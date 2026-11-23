import { getServerSession } from "next-auth";
import { authOptions } from "../../../auth/[...nextauth]/route";
import dbConnect from "@/lib/db";
import Role from "@/models/Role";
import { can } from "@/lib/rbac";
import { logAction } from "@/lib/audit";
import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { plainPermissions, roleRemovalError, parseRoleDeleteMode } from "../helpers";
import { roleUsage } from "../usage";

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// PUT { permissions, description, name } edits a role; PUT { isDeleted: false } restores
// a role from the Trash.
export async function PUT(req, { params }) {
    const session = await getServerSession(authOptions);
    if (!session || !session.user.isStaff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    if (!can(session.user, "staff.manage_roles")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { id } = await params;
    if (!mongoose.isValidObjectId(id)) return NextResponse.json({ error: "Role not found" }, { status: 404 });
    await dbConnect();

    try {
        const body = await req.json().catch(() => ({}));
        const { permissions, description } = body;
        const name = typeof body.name === "string" ? body.name.trim() : "";

        const role = await Role.findById(id);
        if (!role) return NextResponse.json({ error: "Role not found" }, { status: 404 });

        if (body.isDeleted === false) {
            if (role.isDeleted) {
                role.isDeleted = false;
                role.deletedAt = null;
                await role.save();
                await logAction(req, session, 'RESTORE_ROLE', 'roles', {
                    message: `Restored role from the Trash: ${role.name}`
                });
            }
            return NextResponse.json(role);
        }

        if (role.isDeleted) {
            return NextResponse.json({ error: "This role is in the Trash. Restore it before making changes." }, { status: 409 });
        }

        // Prevent modification of critical system slug but allow name/desc/permissions
        const before = JSON.parse(JSON.stringify(role));

        if (name && !role.isSystem && name !== role.name) {
            const taken = await Role.findOne({
                _id: { $ne: role._id },
                name: { $regex: `^${escapeRegex(name)}$`, $options: "i" },
            }).select("_id").lean();
            if (taken) return NextResponse.json({ error: "Another role already uses this name" }, { status: 400 });
            role.name = name;
        }
        if (typeof description === "string") role.description = description.trim();
        if (permissions && typeof permissions === "object") role.permissions = plainPermissions(permissions);

        await role.save();

        await logAction(req, session, 'UPDATE_ROLE', 'roles', {
            before,
            after: role,
            message: `Updated permissions for role: ${role.name}`
        });

        return NextResponse.json(role);
    } catch (error) {
        if (error?.code === 11000) return NextResponse.json({ error: "Another role already uses this name" }, { status: 400 });
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// DELETE ?mode=trash (default) moves a custom, unused role to the Trash;
// DELETE ?mode=permanent removes a role that is already in the Trash.
// System roles and roles still assigned to any user (trashed users included) are refused.
export async function DELETE(req, { params }) {
    const session = await getServerSession(authOptions);
    if (!session || !session.user.isStaff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    if (!can(session.user, "staff.manage_roles")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { id } = await params;
    if (!mongoose.isValidObjectId(id)) return NextResponse.json({ error: "Role not found" }, { status: 404 });
    const mode = parseRoleDeleteMode(new URL(req.url).searchParams.get("mode"));
    await dbConnect();

    try {
        const role = await Role.findById(id).lean();
        if (!role) return NextResponse.json({ error: "Role not found" }, { status: 404 });

        const usage = (await roleUsage([id])).get(String(id)) || { active: 0, trashed: 0 };
        const error = roleRemovalError(role, usage);
        if (error) return NextResponse.json({ error, staffCount: usage.active, trashedStaffCount: usage.trashed }, { status: 400 });

        if (mode === "permanent") {
            const deleted = await Role.findOneAndDelete({ _id: id, isDeleted: true, isSystem: { $ne: true } });
            if (!deleted) {
                return NextResponse.json({ error: "Move the role to the Trash before deleting it permanently" }, { status: 409 });
            }
            await logAction(req, session, 'DELETE_ROLE', 'roles', {
                before: role,
                message: `Permanently deleted role: ${role.name}`
            });
            return NextResponse.json({ message: "Role deleted permanently" });
        }

        if (!role.isDeleted) {
            await Role.updateOne({ _id: id }, { $set: { isDeleted: true, deletedAt: new Date() } });
            await logAction(req, session, 'TRASH_ROLE', 'roles', {
                message: `Moved role to the Trash: ${role.name}`
            });
        }

        return NextResponse.json({ message: "Role moved to the Trash" });
    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
