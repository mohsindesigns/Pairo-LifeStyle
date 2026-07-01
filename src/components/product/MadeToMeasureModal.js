"use client";

import { useState, useEffect } from "react";
import { X, Info, Check, Ruler } from "lucide-react";

const UPPER_BODY_FIELDS = [
  { key: "chest",       label: "Chest",         hint: "Measure around the fullest part of your chest, keeping the tape horizontal." },
  { key: "neck",        label: "Neck",          hint: "Measure around the base of your neck where the collar sits." },
  { key: "shoulder",    label: "Shoulder",      hint: "Measure from one shoulder point to the other across the back." },
  { key: "sleeveLength",label: "Sleeve Length", hint: "From shoulder point to end of wrist, arm slightly bent." },
  { key: "bicep",       label: "Bicep",         hint: "Measure around the fullest part of your upper arm." },
  { key: "wrist",       label: "Wrist",         hint: "Measure around your wrist just below the wrist bone." },
];

const LOWER_BODY_FIELDS = [
  { key: "waist",       label: "Waist",         hint: "Measure around your natural waistline, the narrowest part of your torso." },
  { key: "lowerWaist",  label: "Lower Waist",   hint: "Measure around your hips at the widest point, ~8\" below your natural waist." },
  { key: "hips",        label: "Hips",          hint: "Measure around the fullest part of your hips." },
  { key: "jacketLength",label: "Jacket Length", hint: "From the back of your neck down to where you want the jacket to end." },
];

const PHYSICAL_PROFILE_FIELDS = [
  { key: "height", label: "Height", hint: "Your full standing height, measured without shoes." },
  { key: "weight", label: "Weight", hint: "Your approximate weight helps us fine-tune the fit pattern." },
];

const M2M_SURCHARGE = 25;

