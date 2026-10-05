import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import dbConnect from "@/lib/db";
import Page from "@/models/Page";
import { can } from "@/lib/rbac";
import { logAction } from "@/lib/audit";
import { validateTemplateSections } from "@/lib/templates";
import { revalidatePath } from "next/cache";

export async function GET(req, { params }) {
    const { id } = await params;
    const session = await getServerSession(authOptions);
    if (!session || !session.user.isStaff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    if (!can(session.user, "pages.view")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    await dbConnect();
    try {
        const mongoose = (await import("mongoose")).default;
        const page = mongoose.isValidObjectId(id)
            ? await Page.findById(id).lean()
            : await Page.findOne({ slug: id }).lean();
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
        const mongoose = (await import("mongoose")).default;
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

        const existing = mongoose.isValidObjectId(id)
            ? await Page.findById(id)
            : await Page.findOne({ slug: id });
        if (!existing) return NextResponse.json({ error: "Page not found" }, { status: 404 });

        // Enforce Template Immutability (locked template check)
        const existingTemplate = existing.template || (existing.slug === "home" ? "home" : existing.slug === "about" ? "about" : existing.slug === "contact" ? "contact" : "default");
        if (body.template && body.template !== existingTemplate) {
            return NextResponse.json({ error: "Page template is locked and cannot be modified after creation." }, { status: 400 });
        }

        // Validate sections against template constraints
        const { isValid, error } = validateTemplateSections(existingTemplate, body.sections);
        if (!isValid) {
            return NextResponse.json({ error }, { status: 400 });
        }

        // Prevent collisions with reserved system routes and handle slug changes
        const { isReservedPath, registerRedirect } = await import("@/lib/redirect-resolver");
        let targetSlug = existing.slug;

        if (body.slug) {
            const cleanSlug = body.slug.toLowerCase().trim().replace(/[^a-z0-9-_]+/g, '-');
            
            if (existing.isSystem) {
                // System pages (e.g. contact, about, home) have locked system slugs that power core routes
                if (cleanSlug !== existing.slug) {
                    return NextResponse.json({ error: "System page slug cannot be modified" }, { status: 400 });
                }
                targetSlug = existing.slug;
            } else if (cleanSlug !== existing.slug) {
                // Non-system pages: check for collisions only if the slug is actually changing
                if (isReservedPath(cleanSlug)) {
                    return NextResponse.json({ error: "Slug collides with a reserved system route" }, { status: 400 });
                }

                const slugCollision = await Page.findOne({ slug: cleanSlug, _id: { $ne: existing._id } });
                if (slugCollision) {
                    return NextResponse.json({ error: "A page with this slug already exists" }, { status: 400 });
                }

                // Register 301 redirect if slug changed
                if (existing.slug) {
                    await registerRedirect(`/${existing.slug}`, `/${cleanSlug}`);
                }
                targetSlug = cleanSlug;
            }
        }

        const { _id, __v, createdAt, updatedAt, ...updateData } = body;

        const updated = await Page.findByIdAndUpdate(existing._id, {
            ...updateData,
            slug: targetSlug,
            template: existingTemplate, // Force template to be immutable
            isSystem: existing.isSystem, // Force isSystem to be immutable
            updatedBy: session.user.id
        }, { returnDocument: 'after' });

        await logAction(req, session, 'UPDATE_PAGE', 'page', {
            before: existing,
            after: updated,
            message: `Updated page: ${updated.title}`
        });

        // Trigger cache revalidation
        if (existing.slug && existing.slug !== updated.slug) {
            revalidatePath(existing.slug === 'home' ? '/' : `/${existing.slug}`);
        }
        if (updated.slug === 'home') {
            revalidatePath('/');
        } else {
            revalidatePath(`/${updated.slug}`);
        }
        revalidatePath('/', 'layout');

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

        // Trigger cache revalidation
        if (page.slug === 'home') {
            revalidatePath('/');
        } else {
            revalidatePath(`/${page.slug}`);
        }
        revalidatePath('/', 'layout');

        return NextResponse.json({ message: "Page deleted" });
    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
