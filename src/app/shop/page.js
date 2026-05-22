"use client";

import { useState, useMemo, Suspense, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { SlidersHorizontal, ChevronRight, X, Check, ArrowRight, Star } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import siteData from "@/lib/data.json";
import ProductCard from "@/components/home/ProductCard";

const ITEMS_PER_PAGE = 6;

function ShopContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const categoryParam = searchParams.get("category");
  
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const { filters } = siteData;
  
  useEffect(() => {
    fetch("/api/products")
      .then(res => res.json())
      .then(data => {
        // Handle both grouped (homepage) and flat responses
        const flatProducts = data.all ? data.all : (data.newArrivals ? [...data.newArrivals, ...data.topSelling] : data);
        setProducts(flatProducts);
        setLoading(false);
      });
  }, []);
  
  // States for filters
  const [maxPrice, setMaxPrice] = useState(filters.priceRange.max);
  const [sliderValue, setSliderValue] = useState(filters.priceRange.max);
  const [selectedColors, setSelectedColors] = useState([]);
  const [selectedSizes, setSelectedSizes] = useState([]);
  const [sortBy, setSortBy] = useState("Most Popular");
  const [currentPage, setCurrentPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    const handler = setTimeout(() => {
      setMaxPrice(sliderValue);
      setCurrentPage(1);
    }, 150);
    return () => clearTimeout(handler);
  }, [sliderValue]);

  const filteredProducts = useMemo(() => {
    let result = products;

    if (categoryParam) {
      result = result.filter(p => p.category?.toLowerCase() === categoryParam.toLowerCase());
    }

    result = result.filter(p => p.price <= maxPrice);

    if (selectedColors.length > 0) {
      result = result.filter(p => p.colors?.some(c => selectedColors.includes(c)));
    }

    if (selectedSizes.length > 0) {
       result = result.filter(p => p.sizes?.some(s => selectedSizes.includes(s)));
    }

    if (sortBy === "Price: Low to High") {
      result = [...result].sort((a, b) => a.price - b.price);
    } else if (sortBy === "Price: High to Low") {
      result = [...result].sort((a, b) => b.price - a.price);
    } else if (sortBy === "Newest") {
      result = [...result].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    } else if (sortBy === "Most Popular") {
      result = [...result].sort((a, b) => b.rating - a.rating);
    }

    return result;
  }, [products, categoryParam, maxPrice, selectedColors, selectedSizes, sortBy]);

  const totalPages = Math.ceil(filteredProducts.length / ITEMS_PER_PAGE);
  const paginatedProducts = filteredProducts.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const toggleColor = (color) => {
    setSelectedColors(prev => prev.includes(color) ? prev.filter(c => c !== color) : [...prev, color]);
    setCurrentPage(1);
  };

  const toggleSize = (size) => {
    setSelectedSizes(prev => prev.includes(size) ? prev.filter(s => s !== size) : [...prev, size]);
    setCurrentPage(1);
  };

  const resetFilters = () => {
    setSliderValue(filters.priceRange.max);
    setMaxPrice(filters.priceRange.max);
    setSelectedColors([]);
    setSelectedSizes([]);
    setSortBy("Most Popular");
    setCurrentPage(1);
    router.push("/shop");
  };

  const renderFilterSections = (isMobile = false) => (
    <div className="space-y-10">
      <div className="pb-8 border-b border-black/5">
        <h4 className="font-bold text-[10px] uppercase tracking-[0.2em] text-black/30 mb-6">Categories</h4>
        <div className="flex flex-col gap-3 text-xs">
          <Link href="/shop" className={`flex items-center justify-between py-1 transition-all ${!categoryParam ? "font-bold text-black" : "text-black/50 hover:text-black"}`}>
            <span>All Products</span>
          </Link>
          {filters.categories.map((cat) => (
            <Link 
              key={cat} 
              href={`/shop?category=${cat.toLowerCase()}`}
              onClick={() => isMobile && setShowFilters(false)}
              className={`flex items-center justify-between py-1 transition-all ${categoryParam?.toLowerCase() === cat.toLowerCase() ? "font-bold text-black" : "text-black/50 hover:text-black"}`}
            >
              <span>{cat}</span>
            </Link>
          ))}
        </div>
      </div>

      <div className="pb-8 border-b border-black/5">
        <h4 className="font-bold text-[10px] uppercase tracking-[0.2em] text-black/30 mb-6">Price</h4>
        <input type="range" className="w-full accent-black cursor-pointer" min={filters.priceRange.min} max={filters.priceRange.max} step={10} value={sliderValue} onChange={(e) => setSliderValue(parseInt(e.target.value))} />
        <div className="flex justify-between text-[10px] font-bold mt-3 text-black/40">
          <span>${filters.priceRange.min}</span>
          <span className="text-black">${sliderValue}</span>
        </div>
      </div>

      <div className="pb-8 border-b border-black/5">
        <h4 className="font-bold text-[10px] uppercase tracking-[0.2em] text-black/30 mb-6">Colors</h4>
        <div className="flex flex-wrap gap-3">
          {filters.colors.map((color) => {
             const colorMap = { "Black": "#1A1A1A", "Brown": "#4A3B2F", "Tan": "#D2B48C", "Camel": "#C19A6B", "Navy": "#1B2E3C" };
             return (
              <button key={color} onClick={() => toggleColor(color)} className="group relative">
                <div className={`w-7 h-7 rounded-full border border-black/5 flex items-center justify-center transition-all ${selectedColors.includes(color) ? "ring-2 ring-black ring-offset-2 scale-110" : "hover:scale-110"}`} style={{ backgroundColor: colorMap[color] || color.toLowerCase() }}>
                  {selectedColors.includes(color) && <Check className={`w-3 h-3 ${color === 'White' ? 'text-black' : 'text-white'}`} />}
                </div>
              </button>
             );
          })}
        </div>
      </div>

      <div className="pb-8 border-b border-black/5">
        <h4 className="font-bold text-[10px] uppercase tracking-[0.2em] text-black/30 mb-6">Sizes</h4>
        <div className="flex flex-wrap gap-2">
          {filters.sizes.map((size) => (
            <button key={size} onClick={() => toggleSize(size)} className={`px-5 py-2 rounded-lg text-[10px] font-bold uppercase transition-all border ${selectedSizes.includes(size) ? "bg-black text-white border-black" : "bg-transparent text-black/40 border-black/10 hover:border-black hover:text-black"}`}>
              {size}
            </button>
          ))}
        </div>
      </div>

      <button onClick={resetFilters} className="w-full text-black/40 hover:text-black py-4 font-bold text-[9px] uppercase tracking-[0.2em] transition-all">Clear All</button>
    </div>
  );

  return (
    <div className="bg-white min-h-screen">
      <div className="container mx-auto px-6 md:px-16 py-8 md:py-16">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-8">
          <div className="space-y-4">
             <div className="flex items-center gap-2 text-black/30 text-[9px] font-bold uppercase tracking-widest">
                <Link href="/" className="hover:text-black transition-colors">Home</Link>
                <ChevronRight className="w-3 h-3" />
                <span className="text-black">Shop</span>
             </div>
             <h1 className="text-4xl md:text-6xl font-bold heading-font tracking-tighter uppercase leading-none">
                {categoryParam ? categoryParam : "Shop All"}
             </h1>
          </div>
          <div className="flex items-center justify-between md:justify-end gap-8 border-t border-black/5 md:border-none pt-8 md:pt-0">
             <div className="flex items-center gap-3">
                <span className="text-[10px] font-bold text-black/20 uppercase">Sort by:</span>
                <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="font-bold text-sm bg-transparent focus:outline-none cursor-pointer uppercase">
                  <option>Most Popular</option>
                  <option>Newest</option>
                  <option>Price: Low to High</option>
                  <option>Price: High to Low</option>
                </select>
             </div>
             <button onClick={() => setShowFilters(true)} className="lg:hidden flex items-center gap-2 px-6 py-3 bg-black text-white rounded-full text-[10px] font-bold uppercase tracking-widest active:scale-95 transition-transform"><SlidersHorizontal className="w-4 h-4" /> Filter</button>
          </div>
        </div>

        <div className="flex flex-col lg:grid lg:grid-cols-12 gap-16">
          <aside className="hidden lg:block lg:col-span-3 h-fit sticky top-32">{renderFilterSections(false)}</aside>
          <main className="lg:col-span-9 min-h-[800px]">
            {loading ? (
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-10">
                 {[1,2,3,4,5,6].map(i => <div key={i} className="aspect-[3/4] bg-gray-100 animate-pulse rounded-2xl" />)}
              </div>
            ) : paginatedProducts.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-2 xl:grid-cols-3 gap-y-12 gap-x-6 md:gap-x-10">
                {paginatedProducts.map((product) => (
                  <ProductCard key={product.id || product._id} product={product} />
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-40 border border-dashed border-black/10 rounded-3xl">
                <p className="text-sm font-bold uppercase tracking-widest text-black/40 mb-6">No products found</p>
                <button onClick={resetFilters} className="px-8 py-3 bg-black text-white rounded-full text-[10px] font-bold uppercase tracking-widest">Clear Filters</button>
              </div>
            )}

            {totalPages > 1 && (
              <div className="mt-20 flex items-center justify-center gap-12 border-t border-black/5 pt-12">
                <button onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} disabled={currentPage === 1} className={`text-[10px] font-bold uppercase tracking-widest transition-all ${currentPage === 1 ? "opacity-10" : "hover:text-black/60"}`}>Prev</button>
                <div className="flex gap-8">
                  {[...Array(totalPages)].map((_, i) => (
                    <button key={i + 1} onClick={() => setCurrentPage(i + 1)} className={`text-sm font-bold transition-all ${currentPage === i + 1 ? "text-black border-b-2 border-black" : "text-black/20 hover:text-black"}`}>{i + 1}</button>
                  ))}
                </div>
                <button onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} disabled={currentPage === totalPages} className={`text-[10px] font-bold uppercase tracking-widest transition-all ${currentPage === totalPages ? "opacity-10" : "hover:text-black/60"}`}>Next</button>
              </div>
            )}
          </main>
        </div>
      </div>

      <AnimatePresence>
        {showFilters && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowFilters(false)} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] lg:hidden" />
            <motion.div initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "spring", damping: 30, stiffness: 300 }} className="fixed right-0 top-0 bottom-0 w-[85vw] max-w-sm bg-white z-[110] lg:hidden flex flex-col">
              <div className="p-6 flex items-center justify-between border-b border-black/5"><h3 className="text-xl font-bold heading-font uppercase">Filters</h3><button onClick={() => setShowFilters(false)} className="p-2 hover:bg-black/5 rounded-full"><X className="w-6 h-6" /></button></div>
              <div className="flex-1 overflow-y-auto p-6 scrollbar-hide">{renderFilterSections(true)}</div>
              <div className="p-6"><button onClick={() => setShowFilters(false)} className="w-full bg-black text-white py-4 rounded-xl font-bold text-[10px] uppercase tracking-widest shadow-xl">Apply</button></div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function ShopPage() {
  return (
    <Suspense fallback={<div className="container mx-auto px-4 py-40 text-center animate-pulse font-bold text-xl uppercase">Loading Catalog...</div>}>
      <ShopContent />
    </Suspense>
  );
}
