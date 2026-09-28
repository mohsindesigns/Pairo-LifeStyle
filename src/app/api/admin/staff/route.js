import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import dbConnect from "@/lib/db";
import Staff from "@/models/Staff";
import Role from "@/models/Role";
import { can } from "@/lib/rbac";
import { logAction } from "@/lib/audit";
import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";

export async function GET(req) {
    const session = await getServerSession(authOptions);
    if (!session || !session.user.isStaff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    if (!can(session.user, "staff.view")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    await dbConnect();
    try {
        const staff = await Staff.find()
            .populate('roleId', 'name slug')
            .select('-password')
            .sort({ createdAt: -1 })
            .lean();
        
        return NextResponse.json(staff);
    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(req) {
    const session = await getServerSession(authOptions);
    if (!session || !session.user.isStaff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    if (!can(session.user, "staff.create")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    await dbConnect();
    try {
        const body = await req.json();
        const { name, email, password, roleId } = body;

        // Validation
        if (!name || !email || !password || !roleId) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        const existing = await Staff.findOne({ email });
        if (existing) return NextResponse.json({ error: "Staff email already exists" }, { status: 400 });

        // Security: creating an account with an elevated (super-admin) role is a
        // staff.manage_roles action, not merely staff.create — otherwise anyone who can
        // create staff accounts could hand out full super-admin access.
        const targetRole = await Role.findById(roleId);
        if (!targetRole) return NextResponse.json({ error: "Role not found" }, { status: 400 });
        if (targetRole.slug === 'super-admin' && !can(session.user, "staff.manage_roles")) {
            return NextResponse.json({ error: "You don't have permission to assign the Super Admin role" }, { status: 403 });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const newStaff = await Staff.create({
            name,
            email,
            password: hashedPassword,
            roleId,
            status: 'Active'
        });

        await logAction(req, session, 'CREATE_STAFF', 'staff', {
            after: { id: newStaff._id, name, email, roleId },
            message: `Created new staff member: ${email}`
        });

        return NextResponse.json({ message: "Staff created", id: newStaff._id }, { status: 201 });
    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
