"use client";

import { useState, useEffect } from "react";
import { X, Info, Ruler } from "lucide-react";

import { MADE_TO_MEASURE_SURCHARGE, resolveVariantForItem } from "@/lib/productPricing";

// `min` / `max` are in inches; centimetres are derived. Weight is the exception: pounds (inches mode) or kilograms (cm mode).
const UPPER_BODY_FIELDS = [
  { key: "chest", label: "Chest", required: true, min: 20, max: 70, hint: "Measure around the fullest part of your chest, keeping the tape horizontal." },
  { key: "neck", label: "Neck", min: 8, max: 30, hint: "Measure around the base of your neck where the collar sits." },
  { key: "shoulder", label: "Shoulder", required: true, min: 10, max: 30, hint: "Measure from one shoulder point to the other across the back." },
  { key: "sleeveLength", label: "Sleeve Length", required: true, min: 15, max: 40, hint: "From shoulder point to end of wrist, arm slightly bent." },
  { key: "bicep", label: "Bicep", min: 6, max: 30, hint: "Measure around the fullest part of your upper arm." },
  { key: "wrist", label: "Wrist", min: 4, max: 12, hint: "Measure around your wrist just below the wrist bone." },
];

const LOWER_BODY_FIELDS = [
  { key: "waist", label: "Waist", min: 20, max: 70, hint: "Measure around your natural waistline, the narrowest part of your torso." },
  { key: "lowerWaist", label: "Lower Waist", min: 20, max: 70, hint: "Measure around your hips at the widest point, ~8\" below your natural waist." },
  { key: "hips", label: "Hips", min: 20, max: 80, hint: "Measure around the fullest part of your hips." },
  { key: "jacketLength", label: "Jacket Length", required: true, min: 15, max: 45, hint: "From the back of your neck down to where you want the jacket to end." },
];

const PHYSICAL_PROFILE_FIELDS = [
  { key: "height", label: "Height", min: 40, max: 90, hint: "Your full standing height, measured without shoes." },
  { key: "weight", label: "Weight", weight: true, min: 60, max: 600, hint: "Your approximate weight helps us fine-tune the fit pattern." },
];

const ALL_FIELDS = [...UPPER_BODY_FIELDS, ...LOWER_BODY_FIELDS, ...PHYSICAL_PROFILE_FIELDS];

// Same constant the server adds in resolveAuthoritativePrice (src/lib/productPricing.js).
const M2M_SURCHARGE = MADE_TO_MEASURE_SURCHARGE;
const LATER_NOTE = "[Customer will send measurements later]";

function fieldUnit(field, unit) {
  if (field.weight) return unit === "inches" ? "lb" : "kg";
  return unit === "inches" ? "in" : "cm";
}

function fieldRange(field, unit) {
  if (unit === "inches") return [field.min, field.max];
  if (field.weight) return [Math.round(field.min * 0.4536), Math.round(field.max * 0.4536)];
  return [Math.round(field.min * 2.54), Math.round(field.max * 2.54)];
}

function validateMeasurements(measurements, unit, later) {
  const errors = {};
  for (const field of ALL_FIELDS) {
    const raw = String(measurements[field.key] ?? "").trim();
    if (!raw) {
      if (field.required && !later) errors[field.key] = "Required";
      continue;
    }
    const n = Number(raw);
    const [min, max] = fieldRange(field, unit);
    if (!Number.isFinite(n) || n <= 0) errors[field.key] = "Enter a number greater than 0";
    else if (n < min || n > max) errors[field.key] = `Enter ${min}-${max} ${fieldUnit(field, unit)}`;
  }
  return errors;
}

export default function MadeToMeasureModal(props) {
  // The form mounts fresh each time the modal opens, so its state never needs resetting.
  if (!props.isOpen) return null;
  return <MadeToMeasureForm {...props} />;
}

