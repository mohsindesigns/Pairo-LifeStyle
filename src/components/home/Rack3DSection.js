"use client";

// Homepage 3D rack (CMS section "rack_3d"). Garments hang on a WebGL rail; hover turns a piece towards you,
// click opens it in 360° with colours, sizes and add-to-cart. What hangs here is arranged in
// Admin → Products → 3D Rack; the engine is the OFFCUT rack engine (src/lib/rack3d/engine.js).
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, X, ShoppingBag } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { getProductUrl } from "@/lib/routes";
import { formatCurrency } from "@/lib/currency";
import { loadRack3D } from "@/lib/rack3d/load";

const pad = (n) => String(n).padStart(2, "0");
const mod = (n, m) => ((n % m) + m) % m;

function variantFor(p, color, size) {
  const attrs = p.attributes || [];
  if (!attrs.length || !p.variantCombinations?.length) return null;
  const sel = {};
  for (const a of attrs) {
    if (a.type === "color") sel[a.name] = color;
    else if (a.type === "size") sel[a.name] = size;
  }
  const title = attrs.map((a) => sel[a.name]).filter(Boolean).join(" / ");
  return p.variantCombinations.find((v) => v.title === title) || null;
}
const inStock = (p, v) => (v ? (v.stock == null || v.stock > 0 || p.manageStock === false) : (p.manageStock === false || p.stock == null || p.stock > 0));

