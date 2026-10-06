"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Shuffle } from "lucide-react";
import ProductCard from "./ProductCard";

const COLUMN_CLASS = {
  "2": "grid-cols-2",
  "3": "grid-cols-2 md:grid-cols-3",
  "4": "grid-cols-2 md:grid-cols-4",
};

function shuffle(list) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

const formatPrice = (value) => `$${Number(value).toLocaleString("en-US")}`;

function formatRange(range) {
  return range.maxPrice !== null && range.maxPrice !== undefined
    ? `${formatPrice(range.minPrice)} – ${formatPrice(range.maxPrice)}`
    : `${formatPrice(range.minPrice)} and up`;
}

function RangeBlock({ range, index, layout, columns, exploreLabel, showCount, allowReshuffle, dark }) {
  const [items, setItems] = useState(range.products || []);
  const canReshuffle = allowReshuffle && range.randomize;

  useEffect(() => {
    setItems(range.randomize ? shuffle(range.products || []) : range.products || []);
  }, [range.products, range.randomize]);

  const exploreHref = `/shop?priceMin=${range.minPrice}${range.maxPrice !== null && range.maxPrice !== undefined ? `&priceMax=${range.maxPrice}` : ""}`;
  const countText = `${range.total} ${range.total === 1 ? "piece" : "pieces"}`;

  return (
    <article
      id={`price-range-${index}`}
      className={`scroll-mt-24 rounded-3xl border p-5 md:p-8 ${
        dark ? "border-white/10 bg-white/[0.03]" : "border-neutral-200 bg-white"
      }`}
    >
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5 pb-6">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            {range.badge && (
              <span className="rounded-full bg-black px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-white">
                {range.badge}
              </span>
            )}
            <span className="text-xs font-medium tabular-nums opacity-60">{formatRange(range)}</span>
          </div>
          {range.label && <h3 className="heading-font text-2xl md:text-3xl leading-tight">{range.label}</h3>}
          {showCount === "yes" && <p className="text-xs opacity-60">{countText}</p>}
        </div>

        <div className="flex items-center gap-3">
          {canReshuffle && (
            <button
              type="button"
              onClick={() => setItems(shuffle(range.products || []))}
              aria-label="Shuffle products"
              className={`rounded-full border p-3 transition-colors ${
                dark ? "border-white/20 hover:bg-white hover:text-black" : "border-neutral-300 hover:bg-neutral-900 hover:text-white"
              }`}
            >
              <Shuffle className="h-4 w-4" />
            </button>
          )}
          <Link
            href={exploreHref}
            className="inline-flex items-center gap-2 rounded-full bg-black px-6 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-white transition-colors hover:bg-neutral-800"
          >
            {exploreLabel}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      {items.length === 0 ? (
        <div className={`rounded-2xl border border-dashed p-10 text-center text-sm opacity-60 ${dark ? "border-white/20" : "border-neutral-300"}`}>
          No products in this price range yet.
        </div>
      ) : layout === "scroller" ? (
        <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2">
          {items.map((product) => (
            <div key={product._id} className="w-[72%] shrink-0 snap-start sm:w-[260px]">
              <ProductCard product={product} listName={range.label || "Price range"} />
            </div>
          ))}
        </div>
      ) : (
        <div className={`grid gap-4 md:gap-6 ${COLUMN_CLASS[columns] || COLUMN_CLASS["4"]}`}>
          {items.map((product) => (
            <ProductCard key={product._id} product={product} listName={range.label || "Price range"} />
          ))}
        </div>
      )}
    </article>
  );
}

export default function PriceRangeShowcase({
  eyebrow,
  title,
  subtitle,
  background = "light",
  layout = "grid",
  columns = "4",
  exploreLabel = "Explore More",
  showCount = "yes",
  shuffle: shuffleSetting = "yes",
  ranges = [],
}) {
  if (!ranges.length) return null;

  const dark = background === "dark";
  const allowReshuffle = shuffleSetting !== "no";

  return (
    <section className={`py-16 md:py-24 ${dark ? "bg-neutral-950 text-white" : "bg-[#faf9f6] text-neutral-900"}`}>
      <div className="mx-auto max-w-[1400px] space-y-12 px-5 md:space-y-14 md:px-10">
        <header className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl space-y-3">
            {eyebrow && <p className="text-[11px] font-semibold uppercase tracking-[0.3em] opacity-60">{eyebrow}</p>}
            {title && <h2 className="heading-font text-3xl leading-[1.05] tracking-tight md:text-5xl">{title}</h2>}
            {subtitle && <p className="text-sm leading-relaxed opacity-70 md:text-base">{subtitle}</p>}
          </div>
          {ranges.length > 1 && (
            <nav className="flex flex-wrap gap-2" aria-label="Jump to price range">
              {ranges.map((range, i) => (
                <a
                  key={i}
                  href={`#price-range-${i}`}
                  className={`rounded-full border px-4 py-1.5 text-xs font-medium transition-colors ${
                    dark ? "border-white/20 hover:bg-white hover:text-black" : "border-neutral-300 hover:bg-neutral-900 hover:text-white"
                  }`}
                >
                  {range.label || formatRange(range)}
                </a>
              ))}
            </nav>
          )}
        </header>

        {ranges.map((range, index) => (
          <RangeBlock
            key={index}
            range={range}
            index={index}
            layout={layout}
            columns={columns}
            exploreLabel={exploreLabel}
            showCount={showCount}
            allowReshuffle={allowReshuffle}
            dark={dark}
          />
        ))}
      </div>
    </section>
  );
}
