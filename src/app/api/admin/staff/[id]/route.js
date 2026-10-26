import { getServerSession } from "next-auth";
import { authOptions } from "../../../auth/[...nextauth]/route";
import dbConnect from "@/lib/db";
import Staff from "@/models/Staff";
import Role from "@/models/Role";
import { can } from "@/lib/rbac";
import { logAction } from "@/lib/audit";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { NextResponse } from "next/server";
import {
    SUPER_ADMIN_SLUG,
    STAFF_STATUSES,
    MIN_STAFF_PASSWORD,
    normalizeStaffEmail,
    isValidStaffEmail,
    parseStaffDeleteMode,
    staffTrashError,
    staffPermanentDeleteError,
    staffTrashUpdate,
    staffRestoreUpdate,
    staffRestoreError,
} from "../helpers";

// Active, non-trashed Super Admins other than `excludeId`.
async function countOtherActiveSuperAdmins(excludeId) {
    const role = await Role.findOne({ slug: SUPER_ADMIN_SLUG }).select("_id").lean();
    if (!role) return 0;
    return Staff.countDocuments({
        roleId: role._id,
        status: "Active",
        isDeleted: { $ne: true },
        _id: { $ne: excludeId },
    });
}

const actorRoleSlug = (session) => session?.user?.role?.slug || session?.user?.roleId?.slug || null;

