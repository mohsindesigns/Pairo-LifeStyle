import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import dbConnect from "@/lib/db";
import ShadowBan from "@/models/ShadowBan";
import Customer from "@/models/Customer";
import Review from "@/models/Review";
import { can } from "@/lib/rbac";
import { logAction } from "@/lib/audit";

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user.isStaff) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!can(session.user, "reviews.moderate")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { value, type, action, reason } = body; // value: email/ip, type: 'email'|'ip', action: 'ban'|'unban'

    if (!value || !type || !action || !["email", "ip"].includes(type) || !["ban", "unban"].includes(action)) {
      return NextResponse.json({ error: "Invalid input parameters" }, { status: 400 });
    }

    await dbConnect();

    const normalizedValue = value.toLowerCase().trim();

    if (action === "ban") {
      // Create shadow ban
      await ShadowBan.findOneAndUpdate(
        { value: normalizedValue },
        { value: normalizedValue, type, reason, createdBy: session.user.id },
        { upsert: true, new: true }
      );

      // If type is email, flag the customer profile
      if (type === "email") {
        await Customer.updateMany(
          { email: normalizedValue },
          { $set: { isShadowBanned: true } }
        );
      }

      // Flag all matching reviews as shadow-banned and move status to Spam silently
      const query = type === "email" ? { customerEmail: normalizedValue } : { ipAddress: normalizedValue };
      await Review.updateMany(query, {
        $set: { shadowBanned: true, status: "Spam" }
      });

      // Audit Log
      await logAction(req, session, "SHADOW_BAN_USER", "reviews", {
        value: normalizedValue,
        type,
        action,
        reason,
        message: `Shadow-banned reviewer: ${normalizedValue} (${type})`
      });
    } else {
      // Unban shadow ban
      await ShadowBan.deleteOne({ value: normalizedValue });

      if (type === "email") {
        await Customer.updateMany(
          { email: normalizedValue },
          { $set: { isShadowBanned: false } }
        );
      }

      const query = type === "email" ? { customerEmail: normalizedValue } : { ipAddress: normalizedValue };
      await Review.updateMany(query, {
        $set: { shadowBanned: false }
      });

      // Audit Log
      await logAction(req, session, "SHADOW_UNBAN_USER", "reviews", {
        value: normalizedValue,
        type,
        action,
        message: `Removed shadow-ban for reviewer: ${normalizedValue}`
      });
    }

    return NextResponse.json({ success: true, message: `Successfully ${action === "ban" ? "shadow-banned" : "un-shadow-banned"} reviewer.` });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
