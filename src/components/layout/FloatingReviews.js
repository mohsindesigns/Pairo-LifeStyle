"use client";

import { useState, useEffect, useRef } from "react";
import { Star, X } from "lucide-react";
import { useSiteData } from "@/context/SiteContext";

function GoogleG({ className = "w-5 h-5" }) {
  return (
    <svg className={className} viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

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

  const cfg = siteData?.floatingReviews || {};
  const enabled = cfg.enabled !== false;
  const label = String(cfg.label || "").trim() || "Google Reviews";
  const top = Number.isFinite(Number(cfg.topOffset)) ? Number(cfg.topOffset) : 50;
  const reviews = Array.isArray(siteData?.testimonials?.reviews) ? siteData.testimonials.reviews : [];
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
              <GoogleG className="w-5 h-5 shrink-0" />
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
                      </div>
                    </div>
                    <GoogleG className="w-5 h-5 shrink-0" />
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
