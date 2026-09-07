import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import dbConnect from "@/lib/db";
import Script from "@/models/Script";
import { can } from "@/lib/rbac";
import { logAction } from "@/lib/audit";

export async function GET(req, { params }) {
    const { id } = await params;
    const session = await getServerSession(authOptions);
    if (!session || !session.user.isStaff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    if (!can(session.user, "scripts.view")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    await dbConnect();
    try {
        const script = await Script.findById(id).lean();
        if (!script) return NextResponse.json({ error: "Script not found" }, { status: 404 });
        return NextResponse.json(script);
    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PUT(req, { params }) {
    const { id } = await params;
    const session = await getServerSession(authOptions);
    if (!session || !session.user.isStaff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    if (!can(session.user, "scripts.edit")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    await dbConnect();
    try {
        const body = await req.json();
        const { auditLog, version, ...updateData } = body;

        const scriptSize = JSON.stringify(body).length;
        if (scriptSize > 102400) {
            return NextResponse.json({ error: "Script payload exceeds 100KB limit." }, { status: 400 });
        }

        const dangerousPatterns = [/document\.write\(/i];
        if (updateData.code && dangerousPatterns.some(p => p.test(updateData.code))) {
            return NextResponse.json({ error: "Script contains prohibited patterns (document.write)." }, { status: 400 });
        }

        const existing = await Script.findById(id);
        if (!existing) return NextResponse.json({ error: "Script not found" }, { status: 404 });

        const updated = await Script.findByIdAndUpdate(id, {
            ...updateData,
            updatedBy: session.user.id,
            $inc: { version: 1 },
            $push: { auditLog: { action: 'UPDATE', by: session.user.id, at: new Date() } }
        }, { returnDocument: 'after' });

        await logAction(req, session, 'UPDATE_SCRIPT', 'script', {
            before: existing,
            after: updated,
            message: `Updated script: ${updated.name}`
        });

        return NextResponse.json(updated);
    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(req, { params }) {
    const { id } = await params;
    const session = await getServerSession(authOptions);
    if (!session || !session.user.isStaff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    if (!can(session.user, "scripts.delete")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    await dbConnect();
    try {
        const script = await Script.findById(id);
        if (!script) return NextResponse.json({ error: "Script not found" }, { status: 404 });

        await Script.findByIdAndDelete(id);

        await logAction(req, session, 'DELETE_SCRIPT', 'script', {
            before: script,
            message: `Deleted script: ${script.name}`
        });

        return NextResponse.json({ message: "Script deleted" });
    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
