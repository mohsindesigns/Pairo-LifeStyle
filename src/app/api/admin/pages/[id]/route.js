import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import dbConnect from "@/lib/db";
import Page from "@/models/Page";
import { can } from "@/lib/rbac";
import { logAction } from "@/lib/audit";

export async function GET(req, { params }) {
    const { id } = await params;
    const session = await getServerSession(authOptions);
    if (!session || !session.user.isStaff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    if (!can(session.user, "pages.view")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    await dbConnect();
    try {
        const page = await Page.findById(id).lean();
        if (!page) return NextResponse.json({ error: "Page not found" }, { status: 404 });
        return NextResponse.json(page);
    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PUT(req, { params }) {
    const { id } = await params;
    const session = await getServerSession(authOptions);
    if (!session || !session.user.isStaff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    if (!can(session.user, "pages.edit")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    await dbConnect();
    try {
        const body = await req.json();
        
        // --- PRODUCTION DATA VALIDATION ---
        if (!body.title || typeof body.title !== 'string') return NextResponse.json({ error: "Invalid Title" }, { status: 400 });
        if (!Array.isArray(body.sections)) return NextResponse.json({ error: "Sections must be an array" }, { status: 400 });
        
        // Validate section structure
        for (const section of body.sections) {
            if (!section.id || !section.type) {
                return NextResponse.json({ error: "Invalid Section Data" }, { status: 400 });
            }
        }

        const existing = await Page.findById(id);
        if (!existing) return NextResponse.json({ error: "Page not found" }, { status: 404 });

        // Prevent collisions with reserved system routes
        const { isReservedPath, registerRedirect } = await import("@/lib/redirect-resolver");
        if (body.slug) {
            if (isReservedPath(body.slug)) {
                return NextResponse.json({ error: "Slug collides with a reserved system route" }, { status: 400 });
            }
        }

        // Register redirect if slug changed
        if (body.slug && existing.slug && existing.slug !== body.slug) {
            await registerRedirect(`/${existing.slug}`, `/${body.slug}`);
        }

        const updated = await Page.findByIdAndUpdate(id, {
            ...body,
            updatedBy: session.user.id
        }, { returnDocument: 'after' });

        await logAction(req, session, 'UPDATE_PAGE', 'page', {
            before: existing,
            after: updated,
            message: `Updated page: ${updated.title}`
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

    if (!can(session.user, "pages.delete")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    await dbConnect();
    try {
        const page = await Page.findById(id);
        if (!page) return NextResponse.json({ error: "Page not found" }, { status: 404 });

        if (page.isSystem) {
            return NextResponse.json({ error: "Cannot delete system pages" }, { status: 400 });
        }

        await Page.findByIdAndDelete(id);

        await logAction(req, session, 'DELETE_PAGE', 'page', {
            before: page,
            message: `Deleted page: ${page.title}`
        });

        return NextResponse.json({ message: "Page deleted" });
    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
