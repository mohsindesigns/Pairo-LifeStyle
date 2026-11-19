"use client";

import { useState, useEffect, useRef } from "react";
import { Star, X } from "lucide-react";
import { useSiteData } from "@/context/SiteContext";

function relativeDate(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  const days = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (days < 1) return "Today";
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
  if (days < 30) { const w = Math.floor(days / 7); return `${w} week${w === 1 ? "" : "s"} ago`; }
  if (days < 365) { const m = Math.floor(days / 30); return `${m} month${m === 1 ? "" : "s"} ago`; }
  const y = Math.floor(days / 365);
  return `${y} year${y === 1 ? "" : "s"} ago`;
}

export default function FloatingReviews() {
  const siteData = useSiteData();
  const [open, setOpen] = useState(false);
  const closeRef = useRef(null);
  const [reviews, setReviews] = useState([]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/reviews/verified")
      .then((r) => (r.ok ? r.json() : { reviews: [] }))
      .then((d) => { if (!cancelled) setReviews(Array.isArray(d?.reviews) ? d.reviews : []); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const cfg = siteData?.floatingReviews || {};
  const enabled = cfg.enabled !== false;
  const rawLabel = String(cfg.label || "").trim();
  const label = !rawLabel || rawLabel === "Google Reviews" ? "Reviews" : rawLabel;
  const top = Number.isFinite(Number(cfg.topOffset)) ? Number(cfg.topOffset) : 50;
  const visible = enabled && reviews.length > 0;

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    const orig = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = orig;
    };
  }, [open]);

  if (!visible) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Open ${label}`}
        aria-haspopup="dialog"
        className="fixed right-0 z-[60] flex items-center gap-2 bg-black text-white px-2.5 py-4 rounded-l-xl shadow-lg hover:bg-neutral-800 transition-colors cursor-pointer"
        style={{ top: `${top}%`, transform: "translateY(-50%)" }}
      >
        <span
          className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] whitespace-nowrap"
          style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
        >
          <Star className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" aria-hidden="true" />
          {label}
        </span>
      </button>

      <div
        className={`fixed inset-0 z-[100] ${open ? "" : "pointer-events-none"}`}
        aria-hidden={!open}
      >
        <div
          onClick={() => setOpen(false)}
          className={`absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-300 ${open ? "opacity-100" : "opacity-0"}`}
        />
        <aside
          role="dialog"
          aria-modal="true"
          aria-label={label}
          className={`absolute right-0 top-0 h-full w-full sm:w-[420px] bg-neutral-100 shadow-2xl flex flex-col transition-transform duration-300 ease-out ${open ? "translate-x-0" : "translate-x-full"}`}
        >
          <div className="flex items-center justify-between gap-3 px-5 py-4 bg-white border-b border-black/5">
            <div className="flex items-center gap-2 min-w-0">
              <h2 className="text-sm font-bold uppercase tracking-tight text-black truncate">{label}</h2>
              <span className="text-[11px] text-black/40 font-bold">({reviews.length})</span>
            </div>
            <button
              ref={closeRef}
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close reviews"
              className="w-9 h-9 shrink-0 rounded-full flex items-center justify-center hover:bg-black/5 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <ul className="flex-1 overflow-y-auto overscroll-contain p-4 space-y-3 list-none m-0">
            {reviews.map((review, i) => {
              const name = String(review?.name || "").trim() || "Customer";
              const rating = Number(review?.rating) || 0;
              const date = relativeDate(review?.date || review?.createdAt);
              const image = review?.image || review?.avatar;
              return (
                <li key={i} className="bg-white rounded-2xl border border-black/5 shadow-sm p-4 flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-black text-white flex items-center justify-center font-bold text-base overflow-hidden shrink-0">
                        {image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={image} alt="" className="w-full h-full object-cover" />
                        ) : (
                          name[0].toUpperCase()
                        )}
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-black font-bold text-[13px] heading-font tracking-tight uppercase truncate">{name}</h3>
                        {date && <span className="text-black/40 text-[10px] font-medium">{date}</span>}
                        {review?.product && <span className="block text-black/50 text-[10px] font-medium truncate">on {review.product}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-0.5" role="img" aria-label={`${rating} out of 5 stars`}>
                    {[...Array(5)].map((_, s) => (
                      <Star key={s} className={`w-4 h-4 ${s < rating ? "fill-primary text-primary" : "text-black/10"}`} aria-hidden="true" />
                    ))}
                  </div>
                  {review?.text && (
                    <p className="text-black text-[13px] font-medium leading-relaxed heading-font tracking-tight whitespace-pre-line break-words">
                      {review.text}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        </aside>
      </div>
    </>
  );
}
