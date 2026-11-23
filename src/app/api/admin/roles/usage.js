import mongoose from "mongoose";
import Staff from "@/models/Staff";

// Staff counts per role: Map<roleId string, { active, trashed }>. "active" = not trashed.
export async function roleUsage(roleIds = null) {
    const match = roleIds ? { roleId: { $in: roleIds.map((id) => new mongoose.Types.ObjectId(String(id))) } } : {};
    const rows = await Staff.aggregate([
        { $match: match },
        { $group: { _id: { roleId: "$roleId", trashed: { $eq: ["$isDeleted", true] } }, n: { $sum: 1 } } },
    ]);
    const usage = new Map();
    for (const row of rows) {
        const key = String(row._id.roleId);
        const entry = usage.get(key) || { active: 0, trashed: 0 };
        if (row._id.trashed) entry.trashed += row.n;
        else entry.active += row.n;
        usage.set(key, entry);
    }
    return usage;
}
