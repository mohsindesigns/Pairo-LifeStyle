import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import dbConnect from "@/lib/db";
import Script from "@/models/Script";
import { can } from "@/lib/rbac";
import { logAction } from "@/lib/audit";

export async function GET(req) {
    const session = await getServerSession(authOptions);
    if (!session || !session.user.isStaff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    if (!can(session.user, "scripts.view")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    await dbConnect();
    try {
        const scripts = await Script.find().sort({ priority: 1, createdAt: -1 }).lean();
        return NextResponse.json(scripts);
    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(req) {
    const session = await getServerSession(authOptions);
    if (!session || !session.user.isStaff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    if (!can(session.user, "scripts.create")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    await dbConnect();
    try {
        const body = await req.json();
        const { name, type, location, code, templateConfig, isActive } = body;

        // 1. Script Size Validation (Max 100KB per script)
        const scriptSize = JSON.stringify(body).length;
        if (scriptSize > 102400) {
            return NextResponse.json({ error: "Script payload exceeds 100KB limit." }, { status: 400 });
        }

        // 2. Basic Dangerous Pattern Detection
        // Note: <iframe> is intentionally allowed — standard integrations (GTM noscript
        // fallback, YouTube embeds, payment provider widgets) legitimately require it,
        // and this endpoint already requires scripts.create/scripts.edit permission.
        const dangerousPatterns = [/document\.write\(/i];
        if (code && dangerousPatterns.some(p => p.test(code))) {
            return NextResponse.json({ error: "Script contains prohibited patterns (document.write)." }, { status: 400 });
        }

        if (!name || !type || !location) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        const slug = name.toLowerCase().replace(/[^a-z0-9]/g, '-');
        
        const { auditLog, version, ...cleanBody } = body;
        
        const newScript = await Script.create({
            ...cleanBody,
            slug,
            createdBy: session.user.id,
            updatedBy: session.user.id,
            auditLog: [{ action: 'CREATE', by: session.user.id, at: new Date() }]
        });

        await logAction(req, session, 'CREATE_SCRIPT', 'script', {
            after: newScript,
            message: `Created new tracking script: ${name}`
        });

        return NextResponse.json(newScript, { status: 201 });
    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
