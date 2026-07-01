"use client";

import { useState, useEffect, useRef } from "react";
import {
  X,
  Upload,
  ChevronDown,
  Palette,
  Layers,
  Settings,
  Feather,
  Image as ImageIcon,
  FileText,
  Check,
  Loader2,
  User,
  Mail,
  Phone,
  AlertCircle,
} from "lucide-react";

/* ─── Option definitions ─────────────────────────────────────────────── */
const LEATHER_COLORS  = ["None", "Black", "Brown", "Blue", "Other"];
const LEATHER_TYPES   = ["None", "Sheepskin", "Goatskin", "Cowhide", "Calfhide", "Other"];
const INNER_LININGS   = [
  "None",
  "Non Quilted (Polyester)",
  "Change Color (Quilted)",
  "Change Color (Non-Quilted)",
  "Synthetic Fur",
  "Other",
];
const HARDWARE_COLORS = ["None", "Silver", "Brass", "Black", "Other"];
const FUR_TYPES       = ["None", "Faux Fur", "Shearling", "Rabbit", "Fox", "Mink", "Wool", "Other"];
const FUR_COLORS      = ["White", "Black", "Brown", "Grey", "Cream", "Beige", "Custom"];
const FUR_PLACEMENTS  = ["Collar", "Hood", "Sleeves", "Cuffs", "Front", "Back"];
const FUR_DENSITIES   = ["Light", "Medium", "Heavy"];
const ARTWORK_SLOTS   = [
  { key: "leftChest",  label: "Left Chest" },
  { key: "rightChest", label: "Right Chest" },
  { key: "leftArm",   label: "Left Arm" },
  { key: "rightArm",  label: "Right Arm" },
  { key: "back",      label: "Back" },
  { key: "other",     label: "Other Placement" },
];
const ACCEPTED_FORMATS = ".png,.jpg,.jpeg,.svg,.pdf,.ai,.eps,.webp";