export default function Rack3DSection({ eyebrow = "The rack", title = "Spin it in 3D", subtitle, height = 720, products = [], headingLevel = "h2" }) {
  const items = useMemo(() => (products || []).filter((p) => p && p.rack3d && p.rack3d.lo), [products]);
  const canvasRef = useRef(null);
  const engRef = useRef(null);
  const [mode, setMode] = useState("loading"); // loading | gl | flat
  const [progress, setProgress] = useState(0);
  const [hover, setHover] = useState(-1);
  const [open, setOpen] = useState(false);
  const [idx, setIdx] = useState(0);
  const [color, setColor] = useState(0);
  const [size, setSize] = useState(0);
  const [added, setAdded] = useState(false);
  const { addToCart } = useCart();
  const Heading = headingLevel === "h1" ? "h1" : "h2";
  // The engine calls back with closures from when it was built, so it reaches the latest handlers and
  // the open/idx state through refs that are only written in handlers and effects (never during render).
  const view = useRef({ open: false, idx: 0 });
  const handlers = useRef({});

  // build the 3D rack once
  useEffect(() => {
    if (!items.length) return undefined;
    let dead = false;
    loadRack3D().then((Rack3D) => {
      if (dead || !canvasRef.current) return;
      if (!Rack3D.supported()) { setMode("flat"); return; }
      try {
        const eng = new Rack3D(canvasRef.current, {
          items: items.map((p) => ({ lo: p.rack3d.lo, hi: p.rack3d.hi, alt: p.rack3d.alt, scale: p.rack3d.scale || 1 })),
          onProgress: (v) => !dead && setProgress(v),
          onReady: () => { if (dead) return; setMode("gl"); requestAnimationFrame(() => { eng.resize(); eng.intro(0.05); }); },
          onFail: () => { if (!dead) setMode("flat"); },
          onHover: (h) => !dead && setHover(h),
          onClick: (i) => handlers.current.open?.(i),
        });
        engRef.current = eng;
      } catch { setMode("flat"); }
    }).catch(() => !dead && setMode("flat"));
    return () => {
      dead = true;
      if (engRef.current) { try { engRef.current.dispose(); } catch {} engRef.current = null; }
    };
  }, [items]);

  const firstSize = (p, ci) => {
    const sizes = p.sizes || [];
    const c = p.rack3d.colors[ci]?.label;
    const k = sizes.findIndex((s) => inStock(p, variantFor(p, c, s)));
    return k < 0 ? 0 : k;
  };

  function openPiece(i) {
    const eng = engRef.current;
    if (!eng) return;
    if (view.current.open) {
      if (i === view.current.idx) return;
      eng.goTo(i, i > view.current.idx ? 1 : -1);
    } else {
      eng.enterProduct(i);
    }
    view.current = { open: true, idx: i };
    setOpen(true); setIdx(i); setColor(0); setSize(firstSize(items[i], 0)); setAdded(false); setHover(-1);
  }
  const step = (d) => {
    const eng = engRef.current; if (!eng) return;
    const next = mod(idx + d, items.length);
    eng.step(d);
    view.current = { open: true, idx: next };
    setIdx(next); setColor(0); setSize(firstSize(items[next], 0)); setAdded(false);
  };
  const close = () => { engRef.current?.exitProduct(); view.current = { open: false, idx }; setOpen(false); setHover(-1); };
  useEffect(() => { handlers.current.open = openPiece; });
  const pickColor = (ci) => { if (ci === color) return; engRef.current?.setColor(ci); setColor(ci); setSize(firstSize(items[idx], ci)); setAdded(false); };

  useEffect(() => {
    if (!open) return undefined;
    const k = (e) => { if (e.key === "Escape") close(); else if (e.key === "ArrowRight") step(1); else if (e.key === "ArrowLeft") step(-1); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  });

  if (!items.length) return null;

  const cur = items[idx] || items[0];
  const curColor = cur.rack3d.colors[color] || cur.rack3d.colors[0];
  const sizes = cur.sizes || [];
  const curSize = sizes[size];
  const v = variantFor(cur, curColor?.label, curSize);
  const price = v?.price ?? cur.price;
  const compare = v?.compareAtPrice ?? cur.compareAtPrice;
  const available = inStock(cur, v);
  const hp = hover >= 0 ? items[hover] : null;

  const add = () => {
    const colorAttr = (cur.attributes || []).find((a) => a.type === "color");
    const sizeAttr = (cur.attributes || []).find((a) => a.type === "size");
    const selectedOptions = {};
    if (colorAttr && curColor?.label) selectedOptions[colorAttr.name] = curColor.label;
    if (sizeAttr && curSize) selectedOptions[sizeAttr.name] = curSize;
    addToCart({ ...cur, price, compareAtPrice: compare, image: v?.image || curColor?.img || cur.image, sku: v?.sku || cur.sku, selectedOptions }, true);
    setAdded(true);
  };

  const stageH = { "--rack-h": `${Math.max(420, Math.min(1000, Number(height) || 720))}px` };

  return (
    <section className="relative w-full overflow-hidden py-10 md:py-16" aria-label={title}>
      <div className="max-w-[1400px] mx-auto px-4 md:px-8 flex flex-col md:flex-row md:items-end md:justify-between gap-3 mb-2">
        <div>
          {eyebrow && <p className="text-xs md:text-sm font-semibold uppercase tracking-[0.2em] opacity-60">{eyebrow}</p>}
          {title && <Heading className="text-3xl md:text-5xl font-bold leading-tight break-words">{title}</Heading>}
        </div>
        {subtitle && <p className="text-sm md:text-base opacity-70 max-w-sm md:text-right">{subtitle}</p>}
      </div>

      {mode === "flat" ? (
        <div className="max-w-[1400px] mx-auto px-4 md:px-8 mt-6 flex gap-4 overflow-x-auto snap-x pb-2">
          {items.map((p) => (
            <Link key={p.id} href={getProductUrl(p)} className="snap-start shrink-0 w-44 md:w-56 group">
              <div className="aspect-[3/4] bg-black/5 rounded-xl overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.rack3d.colors[0]?.img || p.image} alt={p.name} className="w-full h-full object-contain group-hover:scale-105 transition-transform" />
              </div>
              <p className="mt-2 font-semibold text-sm line-clamp-2">{p.name}</p>
              <p className="text-sm opacity-70">{formatCurrency(p.price)}</p>
            </Link>
          ))}
        </div>
      ) : (
        <div className="relative w-full h-[calc(var(--rack-h)*0.72)] md:h-[var(--rack-h)]" style={stageH}>
          <canvas
            ref={canvasRef}
            className={`absolute inset-0 w-full h-full block outline-none transition-opacity duration-700 ${mode === "gl" ? "opacity-100" : "opacity-0"} ${hover >= 0 && !open ? "cursor-pointer" : ""}`}
            style={{ touchAction: "pan-y" }}
            role="img"
            aria-label="3D clothing rack. Hover a piece to turn it towards you, click to open it in 360 degrees."
          />

          {mode === "loading" && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <p className="text-xs uppercase tracking-[0.2em] opacity-60">Loading 3D rack — {Math.round(progress * 100)}%</p>
            </div>
          )}

          {/* caption under the rail */}
          {mode === "gl" && !open && (
            <div className="absolute left-4 right-4 md:left-8 md:right-8 bottom-4 md:bottom-6 grid grid-cols-1 md:grid-cols-3 items-end gap-2 pointer-events-none text-center md:text-left">
              <span className="hidden md:block text-xs uppercase tracking-[0.2em] opacity-60">Hover to turn · Click for 360°</span>
              <div className="text-center">
                <div className="text-xs uppercase tracking-[0.2em] opacity-60">{hp ? `${pad(hover + 1)} / ${pad(items.length)}` : `— / ${pad(items.length)}`}</div>
                <div className="text-lg md:text-2xl font-semibold mt-1 line-clamp-1">{hp ? hp.name : "Tap a piece to open it"}</div>
              </div>
              <span className="hidden md:block text-xs uppercase tracking-[0.2em] opacity-60 text-right">{hp ? formatCurrency(hp.price) : ""}</span>
            </div>
          )}

          {/* product view */}
          {open && (
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute top-3 left-4 md:top-6 md:left-8 text-xs uppercase tracking-[0.2em] opacity-60">{pad(idx + 1)} / {pad(items.length)}</div>
              <button type="button" onClick={close} className="pointer-events-auto absolute top-2 right-3 md:top-4 md:right-6 inline-flex items-center gap-2 rounded-full border border-current/20 bg-white/90 px-4 py-2 text-sm font-semibold shadow-sm hover:bg-white">
                Back to rack <X size={14} />
              </button>
              {items.length > 1 && (
                <>
                  <button type="button" aria-label="Previous piece" onClick={() => step(-1)} className="pointer-events-auto absolute left-2 md:left-8 top-[38%] w-11 h-11 md:w-14 md:h-14 rounded-full border-2 border-current bg-white/90 flex items-center justify-center hover:bg-black hover:text-white transition-colors"><ArrowLeft size={18} /></button>
                  <button type="button" aria-label="Next piece" onClick={() => step(1)} className="pointer-events-auto absolute right-2 md:right-8 lg:right-[440px] top-[38%] w-11 h-11 md:w-14 md:h-14 rounded-full border-2 border-current bg-white/90 flex items-center justify-center hover:bg-black hover:text-white transition-colors"><ArrowRight size={18} /></button>
                </>
              )}
              <div className="pointer-events-auto absolute left-1/2 -translate-x-1/2 bottom-3 md:bottom-6 w-[min(560px,94%)] lg:left-auto lg:translate-x-0 lg:right-8 lg:bottom-auto lg:top-1/2 lg:-translate-y-1/2 lg:w-[380px] rounded-2xl bg-white/95 shadow-lg backdrop-blur px-4 py-4 md:px-6 md:py-5 flex flex-col items-center gap-3 text-center">
                <p className="text-[11px] uppercase tracking-[0.2em] opacity-50">Drag to rotate · 360°</p>
                <h3 className="text-xl md:text-2xl font-semibold leading-tight">{cur.name}</h3>
                <p className="font-bold">
                  {formatCurrency(price)}
                  {compare > price && <span className="ml-2 line-through opacity-50 font-normal">{formatCurrency(compare)}</span>}
                </p>
                {cur.rack3d.colors.length > 1 || cur.rack3d.colors[0]?.label ? (
                  <div className="flex flex-wrap justify-center gap-2" role="group" aria-label="Colour">
                    {cur.rack3d.colors.map((c, ci) => (
                      <button key={ci} type="button" aria-pressed={ci === color} onClick={() => pickColor(ci)}
                        className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm ${ci === color ? "border-black font-semibold" : "border-black/15"}`}>
                        <span className="w-3.5 h-3.5 rounded-full border border-black/10" style={{ background: c.sw }} />{c.label || "Default"}
                      </button>
                    ))}
                  </div>
                ) : null}
                {sizes.length > 0 && (
                  <div className="flex flex-wrap justify-center gap-2" role="group" aria-label="Size">
                    {sizes.map((s, si) => {
                      const out = !inStock(cur, variantFor(cur, curColor?.label, s));
                      return (
                        <button key={s} type="button" aria-pressed={si === size} title={out ? `${s} — sold out` : s} onClick={() => { setSize(si); setAdded(false); }}
                          className={`min-w-11 rounded-lg border px-3 py-1.5 text-sm ${si === size ? "border-black bg-black text-white" : "border-black/15"} ${out ? "opacity-40 line-through" : ""}`}>
                          {s}
                        </button>
                      );
                    })}
                  </div>
                )}
                <div className="flex flex-wrap justify-center gap-2 w-full">
                  <button type="button" onClick={add} disabled={!available}
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-black text-white px-6 py-3 text-sm font-semibold disabled:opacity-40">
                    <ShoppingBag size={16} /> {!available ? "Sold out in this size" : added ? "Added — add another" : "Add to cart"}
                  </button>
                  <Link href={getProductUrl(cur)} className="inline-flex items-center justify-center rounded-full border border-black/20 px-6 py-3 text-sm font-semibold hover:border-black">Full details</Link>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
