"use client";

import { useState } from "react";
import ProductGallery from "./ProductGallery";
import ClientProductActions from "./ClientProductActions";
import {
  ShieldCheck,
  Truck,
  Zap,
  Package,
  Globe,
  Star,
  Layers,
  Heart,
  Anchor,
  Award,
  RefreshCw,
  Info,
  HelpCircle,
  MessageSquare
} from "lucide-react";

const ICON_MAP = {
  Shield: ShieldCheck,
  Truck: Truck,
  Zap: Zap,
  Package: Package,
  Globe: Globe,
  Star: Star,
  Layers: Layers,
  Heart: Heart,
  Anchor: Anchor,
  Award: Award,
  Refresh: RefreshCw
};

export default function ProductMainSection({ product }) {
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [selectedVariantImage, setSelectedVariantImage] = useState("");

  const handleVariantChange = (variant) => {
    if (variant.isPartial) {
      // Always set — empty string resets gallery to product default
      setSelectedVariantImage(variant.image ?? "");
      return;
    }
    setSelectedVariant(variant);
    if (variant.image) setSelectedVariantImage(variant.image);
  };

  const displayPrice = selectedVariant?.price || product.price;
  const displayCompareAtPrice = selectedVariant ? (selectedVariant.compareAtPrice !== undefined && selectedVariant.compareAtPrice !== null ? selectedVariant.compareAtPrice : null) : product.compareAtPrice;
  const displaySku = selectedVariant?.sku || product.sku;
  const displayStock = selectedVariant?.stock !== undefined ? selectedVariant.stock : product.stock;

  const categoryName = product.categories?.[0]?.name || product.category || "Collection";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-16 items-start">
      {/* LEFT SIDE: STATIC/STICKY GALLERY */}
      <div className="lg:col-span-6 lg:sticky lg:top-24 transition-all duration-500">
        <ProductGallery
          images={product.images}
          variantImage={selectedVariantImage}
          productName={product.name}
          imageAlts={product.imageAlts}
        />
      </div>

      {/* RIGHT SIDE: SCROLLABLE INFO */}
      <div className="lg:col-span-6 space-y-8 md:space-y-12">
        <div className="space-y-4 md:space-y-6">
          <div className="space-y-2">
            <p className="text-[9px] md:text-[10px] font-bold text-black/20 uppercase tracking-[0.3em]">
              Pairo Studio — {categoryName}
            </p>
            <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold heading-font uppercase tracking-tight leading-[1.05] text-black">
              {product.name}
            </h1>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex gap-0.5">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className={`w-3.5 h-3.5 ${i < Math.floor(product.rating || 5) ? 'fill-[#FFC633] text-[#FFC633]' : 'fill-black/5 text-black/5'}`} />
              ))}
            </div>
            <span className="text-[10px] font-bold text-black/30 uppercase tracking-widest pl-4 border-l border-black/10">
              {product.rating || 5}/5 Ratings
            </span>
          </div>

          <div className="flex items-baseline gap-4">
            <span className="text-3xl md:text-4xl font-bold heading-font tracking-tighter text-black">${displayPrice}</span>
            {displayCompareAtPrice > displayPrice && (
              <div className="flex items-center gap-3">
                <span className="text-xl font-bold text-black/10 line-through">${displayCompareAtPrice}</span>
                <span className="text-[9px] font-bold text-red-500 uppercase tracking-widest bg-red-50 px-2.5 py-1 rounded-full">
                  -{Math.round(((displayCompareAtPrice - displayPrice) / displayCompareAtPrice) * 100)}% OFF
                </span>
              </div>
            )}
            {displaySku && (
              <span className="text-[9px] font-bold text-black/15 uppercase tracking-[0.2em] ml-auto">SKU: {displaySku}</span>
            )}
          </div>
        </div>

        {product.shortDescription && (
          <div className="relative">
             <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-black/5 rounded-full" />
             <p className="text-black/60 text-sm md:text-base leading-relaxed font-medium italic pl-6 py-1">
               {product.shortDescription}
             </p>
          </div>
        )}

        {/* Variant Selector + Stock + ATC */}
        <ClientProductActions
          product={{ ...product, stock: displayStock }}
          onVariantChange={handleVariantChange}
        />

        {/* Stats Block - CMS Driven */}
        {product.stats && product.stats.length > 0 && (
          <div className="grid grid-cols-2 gap-6 pt-10 border-t border-black/5">
            {product.stats.map((stat, i) => {
              const Icon = ICON_MAP[stat.icon] || Info;
              return (
                <div key={i} className="flex items-start gap-4 group">
                  <div className="p-3 bg-[#F9F9F9] rounded-2xl group-hover:bg-black transition-colors duration-300">
                    <Icon className="w-4 h-4 text-black/40 group-hover:text-white transition-colors" />
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-[8px] font-bold uppercase tracking-[0.2em] text-black/30">{stat.label}</p>
                    <p className="text-[11px] font-bold text-black uppercase tracking-wider">{stat.value}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* FAQ Summary Section */}
        {product.faqs && product.faqs.length > 0 && (
          <div className="pt-10 border-t border-black/5 space-y-6">
            <div className="flex items-center justify-between">
               <h3 className="text-[10px] font-bold uppercase tracking-[0.3em] text-black/30">Frequent Inquiries</h3>
               <div className="flex items-center gap-2 text-[9px] font-bold text-black/40 uppercase tracking-widest">
                  <MessageSquare className="w-3 h-3" /> {product.faqs.length} Total
               </div>
            </div>
            <div className="space-y-3">
              {product.faqs.slice(0, 2).map((faq, i) => (
                <div key={i} className="p-5 bg-white border border-black/5 rounded-2xl flex gap-4 hover:border-black/20 transition-all cursor-pointer group shadow-sm">
                  <div className="shrink-0 w-8 h-8 rounded-full bg-black/5 flex items-center justify-center group-hover:bg-black transition-colors">
                     <HelpCircle className="w-3.5 h-3.5 text-black/20 group-hover:text-white transition-colors" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-[11px] font-bold text-black tracking-tight">{faq.question}</p>
                    <p className="text-[11px] text-black/40 leading-relaxed line-clamp-1">{faq.answer}</p>
                  </div>
                </div>
              ))}
              <p className="text-center text-[9px] font-bold text-black/30 uppercase tracking-[0.2em] pt-2">
                View detailed FAQs below
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
