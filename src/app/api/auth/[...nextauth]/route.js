import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import dbConnect from "@/lib/db";
import Staff from "@/models/Staff";
import Customer from "@/models/Customer";
import Affiliate from "@/models/Affiliate";
import Role from "@/models/Role";
import bcrypt from "bcryptjs";
import { verifyTurnstileToken } from "@/lib/turnstile";
import { rateLimit } from "@/lib/rateLimit";

export const authOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "text" },
        password: { label: "Password", type: "password" },
        loginType: { label: "Type", type: "text" }, // 'staff', 'customer', or 'affiliate'
        turnstileToken: { label: "Turnstile Token", type: "text" }
      },
      async authorize(credentials, req) {
        await dbConnect();

        const cleanEmail = typeof credentials?.email === "string" ? credentials.email.toLowerCase().trim() : "";
        const password = credentials?.password || "";
        const turnstileToken = credentials?.turnstileToken;

        // 1. Rate Limiting (8 login attempts per minute per email/IP)
        const rateLimitResult = await rateLimit(`LOGIN:${cleanEmail || 'UNKNOWN'}`, 8, 60);
        if (!rateLimitResult.success) {
          throw new Error("Too many login attempts. Please wait a minute before trying again.");
        }

        // 2. Cloudflare Turnstile Verification
        const turnstileCheck = await verifyTurnstileToken(turnstileToken);
        if (!turnstileCheck.success) {
          throw new Error(turnstileCheck.error || "Captcha verification failed. Please try again.");
        }

        // 3. Try Staff
        if (!credentials.loginType || credentials.loginType === 'staff') {
            const staff = await Staff.findOne({ email: cleanEmail }).populate('roleId').lean();
            if (staff) {
                if (staff.status !== 'Active') {
                    throw new Error(staff.status === 'Suspended' ? "Account suspended" : "Account locked");
                }

                const isMatch = await bcrypt.compare(password, staff.password);
                if (isMatch) {
                    const ip = "127.0.0.1";
                    await Staff.updateOne(
                        { _id: staff._id },
                        { 
                            $set: { 
                                'security.lastLogin': new Date(),
                                'security.lastLoginIp': ip
                            } 
                        }
                    );

                    return { 
                        id: staff._id.toString(), 
                        name: staff.name, 
                        email: staff.email, 
                        role: staff.roleId, 
                        isStaff: true,
                        isAffiliate: false
                    };
                }
                throw new Error("Invalid staff credentials");
            }
        }

        // 4. Try Affiliate
        if (!credentials.loginType || credentials.loginType === 'affiliate') {
            const affiliate = await Affiliate.findOne({ email: cleanEmail }).lean();
            if (affiliate) {
                if (affiliate.status !== 'Active') {
                    throw new Error("Affiliate account is suspended or inactive");
                }

                const isMatch = await bcrypt.compare(password, affiliate.password);
                if (isMatch) {
                    return {
                        id: affiliate._id.toString(),
                        name: affiliate.name,
                        email: affiliate.email,
                        isStaff: false,
                        isAffiliate: true
                    };
                }
                throw new Error("Invalid affiliate credentials");
            }
        }

        // 5. Try Customer
        if (!credentials.loginType || credentials.loginType === 'customer') {
            const customer = await Customer.findOne({ email: cleanEmail }).lean();
            if (customer) {
                const isMatch = await bcrypt.compare(password, customer.password);
                if (isMatch) {
                    // Block unverified customers
                    if (!customer.emailVerified) {
                        throw new Error("EMAIL_NOT_VERIFIED");
                    }
                    return {
                        id: customer._id.toString(),
                        name: customer.name,
                        email: customer.email,
                        isStaff: false,
                        isAffiliate: false
                    };
                }
                throw new Error("Invalid customer credentials");
            }
        }

        throw new Error("No account found with this email");
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.isStaff = user.isStaff;
        token.isAffiliate = user.isAffiliate || false;
        if (user.isStaff) {
            token.role = user.role;
        }
      }

      // Security: Re-verify staff status from DB to prevent suspended users from staying logged in
      if (token?.isStaff && token.id) {
          try {
              await dbConnect();
              const staff = await Staff.findById(token.id).select('status');
              console.log("[NextAuth] Re-verifying staff:", token.id, "Found:", !!staff, "Status:", staff?.status);
              if (!staff || staff.status !== 'Active') {
                  console.log("[NextAuth] Clearing token because staff is missing or inactive!");
                  return {};
              }
          } catch (e) {
              console.error("JWT Status Check Error:", e.message);
          }
      }

      // Security: Re-verify affiliate status from DB to prevent suspended affiliates from staying logged in
      if (token?.isAffiliate && token.id) {
          try {
              await dbConnect();
              const affiliate = await Affiliate.findById(token.id).select('status');
              console.log("[NextAuth] Re-verifying affiliate:", token.id, "Found:", !!affiliate, "Status:", affiliate?.status);
              if (!affiliate || affiliate.status !== 'Active') {
                  console.log("[NextAuth] Clearing token because affiliate is missing or inactive!");
                  return {};
              }
          } catch (e) {
              console.error("JWT Affiliate Check Error:", e.message);
          }
      }

      return token;
    },
    async session({ session, token }) {
      if (token && token.id) {
        session.user.id = token.id;
        session.user.isStaff = token.isStaff;
        session.user.isAffiliate = token.isAffiliate || false;
        if (token.isStaff) {
            session.user.role = token.role;
        }
      }
      return session;
    }
  },
  pages: {
    signIn: "/login",
  },
  secret: process.env.NEXTAUTH_SECRET,
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
