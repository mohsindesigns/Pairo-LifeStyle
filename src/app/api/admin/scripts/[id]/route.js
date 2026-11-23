import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import dbConnect from "@/lib/db";
import Script from "@/models/Script";
import { can } from "@/lib/rbac";
import { logAction } from "@/lib/audit";
import { stripServerFields } from "../helpers";

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
        const updateData = stripServerFields(body);

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
        // A trashed script can be edited but never switched on; restore it first.
        if (existing.isDeleted) updateData.isActive = false;

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

// DELETE            -> move to Trash (also pauses it, so the storefront stops injecting it at once)
// DELETE ?permanent=true -> delete for good; only allowed for a script already in the Trash
export async function DELETE(req, { params }) {
    const { id } = await params;
    const session = await getServerSession(authOptions);
    if (!session || !session.user.isStaff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    if (!can(session.user, "scripts.delete")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    await dbConnect();
    try {
        const permanent = new URL(req.url).searchParams.get("permanent") === "true";
        const script = await Script.findById(id);
        if (!script) return NextResponse.json({ error: "Script not found" }, { status: 404 });

        if (!permanent) {
            if (script.isDeleted) return NextResponse.json({ message: "Script already in the Trash" });
            await Script.updateOne(
                { _id: id },
                {
                    $set: { isDeleted: true, deletedAt: new Date(), isActive: false, updatedBy: session.user.id },
                    $push: { auditLog: { action: "TRASH", by: session.user.id, at: new Date() } },
                }
            );
            await logAction(req, session, 'TRASH_SCRIPT', 'script', {
                before: script,
                message: `Moved script to Trash: ${script.name}`
            });
            return NextResponse.json({ message: "Script moved to Trash" });
        }

        // Atomic re-check so a live script can never be hard-deleted in one step.
        const deleted = await Script.findOneAndDelete({ _id: id, isDeleted: true });
        if (!deleted) {
            return NextResponse.json({ error: "Move the script to the Trash before deleting it permanently." }, { status: 409 });
        }

        await logAction(req, session, 'DELETE_SCRIPT', 'script', {
            before: script,
            message: `Permanently deleted script: ${script.name}`
        });

        return NextResponse.json({ message: "Script permanently deleted" });
    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// PATCH { action: "restore" } -> bring a script back from the Trash, paused (never live by surprise).
export async function PATCH(req, { params }) {
    const { id } = await params;
    const session = await getServerSession(authOptions);
    if (!session || !session.user.isStaff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    if (!can(session.user, "scripts.edit")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    await dbConnect();
    try {
        const body = await req.json().catch(() => ({}));
        if (body?.action !== "restore") return NextResponse.json({ error: "Unsupported action" }, { status: 400 });

        const script = await Script.findOneAndUpdate(
            { _id: id, isDeleted: true },
            {
                $set: { isDeleted: false, deletedAt: null, isActive: false, updatedBy: session.user.id },
                $push: { auditLog: { action: "RESTORE", by: session.user.id, at: new Date() } },
            },
            { returnDocument: "after" }
        );
        if (!script) {
            const exists = await Script.exists({ _id: id });
            return exists
                ? NextResponse.json({ message: "Script is not in the Trash" })
                : NextResponse.json({ error: "Script not found" }, { status: 404 });
        }

        await logAction(req, session, 'RESTORE_SCRIPT', 'script', {
            after: script,
            message: `Restored script from Trash (paused): ${script.name}`
        });

        return NextResponse.json({ message: "Script restored", script });
    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