export async function GET(req, { params }) {
    const session = await getServerSession(authOptions);
    if (!session || !session.user.isStaff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    if (!can(session.user, "staff.view")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { id } = await params;
    if (!mongoose.isValidObjectId(id)) return NextResponse.json({ error: "Staff member not found" }, { status: 404 });
    await dbConnect();

    try {
        const staff = await Staff.findById(id).select("-password").populate("roleId").lean();
        if (!staff) return NextResponse.json({ error: "Staff member not found" }, { status: 404 });
        return NextResponse.json(staff);
    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// Restore from the Trash: PUT { isDeleted: false } (needs staff.delete, like trashing).
async function restoreStaff(req, session, id) {
    if (!can(session.user, "staff.delete")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const staff = await Staff.findById(id).populate("roleId");
    if (!staff) return NextResponse.json({ error: "Staff member not found" }, { status: 404 });
    if (!staff.isDeleted) return NextResponse.json({ message: "Staff member is not in the Trash" });

    const restoreError = staffRestoreError({ actorRoleSlug: actorRoleSlug(session), target: staff });
    if (restoreError) return NextResponse.json({ error: restoreError }, { status: 403 });

    await Staff.updateOne({ _id: id, isDeleted: true }, staffRestoreUpdate(staff));

    await logAction(req, session, "RESTORE_STAFF", "staff", {
        message: `Restored staff member from the Trash: ${staff.email}`
    });

    return NextResponse.json({ message: "Staff member restored" });
}

export async function PUT(req, { params }) {
    const session = await getServerSession(authOptions);
    if (!session || !session.user.isStaff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    if (!mongoose.isValidObjectId(id)) return NextResponse.json({ error: "Staff member not found" }, { status: 404 });
    await dbConnect();

    try {
        const body = await req.json().catch(() => ({}));
        if (body?.isDeleted === false) return restoreStaff(req, session, id);

        if (!can(session.user, "staff.edit")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

        const { roleId, status, password } = body;
        const name = typeof body.name === "string" ? body.name.trim() : "";
        const email = normalizeStaffEmail(body.email);

        const staff = await Staff.findById(id).populate('roleId');
        if (!staff) return NextResponse.json({ error: "Staff member not found" }, { status: 404 });

        if (staff.isDeleted) {
            return NextResponse.json({ error: "This user is in the Trash. Restore them before making changes." }, { status: 409 });
        }

        if (status && !STAFF_STATUSES.includes(status)) {
            return NextResponse.json({ error: "Invalid status" }, { status: 400 });
        }

        // Security: Prevent suspending/locking yourself or a Super Admin unless you ARE the target
        if (session.user.id === id && status && status !== 'Active') {
            return NextResponse.json({ error: "You cannot suspend your own account" }, { status: 400 });
        }

        if (staff.roleId?.slug === SUPER_ADMIN_SLUG && status && status !== 'Active' && session.user.id !== id) {
            return NextResponse.json({ error: "Cannot suspend a Super Admin" }, { status: 400 });
        }

        const roleChanging = roleId && String(staff.roleId?._id || staff.roleId) !== String(roleId);

        // Security: Changing a staff member's role is a separate, more sensitive permission
        // than general staff.edit — without this, anyone who can edit staff (e.g. update a
        // name) could hand themselves or anyone else a super-admin role.
        if (roleChanging && !can(session.user, "staff.manage_roles")) {
            return NextResponse.json({ error: "You don't have permission to change staff roles" }, { status: 403 });
        }

        if (roleChanging) {
            const newRole = await Role.findById(roleId).select("isDeleted").lean();
            if (!newRole || newRole.isDeleted) return NextResponse.json({ error: "Role not found" }, { status: 400 });

            // Never demote the last active Super Admin.
            if (staff.roleId?.slug === SUPER_ADMIN_SLUG && staff.status === "Active" && (await countOtherActiveSuperAdmins(staff._id)) < 1) {
                return NextResponse.json({ error: "This is the last active Super Admin; assign the Super Admin role to someone else first" }, { status: 400 });
            }
        }

        // Security: only a Super Admin may set/reset a Super Admin's password — otherwise
        // anyone with staff.edit could take over a super-admin account.
        if (password && staff.roleId?.slug === SUPER_ADMIN_SLUG && actorRoleSlug(session) !== SUPER_ADMIN_SLUG) {
            return NextResponse.json({ error: "Only a Super Admin can reset a Super Admin's password" }, { status: 403 });
        }

        if (password && (typeof password !== "string" || password.length < MIN_STAFF_PASSWORD)) {
            return NextResponse.json({ error: `Password must be at least ${MIN_STAFF_PASSWORD} characters` }, { status: 400 });
        }

        if (email && email !== staff.email) {
            if (!isValidStaffEmail(email)) return NextResponse.json({ error: "Please enter a valid email address" }, { status: 400 });
            const taken = await Staff.findOne({ email, _id: { $ne: staff._id } }).select("_id").lean();
            if (taken) return NextResponse.json({ error: "Another user already uses this email" }, { status: 400 });
        }

        // The audit log must never receive a password hash (it is readable by anyone who can view the log).
        // toJSON (not toObject): it flattens the role's permissions Map, which would otherwise be saved as an empty object.
        const withoutPassword = (doc) => { const { password: _hash, ...rest } = doc.toJSON(); return rest; };
        const before = JSON.parse(JSON.stringify(withoutPassword(staff)));

        if (name) staff.name = name;
        if (email) staff.email = email;
        if (roleId) staff.roleId = roleId;
        if (status) staff.status = status;
        
        if (password) {
            staff.password = await bcrypt.hash(password, 10);
            staff.security.passwordChangedAt = Date.now();
        }

        await staff.save();

        await logAction(req, session, 'UPDATE_STAFF', 'staff', {
            before,
            after: withoutPassword(staff),
            message: `Updated staff member: ${staff.email}${password ? " (password changed)" : ""}`
        });

        return NextResponse.json({ message: "Staff updated successfully" });
    } catch (error) {
        if (error?.code === 11000) return NextResponse.json({ error: "Another user already uses this email" }, { status: 400 });
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// DELETE ?mode=trash (default) moves the user to the Trash: they can't sign in and any live
// session ends (status becomes Suspended). DELETE ?mode=permanent removes a trashed user.
export async function DELETE(req, { params }) {
    const session = await getServerSession(authOptions);
    if (!session || !session.user.isStaff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    if (!can(session.user, "staff.delete")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { id } = await params;
    if (!mongoose.isValidObjectId(id)) return NextResponse.json({ error: "Staff member not found" }, { status: 404 });
    const mode = parseStaffDeleteMode(new URL(req.url).searchParams.get("mode"));
    await dbConnect();

    try {
        const staff = await Staff.findById(id).populate('roleId').lean();
        if (!staff) return NextResponse.json({ error: "Staff member not found" }, { status: 404 });

        const actor = { actorId: session.user.id, actorRoleSlug: actorRoleSlug(session) };

        if (mode === "permanent") {
            const error = staffPermanentDeleteError({ ...actor, target: staff });
            if (error) return NextResponse.json({ error }, { status: staff.isDeleted ? 400 : 409 });

            // Atomic: re-checks that the user is still in the Trash.
            const deleted = await Staff.findOneAndDelete({ _id: id, isDeleted: true });
            if (!deleted) return NextResponse.json({ error: "Move the user to the Trash before deleting them permanently" }, { status: 409 });

            const { password: _pw, ...safe } = staff;
            await logAction(req, session, 'DELETE_STAFF', 'staff', {
                before: safe,
                message: `Permanently deleted staff member: ${staff.email}`
            });
            return NextResponse.json({ message: "Staff member deleted permanently" });
        }

        if (staff.isDeleted) return NextResponse.json({ message: "Staff member is already in the Trash" });

        const isSuperAdmin = staff.roleId?.slug === SUPER_ADMIN_SLUG;
        const otherActiveSuperAdmins = isSuperAdmin ? await countOtherActiveSuperAdmins(staff._id) : 0;
        const error = staffTrashError({ ...actor, target: staff, otherActiveSuperAdmins });
        if (error) return NextResponse.json({ error }, { status: 400 });

        await Staff.updateOne({ _id: id, isDeleted: { $ne: true } }, staffTrashUpdate(staff));

        // Race guard: two Super Admins trashing each other at once must not leave none.
        if (isSuperAdmin) {
            const role = await Role.findOne({ slug: SUPER_ADMIN_SLUG }).select("_id").lean();
            const remaining = role
                ? await Staff.countDocuments({ roleId: role._id, status: "Active", isDeleted: { $ne: true } })
                : 0;
            if (remaining < 1) {
                await Staff.updateOne({ _id: id }, staffRestoreUpdate({ ...staff, statusBeforeTrash: staff.status }));
                return NextResponse.json({ error: "This is the last active Super Admin and cannot be moved to the Trash" }, { status: 400 });
            }
        }

        await logAction(req, session, 'TRASH_STAFF', 'staff', {
            message: `Moved staff member to the Trash: ${staff.email}`
        });

        return NextResponse.json({ message: "Staff member moved to the Trash" });
    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
