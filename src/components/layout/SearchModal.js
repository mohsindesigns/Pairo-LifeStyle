"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { X, Search, ArrowRight, TrendingUp } from "lucide-react";
import siteData from "@/lib/data.json";

export default function SearchModal({ isOpen, onClose }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [results, setResults] = useState({ products: [], categories: [] });
  const inputRef = useRef(null);

  const { products, categories, search } = siteData;

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

  useEffect(() => {
    const runSearch = () => {
      if (searchQuery.trim().length > 1) {
        const query = searchQuery.toLowerCase();
        const allProducts = [...products.newArrivals, ...products.topSelling];
        const filteredProducts = allProducts.filter(p => 
          p.name.toLowerCase().includes(query) || 
          p.category.toLowerCase().includes(query)
        ).slice(0, 8);

        const filteredCategories = categories.items.filter(c => 
          c.name.toLowerCase().includes(query) || 
          c.slug.toLowerCase().includes(query)
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
  }, [searchQuery, products, categories]);

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
            <div className="container mx-auto px-4 sm:px-6 md:px-16 py-4 md:py-10 flex items-center justify-between gap-4 md:gap-8">
              <div className="flex items-center gap-3 md:gap-4 flex-1">
                <Search className="w-4 h-4 md:w-5 md:h-5 text-black/40" />
                <input
                  ref={inputRef}
                  type="text"
                  placeholder={search.placeholder}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-transparent text-base md:text-xl font-medium outline-none placeholder:text-black/20 uppercase tracking-wider"
                />
              </div>
              <button
                onClick={onClose}
                className="flex items-center gap-2 md:gap-3 group"
              >
                <span className="hidden sm:inline text-[10px] font-bold uppercase tracking-[0.2em] text-black/40 group-hover:text-black transition-colors">{search.close}</span>
                <div className="p-2 md:p-3 bg-black/5 rounded-full group-hover:bg-black group-hover:text-white transition-all">
                  <X className="w-4 h-4 md:w-5 md:h-5" />
                </div>
              </button>
            </div>
          </div>

          {/* Results Area */}
          <div className="flex-1 overflow-y-auto scrollbar-hide py-8 md:py-12">
            <div className="container mx-auto px-4 sm:px-6 md:px-16">
              {searchQuery.length > 1 ? (
                <div 
                  onClick={(e) => e.stopPropagation()}
                  className="flex flex-col lg:grid lg:grid-cols-12 gap-10 md:gap-16"
                >
                  {/* Sidebar Results: Collections */}
                  <div className="lg:col-span-3 space-y-8 md:space-y-12">
                    <div>
                      <h4 className="text-[8px] md:text-[9px] font-bold text-black/30 uppercase tracking-[0.3em] mb-4 md:mb-8">{search.suggestedDepartments}</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4 md:gap-6">
                        {results.categories.length > 0 ? (
                          results.categories.map((cat) => (
                            <Link
                              key={cat.slug}
                              href={`/shop?category=${cat.slug}`}
                              onClick={onClose}
                              className="group block"
                            >
                              <div className="flex items-center gap-3 md:gap-4">
                                <div className="w-8 h-8 md:w-10 md:h-10 rounded-full overflow-hidden bg-black/5 border border-black/5 flex-shrink-0">
                                   <Image src={cat.image} alt={cat.name} width={40} height={40} className="object-cover group-hover:scale-110 transition-transform duration-500" />
                                </div>
                                <span className="text-[11px] md:text-xs font-bold uppercase tracking-widest group-hover:text-black/60 transition-colors">{cat.name} Collection</span>
                              </div>
                            </Link>
                          ))
                        ) : (
                          <p className="text-[10px] text-black/20 italic">No collections found.</p>
                        )}
                      </div>
                    </div>

                    <div className="pt-6 md:pt-10 border-t border-black/5">
                      <h4 className="text-[8px] md:text-[9px] font-bold text-black/30 uppercase tracking-[0.3em] mb-4 md:mb-6 flex items-center gap-2">
                        <TrendingUp className="w-3 h-3" />
                        {search.trendingSearches}
                      </h4>
                      <div className="flex flex-wrap lg:flex-col gap-3 md:gap-4">
                        {search.trending.map((tag) => (
                          <button
                            key={tag}
                            onClick={() => setSearchQuery(tag)}
                            className="bg-black/5 lg:bg-transparent px-4 py-2 lg:p-0 rounded-full lg:rounded-none text-left text-[9px] md:text-[11px] font-bold uppercase tracking-widest text-black/40 hover:text-black transition-colors"
                          >
                            {tag}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Main Results: Products */}
                  <div className="lg:col-span-9">
                    <h4 className="text-[8px] md:text-[9px] font-bold text-black/30 uppercase tracking-[0.3em] mb-6 md:mb-8">{search.matchingProducts} ({results.products.length})</h4>
                    {results.products.length > 0 ? (
                      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-8">
                        {results.products.map((product) => (
                          <Link
                            key={product.id}
                            href={`/product/${product.id}`}
                            onClick={onClose}
                            className="group"
                          >
                            <div className="relative aspect-[3/4] rounded-xl md:rounded-2xl overflow-hidden bg-black/5 mb-3 md:mb-4">
                              <Image src={product.image} alt={product.name} fill sizes="(max-width: 768px) 50vw, 33vw" className="object-cover group-hover:scale-105 transition-transform duration-700" />
                            </div>
                            <div className="space-y-0.5 md:space-y-1">
                               <p className="text-[7px] md:text-[8px] font-bold text-black/30 uppercase tracking-widest">{product.category}</p>
                               <h5 className="text-[10px] md:text-sm font-bold uppercase tracking-tight leading-tight">{product.name}</h5>
                               <p className="text-[9px] md:text-xs font-medium text-black/60">${product.price}</p>
                            </div>
                          </Link>
                        ))}
                      </div>
                    ) : (
                      <div className="py-12 md:py-20 text-center bg-black/5 rounded-2xl md:rounded-3xl border border-dashed border-black/10">
                        <p className="text-[9px] md:text-[10px] font-bold uppercase tracking-widest text-black/30 italic px-4">{search.noProductsFound} &quot;{searchQuery}&quot;</p>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                /* Static State */
                <div 
                  onClick={(e) => e.stopPropagation()}
                  className="max-w-5xl mx-auto py-4 md:py-10"
                >
                  <div className="flex flex-col md:grid md:grid-cols-3 gap-10 md:gap-12">
                      <div className="space-y-6 md:space-y-8">
                        <h4 className="text-[8px] md:text-[10px] font-bold text-black/30 uppercase tracking-[0.4em]">{search.popularCategories}</h4>
                        <div className="grid grid-cols-2 md:grid-cols-1 gap-4 md:gap-6">
                            {categories.items.map((cat) => (
                              <Link key={cat.slug} href={`/shop?category=${cat.slug}`} onClick={onClose} className="group block text-lg md:text-2xl font-bold heading-font uppercase tracking-tighter hover:text-black/40 transition-colors">
                                {cat.name}
                              </Link>
                            ))}
                        </div>
                      </div>
                      
                      <div className="md:col-span-2">
                        <h4 className="text-[8px] md:text-[10px] font-bold text-black/30 uppercase tracking-[0.4em] mb-6 md:mb-8">{search.featuredCollection}</h4>
                        <Link href="/shop" onClick={onClose} className="group relative aspect-[16/9] md:aspect-[16/7] block rounded-2xl md:rounded-3xl overflow-hidden bg-black/5">
                            <Image src={categories.items[1].image} alt="Featured" fill sizes="(max-width: 768px) 100vw, 66vw" className="object-cover group-hover:scale-105 transition-transform duration-1000" />
                            <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors flex flex-col justify-end p-6 md:p-8">
                               <h3 className="text-xl md:text-2xl font-bold text-white uppercase tracking-tighter heading-font">{search.featuredTitle}</h3>
                               <div className="flex items-center gap-2 text-white/60 group-hover:text-white transition-colors mt-2">
                                  <span className="text-[8px] md:text-[10px] font-bold uppercase tracking-widest">{search.shopCollection}</span>
                                  <ArrowRight className="w-3 h-3 md:w-4 md:h-4" />
                                </div>
                            </div>
                        </Link>
                      </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
