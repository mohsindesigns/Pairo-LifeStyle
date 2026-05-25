import { notFound } from "next/navigation";
import dbConnect from "@/lib/db";
import Blog from "@/models/Blog";
import SiteConfig from "@/models/SiteConfig";
import Product from "@/models/Product";
import BlogDetailClient from "@/components/blog/BlogDetailClient";
import mongoose from "mongoose";
import { checkAndApplyRedirect } from "@/lib/redirect-resolver";
import { resolveSEOMetadata } from "@/lib/seo-resolver";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }) {
  const { slug } = await params;
  await dbConnect();
  
  const currentPath = `/blog/${slug}`;
  await checkAndApplyRedirect(currentPath);

  const post = await Blog.findOne({ slug, isDeleted: { $ne: true } }).lean();
  if (!post) return { title: 'Post Not Found' };

  const { metadata } = resolveSEOMetadata({
    entity: post,
    type: "blog",
    path: currentPath
  });

  return metadata;
}

export default async function BlogDetail({ params }) {
  const { slug } = await params;
  
  const currentPath = `/blog/${slug}`;
  await checkAndApplyRedirect(currentPath);

  await dbConnect();

  const post = await Blog.findOne({ slug, isDeleted: { $ne: true } }).lean();

  if (!post) {
    notFound();
  }

  const config = await SiteConfig.findOne({ key: 'main' }).lean();
  let featuredProduct = config?.blogs?.featuredProduct || {
    id: "default",
    name: "Archival Piece",
    image: "/placeholder.jpg",
    label: "FEATURED"
  };

  if (post.featuredProductId) {
    const dbProduct = await Product.findOne({
      $or: [
        { _id: mongoose.isValidObjectId(post.featuredProductId) ? post.featuredProductId : null },
        { slug: post.featuredProductId }
      ]
    }).lean();

    if (dbProduct) {
      featuredProduct = {
        ...JSON.parse(JSON.stringify(dbProduct)),
        id: dbProduct._id.toString(),
        label: "FEATURED"
      };
    }
  }

  const latestPosts = await Blog.find({
    slug: { $ne: slug },
    status: 'Published',
    isDeleted: { $ne: true }
  }).limit(6).sort({ createdAt: -1 }).lean();

  // Sanitize for client to ensure only plain objects are passed
  const serializedPost = JSON.parse(JSON.stringify(post));
  const serializedPosts = JSON.parse(JSON.stringify(latestPosts)).map(p => ({
    ...p,
    id: p._id,
    date: new Date(p.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  }));

  const postDate = new Date(post.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  const { structuredData } = resolveSEOMetadata({
    entity: post,
    type: "blog",
    path: currentPath
  });

  return (
    <>
      {structuredData && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
      )}
      <BlogDetailClient
        post={serializedPost}
        posts={serializedPosts}
        featuredProduct={featuredProduct}
        postDate={postDate}
      />
    </>
  );
}
