"use client";

import { useState, useMemo, useEffect, useTransition } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { SlidersHorizontal, ChevronRight, X, Check, Star } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import siteData from "@/lib/data.json";
import ProductCard from "@/components/home/ProductCard";
import { useSiteData } from "@/context/SiteContext";

const ITEMS_PER_PAGE = 24;

const silentReplaceState = (newUrl) => {
  if (typeof window === "undefined") return;
  try {
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    document.body.appendChild(iframe);
    const nativeReplace = iframe.contentWindow.history.replaceState;
    document.body.removeChild(iframe);
    nativeReplace.call(window.history, { ...window.history.state, as: newUrl, url: newUrl }, '', newUrl);
  } catch (e) {
    window.history.replaceState({ ...window.history.state, as: newUrl, url: newUrl }, '', newUrl);
  }
};

export default function ShopContentClient({ initialCategory = null, initialType = null }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  
  // Resolve from search parameters or fallback to server-passed props for SEO / SSR hydration alignment
  const categoryParam = searchParams.get("category") ?? initialCategory;
  const typeParam = searchParams.get("type") ?? initialType;
  
  const [products, setProducts] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(categoryParam || "");
  const [loading, setLoading] = useState(true);
  const { filters } = siteData;
  const siteContextData = useSiteData();
  const dbCategories = siteContextData?._dbCategories || [];

  // Enforce manual scroll restoration on mount to prevent Next.js layout jumps on route mutations
  useEffect(() => {
    if (typeof window !== "undefined" && "scrollRestoration" in window.history) {
      const originalScrollRestoration = window.history.scrollRestoration;
      window.history.scrollRestoration = "manual";
      return () => {
        window.history.scrollRestoration = originalScrollRestoration;
      };
    }
  }, []);
  
  useEffect(() => {
    fetch("/api/products")
      .then(res => res.json())
      .then(data => {
        const flatProducts = data.all ? data.all : (data.newArrivals ? [...data.newArrivals, ...data.topSelling] : data);
        setProducts(flatProducts);
        setLoading(false);
      });
  }, []);

  // 1. Dynamic Categories from actual product data or dbCategories
  const allCategories = useMemo(() => {
    const cats = new Set();
    products.forEach(p => {
      if (p.category) cats.add(p.category);
      if (p.categories && Array.isArray(p.categories)) {
        p.categories.forEach(c => {
          if (c && typeof c === 'object' && c.name) {
            cats.add(c.name);
          } else if (typeof c === 'string') {
            const dbCat = dbCategories.find(dc => dc._id === c || dc.slug === c);
            if (dbCat) cats.add(dbCat.name);
          }
        });
      }
    });
    dbCategories
      .filter(cat => cat.type === 'product' && cat.name)
      .forEach(cat => cats.add(cat.name));

    return Array.from(cats);
  }, [products, dbCategories]);

  // 2. Dynamic Colors from actual products (legacy colors array + structured attributes)
  const dynamicColors = useMemo(() => {
    const colorsMap = new Map(); // name -> { label, hex, image }
    products.forEach(p => {
      if (p.colors && Array.isArray(p.colors)) {
        p.colors.forEach(c => {
          if (c && typeof c === 'string') {
            const normalized = c.trim();
            if (!colorsMap.has(normalized.toLowerCase())) {
              colorsMap.set(normalized.toLowerCase(), { label: normalized, hex: null });
            }
          }
        });
      }
      if (p.attributes && Array.isArray(p.attributes)) {
        p.attributes.forEach(attr => {
          if (attr.name && (attr.name.toLowerCase() === 'color' || attr.name.toLowerCase() === 'colors')) {
            attr.values?.forEach(v => {
              if (v.label) {
                const normalized = v.label.trim();
                if (!colorsMap.has(normalized.toLowerCase())) {
                  colorsMap.set(normalized.toLowerCase(), {
                    label: normalized,
                    hex: v.hex || null,
                    image: v.image || null
                  });
                } else {
                  const existing = colorsMap.get(normalized.toLowerCase());
                  if (!existing.hex && v.hex) existing.hex = v.hex;
                  if (!existing.image && v.image) existing.image = v.image;
                }
              }
            });
          }
        });
      }
    });
    return Array.from(colorsMap.values());
  }, [products]);

  // 3. Dynamic Sizes from actual products (legacy sizes array + structured attributes)
  const dynamicSizes = useMemo(() => {
    const sizesSet = new Set();
    products.forEach(p => {
      if (p.sizes && Array.isArray(p.sizes)) {
        p.sizes.forEach(s => {
          if (s && typeof s === 'string') {
            sizesSet.add(s.trim());
          }
        });
      }
      if (p.attributes && Array.isArray(p.attributes)) {
        p.attributes.forEach(attr => {
          if (attr.name && (attr.name.toLowerCase() === 'size' || attr.name.toLowerCase() === 'sizes')) {
            attr.values?.forEach(v => {
              if (v.label) sizesSet.add(v.label.trim());
            });
          }
        });
      }
    });
    const order = ["XS", "S", "M", "L", "XL", "XXL", "XXXL"];
    return Array.from(sizesSet).sort((a, b) => {
      const idxA = order.indexOf(a.toUpperCase());
      const idxB = order.indexOf(b.toUpperCase());
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.localeCompare(b);
    });
  }, [products]);

  // 4. Dynamic Product Types from actual products
  const dynamicProductTypes = useMemo(() => {
    const types = new Set();
    products.forEach(p => {
      if (p.type && typeof p.type === 'string') {
        types.add(p.type.trim());
      }
      if (p.category && typeof p.category === 'string') {
        types.add(p.category.trim());
      }
      if (p.attributes && Array.isArray(p.attributes)) {
        p.attributes.forEach(attr => {
          if (attr.name && attr.name.toLowerCase() === 'type') {
            attr.values?.forEach(v => {
              if (v.label) types.add(v.label.trim());
            });
          }
        });
      }
    });
    return Array.from(types)
      .map(t => t.charAt(0).toUpperCase() + t.slice(1))
      .filter(Boolean);
  }, [products]);

  // 5. Dynamic Custom Attributes (excluding Color, Size, Type)
  const customAttributesMap = useMemo(() => {
    const attrMap = new Map(); // attrName -> Set of values
    products.forEach(p => {
      if (p.attributes && Array.isArray(p.attributes)) {
        p.attributes.forEach(attr => {
          if (attr.name) {
            const nameLower = attr.name.toLowerCase();
            if (nameLower !== 'color' && nameLower !== 'colors' && nameLower !== 'size' && nameLower !== 'sizes' && nameLower !== 'type') {
              if (!attrMap.has(attr.name)) {
                attrMap.set(attr.name, new Set());
              }
              attr.values?.forEach(v => {
                if (v.label) attrMap.get(attr.name).add(v.label.trim());
              });
            }
          }
        });
      }
    });
    const result = [];
    attrMap.forEach((valSet, key) => {
      if (valSet.size > 0) {
        result.push({
          name: key,
          values: Array.from(valSet)
        });
      }
    });
    return result;
  }, [products]);

  // 6. Dynamic Price limits
  const priceLimits = useMemo(() => {
    if (products.length === 0) return { min: 200, max: 2000 };
    let min = Infinity;
    let max = -Infinity;
    products.forEach(p => {
      const pPrice = Number(p.price);
      if (!isNaN(pPrice)) {
        if (pPrice < min) min = pPrice;
        if (pPrice > max) max = pPrice;
      }
    });
    if (min === Infinity) return { min: 200, max: 2000 };
    return {
      min: Math.floor(min / 10) * 10,
      max: Math.ceil(max / 10) * 10
    };
  }, [products]);
  
  // States for filters
  const [maxPrice, setMaxPrice] = useState(2000);
  const [sliderValue, setSliderValue] = useState(2000);
  const [selectedColors, setSelectedColors] = useState([]);
  const [selectedSizes, setSelectedSizes] = useState([]);
  const [selectedTypes, setSelectedTypes] = useState(typeParam ? [typeParam] : []);
  const [selectedCustomAttrs, setSelectedCustomAttrs] = useState({});
  const [sortBy, setSortBy] = useState("Most Popular");
  const [currentPage, setCurrentPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Keep states synchronized when url query params change externally (e.g. back/forward button)
  useEffect(() => {
    const cat = searchParams.get("category") ?? initialCategory;
    setSelectedCategory(cat || "");
    const typ = searchParams.get("type") ?? initialType;
    setSelectedTypes(typ ? [typ] : []);
  }, [searchParams, initialCategory, initialType]);

  // Sync price limits on product load
  useEffect(() => {
    if (products.length > 0) {
      setMaxPrice(priceLimits.max);
      setSliderValue(priceLimits.max);
    }
  }, [priceLimits, products.length]);

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
    if (selectedCategory) {
      const targetDbCat = dbCategories.find(c => 
        c.name.toLowerCase() === selectedCategory.toLowerCase() ||
        c.slug?.toLowerCase() === selectedCategory.toLowerCase() ||
        c._id === selectedCategory
      );
      result = result.filter(p => {
         const pCat = p.category || '';
         const pCats = p.categories || [];
         const matchesString = pCat.toLowerCase() === selectedCategory.toLowerCase() ||
                               (targetDbCat && pCat.toLowerCase() === targetDbCat.name.toLowerCase()) ||
                               (targetDbCat && pCat.toLowerCase() === targetDbCat.slug?.toLowerCase());
         const matchesId = targetDbCat && pCats.includes(targetDbCat._id);
         return matchesString || matchesId;
      });
    }

    // Type filter
    if (selectedTypes.length > 0) {
      result = result.filter(p => {
        const productType = p.type || p.category;
        const hasAttrType = p.attributes?.some(attr =>
          attr.name?.toLowerCase() === 'type' &&
          attr.values?.some(v => v.label && selectedTypes.some(type => v.label.toLowerCase() === type.toLowerCase()))
        );
        return selectedTypes.some(type => 
          productType?.toLowerCase().includes(type.toLowerCase())
        ) || hasAttrType;
      });
    }

    // Price filter
    result = result.filter(p => p.price <= maxPrice);

    // Color filter
    if (selectedColors.length > 0) {
      result = result.filter(p => {
        const hasLegacyColor = p.colors?.some(c => selectedColors.includes(c));
        const hasAttrColor = p.attributes?.some(attr => 
          (attr.name?.toLowerCase() === 'color' || attr.name?.toLowerCase() === 'colors') &&
          attr.values?.some(v => v.label && selectedColors.includes(v.label.trim()))
        );
        return hasLegacyColor || hasAttrColor;
      });
    }

    // Size filter
    if (selectedSizes.length > 0) {
      result = result.filter(p => {
        const hasLegacySize = p.sizes?.some(s => selectedSizes.includes(s));
        const hasAttrSize = p.attributes?.some(attr => 
          (attr.name?.toLowerCase() === 'size' || attr.name?.toLowerCase() === 'sizes') &&
          attr.values?.some(v => v.label && selectedSizes.includes(v.label.trim()))
        );
        return hasLegacySize || hasAttrSize;
      });
    }

    // Custom attributes filter
    Object.keys(selectedCustomAttrs).forEach(attrName => {
      const selectedVals = selectedCustomAttrs[attrName];
      if (selectedVals && selectedVals.length > 0) {
        result = result.filter(p => 
          p.attributes?.some(attr => 
            attr.name === attrName &&
            attr.values?.some(v => v.label && selectedVals.includes(v.label.trim()))
          )
        );
      }
    });

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
  }, [products, selectedCategory, maxPrice, selectedColors, selectedSizes, selectedTypes, selectedCustomAttrs, sortBy, searchQuery]);

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

  const handleCategorySelect = (catName) => {
    setSelectedCategory(catName);
    setCurrentPage(1);
    const params = new URLSearchParams(window.location.search);
    if (catName) {
      params.set("category", catName.toLowerCase());
    } else {
      params.delete("category");
    }
    const newUrl = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ''}`;
    silentReplaceState(newUrl);
  };

  const toggleType = (type) => {
    setSelectedTypes(prev => {
      const newTypes = prev.includes(type) 
        ? prev.filter(t => t !== type) 
        : [...prev, type];
      
      const params = new URLSearchParams(window.location.search);
      if (newTypes.length === 1) {
        params.set("type", newTypes[0].toLowerCase());
      } else {
        params.delete("type");
      }
      const newUrl = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ''}`;
      silentReplaceState(newUrl);
      
      return newTypes;
    });
    setCurrentPage(1);
  };

  const toggleCustomAttr = (attrName, value) => {
    setSelectedCustomAttrs(prev => {
      const current = prev[attrName] || [];
      const updated = current.includes(value)
        ? current.filter(v => v !== value)
        : [...current, value];
      const newSelections = { ...prev, [attrName]: updated };
      if (updated.length === 0) {
        delete newSelections[attrName];
      }
      return newSelections;
    });
    setCurrentPage(1);
  };

  const resetFilters = () => {
    setSliderValue(priceLimits.max);
    setMaxPrice(priceLimits.max);
    setSelectedColors([]);
    setSelectedSizes([]);
    setSelectedTypes([]);
    setSelectedCategory("");
    setSelectedCustomAttrs({});
    setSearchQuery("");
    setSortBy("Most Popular");
    setCurrentPage(1);
    silentReplaceState(window.location.pathname);
  };

  const getActiveFilterCount = () => {
    let count = 0;
    if (selectedColors.length > 0) count++;
    if (selectedSizes.length > 0) count++;
    if (selectedTypes.length > 0) count++;
    if (searchQuery.trim()) count++;
    if (maxPrice < priceLimits.max) count++;
    Object.keys(selectedCustomAttrs).forEach(k => {
      if (selectedCustomAttrs[k].length > 0) count++;
    });
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
          <button 
            type="button"
            onClick={() => handleCategorySelect("")}
            className={`flex items-center justify-between py-1 w-full text-left transition-all ${!selectedCategory ? "font-bold text-black" : "text-black/50 hover:text-black"}`}
          >
            <span>All Products</span>
            <span className="text-black/30 text-[10px]">{products.length}</span>
          </button>
          {allCategories.map((cat) => {
            const dbCat = dbCategories.find(c => c.name.toLowerCase() === cat.toLowerCase());
            const isSelected = selectedCategory && (
              selectedCategory.toLowerCase() === cat.toLowerCase() ||
              (dbCat && selectedCategory.toLowerCase() === dbCat.slug?.toLowerCase()) ||
              (dbCat && selectedCategory === dbCat._id)
            );
            return (
              <button 
                key={cat} 
                type="button"
                onClick={() => {
                  handleCategorySelect(dbCat ? dbCat.slug : cat.toLowerCase());
                  if (isMobile) setShowFilters(false);
                }}
                className={`flex items-center justify-between py-1 w-full text-left transition-all ${isSelected ? "font-bold text-black" : "text-black/50 hover:text-black"}`}
              >
                <span>{cat}</span>
                <span className="text-black/30 text-[10px]">
                  {products.filter(p => {
                    const pCat = p.category || '';
                    const pCats = p.categories || [];
                    const matchesString = pCat.toLowerCase() === cat.toLowerCase();
                    const matchesId = dbCat && pCats.includes(dbCat._id);
                    return matchesString || matchesId;
                  }).length}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Product Types */}
      <div className="pb-8 border-b border-black/5">
        <h4 className="font-bold text-[10px] uppercase tracking-[0.2em] text-black/30 mb-6">Product Type</h4>
        <div className="flex flex-wrap gap-2">
          {dynamicProductTypes.map((type) => (
            <button
              key={type}
              type="button"
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
          <span className="ml-2 text-black">${priceLimits.min} - ${sliderValue}</span>
        </h4>
        <input 
          type="range" 
          className="w-full accent-black cursor-pointer" 
          min={priceLimits.min} 
          max={priceLimits.max} 
          step={10} 
          value={sliderValue} 
          onChange={(e) => setSliderValue(parseInt(e.target.value))} 
        />
        <div className="flex justify-between text-[10px] font-bold mt-3 text-black/40">
          <span>${priceLimits.min}</span>
          <span className="text-black font-bold">${sliderValue}</span>
          <span>${priceLimits.max}</span>
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
          {dynamicColors.map((colorObj) => {
             const color = colorObj.label;
             const hex = colorObj.hex;
             const image = colorObj.image;
             
             const colorMapFallback = { 
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
             
             const backgroundColor = hex || colorMapFallback[color] || color.toLowerCase();
             
             return (
              <button 
                key={color} 
                type="button"
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
                  style={{ 
                    backgroundColor: image ? 'transparent' : backgroundColor,
                    backgroundImage: image ? `url(${image})` : 'none',
                    backgroundSize: 'cover'
                  }} 
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
          {dynamicSizes.map((size) => (
            <button 
              key={size} 
              type="button"
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

      {/* Custom Dynamic Attributes */}
      {customAttributesMap.map((attr) => (
        <div key={attr.name} className="pb-8 border-b border-black/5">
          <h4 className="font-bold text-[10px] uppercase tracking-[0.2em] text-black/30 mb-6">
            {attr.name}
            {selectedCustomAttrs[attr.name]?.length > 0 && (
              <span className="ml-2 text-black">({selectedCustomAttrs[attr.name].length})</span>
            )}
          </h4>
          <div className="flex flex-wrap gap-2">
            {attr.values.map((val) => {
              const isSelected = selectedCustomAttrs[attr.name]?.includes(val);
              return (
                <button
                  key={val}
                  type="button"
                  onClick={() => toggleCustomAttr(attr.name, val)}
                  className={`px-4 py-2 rounded-lg text-[10px] font-bold uppercase transition-all border ${
                    isSelected
                      ? "bg-black text-white border-black"
                      : "bg-transparent text-black/40 border-black/10 hover:border-black hover:text-black"
                  }`}
                >
                  {val}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {/* Reset Filters */}
      <button 
        type="button"
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
                 {(() => {
                   if (selectedCategory) {
                     const dbCat = dbCategories.find(c => 
                       c.name.toLowerCase() === selectedCategory.toLowerCase() ||
                       c.slug?.toLowerCase() === selectedCategory.toLowerCase() ||
                       c._id === selectedCategory
                     );
                     return dbCat ? dbCat.name : selectedCategory;
                   }
                   return selectedTypes[0] || "Shop All";
                 })()}
              </h1>
             <p className="text-sm text-black/40 font-medium">
               {filteredProducts.length} {filteredProducts.length === 1 ? 'product' : 'products'} found
               {getActiveFilterCount() > 0 && ` • ${getActiveFilterCount()} active filter${getActiveFilterCount() > 1 ? 's' : ''}`}
             </p>
          </div>
          <div className="flex items-center justify-between md:justify-end gap-8 border-t border-black/5 md:border-none pt-8 md:pt-0">
             <div className="flex items-center gap-3">
                <span className="text-[10px] font-bold text-black/20 uppercase tracking-widest hidden sm:inline">Sort by:</span>
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
               type="button"
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
                  type="button"
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
                  type="button"
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
                      type="button"
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
                  type="button"
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
                  type="button"
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
                  type="button"
                  onClick={resetFilters}
                  className="flex-1 text-black/60 hover:text-black py-4 rounded-xl font-bold text-[10px] uppercase tracking-widest border border-black/10 hover:border-black/30 transition-all"
                >
                  Reset
                </button>
                <button 
                  type="button"
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
