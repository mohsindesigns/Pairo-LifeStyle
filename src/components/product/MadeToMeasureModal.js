"use client";

import { useState, useEffect } from "react";
import { X, Info, Check } from "lucide-react";

const UPPER_BODY_FIELDS = [
  { key: "chest", label: "Chest", hint: "Measure around the fullest part of your chest, keeping the tape horizontal." },
  { key: "neck", label: "Neck", hint: "Measure around the base of your neck where the collar sits." },
  { key: "shoulder", label: "Shoulder", hint: "Measure from one shoulder point to the other across the back." },
  { key: "sleeveLength", label: "Sleeve Length", hint: "From shoulder point to the end of your wrist, with arm slightly bent." },
  { key: "bicep", label: "Bicep", hint: "Measure around the fullest part of your upper arm." },
  { key: "wrist", label: "Wrist", hint: "Measure around your wrist just below the wrist bone." },
];

const LOWER_BODY_FIELDS = [
  { key: "waist", label: "Waist", hint: "Measure around your natural waistline, the narrowest part of your torso." },
  { key: "lowerWaist", label: "Lower Waist", hint: "Measure around your hips at the widest point, about 8\" below your natural waist." },
  { key: "hips", label: "Hips", hint: "Measure around the fullest part of your hips." },
  { key: "jacketLength", label: "Jacket Length", hint: "From the back of your neck down to where you want the jacket to end." },
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

  // Reset on open
  useEffect(() => {
    if (isOpen) {
      setMeasurements({});
      setNotes("");
      setAdded(false);
      setUnit("inches");
    }
  }, [isOpen]);

  // Trap scroll
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
      setTimeout(() => { onClose(); }, 800);
    }, 500);
  };

  const unitLabel = unit === "inches" ? "in" : "cm";

  const renderField = (field) => (
    <div key={field.key} className="relative">
      {/* Label */}
      <label className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-black mb-1">
        {field.label}
        <span
          className="text-black/30 hover:text-black/60 cursor-pointer transition-colors"
          onMouseEnter={() => setActiveTooltip(field.key)}
          onMouseLeave={() => setActiveTooltip(null)}
          onClick={() => setActiveTooltip(activeTooltip === field.key ? null : field.key)}
        >
          <Info className="w-2.5 h-2.5" />
        </span>
      </label>

      {/* Tooltip */}
      {activeTooltip === field.key && (
        <div className="absolute left-0 -top-1.5 z-10 translate-y-[-100%] bg-black text-white text-[9px] leading-relaxed p-2 rounded-[2px] shadow-lg w-48 pointer-events-none">
          {field.hint}
          <div className="absolute left-2.5 bottom-0 translate-y-full border-[3px] border-transparent border-t-black" />
        </div>
      )}

      {/* Input */}
      <div className="relative">
        <input
          type="number"
          min="0"
          step="0.5"
          placeholder="0"
          value={measurements[field.key] || ""}
          onChange={(e) => handleChange(field.key, e.target.value)}
          className="w-full border border-black/12 rounded-[2px] px-2 py-1.5 pr-8 text-[11px] text-black outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/10 transition-all bg-white placeholder-black/25 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[8px] font-bold text-black/50 uppercase">
          {unitLabel}
        </span>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[999] flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/55 backdrop-blur-[2px]" onClick={onClose} />

      {/* Panel */}
      <div className="relative w-full sm:max-w-xl max-h-[92dvh] bg-white rounded-t-[14px] sm:rounded-[3px] shadow-2xl flex flex-col overflow-hidden animate-slideUp">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-black/8 shrink-0">
          <div>
            <p className="text-[12px] font-bold uppercase tracking-widest text-black">Made to Measure</p>
            <p className="text-[9px] text-black/55 uppercase tracking-[0.1em] font-semibold mt-0.5">
              Bespoke Fit Configuration — +${M2M_SURCHARGE} Surcharge
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-black/5 rounded-full transition-colors">
            <X className="w-3.5 h-3.5 text-black/60" />
          </button>
        </div>

        {/* Unit Selector */}
        <div className="px-5 pt-3 pb-2.5 shrink-0 flex items-center justify-between border-b border-black/[0.04]">
          <span className="text-[9px] font-bold uppercase tracking-widest text-black">
            Measurement Unit
          </span>
          <div className="flex rounded-[2px] border border-black/12 overflow-hidden text-[9px] font-bold">
            {["inches", "cm"].map((u) => (
              <button
                key={u}
                type="button"
                onClick={() => setUnit(u)}
                className={`px-3 py-1 transition-colors uppercase tracking-wider ${unit === u ? "bg-primary text-white" : "bg-white text-black hover:bg-black/5"
                  }`}
              >
                {u}
              </button>
            ))}
          </div>
        </div>

        {/* Form Body — scrollable */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 min-h-0">

          {/* Upper Body */}
          <div className="space-y-2">
            <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-black border-b border-black/8 pb-1">
              Upper Body Specs
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {UPPER_BODY_FIELDS.map(renderField)}
            </div>
          </div>

          {/* Lower Body */}
          <div className="space-y-2">
            <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-black border-b border-black/8 pb-1">
              Lower Body &amp; Length
            </p>
            <div className="grid grid-cols-2 gap-3">
              {LOWER_BODY_FIELDS.map(renderField)}
            </div>
          </div>

          {/* Physical Profile */}
          <div className="space-y-2">
            <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-black border-b border-black/8 pb-1">
              Physical Profile
            </p>
            <div className="grid grid-cols-2 gap-3">
              {PHYSICAL_PROFILE_FIELDS.map(renderField)}
            </div>
          </div>

          {/* Additional Notes */}
          <div className="space-y-1">
            <label className="block text-[9px] font-bold uppercase tracking-[0.15em] text-black">
              Fitting Notes / Requests (Optional)
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Posture detail, shoulder pads request, custom fit preferences..."
              className="w-full border border-black/12 rounded-[2px] px-2 py-1.5 text-[11px] text-black placeholder-black/25 outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/10 transition-all bg-white resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-black/8 bg-white shrink-0">
          {/* Price Calculations */}
          <div className="flex items-center justify-between text-[11px] mb-1.5 px-1">
            <span className="text-black font-medium">Base Product Price</span>
            <span className="font-bold text-black">${product?.price?.toFixed(2)}</span>
          </div>
          <div className="flex items-center justify-between text-[11px] mb-3 px-1">
            <span className="text-black font-medium">Made to Measure Upgrade</span>
            <span className="font-bold text-emerald-600">+${M2M_SURCHARGE}.00</span>
          </div>
          <div className="flex items-center justify-between mb-4 py-2.5 px-3 bg-primary text-white rounded-[2px]">
            <span className="text-[10px] font-bold uppercase tracking-wider">Total</span>
            <span className="text-[13px] font-bold">${((product?.price || 0) + M2M_SURCHARGE).toFixed(2)}</span>
          </div>

          <button
            type="button"
            onClick={handleAdd}
            disabled={adding || added}
            className={`w-full h-10 rounded-[2px] font-bold uppercase tracking-[0.15em] text-[11px] flex items-center justify-center gap-2 transition-all duration-300 ${added
              ? "bg-emerald-600 text-white"
              : "bg-primary text-white hover:bg-primary/95 active:scale-[0.99]"
              }`}
          >
            {added ? (
              <>
                <Check className="w-3.5 h-3.5" strokeWidth={2.5} />
                Added to Cart!
              </>
            ) : adding ? (
              "Adding..."
            ) : (
              "Confirm & Add to Cart"
            )}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(28px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .animate-slideUp { animation: slideUp 0.28s cubic-bezier(0.16, 1, 0.3, 1) both; }
      `}</style>
    </div>
  );
}
