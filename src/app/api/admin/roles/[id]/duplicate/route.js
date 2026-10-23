import { getServerSession } from "next-auth";
import { authOptions } from "../../../../auth/[...nextauth]/route";
import dbConnect from "@/lib/db";
import Role from "@/models/Role";
import { can, ALL_PERMISSIONS } from "@/lib/rbac";
import { logAction } from "@/lib/audit";
import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { plainPermissions, uniqueRoleCopyName, uniqueRoleCopySlug } from "../../helpers";

// POST /api/admin/roles/[id]/duplicate: copies a role's description and permissions into a
// new custom role named "<name> (Copy)" with a unique "<slug>-copy" slug.
export async function POST(req, { params }) {
    const session = await getServerSession(authOptions);
    if (!session || !session.user.isStaff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    if (!can(session.user, "staff.manage_roles")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { id } = await params;
    if (!mongoose.isValidObjectId(id)) return NextResponse.json({ error: "Role not found" }, { status: 404 });
    await dbConnect();

    try {
        const source = await Role.findById(id).lean();
        if (!source) return NextResponse.json({ error: "Role not found" }, { status: 404 });

        // Super Admin has no stored permissions (it bypasses every check); its copy is an
        // ordinary role with every listed permission ticked.
        const permissions = source.slug === "super-admin"
            ? plainPermissions(ALL_PERMISSIONS)
            : plainPermissions(source.permissions);

        const all = await Role.find({}).select("name slug").lean();
        const name = uniqueRoleCopyName(source.name, all.map((r) => r.name));
        const slug = uniqueRoleCopySlug(source.slug, all.map((r) => r.slug));

        const role = await Role.create({
            name,
            slug,
            description: source.description || "",
            permissions,
            isSystem: false,
            isActive: true,
        });

        await logAction(req, session, 'CREATE_ROLE', 'roles', {
            after: role,
            message: `Duplicated role "${source.name}" as "${name}"`
        });

        return NextResponse.json(role, { status: 201 });
    } catch (error) {
        if (error?.code === 11000) return NextResponse.json({ error: "Could not create a unique copy, try again" }, { status: 409 });
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
