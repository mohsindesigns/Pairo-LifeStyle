"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { X, Search, ArrowRight, TrendingUp } from "lucide-react";
import siteData from "@/lib/data.json";
import { useSiteData } from "@/context/SiteContext";
import { getProductUrl, getCategoryUrl } from "@/lib/routes";
import { trackSearch } from "@/lib/analytics";

export default function SearchModal({ isOpen, onClose }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [dbProducts, setDbProducts] = useState([]);
  const [results, setResults] = useState({ products: [], categories: [] });
  const inputRef = useRef(null);
  const lastSearchTracked = useRef("");

  // GA4 search + Pinterest search — fire once per settled query (debounced), not per keystroke.
  useEffect(() => {
    const q = searchQuery.trim();
    if (q.length <= 1) return;
    const t = setTimeout(() => {
      const key = q.toLowerCase();
      if (lastSearchTracked.current !== key) {
        lastSearchTracked.current = key;
        trackSearch(q);
      }
    }, 900);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const siteContextData = useSiteData();
  const dbCategories = siteContextData?._dbCategories || [];
  const { search } = siteData;

  // Prevent background scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current.focus(), 100);
    }
  }, [isOpen]);

  // Fetch live products when modal is opened
  useEffect(() => {
    if (isOpen) {
      fetch("/api/products")
        .then((res) => res.json())
        .then((data) => {
          const flatProducts = data.all 
            ? data.all 
            : (data.newArrivals ? [...data.newArrivals, ...data.topSelling] : data);
          setDbProducts(flatProducts || []);
        })
        .catch((err) => console.error("Search modal products fetch failed:", err));
    }
  }, [isOpen]);

  useEffect(() => {
    const runSearch = () => {
      if (searchQuery.trim().length > 1) {
        const query = searchQuery.toLowerCase();
        const filteredProducts = dbProducts.filter(p => 
          p.name?.toLowerCase().includes(query) || 
          p.category?.toLowerCase().includes(query)
        ).slice(0, 8);

        const filteredCategories = dbCategories.filter(c => 
          c.name?.toLowerCase().includes(query) || 
          c.slug?.toLowerCase().includes(query)
        ).slice(0, 4);

        setResults({ products: filteredProducts, categories: filteredCategories });
      } else {
        setResults((prev) => 
          prev.products.length === 0 && prev.categories.length === 0 
            ? prev 
            : { products: [], categories: [] }
        );
      }
    };
    Promise.resolve().then(runSearch);
  }, [searchQuery, dbProducts, dbCategories]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-[100] bg-white flex flex-col h-screen"
        >
          {/* Header Panel */}
          <div 
            onClick={(e) => e.stopPropagation()}
            className="border-b border-black/5 bg-white shrink-0"
          >
            <div className="container mx-auto px-4 sm:px-6 md:px-16 py-4 md:py-5 flex items-center justify-between gap-4 md:gap-6">
              <div className="flex items-center gap-4 flex-1 bg-white border border-black rounded-[var(--radius,0px)] px-6 py-3 md:py-3.5 transition-all duration-300 focus-within:ring-1 focus-within:ring-black">
                <Search className="w-4 h-4 md:w-5 md:h-5 text-black flex-shrink-0" />
                <input
                  ref={inputRef}
                  type="text"
                  placeholder={search.placeholder || "Search Pairo..."}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-transparent text-base md:text-lg font-semibold outline-none placeholder:text-black/60 uppercase tracking-[0.15em] text-black"
                />
              </div>
              <button
                onClick={onClose}
                className="flex items-center gap-2 md:gap-3 group"
              >
                <span className="hidden sm:inline text-[10px] font-bold uppercase tracking-[0.2em] text-black group-hover:text-black transition-colors">{search.close}</span>
                <div className="p-2 md:p-2.5 bg-black/5 rounded-full group-hover:bg-black group-hover:text-white transition-all">
                  <X className="w-4 h-4 md:w-5 md:h-5" />
                </div>
              </button>
            </div>
          </div>

          {/* Results Area */}
          <div className="flex-1 overflow-y-auto scrollbar-hide py-4 md:py-6">
            <div className="container mx-auto px-4 sm:px-6 md:px-16">
              {searchQuery.length > 1 ? (
                <div 
                  onClick={(e) => e.stopPropagation()}
                  className="space-y-6 animate-fade-in"
                >
                  {/* Main Results: Products */}
                  <div>
                    <p className="text-[8px] md:text-[9px] font-bold text-black uppercase tracking-[0.3em] mb-4">
                      {search.matchingProducts} ({results.products.length})
                    </p>
                    {results.products.length > 0 ? (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-5">
                        {results.products.map((product) => (
                          <Link
                            key={product._id || product.id}
                            href={getProductUrl(product)}
                            onClick={onClose}
                            className="group block"
                          >
                            <div className="relative aspect-[3/4] rounded-[var(--radius,0px)] overflow-hidden bg-black/5 mb-2 border border-black/5">
                              {(() => {
                                const productImg = product.images?.[0] || product.image || "/placeholder.jpg";
                                return (
                                  <Image 
                                    src={productImg} 
                                    alt={product.name} 
                                    fill 
                                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 15vw" 
                                    className="object-cover group-hover:scale-105 transition-transform duration-700" 
                                    unoptimized={productImg ? (!productImg.startsWith("http") && !productImg.includes("cloudinary.com")) : false}
                                  />
                                );
                              })()}
                            </div>
                            <div className="space-y-0.5">
                               <p className="text-[7px] font-bold text-black uppercase tracking-widest">{product.category}</p>
                               <p className="text-[9px] md:text-[10px] font-bold uppercase tracking-tight leading-tight line-clamp-2 text-black group-hover:text-black/75 transition-colors">{product.name}</p>
                               <p className="text-[8px] md:text-[9px] font-semibold text-black">${product.price}</p>
                            </div>
                          </Link>
                        ))}
                      </div>
                    ) : (
                      <div className="py-8 md:py-12 text-center bg-black/5 rounded-[var(--radius,0px)] border border-dashed border-black/10">
                        <p className="text-[9px] md:text-[10px] font-bold uppercase tracking-widest text-black italic px-4">{search.noProductsFound} &quot;{searchQuery}&quot;</p>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                /* Dynamic State (Initially Empty) */
                <div 
                  onClick={(e) => e.stopPropagation()}
                  className="flex flex-col items-center justify-center py-20 text-center select-none"
                >
                  <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-black">
                    Type to search our collection
                  </p>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
