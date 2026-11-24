"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { X, Search, ArrowRight } from "lucide-react";
import siteData from "@/lib/data.json";
import { useSiteData } from "@/context/SiteContext";
import { getProductUrl, getCategoryUrl } from "@/lib/routes";
import { trackSearch } from "@/lib/analytics";
import { recordSearchResult } from "@/lib/siteAnalytics";
import { getOptimizedImage } from "@/lib/cloudinary";
import { formatMoney } from "@/lib/money";

const DEBOUNCE_MS = 250;
const MIN_QUERY = 2;
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';

function SkeletonRows() {
  return (
    <div className="space-y-3" aria-hidden="true">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="flex items-center gap-4 animate-pulse">
          <div className="w-16 h-20 bg-black/10 shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-1/3 bg-black/10" />
            <div className="h-4 w-2/3 bg-black/10" />
            <div className="h-3 w-16 bg-black/10" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function SearchModal({ isOpen, onClose }) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  // Last settled response: { q, products, categories, error }
  const [result, setResult] = useState({ q: "", products: [], categories: [], error: false });
  const [fetchedTop, setFetchedTop] = useState([]);
  const [activeIndex, setActiveIndex] = useState(-1);

  const dialogRef = useRef(null);
  const inputRef = useRef(null);
  const lastSearchTracked = useRef("");
  const resultCount = useRef({ q: "", count: 0 });
  const pendingRecord = useRef("");

  const { search } = siteData;
  const siteContextData = useSiteData();
  const contextCategories = siteContextData?._dbCategories;

  const trimmed = searchQuery.trim();
  const hasQuery = trimmed.length >= MIN_QUERY;
  const loading = hasQuery && result.q !== trimmed;

  // Popular categories (empty state / no-results). Prefer data the page already has; otherwise ask the API once.
  const topCategories = useMemo(() => {
    const fromCtx = (contextCategories || [])
      .filter((c) => c && c.name && c.slug && c.type !== "blog" && c.status !== "Draft" && !c.isDeleted)
      .sort((a, b) => (b.productCount || 0) - (a.productCount || 0))
      .slice(0, 8);
    return fromCtx.length ? fromCtx : fetchedTop;
  }, [contextCategories, fetchedTop]);

  const needsTopFetch = isOpen && !(contextCategories || []).length && fetchedTop.length === 0;
  useEffect(() => {
    if (!needsTopFetch) return;
    const ctrl = new AbortController();
    fetch("/api/search", { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d?.topCategories?.length) setFetchedTop(d.topCategories); })
      .catch(() => {});
    return () => ctrl.abort();
  }, [needsTopFetch]);

  // Debounced, abortable search against the lightweight endpoint.
  useEffect(() => {
    if (!isOpen || trimmed.length < MIN_QUERY) return;
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}`, { signal: ctrl.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const products = data.products || [];
        const categories = data.categories || [];
        resultCount.current = { q: trimmed.toLowerCase(), count: products.length + categories.length };
        if (pendingRecord.current === trimmed.toLowerCase()) {
          pendingRecord.current = "";
          recordSearchResult(trimmed, resultCount.current.count);
        }
        setResult({ q: trimmed, products, categories, error: false });
      } catch (err) {
        if (err?.name === "AbortError") return;
        setResult({ q: trimmed, products: [], categories: [], error: true });
      }
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [trimmed, isOpen]);

  // GA4 search + Pinterest search — fire once per settled query, not per keystroke.
  useEffect(() => {
    if (trimmed.length < MIN_QUERY) return;
    const t = setTimeout(() => {
      const key = trimmed.toLowerCase();
      if (lastSearchTracked.current === key) return;
      lastSearchTracked.current = key;
      trackSearch(trimmed);
      if (resultCount.current.q === key) recordSearchResult(trimmed, resultCount.current.count);
      else pendingRecord.current = key;
    }, 900);
    return () => clearTimeout(t);
  }, [trimmed]);

  // Prevent background scroll when modal is open
  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "unset";
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  // Focus the input on open; return focus to the opener on close.
  useEffect(() => {
    if (!isOpen) return;
    const opener = document.activeElement;
    const t = setTimeout(() => inputRef.current?.focus(), 100);
    return () => {
      clearTimeout(t);
      if (opener && typeof opener.focus === "function" && document.contains(opener)) opener.focus();
    };
  }, [isOpen]);

  const visibleResult = hasQuery && result.q === trimmed ? result : null;
  const items = useMemo(() => {
    if (!visibleResult) return [];
    return [
      ...visibleResult.categories.map((c) => ({ kind: "category", href: getCategoryUrl(c), key: `c-${c.slug}` })),
      ...visibleResult.products.map((p) => ({ kind: "product", href: getProductUrl(p), key: `p-${p._id}` })),
    ];
  }, [visibleResult]);

  useEffect(() => {
    if (activeIndex < 0 || !items[activeIndex]) return;
    document.getElementById(`search-item-${activeIndex}`)?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, items]);

  const go = (href) => {
    onClose();
    router.push(href);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
      return;
    }
    if (e.key === "ArrowDown" && items.length) {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % items.length);
      return;
    }
    if (e.key === "ArrowUp" && items.length) {
      e.preventDefault();
      setActiveIndex((i) => (i <= 0 ? items.length - 1 : i - 1));
      return;
    }
    if (e.key === "Enter" && e.target === inputRef.current && items.length) {
      e.preventDefault();
      go(items[activeIndex >= 0 ? activeIndex : 0].href);
      return;
    }
    if (e.key === "Tab" && dialogRef.current) {
      const nodes = Array.from(dialogRef.current.querySelectorAll(FOCUSABLE)).filter((n) => n.offsetParent !== null);
      if (!nodes.length) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      } else if (!dialogRef.current.contains(document.activeElement)) {
        e.preventDefault();
        first.focus();
      }
    }
  };

  const categoryChips = (list) => (
    <div className="flex flex-wrap gap-2">
      {list.map((c) => (
        <Link
          key={c.slug}
          href={getCategoryUrl(c)}
          onClick={onClose}
          className="inline-flex items-center min-h-[40px] px-4 border border-black/20 text-xs sm:text-sm font-semibold uppercase tracking-wider text-black hover:bg-black hover:text-white transition-colors"
        >
          {c.name}
        </Link>
      ))}
    </div>
  );

  const categoryCount = visibleResult ? visibleResult.categories.length : 0;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          onKeyDown={handleKeyDown}
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-label="Search"
          className="fixed inset-0 z-[100] bg-white flex flex-col h-screen"
        >
          {/* Header Panel */}
          <div
            onClick={(e) => e.stopPropagation()}
            className="border-b border-black/5 bg-white shrink-0"
          >
            <div className="container mx-auto px-4 sm:px-6 md:px-16 py-4 md:py-5 flex items-center justify-between gap-4 md:gap-6">
              <div className="flex items-center gap-3 md:gap-4 flex-1 bg-white border border-black rounded-[var(--radius,0px)] px-4 md:px-6 py-3 md:py-3.5 transition-all duration-300 focus-within:ring-1 focus-within:ring-black">
                <Search className="w-4 h-4 md:w-5 md:h-5 text-black flex-shrink-0" />
                <input
                  ref={inputRef}
                  type="text"
                  role="combobox"
                  aria-expanded={items.length > 0}
                  aria-controls="search-results"
                  aria-activedescendant={activeIndex >= 0 ? `search-item-${activeIndex}` : undefined}
                  aria-label="Search products"
                  autoComplete="off"
                  maxLength={60}
                  placeholder={search.placeholder || "Search Pairo..."}
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setActiveIndex(-1);
                  }}
                  className="w-full bg-transparent text-base md:text-lg font-semibold outline-none placeholder:text-black/60 uppercase tracking-[0.15em] text-black"
                />
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label={search.close || "Close"}
                className="flex items-center gap-2 md:gap-3 group"
              >
                <span className="hidden sm:inline text-xs font-bold uppercase tracking-[0.2em] text-black">{search.close}</span>
                <div className="p-2.5 bg-black/5 rounded-full group-hover:bg-black group-hover:text-white transition-all">
                  <X className="w-4 h-4 md:w-5 md:h-5" />
                </div>
              </button>
            </div>
          </div>

          {/* Results Area */}
          <div className="flex-1 overflow-y-auto scrollbar-hide py-4 md:py-6" role="region" aria-live="polite">
            <div className="container mx-auto px-4 sm:px-6 md:px-16" onClick={(e) => e.stopPropagation()}>
              {!hasQuery ? (
                /* Empty input: popular searches */
                <div className="max-w-3xl space-y-5">
                  {topCategories.length > 0 && (
                    <>
                      <p className="text-xs font-bold text-black uppercase tracking-[0.25em]">Popular searches</p>
                      {categoryChips(topCategories)}
                    </>
                  )}
                  <Link
                    href="/shop"
                    onClick={onClose}
                    className="inline-flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-black underline underline-offset-4"
                  >
                    Shop all <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              ) : loading ? (
                <div className="max-w-3xl" role="status" aria-label="Searching">
                  <SkeletonRows />
                </div>
              ) : visibleResult && items.length > 0 ? (
                <div id="search-results" role="listbox" className="max-w-3xl space-y-6">
                  {categoryCount > 0 && (
                    <div>
                      <p className="text-xs font-bold text-black uppercase tracking-[0.25em] mb-3">Categories</p>
                      <div className="flex flex-wrap gap-2">
                        {visibleResult.categories.map((c, i) => (
                          <Link
                            key={c.slug}
                            id={`search-item-${i}`}
                            role="option"
                            aria-selected={activeIndex === i}
                            href={getCategoryUrl(c)}
                            onClick={onClose}
                            className={`inline-flex items-center min-h-[40px] px-4 border text-xs sm:text-sm font-semibold uppercase tracking-wider transition-colors ${
                              activeIndex === i ? "bg-black text-white border-black" : "border-black/20 text-black hover:bg-black hover:text-white"
                            }`}
                          >
                            {c.name}
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                  {visibleResult.products.length > 0 && (
                    <div>
                      <p className="text-xs font-bold text-black uppercase tracking-[0.25em] mb-3">
                        {search.matchingProducts} ({visibleResult.products.length})
                      </p>
                      <div className="divide-y divide-black/5">
                        {visibleResult.products.map((product, pi) => {
                          const idx = categoryCount + pi;
                          const img = product.image ? getOptimizedImage(product.image, "thumbnail") : "/placeholder.jpg";
                          const onSale = product.compareAtPrice && product.compareAtPrice > product.price;
                          return (
                            <Link
                              key={product._id}
                              id={`search-item-${idx}`}
                              role="option"
                              aria-selected={activeIndex === idx}
                              href={getProductUrl(product)}
                              onClick={onClose}
                              className={`group flex items-center gap-4 py-3 px-2 -mx-2 transition-colors ${
                                activeIndex === idx ? "bg-black/5" : "hover:bg-black/[0.03]"
                              }`}
                            >
                              <div className="relative w-16 h-20 shrink-0 bg-black/5 border border-black/5 overflow-hidden">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={img} alt="" loading="lazy" decoding="async" className="absolute inset-0 w-full h-full object-cover" />
                              </div>
                              <div className="min-w-0 flex-1 space-y-1">
                                {product.categoryName ? (
                                  <p className="text-xs font-semibold text-black/60 uppercase tracking-wider truncate">{product.categoryName}</p>
                                ) : null}
                                <p className="text-sm md:text-base font-bold uppercase tracking-tight leading-snug line-clamp-2 text-black">{product.name}</p>
                                <p className="text-sm font-semibold text-black">
                                  ${formatMoney(product.price)}
                                  {onSale ? <span className="ml-2 text-xs font-medium text-black/50 line-through">${formatMoney(product.compareAtPrice)}</span> : null}
                                </p>
                              </div>
                              <ArrowRight className="w-4 h-4 text-black/40 group-hover:text-black shrink-0 hidden sm:block" />
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* No results / error */
                <div className="max-w-3xl space-y-5 py-4">
                  <p className="text-base md:text-lg font-bold text-black">
                    {visibleResult?.error || result.error
                      ? "Search is unavailable right now. Please try again."
                      : <>No matches for &ldquo;{trimmed}&rdquo;</>}
                  </p>
                  <p className="text-sm text-black/70">Check the spelling, try a shorter word, or browse below.</p>
                  {topCategories.length > 0 && (
                    <>
                      <p className="text-xs font-bold text-black uppercase tracking-[0.25em]">{search.popularCategories || "Popular categories"}</p>
                      {categoryChips(topCategories)}
                    </>
                  )}
                  <Link
                    href="/shop"
                    onClick={onClose}
                    className="inline-flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-black underline underline-offset-4"
                  >
                    Shop all <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
