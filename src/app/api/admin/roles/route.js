import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import dbConnect from "@/lib/db";
import Role from "@/models/Role";
import { can } from "@/lib/rbac";
import { logAction } from "@/lib/audit";
import { NextResponse } from "next/server";
import { slugifyRoleName, plainPermissions } from "./helpers";
import { roleUsage } from "./usage";

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export async function GET(req) {
    const session = await getServerSession(authOptions);
    if (!session || !session.user.isStaff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Note: Staff management permission usually covers role viewing
    if (!can(session.user, "staff.manage_roles") && !can(session.user, "staff.view")) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // ?withTrashed=1 (Roles screen) also returns trashed roles, flagged with isDeleted.
    // Role pickers (Add/Edit user) only get roles that can be assigned.
    const withTrashed = new URL(req.url).searchParams.get("withTrashed") === "1";

    await dbConnect();
    try {
        const roles = await Role.find(withTrashed ? {} : { isDeleted: { $ne: true } })
            .sort({ isSystem: -1, name: 1 })
            .lean();
        const usage = await roleUsage();
        return NextResponse.json(roles.map((role) => {
            const u = usage.get(String(role._id)) || { active: 0, trashed: 0 };
            return { ...role, staffCount: u.active, trashedStaffCount: u.trashed };
        }));
    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(req) {
    const session = await getServerSession(authOptions);
    if (!session || !session.user.isStaff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    if (!can(session.user, "staff.manage_roles")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    await dbConnect();
    try {
        const body = await req.json().catch(() => ({}));
        const name = typeof body.name === "string" ? body.name.trim() : "";
        const description = typeof body.description === "string" ? body.description.trim() : "";
        const permissions = plainPermissions(body.permissions);

        if (!name) return NextResponse.json({ error: "Role name is required" }, { status: 400 });
        const slug = slugifyRoleName(name);
        if (!slug) return NextResponse.json({ error: "Role name must contain letters or numbers" }, { status: 400 });

        // Names and slugs are unique across all roles, trashed ones included.
        const existing = await Role.findOne({
            $or: [{ slug }, { name: { $regex: `^${escapeRegex(name)}$`, $options: "i" } }],
        }).select("isDeleted").lean();
        if (existing) {
            return NextResponse.json({
                error: existing.isDeleted
                    ? "A role with this name is in the Trash. Restore it or delete it permanently first."
                    : "Role already exists"
            }, { status: 400 });
        }

        const newRole = await Role.create({
            name,
            slug,
            description,
            permissions,
            isSystem: false
        });

        await logAction(req, session, 'CREATE_ROLE', 'roles', {
            after: newRole,
            message: `Created new role: ${name}`
        });

        return NextResponse.json(newRole, { status: 201 });
    } catch (error) {
        if (error?.code === 11000) return NextResponse.json({ error: "Role already exists" }, { status: 400 });
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