export default function MadeToMeasureModal({ product, isOpen, onClose, onAddToCart }) {
  const [unit, setUnit] = useState("inches");
  const [measurements, setMeasurements] = useState({});
  const [notes, setNotes] = useState("");
  const [activeTooltip, setActiveTooltip] = useState(null);
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setMeasurements({});
      setNotes("");
      setAdded(false);
      setUnit("inches");
    }
  }, [isOpen]);

  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleChange = (key, val) =>
    setMeasurements((prev) => ({ ...prev, [key]: val }));

  const handleAdd = () => {
    setAdding(true);
    const surchargedPrice = (product.price || 0) + M2M_SURCHARGE;
    onAddToCart({
      ...product,
      price: surchargedPrice,
      madeToMeasure: { enabled: true, surcharge: M2M_SURCHARGE, unit, measurements, notes },
    });
    setTimeout(() => {
      setAdding(false);
      setAdded(true);
      setTimeout(() => { onClose(); }, 900);
    }, 500);
  };

  const unitLabel = unit === "inches" ? "in" : "cm";

  const renderField = (field) => (
    <div key={field.key} className="relative">
      <label className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-black mb-1.5">
        {field.label}
        <button
          type="button"
          className="text-black/40 hover:text-black transition-colors"
          onMouseEnter={() => setActiveTooltip(field.key)}
          onMouseLeave={() => setActiveTooltip(null)}
          onClick={() => setActiveTooltip(activeTooltip === field.key ? null : field.key)}
        >
          <Info className="w-3 h-3" />
        </button>
      </label>

      {activeTooltip === field.key && (
        <div className="absolute left-0 -top-2 z-20 translate-y-[-100%] bg-black text-white text-[10px] leading-relaxed p-3 rounded-[var(--radius,0px)] shadow-xl w-52 pointer-events-none font-medium">
          {field.hint}
          <div className="absolute left-3 bottom-0 translate-y-full border-[5px] border-transparent border-t-black" />
        </div>
      )}

      <div className="relative">
        <input
          type="number"
          min="0"
          step="0.5"
          placeholder="0"
          value={measurements[field.key] || ""}
          onChange={(e) => handleChange(field.key, e.target.value)}
          className="w-full border border-black rounded-[var(--radius,0px)] px-3 py-2 pr-9 text-[12px] font-bold text-black bg-white outline-none focus:ring-1 focus:ring-black transition-all placeholder-black/30 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-semibold text-black uppercase tracking-wider">
          {unitLabel}
        </span>
      </div>
    </div>
  );

  const renderGroup = (title, fields, cols = "grid-cols-2 sm:grid-cols-3") => (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-black mb-3 pb-2 border-b border-black">
        {title}
      </p>
      <div className={`grid ${cols} gap-3`}>
        {fields.map(renderField)}
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-5">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative w-full max-w-[300px] xs:max-w-sm sm:max-w-lg md:max-w-xl max-h-[92dvh] bg-white flex flex-col overflow-hidden shadow-2xl border border-black animate-m2m-up rounded-[var(--radius,0px)]">

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-black shrink-0">
          <div>
            <p className="text-[13px] sm:text-[15px] font-bold uppercase tracking-widest text-black">
              Made to Measure
            </p>
            <p className="text-[9px] sm:text-[10px] font-semibold uppercase tracking-[0.15em] text-black/80 mt-0.5">
              Bespoke Fit — +${M2M_SURCHARGE} Surcharge
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center border border-black rounded-[var(--radius,0px)] hover:bg-black hover:text-white transition-all duration-300 active:scale-[0.98] text-black"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Unit Toggle ── */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-black/20 bg-black/[0.02] shrink-0">
          <span className="text-[10px] font-bold uppercase tracking-widest text-black">
            Measurement Unit
          </span>
          <div className="flex gap-1.5">
            {["inches", "cm"].map((u) => (
              <button
                key={u}
                type="button"
                onClick={() => setUnit(u)}
                className={`h-8 px-4 rounded-[var(--radius,0px)] text-[10px] font-semibold uppercase tracking-wider transition-all duration-200 border ${
                  unit === u
                    ? "bg-black text-white border-black"
                    : "bg-white text-black border-black/30 hover:border-black"
                }`}
              >
                {u}
              </button>
            ))}
          </div>
        </div>

        {/* ── Scrollable Body ── */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6 min-h-0">
          {renderGroup("Upper Body", UPPER_BODY_FIELDS, "grid-cols-2 sm:grid-cols-3")}
          {renderGroup("Lower Body & Length", LOWER_BODY_FIELDS, "grid-cols-2")}
          {renderGroup("Physical Profile", PHYSICAL_PROFILE_FIELDS, "grid-cols-2")}

          {/* Notes */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-black mb-2 pb-2 border-b border-black">
              Fitting Notes / Special Requests
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Posture details, shoulder pads, custom fit preferences..."
              className="w-full border border-black rounded-[var(--radius,0px)] px-3 py-2.5 text-[12px] font-medium text-black bg-white outline-none focus:ring-1 focus:ring-black transition-all placeholder-black/30 resize-none"
            />
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="px-5 py-4 border-t border-black bg-white shrink-0">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-medium text-black">Base Price</span>
            <span className="text-[11px] font-medium text-black">${product?.price?.toFixed(2)}</span>
          </div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-medium text-black">Made to Measure Upgrade</span>
            <span className="text-[11px] font-bold text-black">+${M2M_SURCHARGE}.00</span>
          </div>
          <div className="flex items-center justify-between bg-black text-white rounded-[var(--radius,0px)] px-4 py-3 mb-4">
            <span className="text-[11px] font-bold uppercase tracking-wider">Total</span>
            <span className="text-[15px] font-bold">${((product?.price || 0) + M2M_SURCHARGE).toFixed(2)}</span>
          </div>

          <button
            type="button"
            onClick={handleAdd}
            disabled={adding || added}
            className={`w-full h-12 rounded-[var(--radius,0px)] font-bold uppercase tracking-[0.2em] text-[12px] md:text-[13px] flex items-center justify-center gap-2.5 transition-all duration-300 border ${
              added
                ? "bg-emerald-600 border-emerald-600 text-white"
                : "bg-black border-black text-white hover:bg-black/90 active:scale-[0.98] disabled:opacity-60"
            }`}
          >
            {added ? (
              <><Check className="w-4 h-4" strokeWidth={2.5} /> Added to Cart!</>
            ) : adding ? (
              "Adding..."
            ) : (
              "Confirm & Add to Cart"
            )}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes m2mUp {
          from { opacity: 0; transform: scale(0.95) translateY(16px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
        .animate-m2m-up { animation: m2mUp 0.25s cubic-bezier(0.16, 1, 0.3, 1) both; }
      `}</style>
    </div>
  );
}