import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import dbConnect from "@/lib/db";
import AuditLog from "@/models/AuditLog";
import Staff from "@/models/Staff";
import { can } from "@/lib/rbac";
import { NextResponse } from "next/server";

export async function GET(req) {
    const session = await getServerSession(authOptions);
    if (!session || !session.user.isStaff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Usually only Super Admin or high-level Admin can see logs
    if (!can(session.user, "settings.view")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    await dbConnect();
    try {
        // Optional ?q= search across user (name/email), action, target (resource/resourceId)
        // and message. The term is regex-escaped so it is matched literally.
        const q = (new URL(req.url).searchParams.get("q") || "").trim().slice(0, 200);
        const filter = {};
        if (q) {
            const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
            const staffMatches = await Staff.find({ $or: [{ name: rx }, { email: rx }] }).select("_id").lean();
            filter.$or = [
                { action: rx },
                { resource: rx },
                { resourceId: rx },
                { "details.message": rx },
            ];
            if (staffMatches.length) filter.$or.push({ staffId: { $in: staffMatches.map((s) => s._id) } });
        }

        const logs = await AuditLog.find(filter)
            .populate('staffId', 'name email')
            .sort({ timestamp: -1 })
            .limit(100)
            .lean();
        
        return NextResponse.json(logs);
    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
