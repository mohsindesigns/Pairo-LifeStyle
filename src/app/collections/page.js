import Link from "next/link";
import dbConnect from "@/lib/db";
import Category from "@/models/Category";
import { ChevronRight } from "lucide-react";

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

  return (
    <div 
      className="min-h-screen text-foreground"
      style={{ backgroundColor: 'var(--background)', color: 'var(--foreground)', fontFamily: 'var(--body-font)' }}
    >
      {/* Header/Hero Section */}
      <div className="border-b" style={{ borderColor: 'var(--border)' }}>
        <div className="container mx-auto px-4 sm:px-6 md:px-16 py-12 md:py-16">
          {/* Breadcrumb (using p instead of h) */}
          <nav 
            className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] mb-6"
            style={{ color: 'var(--muted)' }}
          >
            <Link href="/" className="hover:opacity-80 transition-opacity">Home</Link>
            <ChevronRight className="w-3 h-3 opacity-60" />
            <span className="opacity-90">Collections</span>
          </nav>

          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="space-y-2">
              <p 
                className="text-[10px] font-black uppercase tracking-[0.35em]"
                style={{ color: 'var(--muted)', fontFamily: 'var(--body-font)' }}
              >
                Luxury Store
              </p>
              <p 
                className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight uppercase leading-none"
                style={{ fontFamily: 'var(--brand-font)' }}
              >
                OUR COLLECTIONS
              </p>
            </div>
            <p 
              className="text-xs sm:text-sm max-w-md leading-relaxed"
              style={{ color: 'var(--muted)' }}
            >
              Explore our full range of premium outerwear. Each collection is meticulously designed with hand-selected materials, rich details, and signature silhouettes.
            </p>
          </div>
        </div>
      </div>

      {/* Categories Grid */}
      <div className="container mx-auto px-4 sm:px-6 md:px-16 py-12 md:py-20">
        {categories.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <p className="text-base font-bold uppercase tracking-wider mb-2 opacity-60">No Collections Found</p>
            <p className="text-xs opacity-40">Check back soon for new premium outerwear drops.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-10 md:gap-12">
            {categories.map((cat) => (
              <Link
                key={cat._id.toString()}
                href={`/collections/${cat.slug}`}
                className="group flex flex-col items-center text-center w-full"
              >
                {/* Image Container - Square with Sharp Corners */}
                <div 
                  className="w-full aspect-square relative overflow-hidden bg-neutral-100 border"
                  style={{ borderColor: 'var(--border)' }}
                >
                  {cat.image ? (
                    <img
                      src={cat.image}
                      alt={cat.name}
                      className="w-full h-full object-cover object-center transition-transform duration-700 ease-out group-hover:scale-103"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-neutral-200">
                      <p 
                        className="text-5xl font-black uppercase tracking-tighter opacity-10"
                        style={{ fontFamily: 'var(--brand-font)' }}
                      >
                        {cat.name.charAt(0)}
                      </p>
                    </div>
                  )}
                </div>

                {/* Title Below Image - Uppercase, Centered, Bold */}
                <p 
                  className="text-base md:text-lg lg:text-xl font-bold uppercase tracking-[0.08em] mt-5 group-hover:opacity-75 transition-opacity leading-tight"
                  style={{ fontFamily: 'var(--brand-font)', color: 'var(--foreground)' }}
                >
                  {cat.name}
                </p>

                {/* Button - Centered, Dark Grey/Black, Sharp Corners */}
                <div className="mt-3.5">
                  <span 
                    className="inline-block px-8 py-2.5 text-[11px] font-bold uppercase tracking-widest transition-opacity group-hover:opacity-90"
                    style={{ 
                      fontFamily: 'var(--brand-font)', 
                      backgroundColor: 'var(--primary)', 
                      color: 'var(--background)' 
                    }}
                  >
                    View Category
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
