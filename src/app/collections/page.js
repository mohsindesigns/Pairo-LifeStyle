import Link from "next/link";
import Image from "next/image";
import dbConnect from "@/lib/db";
import Category from "@/models/Category";
import Product from "@/models/Product";
import { ChevronRight, ArrowRight } from "lucide-react";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Collections | Pairo",
  description: "Browse all Pairo collections — premium shearling and leather jackets crafted for modern wear.",
};

export default async function CollectionsPage() {
  await dbConnect();

  const categories = await Category.find({
    status: "Published",
    isDeleted: { $in: [false, null] },
    type: "product",
  })
    .sort({ name: 1 })
    .lean();

  // Get product counts per category in one aggregation
  const counts = await Product.aggregate([
    { $match: { isDeleted: { $ne: true }, status: "Published" } },
    { $unwind: "$categories" },
    { $group: { _id: "$categories", count: { $sum: 1 } } },
  ]);
  const countMap = {};
  counts.forEach((c) => {
    if (c._id) countMap[c._id.toString()] = c.count;
  });

  const cats = categories.map((cat) => ({
    ...cat,
    _id: cat._id.toString(),
    productCount: countMap[cat._id.toString()] || 0,
  }));

  return (
    <div className="bg-background min-h-screen font-sans">
      {/* Hero header */}
      <div className="border-b border-border">
        <div className="container mx-auto px-6 md:px-16 py-12 md:py-20">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-foreground/40 mb-8">
            <Link href="/" className="hover:text-foreground transition-colors">Home</Link>
            <ChevronRight className="w-3 h-3" />
            <span className="text-foreground/90">Collections</span>
          </nav>

          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-foreground/40 mb-3">Pairo</p>
              <h1 className="text-5xl sm:text-6xl md:text-7xl font-bold heading-font tracking-tighter uppercase leading-none text-foreground">
                Collections
              </h1>
            </div>
            <p className="text-sm text-foreground/50 max-w-sm leading-relaxed">
              Explore our full range of premium leather and shearling collections, each crafted with uncompromising attention to detail.
            </p>
          </div>
        </div>
      </div>

      {/* Category grid */}
      <div className="container mx-auto px-6 md:px-16 py-16 md:py-24">
        {cats.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-40 text-center">
            <p className="text-2xl font-bold heading-font uppercase mb-3 text-foreground">No Collections Yet</p>
            <p className="text-sm text-foreground/50">Check back soon — new collections are on the way.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 md:gap-8">
            {cats.map((cat) => (
              <Link
                key={cat._id}
                href={`/collections/${cat.slug}`}
                className="group relative flex flex-col overflow-hidden rounded-[var(--radius,16px)] border border-border bg-card hover:border-foreground/20 transition-all duration-500 hover:shadow-2xl hover:-translate-y-1"
              >
                {/* Image */}
                <div className="relative aspect-[4/5] overflow-hidden bg-foreground/5">
                  {cat.image ? (
                    <Image
                      src={cat.image}
                      alt={cat.name}
                      fill
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                      className="object-cover object-center transition-transform duration-700 ease-out group-hover:scale-105"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center bg-foreground/5">
                      <span className="text-4xl font-bold heading-font uppercase tracking-tighter text-foreground/10">
                        {cat.name.charAt(0)}
                      </span>
                    </div>
                  )}
                  {/* Gradient overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                  {/* Hover CTA */}
                  <div className="absolute inset-x-0 bottom-0 p-5 translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-400">
                    <span className="inline-flex items-center gap-1.5 text-white text-[10px] font-bold uppercase tracking-widest">
                      Shop Now <ArrowRight className="w-3 h-3" />
                    </span>
                  </div>
                </div>

                {/* Info */}
                <div className="p-5 flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-bold uppercase tracking-[0.12em] text-foreground leading-snug group-hover:text-foreground/70 transition-colors">
                      {cat.name}
                    </h2>
                    {cat.description && (
                      <p className="text-xs text-foreground/45 mt-1 line-clamp-1">{cat.description}</p>
                    )}
                  </div>
                  <span className="shrink-0 text-[11px] font-bold text-foreground/30 tabular-nums mt-0.5">
                    {cat.productCount}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