function MadeToMeasureForm({ product, selectedOptions = {}, onClose, onAddToCart, onHowToMeasure }) {
  const [unit, setUnit] = useState("inches");
  const [measurements, setMeasurements] = useState({});
  const [notes, setNotes] = useState("");
  const [later, setLater] = useState(false);
  const [errors, setErrors] = useState({});
  const [activeTooltip, setActiveTooltip] = useState(null);
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  // Price exactly as the server computes it (resolveAuthoritativePrice): the variant matching the selected options -
  // with Size removed, so usually the product's own price - plus the fixed surcharge. This can differ from the headline
  // price on the page when sizes are priced differently, because Size is replaced by the measurements.
  const variant = resolveVariantForItem(product, { selectedOptions });
  const basePrice = Number(variant?.price !== undefined && variant?.price !== null ? variant.price : product?.price) || 0;
  const total = basePrice + M2M_SURCHARGE;

  const handleChange = (key, val) => {
    setMeasurements((prev) => ({ ...prev, [key]: val }));
    if (errors[key]) setErrors((prev) => { const next = { ...prev }; delete next[key]; return next; });
  };

  const handleUnitChange = (next) => {
    if (next === unit) return;
    // Convert what has been typed so the numbers keep describing the same body.
    setMeasurements((prev) => {
      const converted = {};
      for (const field of ALL_FIELDS) {
        const n = Number(prev[field.key]);
        if (prev[field.key] === undefined || prev[field.key] === "" || !Number.isFinite(n)) {
          if (prev[field.key] !== undefined) converted[field.key] = prev[field.key];
          continue;
        }
        const factor = field.weight ? 0.45359237 : 2.54;
        const value = next === "cm" ? n * factor : n / factor;
        converted[field.key] = String(Math.round(value * 10) / 10);
      }
      return converted;
    });
    setUnit(next);
    setErrors({});
  };

  const handleLaterChange = (checked) => {
    setLater(checked);
    if (checked) {
      // Only the required-field errors go away; range errors on filled fields stay.
      setErrors((prev) => {
        const next = { ...prev };
        for (const field of ALL_FIELDS) if (next[field.key] === "Required") delete next[field.key];
        return next;
      });
    }
  };

  const focusField = (key) => {
    const el = document.getElementById(`m2m-field-${key}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.focus({ preventScroll: true });
  };

  const handleAdd = () => {
    const found = validateMeasurements(measurements, unit, later);
    setErrors(found);
    const first = ALL_FIELDS.find((f) => found[f.key]);
    if (first) {
      window.requestAnimationFrame(() => focusField(first.key));
      return;
    }

    setAdding(true);
    const cleaned = {};
    for (const field of ALL_FIELDS) {
      const raw = String(measurements[field.key] ?? "").trim();
      if (raw) cleaned[field.key] = raw;
    }
    const trimmedNotes = notes.trim();
    // `measurementsLater` is the structured flag; the same fact is also written into the notes because the stored order
    // item only keeps the fields in the Order schema, and the notes are what the admin order page and vendor sheet show.
    const finalNotes = later ? `${LATER_NOTE}${trimmedNotes ? ` ${trimmedNotes}` : ""}` : trimmedNotes;
    onAddToCart({
      ...product,
      price: total,
      // The shopper's chosen attributes (e.g. Color), same as a normal add-to-cart. Without them checkout rejects the line
      // for a product that has attributes besides Size. The parent has already removed Size (measurements replace it).
      selectedOptions,
      madeToMeasure: {
        enabled: true,
        surcharge: M2M_SURCHARGE,
        unit,
        measurements: cleaned,
        notes: finalNotes,
        ...(later ? { measurementsLater: true } : {}),
      },
    });
    setTimeout(() => {
      setAdding(false);
      setAdded(true);
      setTimeout(() => { onClose(); }, 900);
    }, 500);
  };

  const renderField = (field) => {
    const error = errors[field.key];
    const required = field.required && !later;
    const errorId = `m2m-error-${field.key}`;
    return (
      <div key={field.key} className="relative">
        <div className="flex items-center gap-1.5 mb-1.5">
          <label
            htmlFor={`m2m-field-${field.key}`}
            className="text-[11px] font-medium uppercase tracking-widest text-black"
          >
            {field.label}
            {required && <span aria-hidden="true" className="text-red-600"> *</span>}
          </label>
          <button
            type="button"
            aria-label={`How to measure: ${field.label}`}
            className="text-black/40 hover:text-black transition-colors p-1 -m-1"
            onMouseEnter={() => setActiveTooltip(field.key)}
            onMouseLeave={() => setActiveTooltip(null)}
            onClick={() => setActiveTooltip(activeTooltip === field.key ? null : field.key)}
          >
            <Info className="w-3.5 h-3.5" />
          </button>
        </div>

        {activeTooltip === field.key && (
          <div className="absolute left-0 -top-2 z-20 translate-y-[-100%] bg-black text-white text-[11px] leading-relaxed p-3 rounded-[var(--radius,0px)] shadow-xl w-56 max-w-full pointer-events-none font-medium">
            {field.hint}
            <div className="absolute left-3 bottom-0 translate-y-full border-[5px] border-transparent border-t-black" />
          </div>
        )}

        <div className="relative">
          <input
            id={`m2m-field-${field.key}`}
            type="number"
            inputMode="decimal"
            min="0"
            step="0.5"
            placeholder="0"
            value={measurements[field.key] || ""}
            onChange={(e) => handleChange(field.key, e.target.value)}
            aria-invalid={error ? "true" : undefined}
            aria-required={required ? "true" : undefined}
            aria-describedby={error ? errorId : undefined}
            className={`w-full h-11 border rounded-[var(--radius,0px)] px-3 pr-10 text-base sm:text-[13px] font-bold text-black bg-white outline-none focus:ring-1 transition-all placeholder-black/30 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${error ? "border-red-600 focus:ring-red-600" : "border-black focus:ring-black"}`}
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-black uppercase tracking-wider pointer-events-none">
            {fieldUnit(field, unit)}
          </span>
        </div>
        {error && (
          <p id={errorId} role="alert" className="mt-1 text-[11px] font-medium text-red-600">
            {error}
          </p>
        )}
      </div>
    );
  };

  const renderGroup = (title, fields, cols = "sm:grid-cols-2") => (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-black mb-3 pb-2 border-b border-black">
        {title}
      </p>
      <div className={`grid grid-cols-1 ${cols} gap-x-3 gap-y-4`}>
        {fields.map(renderField)}
      </div>
    </div>
  );

  const hasErrors = Object.keys(errors).length > 0;

  return (
    <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-0 sm:p-5">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="m2m-title"
        className="relative w-full sm:max-w-xl max-h-[94dvh] bg-white flex flex-col overflow-hidden shadow-2xl border border-black animate-m2m-up rounded-[var(--radius,0px)]"
      >

        {/* ── Header ── */}
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-black shrink-0">
          <div className="min-w-0">
            <p id="m2m-title" className="text-[13px] sm:text-[15px] font-bold uppercase tracking-widest text-black">
              Made to Measure
            </p>
            <p className="text-[9px] sm:text-[10px] font-semibold uppercase tracking-[0.15em] text-black/80 mt-0.5">
              Bespoke Fit - +${M2M_SURCHARGE} Surcharge
            </p>
            <p className="text-[12px] text-black/70 mt-2 leading-snug">
              Made to order - allow extra production time.
              {onHowToMeasure && (
                <>
                  {" "}
                  <button
                    type="button"
                    onClick={onHowToMeasure}
                    className="inline-flex items-center gap-1 font-semibold text-black underline underline-offset-2 hover:text-black/70"
                  >
                    <Ruler className="w-3 h-3" /> How to measure
                  </button>
                </>
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-9 h-9 shrink-0 flex items-center justify-center border border-black rounded-[var(--radius,0px)] hover:bg-black hover:text-white transition-all duration-300 active:scale-[0.98] text-black"
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
                onClick={() => handleUnitChange(u)}
                aria-pressed={unit === u}
                className={`h-9 px-4 rounded-[var(--radius,0px)] text-[10px] font-semibold uppercase tracking-wider transition-all duration-200 border ${unit === u
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
          <label className="flex items-start gap-3 p-3 border border-black/30 rounded-[var(--radius,0px)] bg-black/[0.02] cursor-pointer">
            <input
              type="checkbox"
              checked={later}
              onChange={(e) => handleLaterChange(e.target.checked)}
              className="mt-0.5 w-5 h-5 shrink-0 accent-black"
            />
            <span className="text-[13px] leading-snug text-black">
              <span className="font-bold">I will send my measurements later</span>
              <span className="block text-black/60 text-[12px] mt-0.5">
                We will contact you after checkout to collect them. Production starts once we have them.
              </span>
            </span>
          </label>

          {renderGroup("Upper Body", UPPER_BODY_FIELDS)}
          {renderGroup("Lower Body & Length", LOWER_BODY_FIELDS)}
          {renderGroup("Physical Profile", PHYSICAL_PROFILE_FIELDS)}

          {/* Notes */}
          <div>
            <label htmlFor="m2m-notes" className="block text-[10px] font-bold uppercase tracking-[0.2em] text-black mb-2 pb-2 border-b border-black">
              Fitting Notes / Special Requests
            </label>
            <textarea
              id="m2m-notes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Posture details, shoulder pads, custom fit preferences..."
              className="w-full border border-black rounded-[var(--radius,0px)] px-3 py-2.5 text-base sm:text-[13px] font-medium text-black bg-white outline-none focus:ring-1 focus:ring-black transition-all placeholder-black/30 resize-none"
            />
          </div>
        </div>

        {/* ── Footer (stays visible while the form scrolls) ── */}
        <div className="px-5 py-3 sm:py-4 border-t border-black bg-white shrink-0">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-medium text-black">Base Price</span>
            <span className="text-[11px] font-medium text-black">${basePrice.toFixed(2)}</span>
          </div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-medium text-black">Made to Measure Upgrade</span>
            <span className="text-[11px] font-bold text-black">+${M2M_SURCHARGE}.00</span>
          </div>
          <div className="flex items-center justify-between bg-black text-white rounded-[var(--radius,0px)] px-4 py-2.5 mb-3">
            <span className="text-[11px] font-bold uppercase tracking-wider">Total</span>
            <span className="text-[15px] font-bold">${total.toFixed(2)}</span>
          </div>

          {hasErrors && (
            <p role="alert" className="mb-2 text-[12px] font-medium text-red-600">
              Please fix the highlighted measurements, or tick &quot;I will send my measurements later&quot;.
            </p>
          )}

          <button
            type="button"
            onClick={handleAdd}
            disabled={adding || added}
            className="w-full h-12 rounded-[var(--radius,0px)] font-bold uppercase tracking-[0.2em] text-[12px] md:text-[13px] flex items-center justify-center transition-all duration-300 border bg-black border-black text-white hover:bg-black/90 active:scale-[0.98] disabled:opacity-60"
          >
            {added ? (
              "Added to Cart!"
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
