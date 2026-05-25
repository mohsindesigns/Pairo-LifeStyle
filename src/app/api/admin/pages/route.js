import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import dbConnect from "@/lib/db";
import Page from "@/models/Page";
import { can } from "@/lib/rbac";
import { logAction } from "@/lib/audit";

export async function GET(req) {
    const session = await getServerSession(authOptions);
    if (!session || !session.user.isStaff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    if (!can(session.user, "pages.view")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    await dbConnect();
    try {
        const pages = await Page.find({ tenantId: 'DEFAULT_STORE' }).sort({ createdAt: -1 }).lean();
        return NextResponse.json(pages);
    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(req) {
    const session = await getServerSession(authOptions);
    if (!session || !session.user.isStaff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    if (!can(session.user, "pages.create")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    await dbConnect();
    try {
        const body = await req.json();
        const { title, slug, description } = body;

        if (!title || !slug) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        // Prevent collisions with reserved system routes
        const { isReservedPath } = await import("@/lib/redirect-resolver");
        if (isReservedPath(slug)) {
            return NextResponse.json({ error: "Slug collides with a reserved system route" }, { status: 400 });
        }

        const existing = await Page.findOne({ slug, tenantId: 'DEFAULT_STORE' });
        if (existing) {
            return NextResponse.json({ error: "Page with this slug already exists" }, { status: 400 });
        }

        const newPage = await Page.create({
            ...body,
            createdBy: session.user.id,
            updatedBy: session.user.id,
            tenantId: 'DEFAULT_STORE'
        });

        await logAction(req, session, 'CREATE_PAGE', 'page', {
            after: newPage,
            message: `Created new page: ${title}`
        });

        return NextResponse.json(newPage, { status: 201 });
    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
