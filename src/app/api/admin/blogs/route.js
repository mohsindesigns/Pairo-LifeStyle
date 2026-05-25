import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Blog from "@/models/Blog";
import { getServerSession } from "next-auth";
import { can } from "@/lib/rbac";
import { authOptions } from "../../auth/[...nextauth]/route";

export async function GET(req) {
   await dbConnect();
   const { searchParams } = new URL(req.url);
   const id = searchParams.get("id");
   const isDeleted = searchParams.get("isDeleted") === "true";
   const status = searchParams.get("status");

   try {
      if (id) {
         const blog = await Blog.findById(id);
         return NextResponse.json(blog);
      }
      let query = { 
         tenantId: searchParams.get('tenantId') || "DEFAULT_STORE"
      };
      
      if (searchParams.get("isDeleted") === "true") {
         query.isDeleted = true;
      } else {
         query.isDeleted = { $ne: true };
      }

      if (status) query.status = status;
      
      const blogs = await Blog.find(query).sort({ createdAt: -1 });
      return NextResponse.json(blogs);
   } catch (err) {
      return NextResponse.json({ error: err.message }, { status: 500 });
   }
}

export async function POST(req) {
   const session = await getServerSession(authOptions);
   if (!session || !session.user.isStaff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
   if (!can(session.user, "blogs.view")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
   
   await dbConnect();
   try {
      const data = await req.json();
      const blogData = {
         ...data,
         tenantId: data.tenantId || "DEFAULT_STORE"
      };

      // Auto-generate slug if missing or handle collisions
      if (!blogData.slug && blogData.title) {
         blogData.slug = blogData.title.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]+/g, '');
      }

      // Check for collision and append suffix if needed
      let slug = blogData.slug;
      let count = 1;
      while (await Blog.findOne({ slug, tenantId: blogData.tenantId })) {
         slug = `${blogData.slug}-${count}`;
         count++;
      }
      blogData.slug = slug;

      console.log("CREATING BLOG:", blogData);
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
   if (!can(session.user, "blogs.create")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

   await dbConnect();
   try {
      const data = await req.json();
      const { id, tenantId = "DEFAULT_STORE", ...updateData } = data;

      const oldBlog = await Blog.findById(id);
      if (!oldBlog) return NextResponse.json({ error: "Blog not found" }, { status: 404 });

      // Auto-generate slug if missing
      if (!updateData.slug && updateData.title) {
         updateData.slug = updateData.title.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]+/g, '');
      }

      // Handle collision on update (only if slug is being changed)
      if (updateData.slug) {
         let slug = updateData.slug;
         let count = 1;
         while (await Blog.findOne({ slug, _id: { $ne: id }, tenantId })) {
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

      console.log("UPDATING BLOG:", id, updateData);
      const blog = await Blog.findOneAndUpdate({ _id: id, tenantId }, updateData, { new: true });
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
   try {
      // Soft delete like WordPress
      await Blog.findByIdAndUpdate(id, { isDeleted: true });
      return NextResponse.json({ success: true });
   } catch (err) {
      return NextResponse.json({ error: err.message }, { status: 500 });
   }
}