/* ─── Section accordion ──────────────────────────────────────────────── */
function Section({ icon: Icon, title, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-black/8 rounded-[2px] overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-white hover:bg-black/[0.015] transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          <Icon className="w-3 h-3 text-black/50" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-black">{title}</span>
        </div>
        <ChevronDown
          className={`w-3.5 h-3.5 text-black/40 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div className="px-4 pb-4 pt-2 space-y-3 border-t border-black/[0.04] bg-neutral-50/30">
          {children}
        </div>
      )}
    </div>
  );
}

/* ─── Pill select ────────────────────────────────────────────────────── */
function PillSelect({ options, value, onChange }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt)}
          className={`px-2.5 py-1 rounded-[2px] text-[9px] font-bold uppercase tracking-wider border transition-all ${
            value === opt
              ? "bg-primary text-white border-primary"
              : "bg-white text-black border-black/15 hover:border-primary/60 hover:text-primary"
          }`}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

/* ─── Multi-select pills ─────────────────────────────────────────────── */
function MultiPillSelect({ options, values, onChange }) {
  const toggle = (v) => {
    if (values.includes(v)) onChange(values.filter((x) => x !== v));
    else onChange([...values, v]);
  };
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => toggle(opt)}
          className={`px-2.5 py-1 rounded-[2px] text-[9px] font-bold uppercase tracking-wider border transition-all flex items-center gap-1 ${
            values.includes(opt)
              ? "bg-primary text-white border-primary"
              : "bg-white text-black border-black/15 hover:border-primary/60 hover:text-primary"
          }`}
        >
          {values.includes(opt) && <Check className="w-2.5 h-2.5" strokeWidth={2.5} />}
          {opt}
        </button>
      ))}
    </div>
  );
}

/* ─── Text input shared style ────────────────────────────────────────── */
const inputCls =
  "w-full border border-black/12 rounded-[2px] px-2.5 py-2 text-[11px] text-black placeholder-black/35 outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/10 transition-all bg-white";

/* ─── Artwork upload slot ────────────────────────────────────────────── */
function ArtworkSlot({ slot, artwork, onChange }) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const inputRef = useRef(null);

  const handleFile = async (file) => {
    if (!file) return;
    setUploadError(null);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      // ← Public endpoint — no admin auth required
      const res = await fetch("/api/uploads/artwork", { method: "POST", body: fd });
      const data = await res.json();
      if (res.ok && data.url) {
        onChange({ url: data.url, name: file.name });
      } else {
        setUploadError(data.error || "Upload failed. Please try again.");
      }
    } catch {
      setUploadError("Network error. Please check your connection.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2.5 p-2.5 border border-black/8 rounded-[2px] bg-white">
        <div className="shrink-0 w-24">
          <p className="text-[9px] font-bold uppercase tracking-wider text-black">{slot.label}</p>
        </div>
        <div className="flex-1 flex items-center gap-2">
          {artwork?.url ? (
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <div className="w-7 h-7 rounded-[1px] border border-black/10 overflow-hidden shrink-0">
                {artwork.url.match(/\.(png|jpg|jpeg|svg|webp)$/i) ? (
                  <img src={artwork.url} alt={artwork.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-black/5 flex items-center justify-center">
                    <FileText className="w-3.5 h-3.5 text-black/40" />
                  </div>
                )}
              </div>
              <span className="text-[9px] text-black truncate flex-1">{artwork.name}</span>
              <button
                type="button"
                onClick={() => { onChange(null); setUploadError(null); }}
                className="text-black/30 hover:text-red-500 transition-colors shrink-0"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider text-black border border-dashed border-black/15 hover:border-primary/40 hover:text-primary px-2.5 py-1.5 rounded-[2px] transition-all bg-neutral-50/50 disabled:opacity-60"
            >
              {uploading ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Upload className="w-3 h-3" />
              )}
              {uploading ? "Uploading..." : "Upload File"}
            </button>
          )}
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED_FORMATS}
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
        </div>
      </div>
      {uploadError && (
        <div className="flex items-center gap-1.5 text-[9px] text-red-600">
          <AlertCircle className="w-3 h-3 shrink-0" />
          {uploadError}
        </div>
      )}
    </div>
  );
}

/* ─── Main Modal ─────────────────────────────────────────────────────── */
export default function CustomizeProductModal({ product, isOpen, onClose }) {
  const [step, setStep] = useState("form");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  // Customer info
  const [customer, setCustomer] = useState({ name: "", email: "", phone: "" });

  // Customization state
  const [leatherColor,      setLeatherColor]      = useState("None");
  const [leatherColorNote,  setLeatherColorNote]  = useState("");
  const [leatherType,       setLeatherType]       = useState("None");
  const [leatherTypeNote,   setLeatherTypeNote]   = useState("");
  const [innerLining,       setInnerLining]       = useState("None");
  const [innerLiningNote,   setInnerLiningNote]   = useState("");
  const [hardwareColor,     setHardwareColor]     = useState("None");
  const [hardwareColorNote, setHardwareColorNote] = useState("");

  // Fur
  const [furType,      setFurType]      = useState("None");
  const [furTypeNote,  setFurTypeNote]  = useState("");
  const [furColor,     setFurColor]     = useState("");
  const [furPlacement, setFurPlacement] = useState([]);
  const [furDensity,   setFurDensity]   = useState("");
  const [furRemovable, setFurRemovable] = useState(null);

  // Artwork
  const [artwork,         setArtwork]         = useState({});
  const [artworkOtherNote,setArtworkOtherNote]= useState("");

  // Additional notes
  const [additionalNotes, setAdditionalNotes] = useState("");

  // Reset on open
  useEffect(() => {
    if (isOpen) {
      setStep("form");
      setSubmitError(null);
      setCustomer({ name: "", email: "", phone: "" });
      setLeatherColor("None");  setLeatherColorNote("");
      setLeatherType("None");   setLeatherTypeNote("");
      setInnerLining("None");   setInnerLiningNote("");
      setHardwareColor("None"); setHardwareColorNote("");
      setFurType("None"); setFurTypeNote(""); setFurColor("");
      setFurPlacement([]); setFurDensity(""); setFurRemovable(null);
      setArtwork({}); setArtworkOtherNote(""); setAdditionalNotes("");
    }
  }, [isOpen]);

  // Trap scroll
  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  if (!isOpen) return null;

  const updateArtwork = (key, val) =>
    setArtwork((prev) => ({ ...prev, [key]: val }));

  const handleSubmit = async () => {
    if (!customer.name.trim() || !customer.email.trim()) {
      setSubmitError("Please enter your name and email address.");
      return;
    }
    setSubmitError(null);
    setSubmitting(true);
    try {
      const payload = {
        customer,
        product: {
          id:    product._id || product.id || null,
          name:  product.name,
          slug:  product.slug || "",
          image: product.images?.[0] || product.image || "",
          price: product.price,
        },
        customizations: {
          leatherColor,
          leatherColorNote,
          leatherType,
          leatherTypeNote,
          innerLining,
          innerLiningNote,
          hardwareColor,
          hardwareColorNote,
          fur: {
            type:      furType,
            typeNote:  furTypeNote,
            color:     furColor,
            placement: furPlacement,
            density:   furDensity,
            removable: furRemovable,
          },
          artwork: {
            ...Object.fromEntries(ARTWORK_SLOTS.map((s) => [s.key, artwork[s.key] || null])),
            // Merge the other-placement note into the artwork.other object
            ...(artwork.other
              ? { other: { ...artwork.other, note: artworkOtherNote } }
              : {}),
          },
        },
        additionalNotes,
      };

      const res = await fetch("/api/customization-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setStep("success");
      } else {
        setSubmitError(data.error || "Submission failed. Please try again.");
      }
    } catch {
      setSubmitError("Network error. Please check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[999] flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/55 backdrop-blur-[2px]" onClick={onClose} />

      {/* Panel */}
      <div className="relative w-full sm:max-w-xl max-h-[92dvh] bg-white rounded-t-[14px] sm:rounded-[3px] shadow-2xl flex flex-col overflow-hidden animate-slideUp">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-black/8 shrink-0">
          <div>
            <p className="text-[12px] font-bold uppercase tracking-widest text-black">Customize Product</p>
            <p className="text-[9px] text-black/55 uppercase tracking-[0.1em] font-semibold mt-0.5">Bespoke Design Inquiry</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-black/5 rounded-full transition-colors">
            <X className="w-3.5 h-3.5 text-black/60" />
          </button>
        </div>

        {step === "success" ? (
          /* ─── Success State ─── */
          <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6 py-12 text-center">
            <div className="w-12 h-12 bg-emerald-50 rounded-full flex items-center justify-center border border-emerald-100">
              <Check className="w-5 h-5 text-emerald-600" strokeWidth={2.5} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-black uppercase tracking-wider">Inquiry Received</h3>
              <p className="text-[11px] text-black/70 leading-relaxed max-w-xs mt-1.5">
                We&apos;ve received your customization request for <strong>{product?.name}</strong>.
                Our design team will review your specs and contact you within 24 hours.
              </p>
            </div>
            <p className="text-[9px] text-black/40 uppercase tracking-widest">
              Confirmation sent to {customer.email}
            </p>
            <button
              type="button"
              onClick={onClose}
              className="h-9 px-6 bg-primary text-white rounded-[2px] text-[10px] font-bold uppercase tracking-widest hover:bg-primary/90 transition-all"
            >
              Done
            </button>
          </div>
        ) : (
          /* ─── Form State ─── */
          <>
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3 min-h-0 bg-neutral-50/10">

              {/* Product Reference */}
              {product && (
                <div className="flex items-center gap-2.5 p-2.5 bg-black/[0.02] border border-black/6 rounded-[2px]">
                  {(product.images?.[0] || product.image) && (
                    <img
                      src={product.images?.[0] || product.image}
                      alt={product.name}
                      className="w-9 h-9 object-cover rounded-[1px] border border-black/8 shrink-0"
                    />
                  )}
                  <div>
                    <p className="text-[11px] font-bold text-black truncate max-w-[280px]">{product.name}</p>
                    <p className="text-[9px] text-black/50 uppercase tracking-wider">Configure Custom Parameters</p>
                  </div>
                </div>
              )}

              {/* Customer Info */}
              <div className="space-y-2">
                <p className="text-[9px] font-bold uppercase tracking-widest text-black border-b border-black/6 pb-1">
                  Your Details
                </p>
                {[
                  { key: "name",  icon: User,  type: "text",  placeholder: "Full Name" },
                  { key: "email", icon: Mail,  type: "email", placeholder: "your@email.com" },
                  { key: "phone", icon: Phone, type: "tel",   placeholder: "Phone Number (Optional)" },
                ].map((f) => (
                  <div key={f.key} className="relative">
                    <f.icon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-black/35" />
                    <input
                      type={f.type}
                      placeholder={f.placeholder}
                      value={customer[f.key]}
                      onChange={(e) => setCustomer((p) => ({ ...p, [f.key]: e.target.value }))}
                      className={`${inputCls} pl-8`}
                    />
                  </div>
                ))}
              </div>

              <p className="text-[9px] font-bold uppercase tracking-widest text-black border-b border-black/6 pb-1 pt-1">
                Design Preferences
              </p>

              {/* Leather Color */}
              <Section icon={Palette} title="Leather Color">
                <PillSelect options={LEATHER_COLORS} value={leatherColor} onChange={setLeatherColor} />
                {leatherColor === "Other" && (
                  <input
                    type="text"
                    placeholder="Describe your custom leather color..."
                    value={leatherColorNote}
                    onChange={(e) => setLeatherColorNote(e.target.value)}
                    className={`${inputCls} mt-1.5`}
                  />
                )}
              </Section>

              {/* Leather Type */}
              <Section icon={Layers} title="Leather Type">
                <PillSelect options={LEATHER_TYPES} value={leatherType} onChange={setLeatherType} />
                {leatherType === "Other" && (
                  <input
                    type="text"
                    placeholder="Describe your custom leather type..."
                    value={leatherTypeNote}
                    onChange={(e) => setLeatherTypeNote(e.target.value)}
                    className={`${inputCls} mt-1.5`}
                  />
                )}
              </Section>

              {/* Inner Lining */}
              <Section icon={Layers} title="Inner Lining">
                <PillSelect options={INNER_LININGS} value={innerLining} onChange={setInnerLining} />
                {innerLining === "Other" && (
                  <input
                    type="text"
                    placeholder="Describe your custom lining..."
                    value={innerLiningNote}
                    onChange={(e) => setInnerLiningNote(e.target.value)}
                    className={`${inputCls} mt-1.5`}
                  />
                )}
              </Section>

              {/* Hardware Color */}
              <Section icon={Settings} title="Hardware Tone">
                <PillSelect options={HARDWARE_COLORS} value={hardwareColor} onChange={setHardwareColor} />
                {hardwareColor === "Other" && (
                  <input
                    type="text"
                    placeholder="Describe your custom hardware finish..."
                    value={hardwareColorNote}
                    onChange={(e) => setHardwareColorNote(e.target.value)}
                    className={`${inputCls} mt-1.5`}
                  />
                )}
              </Section>

              {/* Fur Customization */}
              <Section icon={Feather} title="Fur Accent (Optional)">
                <div className="space-y-3">
                  <div>
                    <p className="text-[9px] font-bold text-black mb-1.5 uppercase tracking-wide">Fur Type</p>
                    <PillSelect options={FUR_TYPES} value={furType} onChange={setFurType} />
                    {furType === "Other" && (
                      <input
                        type="text"
                        placeholder="Describe your custom fur type..."
                        value={furTypeNote}
                        onChange={(e) => setFurTypeNote(e.target.value)}
                        className={`${inputCls} mt-1.5`}
                      />
                    )}
                  </div>
                  {furType !== "None" && (
                    <>
                      <div>
                        <p className="text-[9px] font-bold text-black mb-1.5 uppercase tracking-wide">Fur Color</p>
                        <PillSelect options={FUR_COLORS} value={furColor} onChange={setFurColor} />
                      </div>
                      <div>
                        <p className="text-[9px] font-bold text-black mb-1.5 uppercase tracking-wide">Fur Placement</p>
                        <MultiPillSelect options={FUR_PLACEMENTS} values={furPlacement} onChange={setFurPlacement} />
                      </div>
                      <div>
                        <p className="text-[9px] font-bold text-black mb-1.5 uppercase tracking-wide">Fur Density</p>
                        <PillSelect options={FUR_DENSITIES} value={furDensity} onChange={setFurDensity} />
                      </div>
                      <div>
                        <p className="text-[9px] font-bold text-black mb-1.5 uppercase tracking-wide">Removable Fur?</p>
                        <PillSelect
                          options={["Yes", "No"]}
                          value={furRemovable === true ? "Yes" : furRemovable === false ? "No" : ""}
                          onChange={(v) => setFurRemovable(v === "Yes")}
                        />
                      </div>
                    </>
                  )}
                </div>
              </Section>

              {/* Artwork / Logo */}
              <Section icon={ImageIcon} title="Artwork / Branding Logos">
                <div className="space-y-2">
                  <p className="text-[9px] text-black leading-relaxed uppercase tracking-wide font-semibold">
                    PNG, JPG, SVG, PDF, AI, EPS — Max 10 MB per file.
                  </p>
                  {ARTWORK_SLOTS.map((slot) => (
                    <div key={slot.key} className="space-y-1">
                      <ArtworkSlot
                        slot={slot}
                        artwork={artwork[slot.key]}
                        onChange={(v) => updateArtwork(slot.key, v)}
                      />
                      {slot.key === "other" && artwork.other && (
                        <input
                          type="text"
                          placeholder="Describe the exact placement for this artwork..."
                          value={artworkOtherNote}
                          onChange={(e) => setArtworkOtherNote(e.target.value)}
                          className={`${inputCls} text-[10px]`}
                        />
                      )}
                    </div>
                  ))}
                </div>
              </Section>

              {/* Additional Notes */}
              <div className="space-y-1">
                <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-black">
                  Special Instructions / Design Vision
                </p>
                <textarea
                  rows={3}
                  value={additionalNotes}
                  onChange={(e) => setAdditionalNotes(e.target.value)}
                  placeholder="Describe your design vision in detail (e.g. stitching style, custom pockets, lining patterns, any special requests)..."
                  className={`${inputCls} resize-none`}
                />
              </div>
            </div>

            {/* Footer */}
            <div className="px-5 py-4 border-t border-black/8 bg-white shrink-0">
              {/* Disclaimer */}
              <div className="flex items-start gap-2 mb-3.5 p-2.5 bg-amber-50 border border-amber-200 rounded-[2px]">
                <div className="w-1 h-1 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                <p className="text-[10px] text-amber-900 leading-relaxed">
                  Design inquiries do not initiate any charges. We will review your request and send a formal invoice upon approval.
                </p>
              </div>

              {/* Inline error */}
              {submitError && (
                <div className="flex items-center gap-1.5 mb-3 text-[10px] text-red-600 bg-red-50 border border-red-200 rounded-[2px] px-2.5 py-2">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  {submitError}
                </div>
              )}

              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting}
                className="w-full h-10 rounded-[2px] font-bold uppercase tracking-[0.15em] text-[11px] flex items-center justify-center gap-2 bg-primary text-white hover:bg-primary/95 transition-all duration-300 active:scale-[0.99] disabled:opacity-60"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Submitting Inquiry...
                  </>
                ) : (
                  "Submit Custom Design Request"
                )}
              </button>
            </div>
          </>
        )}
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
