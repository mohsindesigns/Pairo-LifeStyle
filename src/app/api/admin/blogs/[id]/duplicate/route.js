import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import mongoose from "mongoose";
import dbConnect from "@/lib/db";
import Blog from "@/models/Blog";
import { can } from "@/lib/rbac";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { buildBlogDuplicate, copySlugCandidate } from "../../helpers";

// POST /api/admin/blogs/[id]/duplicate — copies the stored post as a new Draft
// titled "<title> (Copy)" with a unique "<slug>-copy[-N]" slug.
export async function POST(req, { params }) {
   const session = await getServerSession(authOptions);
   if (!session || !session.user.isStaff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
   if (!can(session.user, "blogs.create")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

   const { id } = await params;
   if (!mongoose.isValidObjectId(id)) return NextResponse.json({ error: "Post not found" }, { status: 404 });

   await dbConnect();
   try {
      const source = await Blog.findById(id).lean();
      if (!source) return NextResponse.json({ error: "Post not found" }, { status: 404 });

      let attempt = 1;
      let slug = copySlugCandidate(source.slug || "post", attempt);
      // Checked against ALL posts (trashed included) — the slug index is unique.
      while (await Blog.exists({ slug })) {
         attempt++;
         slug = copySlugCandidate(source.slug || "post", attempt);
      }

      const copy = await Blog.create(buildBlogDuplicate(source, slug));
      return NextResponse.json(copy, { status: 201 });
   } catch (err) {
      console.error("BLOG DUPLICATE ERROR:", err);
      return NextResponse.json({ error: err.message || "Failed to duplicate post" }, { status: 500 });
   }
}
