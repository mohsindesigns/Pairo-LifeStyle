import dbConnect from "@/lib/db";
import Product from "@/models/Product";
import WriteReviewClient from "./WriteReviewClient";
import { resolveSEOMetadata } from "@/lib/seo-resolver";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const { metadata } = await resolveSEOMetadata({
    entity: {},
    type: "page",
    fallbackTitle: "Write a Product Review | Pairo",
    fallbackDesc: "Submit your verified product feedback for Pairo handcrafted leather and shearling outerwear pieces.",
    path: "/write-review"
  });
  return metadata;
}

export default async function WriteReviewPage() {
  await dbConnect();
  
  // Fetch active/published products
  const products = await Product.find({ status: "Published", isDeleted: { $ne: true } })
    .select("name slug image images")
    .sort({ name: 1 })
    .lean();

  const sanitizedProducts = JSON.parse(JSON.stringify(products));

  return (
    <div 
      className="min-h-screen text-black bg-[#FAF9F6] py-16 px-4 md:px-8 font-sans"
      style={{ backgroundColor: "var(--background)", color: "black", fontFamily: "var(--body-font)" }}
    >
      <div className="max-w-2xl mx-auto space-y-10 bg-white border border-black/[0.06] p-8 md:p-12 rounded-[24px] shadow-sm">
        <div className="text-center space-y-3">
          <p 
            className="text-[9px] font-black uppercase tracking-[0.3em] text-neutral-400"
            style={{ fontFamily: "var(--body-font)" }}
          >
            Verified Experience
          </p>
          <h1 
            className="text-2xl md:text-3xl font-extrabold tracking-tight uppercase leading-none text-black"
            style={{ fontFamily: "var(--brand-font)" }}
          >
            Write a Product Review
          </h1>
          <p className="text-xs text-neutral-500 max-w-md mx-auto leading-relaxed">
            Please select the item you purchased below to share your handcrafted feedback with the Pairo family.
          </p>
        </div>
        <WriteReviewClient products={sanitizedProducts} />
      </div>
    </div>
  );
}
