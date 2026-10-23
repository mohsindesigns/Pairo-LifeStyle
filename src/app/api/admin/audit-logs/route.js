import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import dbConnect from "@/lib/db";
import AuditLog from "@/models/AuditLog";
import Staff from "@/models/Staff";
import { can } from "@/lib/rbac";
import { redactSecrets } from "@/lib/audit";
import { NextResponse } from "next/server";
import { parseAuditParams, buildAuditFilter, totalPages, escapeRegex } from "./query";

// Entries written before secrets were redacted at write time (e.g. UPDATE_STAFF kept a bcrypt hash) are cleaned here.
const cleanLog = (log) => ({ ...log, details: redactSecrets(log.details) });

// GET /api/admin/audit-logs (read-only)
//   ?q=        search user name/email, action, target, target id, message
//   ?action=   exact action (e.g. UPDATE_PAGE)   ?resource= exact target (e.g. page)
//   ?from=&to= YYYY-MM-DD (inclusive, UTC days)
//   ?page=N    -> { logs, total, page, pages, limit, facets: { actions, resources } }
//   ?export=1  -> same shape, up to 5000 rows, for the CSV export
//   (no page)  -> legacy: plain array of the latest 100 matching logs
export async function GET(req) {
    const session = await getServerSession(authOptions);
    if (!session || !session.user.isStaff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Usually only Super Admin or high-level Admin can see logs
    if (!can(session.user, "settings.view")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    await dbConnect();
    try {
        const params = parseAuditParams(new URL(req.url).searchParams);
        let staffIds = [];
        if (params.q) {
            const rx = new RegExp(escapeRegex(params.q), "i");
            staffIds = (await Staff.find({ $or: [{ name: rx }, { email: rx }] }).select("_id").lean()).map((s) => s._id);
        }
        const filter = buildAuditFilter(params, staffIds);

        if (!params.paginated) {
            const logs = await AuditLog.find(filter)
                .populate('staffId', 'name email')
                .sort({ timestamp: -1 })
                .limit(100)
                .lean();
            return NextResponse.json(logs.map(cleanLog));
        }

        const total = await AuditLog.countDocuments(filter);
        const pages = totalPages(total, params.limit);
        const page = Math.min(params.page, pages);
        const [logs, actions, resources] = await Promise.all([
            AuditLog.find(filter)
                .populate('staffId', 'name email')
                .sort({ timestamp: -1 })
                .skip((page - 1) * params.limit)
                .limit(params.limit)
                .lean(),
            params.isExport ? [] : AuditLog.distinct("action"),
            params.isExport ? [] : AuditLog.distinct("resource"),
        ]);

        return NextResponse.json({
            logs: logs.map(cleanLog),
            total,
            page,
            pages,
            limit: params.limit,
            facets: {
                actions: actions.filter(Boolean).sort(),
                resources: resources.filter(Boolean).sort(),
            },
        });
    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
