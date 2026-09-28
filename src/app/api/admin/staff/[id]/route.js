import { getServerSession } from "next-auth";
import { authOptions } from "../../../auth/[...nextauth]/route";
import dbConnect from "@/lib/db";
import Staff from "@/models/Staff";
import { can } from "@/lib/rbac";
import { logAction } from "@/lib/audit";
import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";

export async function GET(req, { params }) {
    const session = await getServerSession(authOptions);
    if (!session || !session.user.isStaff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    if (!can(session.user, "staff.view")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { id } = await params;
    await dbConnect();

    try {
        const staff = await Staff.findById(id).select("-password").populate("roleId").lean();
        if (!staff) return NextResponse.json({ error: "Staff member not found" }, { status: 404 });
        return NextResponse.json(staff);
    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PUT(req, { params }) {
    const session = await getServerSession(authOptions);
    if (!session || !session.user.isStaff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    if (!can(session.user, "staff.edit")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { id } = await params;
    await dbConnect();

    try {
        const body = await req.json();
        const { name, email, roleId, status, password } = body;

        const staff = await Staff.findById(id).populate('roleId');
        if (!staff) return NextResponse.json({ error: "Staff member not found" }, { status: 404 });

        // Security: Prevent suspending yourself or a Super Admin unless you ARE the target
        if (session.user.id === id && status === 'Suspended') {
            return NextResponse.json({ error: "You cannot suspend your own account" }, { status: 400 });
        }

        if (staff.roleId?.slug === 'super-admin' && status === 'Suspended' && session.user.id !== id) {
            return NextResponse.json({ error: "Cannot suspend a Super Admin" }, { status: 400 });
        }

        // Security: Changing a staff member's role is a separate, more sensitive permission
        // than general staff.edit — without this, anyone who can edit staff (e.g. update a
        // name) could hand themselves or anyone else a super-admin role.
        if (roleId && String(staff.roleId?._id || staff.roleId) !== String(roleId) && !can(session.user, "staff.manage_roles")) {
            return NextResponse.json({ error: "You don't have permission to change staff roles" }, { status: 403 });
        }

        const before = JSON.parse(JSON.stringify(staff));

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
            after: staff,
            message: `Updated staff member: ${staff.email}`
        });

        return NextResponse.json({ message: "Staff updated successfully" });
    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(req, { params }) {
    const session = await getServerSession(authOptions);
    if (!session || !session.user.isStaff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    if (!can(session.user, "staff.delete")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { id } = await params;
    await dbConnect();

    try {
        const staff = await Staff.findById(id).populate('roleId');
        if (!staff) return NextResponse.json({ error: "Staff member not found" }, { status: 404 });

        // Security: Prevent self-deletion
        if (session.user.id === id) {
            return NextResponse.json({ error: "You cannot delete your own account" }, { status: 400 });
        }

        // Security: Prevent Super Admin deletion
        if (staff.roleId?.slug === 'super-admin') {
            return NextResponse.json({ error: "Super Admin accounts are protected and cannot be deleted via the API" }, { status: 400 });
        }

        // Protect last active Super Admin?
        // For now, standard delete
        await Staff.findByIdAndDelete(id);

        await logAction(req, session, 'DELETE_STAFF', 'staff', {
            before: staff,
            message: `Deleted staff member: ${staff.email}`
        });

        return NextResponse.json({ message: "Staff member deleted" });
    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
