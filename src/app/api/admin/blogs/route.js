import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Blog from "@/models/Blog";
import { getServerSession } from "next-auth";
import { can } from "@/lib/rbac";
import { authOptions } from "../../auth/[...nextauth]/route";
import mongoose from "mongoose";
import { blogListQuery, restoreBlogStatus } from "./helpers";

export async function GET(req) {
   const session = await getServerSession(authOptions);
   if (!session || !session.user.isStaff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
   if (!can(session.user, "blogs.view")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

   await dbConnect();
   const { searchParams } = new URL(req.url);
   const id = searchParams.get("id");
   const status = searchParams.get("status");

   try {
      if (id) {
         if (!mongoose.isValidObjectId(id)) return NextResponse.json({ error: "Blog not found" }, { status: 404 });
         const blog = await Blog.findById(id).lean();
         if (!blog) return NextResponse.json({ error: "Blog not found" }, { status: 404 });
         return NextResponse.json(blog);
      }

      // ?counts=true -> numbers for the All | Published | Drafts | Trash views
      if (searchParams.get("counts") === "true") {
         const [all, published, draft, trash] = await Promise.all([
            Blog.countDocuments(blogListQuery("all")),
            Blog.countDocuments(blogListQuery("published")),
            Blog.countDocuments(blogListQuery("draft")),
            Blog.countDocuments(blogListQuery("trash")),
         ]);
         return NextResponse.json({ all, published, draft, trash });
      }

      let query;
      if (searchParams.get("isDeleted") === "true") {
         query = blogListQuery("trash");
      } else {
         query = blogListQuery("all");
         if (status) query.status = status;
      }

      let finder = Blog.find(query).sort({ createdAt: -1 });
      // ?fields=list -> lighter rows for the admin list (no post bodies)
      if (searchParams.get("fields") === "list") {
         finder = finder.select("title slug image category author status isFeatured publishedAt createdAt updatedAt isDeleted deletedAt");
      }
      const blogs = await finder.lean();
      return NextResponse.json(blogs);
   } catch (err) {
      return NextResponse.json({ error: err.message }, { status: 500 });
   }
}

export async function POST(req) {
   const session = await getServerSession(authOptions);
   if (!session || !session.user.isStaff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
   if (!can(session.user, "blogs.create")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
   
   await dbConnect();
   try {
      const data = await req.json();
      // A new post never starts in Trash; identity/timestamp fields are server-owned
      const { _id, __v, id: _legacyId, createdAt, updatedAt, isDeleted, deletedAt, statusBeforeTrash, ...blogData } = data || {};
      if (!blogData.title || !String(blogData.title).trim()) {
         return NextResponse.json({ error: "Title is required." }, { status: 400 });
      }

      // Auto-generate slug if missing or handle collisions
      if (!blogData.slug && blogData.title) {
         blogData.slug = blogData.title.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]+/g, '');
      }

      // Check for collision and append suffix if needed
      let slug = blogData.slug;
      let count = 1;
      while (await Blog.findOne({ slug })) {
         slug = `${blogData.slug}-${count}`;
         count++;
      }
      blogData.slug = slug;

      const blog = await Blog.create(blogData);
      return NextResponse.json(blog);
    } catch (err) {
      console.error("BLOG POST ERROR:", err);
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

export async function PUT(req) {
   const session = await getServerSession(authOptions);
   if (!session || !session.user.isStaff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
   if (!can(session.user, "blogs.edit")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

   await dbConnect();
   try {
      const rawData = await req.json();
      // deletedAt / statusBeforeTrash are managed here, never taken from the client
      const { id, _id, __v, createdAt, updatedAt, deletedAt, statusBeforeTrash, ...updateData } = rawData;

      if (!mongoose.isValidObjectId(id)) return NextResponse.json({ error: "Blog not found" }, { status: 404 });
      const oldBlog = await Blog.findById(id);
      if (!oldBlog) return NextResponse.json({ error: "Blog not found" }, { status: 404 });

      if (updateData.title !== undefined && !String(updateData.title).trim()) {
         return NextResponse.json({ error: "Title is required." }, { status: 400 });
      }

      // Restore from Trash: put back the status the post had before it was trashed
      const isRestore = oldBlog.isDeleted && updateData.isDeleted === false;
      if (isRestore) {
         updateData.status = restoreBlogStatus(oldBlog.statusBeforeTrash);
         updateData.deletedAt = null;
         updateData.statusBeforeTrash = null;
      } else if (updateData.isDeleted === true && !oldBlog.isDeleted) {
         // Trashing goes through DELETE so status/deletedAt are recorded consistently
         delete updateData.isDeleted;
      }

      // Auto-generate slug if missing
      if (!updateData.slug && updateData.title) {
         updateData.slug = updateData.title.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]+/g, '');
      }

      // Handle collision on update (only if slug is being changed)
      if (updateData.slug) {
         let slug = updateData.slug;
         let count = 1;
         while (await Blog.findOne({ slug, _id: { $ne: id } })) {
            slug = `${updateData.slug}-${count}`;
            count++;
         }
         updateData.slug = slug;
      }

      // Register redirect if slug changed
      const { registerRedirect } = await import("@/lib/redirect-resolver");
      if (updateData.slug && oldBlog.slug && oldBlog.slug !== updateData.slug) {
         await registerRedirect(`/blog/${oldBlog.slug}`, `/blog/${updateData.slug}`);
      }

      // Use $set so nested objects (seo, etc.) are properly merged without wiping other fields
      const blog = await Blog.findByIdAndUpdate(id, { $set: updateData }, { new: true });
      return NextResponse.json(blog);
    } catch (err) {
      console.error("BLOG PUT ERROR:", err);
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
}


export async function DELETE(req) {
   const session = await getServerSession(authOptions);
   if (!session || !session.user.isStaff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
   if (!can(session.user, "blogs.delete")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

   await dbConnect();
   const { searchParams } = new URL(req.url);
   const id = searchParams.get("id");
   // ?permanent=true asks explicitly for a permanent delete; it is only allowed for posts
   // already in Trash (never deletes a live post in one step). Without the flag the
   // existing behaviour stays: live post -> Trash, trashed post -> permanent delete.
   const permanent = searchParams.get("permanent") === "true";
   try {
      if (!mongoose.isValidObjectId(id)) return NextResponse.json({ error: "Blog not found" }, { status: 404 });
      const blog = await Blog.findById(id);
      if (!blog) return NextResponse.json({ error: "Blog not found" }, { status: 404 });

      if (permanent && !blog.isDeleted) {
         return NextResponse.json({ error: "Move the post to Trash before deleting it permanently." }, { status: 400 });
      }

      // ?mode=trash never deletes: a post that is already in the Trash just stays there (idempotent), so a stale
      // "Move to Trash" click can no longer permanently delete it.
      if (searchParams.get("mode") === "trash" && blog.isDeleted) {
         return NextResponse.json({ message: "Blog is already in the Trash", success: true });
      }

      if (blog.isDeleted) {
         // Clean up media usage references
         try {
            if (blog.image) {
               const { removeMediaUsage, findMediaByUrl } = await import("@/lib/mediaUsage");
               const media = await findMediaByUrl(blog.image);
               if (media) {
                  await removeMediaUsage(media._id, 'Blog', id);
               }
            }
         } catch (mediaErr) {
            console.error("Failed to clean up blog media references:", mediaErr);
         }

         await Blog.findByIdAndDelete(id);
         return NextResponse.json({ message: "Blog permanently deleted", success: true });
      } else {
         blog.statusBeforeTrash = blog.status || "Draft";
         blog.isDeleted = true;
         blog.deletedAt = new Date();
         blog.status = "Draft";
         await blog.save();
         return NextResponse.json({ message: "Blog moved to trash", success: true, blog });
      }
   } catch (err) {
      return NextResponse.json({ error: err.message }, { status: 500 });
   }
}
