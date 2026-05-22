import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import dbConnect from "@/lib/db";
import Staff from "@/models/Staff";
import Customer from "@/models/Customer";
import Role from "@/models/Role";
import bcrypt from "bcryptjs";

export const authOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "text" },
        password: { label: "Password", type: "password" },
        loginType: { label: "Type", type: "text" } // 'staff' or 'customer'
      },
      async authorize(credentials) {
        await dbConnect();

        // Try Staff first
        const staff = await Staff.findOne({ email: credentials.email }).populate('roleId').lean();
        if (staff) {
            if (staff.status !== 'Active') {
                throw new Error(staff.status === 'Suspended' ? "Account suspended" : "Account locked");
            }

            const isMatch = await bcrypt.compare(credentials.password, staff.password);
            if (isMatch) {
                // Update Last Login and IP
                const ip = "127.0.0.1"; // Fallback as req is not directly available in this specific authorize scope
                
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
                    isStaff: true 
                };
            }
            // If email matches staff but password fails, we don't fall back to customer for safety
            throw new Error("Invalid staff credentials");
        }

        // Try Customer
        const customer = await Customer.findOne({ email: credentials.email }).lean();
        if (customer) {
            const isMatch = await bcrypt.compare(credentials.password, customer.password);
            if (isMatch) {
                return { 
                    id: customer._id.toString(), 
                    name: customer.name, 
                    email: customer.email, 
                    isStaff: false 
                };
            }
            throw new Error("Invalid customer credentials");
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
        if (user.isStaff) {
            token.role = user.role;
        }
      }

      // Security: Re-verify staff status from DB to prevent suspended users from staying logged in
      if (token?.isStaff && token.id) {
          try {
              await dbConnect();
              const staff = await Staff.findById(token.id).select('status');
              if (!staff || staff.status !== 'Active') {
                  return null; // This will effectively sign the user out
              }
          } catch (e) {
              console.error("JWT Status Check Error:", e.message);
          }
      }

      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id;
        session.user.isStaff = token.isStaff;
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
