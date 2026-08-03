import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../auth/[...nextauth]/route";
import dbConnect from "@/lib/db";
import Media from "@/models/Media";
import { deleteFromStorage } from "@/lib/storage";
import { can } from "@/lib/rbac";

// GET /api/admin/media/[id] — Get single media item with usage refs
export async function GET(req, { params }) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user.isStaff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user, "media.manage")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await dbConnect();
  const { id } = await params;
  const media = await Media.findById(id).lean();
  if (!media) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ success: true, media });
}

// PATCH /api/admin/media/[id] — Update metadata (alt, title, tags, caption)
export async function PATCH(req, { params }) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user.isStaff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user, "media.manage")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await dbConnect();
  const { id } = await params;
  const body = await req.json();

  const allowed = ['title', 'altText', 'caption', 'tags', 'folder'];
  const updates = {};
  allowed.forEach(key => {
    if (body[key] !== undefined) updates[key] = body[key];
  });

  // Handle restore from trash
  if (body.restore) {
    updates.isDeleted = false;
    updates.deletedAt = null;
  }

  const media = await Media.findByIdAndUpdate(id, updates, { new: true });
  if (!media) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ success: true, media });
}

async function cleanMediaReferences(media) {
  const url = media.url;
  if (!media.usageRefs || media.usageRefs.length === 0) return;

  try {
    const Product = (await import("@/models/Product")).default;
    const Category = (await import("@/models/Category")).default;
    const Blog = (await import("@/models/Blog")).default;
    const Page = (await import("@/models/Page")).default;
    const SiteConfig = (await import("@/models/SiteConfig")).default;

    for (const ref of media.usageRefs) {
      try {
        const { entityType, entityId, fieldName } = ref;
        if (!entityId) continue;

        if (entityType === "Product") {
          const prod = await Product.findById(entityId);
          if (prod) {
            let modified = false;
            if (fieldName === "images" && Array.isArray(prod.images)) {
              const beforeLen = prod.images.length;
              prod.images = prod.images.filter(img => img !== url);
              if (prod.images.length !== beforeLen) modified = true;
            } else if (fieldName === "image") {
              prod.image = "";
              modified = true;
            } else if (fieldName.startsWith("seo.")) {
              const seoField = fieldName.split(".")[1];
              if (prod.seo) {
                prod.seo[seoField] = "";
                modified = true;
              }
            }
            if (modified) await prod.save();
          }
        } else if (entityType === "Category") {
          const cat = await Category.findById(entityId);
          if (cat) {
            let modified = false;
            if (fieldName === "image") {
              cat.image = "";
              modified = true;
            } else if (fieldName.startsWith("seo.")) {
              const seoField = fieldName.split(".")[1];
              if (cat.seo) {
                cat.seo[seoField] = "";
                modified = true;
              }
            }
            if (modified) await cat.save();
          }
        } else if (entityType === "Blog") {
          const blog = await Blog.findById(entityId);
          if (blog) {
            let modified = false;
            if (fieldName === "image") {
              blog.image = "";
              modified = true;
            } else if (fieldName === "featuredProductData.image") {
              if (blog.featuredProductData) {
                blog.featuredProductData.image = "";
                modified = true;
              }
            } else if (fieldName.startsWith("seo.")) {
              const seoField = fieldName.split(".")[1];
              if (blog.seo) {
                blog.seo[seoField] = "";
                modified = true;
              }
            }
            if (modified) await blog.save();
          }
        } else if (entityType === "Page") {
          const page = await Page.findById(entityId);
          if (page) {
            let modified = false;
            if (fieldName === "image") {
              page.image = "";
              modified = true;
            } else if (fieldName.startsWith("seo.")) {
              const seoField = fieldName.split(".")[1];
              if (page.seo) {
                page.seo[seoField] = "";
                modified = true;
              }
            }
            if (modified) await page.save();
          }
        } else if (entityType === "SiteConfig") {
          const siteConfig = await SiteConfig.findById(entityId);
          if (siteConfig) {
            let modified = false;
            if (fieldName === "headerConfig.logoUrl") {
              siteConfig.headerConfig.logoUrl = "";
              modified = true;
            } else if (fieldName === "footerConfig.logoUrl") {
              siteConfig.footerConfig.logoUrl = "";
              modified = true;
            }
            if (modified) await siteConfig.save();
          }
        }
      } catch (e) {
        console.error(`[Media Cleanup Error] Failed to clean reference for ${ref.entityType} ${ref.entityId}:`, e);
      }
    }
  } catch (err) {
    console.error("[Media Cleanup Import Error]", err);
  }
}

// DELETE /api/admin/media/[id] — Soft delete, or permanent if ?permanent=true
export async function DELETE(req, { params }) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user.isStaff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user, "media.manage")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await dbConnect();
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const permanent = searchParams.get('permanent') === 'true';

  const media = await Media.findById(id);
  if (!media) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (permanent) {
    // Perform references cleanup so pages referencing it do not break
    await cleanMediaReferences(media);

    // Delete from Cloudinary / local filesystem
    if (media.publicId) {
      await deleteFromStorage(media.publicId);
    }
    await Media.findByIdAndDelete(id);
    return NextResponse.json({ success: true, deleted: true });
  }

  // Soft delete
  await Media.findByIdAndUpdate(id, {
    isDeleted: true,
    deletedAt: new Date(),
  });
  return NextResponse.json({ success: true, trashed: true });
}

