"use client";

import { useState, useMemo, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { SlidersHorizontal, ChevronRight, X, Check, Star } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import siteData from "@/lib/data.json";
import ProductCard from "@/components/home/ProductCard";

const ITEMS_PER_PAGE = 6;

const PRODUCT_TYPES = [
  "Jackets",
  "Coats",
  "Vests",
  "Accessories",
  "Bags",
  "Gloves"
];

export default function ShopContentClient({ initialCategory = null, initialType = null }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  // Resolve from search parameters or fallback to server-passed props for SEO / SSR hydration alignment
  const categoryParam = searchParams.get("category") ?? initialCategory;
  const typeParam = searchParams.get("type") ?? initialType;
  
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const { filters } = siteData;
  
  useEffect(() => {
    fetch("/api/products")
      .then(res => res.json())
      .then(data => {
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
  const [selectedTypes, setSelectedTypes] = useState(typeParam ? [typeParam] : []);
  const [sortBy, setSortBy] = useState("Most Popular");
  const [currentPage, setCurrentPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Keep selectedTypes state synchronized when url typeParam changes
  useEffect(() => {
    if (typeParam) {
      setSelectedTypes([typeParam]);
    } else {
      setSelectedTypes([]);
    }
  }, [typeParam]);

  useEffect(() => {
    const handler = setTimeout(() => {
      setMaxPrice(sliderValue);
      setCurrentPage(1);
    }, 150);
    return () => clearTimeout(handler);
  }, [sliderValue]);

  const filteredProducts = useMemo(() => {
    let result = products;

    // Category filter
    if (categoryParam) {
      result = result.filter(p => p.category?.toLowerCase() === categoryParam.toLowerCase());
    }

    // Type filter
    if (selectedTypes.length > 0) {
      result = result.filter(p => {
        const productType = p.type || p.category;
        return selectedTypes.some(type => 
          productType?.toLowerCase().includes(type.toLowerCase())
        );
      });
    }

    // Price filter
    result = result.filter(p => p.price <= maxPrice);

    // Color filter
    if (selectedColors.length > 0) {
      result = result.filter(p => p.colors?.some(c => selectedColors.includes(c)));
    }

    // Size filter
    if (selectedSizes.length > 0) {
       result = result.filter(p => p.sizes?.some(s => selectedSizes.includes(s)));
    }

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(p => 
        p.name?.toLowerCase().includes(query) ||
        p.description?.toLowerCase().includes(query) ||
        p.category?.toLowerCase().includes(query)
      );
    }

    // Sorting
    switch(sortBy) {
      case "Price: Low to High":
        result = [...result].sort((a, b) => a.price - b.price);
        break;
      case "Price: High to Low":
        result = [...result].sort((a, b) => b.price - a.price);
        break;
      case "Newest":
        result = [...result].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        break;
      case "Most Popular":
        result = [...result].sort((a, b) => b.rating - a.rating);
        break;
      case "Name: A to Z":
        result = [...result].sort((a, b) => a.name?.localeCompare(b.name));
        break;
      case "Name: Z to A":
        result = [...result].sort((a, b) => b.name?.localeCompare(a.name));
        break;
      default:
        break;
    }

    return result;
  }, [products, categoryParam, maxPrice, selectedColors, selectedSizes, selectedTypes, sortBy, searchQuery]);

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

  const toggleType = (type) => {
    setSelectedTypes(prev => {
      const newTypes = prev.includes(type) 
        ? prev.filter(t => t !== type) 
        : [...prev, type];
      
      if (newTypes.length === 1) {
        router.push(`/shop?type=${newTypes[0].toLowerCase()}`, { scroll: false });
      } else if (newTypes.length === 0) {
        router.push('/shop', { scroll: false });
      }
      
      return newTypes;
    });
    setCurrentPage(1);
  };

  const resetFilters = () => {
    setSliderValue(filters.priceRange.max);
    setMaxPrice(filters.priceRange.max);
    setSelectedColors([]);
    setSelectedSizes([]);
    setSelectedTypes([]);
    setSearchQuery("");
    setSortBy("Most Popular");
    setCurrentPage(1);
    router.push("/shop");
  };

  const getActiveFilterCount = () => {
    let count = 0;
    if (selectedColors.length > 0) count++;
    if (selectedSizes.length > 0) count++;
    if (selectedTypes.length > 0) count++;
    if (searchQuery.trim()) count++;
    if (maxPrice < filters.priceRange.max) count++;
    return count;
  };

  const renderFilterSections = (isMobile = false) => (
    <div className="space-y-10">
      {/* Search Bar */}
      <div className="pb-8 border-b border-black/5">
        <h4 className="font-bold text-[10px] uppercase tracking-[0.2em] text-black/30 mb-4">Search</h4>
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Search products..."
            className="w-full px-4 py-3 text-sm border border-black/10 rounded-lg focus:outline-none focus:border-black/30 transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-black/5 rounded-full"
            >
              <X className="w-4 h-4 text-black/40" />
            </button>
          )}
        </div>
      </div>

      {/* Categories */}
      <div className="pb-8 border-b border-black/5">
        <h4 className="font-bold text-[10px] uppercase tracking-[0.2em] text-black/30 mb-6">Categories</h4>
        <div className="flex flex-col gap-3 text-xs">
          <Link 
            href="/shop" 
            className={`flex items-center justify-between py-1 transition-all ${!categoryParam ? "font-bold text-black" : "text-black/50 hover:text-black"}`}
          >
            <span>All Products</span>
            <span className="text-black/30 text-[10px]">{products.length}</span>
          </Link>
          {filters.categories.map((cat) => (
            <Link 
              key={cat} 
              href={`/shop?category=${cat.toLowerCase()}`}
              onClick={() => isMobile && setShowFilters(false)}
              className={`flex items-center justify-between py-1 transition-all ${categoryParam?.toLowerCase() === cat.toLowerCase() ? "font-bold text-black" : "text-black/50 hover:text-black"}`}
            >
              <span>{cat}</span>
              <span className="text-black/30 text-[10px]">
                {products.filter(p => p.category?.toLowerCase() === cat.toLowerCase()).length}
              </span>
            </Link>
          ))}
        </div>
      </div>

      {/* Product Types */}
      <div className="pb-8 border-b border-black/5">
        <h4 className="font-bold text-[10px] uppercase tracking-[0.2em] text-black/30 mb-6">Product Type</h4>
        <div className="flex flex-wrap gap-2">
          {PRODUCT_TYPES.map((type) => (
            <button
              key={type}
              onClick={() => toggleType(type)}
              className={`px-4 py-2 rounded-lg text-[10px] font-bold uppercase transition-all border ${
                selectedTypes.includes(type) 
                  ? "bg-black text-white border-black" 
                  : "bg-transparent text-black/40 border-black/10 hover:border-black hover:text-black"
              }`}
            >
              {type}
              {selectedTypes.includes(type) && (
                <X className="inline-block w-3 h-3 ml-2" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Price Range */}
      <div className="pb-8 border-b border-black/5">
        <h4 className="font-bold text-[10px] uppercase tracking-[0.2em] text-black/30 mb-6">
          Price Range
          <span className="ml-2 text-black">${filters.priceRange.min} - ${sliderValue}</span>
        </h4>
        <input 
          type="range" 
          className="w-full accent-black cursor-pointer" 
          min={filters.priceRange.min} 
          max={filters.priceRange.max} 
          step={10} 
          value={sliderValue} 
          onChange={(e) => setSliderValue(parseInt(e.target.value))} 
        />
        <div className="flex justify-between text-[10px] font-bold mt-3 text-black/40">
          <span>${filters.priceRange.min}</span>
          <span className="text-black font-bold">${sliderValue}</span>
          <span>${filters.priceRange.max}</span>
        </div>
      </div>

      {/* Colors */}
      <div className="pb-8 border-b border-black/5">
        <h4 className="font-bold text-[10px] uppercase tracking-[0.2em] text-black/30 mb-6">
          Colors
          {selectedColors.length > 0 && (
            <span className="ml-2 text-black">({selectedColors.length})</span>
          )}
        </h4>
        <div className="flex flex-wrap gap-3">
          {filters.colors.map((color) => {
             const colorMap = { 
               "Black": "#1A1A1A", 
               "Brown": "#4A3B2F", 
               "Tan": "#D2B48C", 
               "Camel": "#C19A6B", 
               "Navy": "#1B2E3C",
               "White": "#FFFFFF",
               "Gray": "#808080",
               "Red": "#8B0000",
               "Green": "#2F4F2F"
             };
             return (
              <button 
                key={color} 
                onClick={() => toggleColor(color)} 
                className="group relative"
                title={color}
              >
                <div 
                  className={`w-8 h-8 rounded-full border transition-all ${
                    selectedColors.includes(color) 
                      ? "ring-2 ring-black ring-offset-2 scale-110" 
                      : "border-black/10 hover:scale-110"
                  }`} 
                  style={{ backgroundColor: colorMap[color] || color.toLowerCase() }}
                >
                  {selectedColors.includes(color) && (
                    <Check className={`w-4 h-4 m-auto ${color === 'White' || color === 'Tan' ? 'text-black' : 'text-white'}`} />
                  )}
                </div>
                <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[8px] font-bold text-black/40 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                  {color}
                </span>
              </button>
             );
          })}
        </div>
      </div>

      {/* Sizes */}
      <div className="pb-8 border-b border-black/5">
        <h4 className="font-bold text-[10px] uppercase tracking-[0.2em] text-black/30 mb-6">
          Sizes
          {selectedSizes.length > 0 && (
            <span className="ml-2 text-black">({selectedSizes.length})</span>
          )}
        </h4>
        <div className="flex flex-wrap gap-2">
          {filters.sizes.map((size) => (
            <button 
              key={size} 
              onClick={() => toggleSize(size)} 
              className={`px-5 py-2 rounded-lg text-[10px] font-bold uppercase transition-all border ${
                selectedSizes.includes(size) 
                  ? "bg-black text-white border-black" 
                  : "bg-transparent text-black/40 border-black/10 hover:border-black hover:text-black"
              }`}
            >
              {size}
            </button>
          ))}
        </div>
      </div>

      {/* Reset Filters */}
      <button 
        onClick={resetFilters} 
        className="w-full text-black/40 hover:text-black py-4 font-bold text-[9px] uppercase tracking-[0.2em] transition-all hover:bg-black/5 rounded-lg"
      >
        Clear All Filters
        {getActiveFilterCount() > 0 && (
          <span className="ml-2 bg-black text-white px-2 py-1 rounded-full text-[8px]">
            {getActiveFilterCount()}
          </span>
        )}
      </button>
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
                {categoryParam ? categoryParam : selectedTypes[0] || "Shop All"}
             </h1>
             <p className="text-sm text-black/40 font-medium">
               {filteredProducts.length} {filteredProducts.length === 1 ? 'product' : 'products'} found
               {getActiveFilterCount() > 0 && ` • ${getActiveFilterCount()} active filter${getActiveFilterCount() > 1 ? 's' : ''}`}
             </p>
          </div>
          <div className="flex items-center justify-between md:justify-end gap-8 border-t border-black/5 md:border-none pt-8 md:pt-0">
             <div className="flex items-center gap-3">
                <span className="text-[10px] font-bold text-black/20 uppercase hidden sm:inline">Sort by:</span>
                <select 
                  value={sortBy} 
                  onChange={(e) => setSortBy(e.target.value)} 
                  className="font-bold text-sm bg-transparent focus:outline-none cursor-pointer uppercase pr-8"
                >
                  <option>Most Popular</option>
                  <option>Newest</option>
                  <option>Price: Low to High</option>
                  <option>Price: High to Low</option>
                  <option>Name: A to Z</option>
                  <option>Name: Z to A</option>
                </select>
             </div>
             <button 
               onClick={() => setShowFilters(true)} 
               className="lg:hidden flex items-center gap-2 px-6 py-3 bg-black text-white rounded-full text-[10px] font-bold uppercase tracking-widest active:scale-95 transition-transform relative"
             >
               <SlidersHorizontal className="w-4 h-4" /> 
               Filter
               {getActiveFilterCount() > 0 && (
                 <span className="absolute -top-1 -right-1 bg-red-500 text-white w-5 h-5 rounded-full text-[8px] flex items-center justify-center">
                   {getActiveFilterCount()}
                 </span>
               )}
             </button>
          </div>
        </div>

        <div className="flex flex-col lg:grid lg:grid-cols-12 gap-16">
          <aside className="hidden lg:block lg:col-span-3 h-fit sticky top-32">
            {renderFilterSections(false)}
          </aside>
          
          <main className="lg:col-span-9 min-h-[800px]">
            {loading ? (
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-10">
                 {[1,2,3,4,5,6].map(i => (
                   <div key={i} className="aspect-[3/4] bg-gray-100 animate-pulse rounded-2xl" />
                 ))}
              </div>
            ) : paginatedProducts.length > 0 ? (
              <>
                <div className="grid grid-cols-2 md:grid-cols-2 xl:grid-cols-3 gap-y-12 gap-x-6 md:gap-x-10">
                  {paginatedProducts.map((product) => (
                    <ProductCard key={product.id || product._id} product={product} />
                  ))}
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-40 border border-dashed border-black/10 rounded-3xl">
                <p className="text-2xl font-bold heading-font uppercase mb-4">No products found</p>
                <p className="text-sm text-black/40 mb-8">Try adjusting your filters or search terms</p>
                <button 
                  onClick={resetFilters} 
                  className="px-8 py-3 bg-black text-white rounded-full text-[10px] font-bold uppercase tracking-widest hover:bg-black/80 transition-colors"
                >
                  Clear All Filters
                </button>
              </div>
            )}

            {totalPages > 1 && (
              <div className="mt-20 flex items-center justify-center gap-12 border-t border-black/5 pt-12">
                <button 
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} 
                  disabled={currentPage === 1} 
                  className={`text-[10px] font-bold uppercase tracking-widest transition-all ${
                    currentPage === 1 ? "opacity-10 cursor-not-allowed" : "hover:text-black/60"
                  }`}
                >
                  Prev
                </button>
                <div className="flex gap-4">
                  {[...Array(totalPages)].map((_, i) => (
                    <button 
                      key={i + 1} 
                      onClick={() => setCurrentPage(i + 1)} 
                      className={`w-8 h-8 text-sm font-bold transition-all rounded-full ${
                        currentPage === i + 1 
                          ? "bg-black text-white" 
                          : "text-black/40 hover:text-black hover:bg-black/5"
                      }`}
                    >
                      {i + 1}
                    </button>
                  ))}
                </div>
                <button 
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} 
                  disabled={currentPage === totalPages} 
                  className={`text-[10px] font-bold uppercase tracking-widest transition-all ${
                    currentPage === totalPages ? "opacity-10 cursor-not-allowed" : "hover:text-black/60"
                  }`}
                >
                  Next
                </button>
              </div>
            )}
          </main>
        </div>
      </div>

      {/* Mobile Filter Drawer */}
      <AnimatePresence>
        {showFilters && (
          <>
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              onClick={() => setShowFilters(false)} 
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] lg:hidden" 
            />
            <motion.div 
              initial={{ x: "100%" }} 
              animate={{ x: 0 }} 
              exit={{ x: "100%" }} 
              transition={{ type: "spring", damping: 30, stiffness: 300 }} 
              className="fixed right-0 top-0 bottom-0 w-[85vw] max-w-sm bg-white z-[110] lg:hidden flex flex-col shadow-2xl"
            >
              <div className="p-6 flex items-center justify-between border-b border-black/5">
                <div>
                  <h3 className="text-xl font-bold heading-font uppercase">Filters</h3>
                  {getActiveFilterCount() > 0 && (
                    <p className="text-xs text-black/40 mt-1">{getActiveFilterCount()} active</p>
                  )}
                </div>
                <button 
                  onClick={() => setShowFilters(false)} 
                  className="p-2 hover:bg-black/5 rounded-full transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-6 scrollbar-hide">
                {renderFilterSections(true)}
              </div>
              <div className="p-6 border-t border-black/5 flex gap-4">
                <button 
                  onClick={resetFilters}
                  className="flex-1 text-black/60 hover:text-black py-4 rounded-xl font-bold text-[10px] uppercase tracking-widest border border-black/10 hover:border-black/30 transition-all"
                >
                  Reset
                </button>
                <button 
                  onClick={() => setShowFilters(false)} 
                  className="flex-1 bg-black text-white py-4 rounded-xl font-bold text-[10px] uppercase tracking-widest shadow-xl hover:bg-black/90 transition-colors"
                >
                  Apply Filters
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
