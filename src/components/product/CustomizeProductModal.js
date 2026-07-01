"use client";

import { useState, useEffect, useRef } from "react";
import {
  X, Upload, ChevronDown, Palette, Layers, Settings,
  Feather, Image as ImageIcon, FileText, Check,
  Loader2, User, Mail, Phone, AlertCircle, Scissors,
} from "lucide-react";

const LEATHER_COLORS  = ["None", "Black", "Brown", "Blue", "Other"];
const LEATHER_TYPES   = ["None", "Sheepskin", "Goatskin", "Cowhide", "Calfhide", "Other"];
const INNER_LININGS   = ["None", "Non Quilted (Polyester)", "Change Color (Quilted)", "Change Color (Non-Quilted)", "Synthetic Fur", "Other"];
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

/* ─── Shared input class ── */
const inputCls = "w-full border border-black rounded-[var(--radius,0px)] px-3 py-2.5 text-[12px] font-medium text-black bg-white outline-none focus:ring-1 focus:ring-black transition-all placeholder-black/30";

/* ─── Pill Select ── */
function PillSelect({ options, value, onChange }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt)}
          className={`px-3 py-1.5 rounded-[var(--radius,0px)] text-[10px] font-semibold uppercase tracking-wider border transition-all ${
            value === opt
              ? "bg-black text-white border-black"
              : "bg-white text-black border-black/30 hover:border-black"
          }`}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

/* ─── Multi Pill Select ── */
function MultiPillSelect({ options, values, onChange }) {
  const toggle = (v) =>
    values.includes(v) ? onChange(values.filter((x) => x !== v)) : onChange([...values, v]);
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => toggle(opt)}
          className={`px-3 py-1.5 rounded-[var(--radius,0px)] text-[10px] font-semibold uppercase tracking-wider border transition-all flex items-center gap-1 ${
            values.includes(opt)
              ? "bg-black text-white border-black"
              : "bg-white text-black border-black/30 hover:border-black"
          }`}
        >
          {values.includes(opt) && <Check className="w-2.5 h-2.5" strokeWidth={3} />}
          {opt}
        </button>
      ))}
    </div>
  );
}

/* ─── Accordion Section ── */
function Section({ icon: Icon, title, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-black rounded-[var(--radius,0px)] overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-white hover:bg-black/[0.03] transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <Icon className="w-3.5 h-3.5 text-black" />
          <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-black">{title}</span>
        </div>
        <ChevronDown className={`w-4 h-4 text-black transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="px-4 pb-4 pt-3.5 space-y-3.5 border-t border-black bg-white">
          {children}
        </div>
      )}
    </div>
  );
}

/* ─── Artwork Upload ── */
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
      <div className="flex items-center gap-3 p-3 border border-black rounded-[var(--radius,0px)] bg-white">
        <p className="text-[10px] font-bold uppercase tracking-wider text-black w-24 shrink-0">{slot.label}</p>
        <div className="flex-1 flex items-center gap-2 min-w-0">
          {artwork?.url ? (
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <div className="w-8 h-8 rounded-[var(--radius,0px)] border border-black overflow-hidden shrink-0">
                {artwork.url.match(/\.(png|jpg|jpeg|svg|webp)$/i) ? (
                  <img src={artwork.url} alt={artwork.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-black/5 flex items-center justify-center">
                    <FileText className="w-3.5 h-3.5 text-black" />
                  </div>
                )}
              </div>
              <span className="text-[10px] text-black font-bold truncate flex-1">{artwork.name}</span>
              <button
                type="button"
                onClick={() => { onChange(null); setUploadError(null); }}
                className="text-black hover:text-red-600 transition-colors shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-black border border-dashed border-black/40 hover:border-black px-3 py-1.5 rounded-[var(--radius,0px)] transition-all bg-white disabled:opacity-50"
            >
              {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
              {uploading ? "Uploading..." : "Upload File"}
            </button>
          )}
          <input ref={inputRef} type="file" accept={ACCEPTED_FORMATS} className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} />
        </div>
      </div>
      {uploadError && (
        <div className="flex items-center gap-1.5 text-[10px] text-red-600 font-bold">
          <AlertCircle className="w-3 h-3 shrink-0" />
          {uploadError}
        </div>
      )}
    </div>
  );
}

/* ─── Sub-label ── */
const SubLabel = ({ children }) => (
  <p className="text-[10px] font-black uppercase tracking-[0.15em] text-black mb-2">{children}</p>
);

/* ─── Main Modal ── */
export default function CustomizeProductModal({ product, isOpen, onClose }) {
  const [step, setStep] = useState("form");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  const [customer, setCustomer] = useState({ name: "", email: "", phone: "" });
  const [leatherColor, setLeatherColor] = useState("None");
  const [leatherColorNote, setLeatherColorNote] = useState("");
  const [leatherType, setLeatherType] = useState("None");
  const [leatherTypeNote, setLeatherTypeNote] = useState("");
  const [innerLining, setInnerLining] = useState("None");
  const [innerLiningNote, setInnerLiningNote] = useState("");
  const [hardwareColor, setHardwareColor] = useState("None");
  const [hardwareColorNote, setHardwareColorNote] = useState("");
  const [furType, setFurType] = useState("None");
  const [furTypeNote, setFurTypeNote] = useState("");
  const [furColor, setFurColor] = useState("");
  const [furPlacement, setFurPlacement] = useState([]);
  const [furDensity, setFurDensity] = useState("");
  const [furRemovable, setFurRemovable] = useState(null);
  const [artwork, setArtwork] = useState({});
  const [artworkOtherNote, setArtworkOtherNote] = useState("");
  const [additionalNotes, setAdditionalNotes] = useState("");

  useEffect(() => {
    if (isOpen) {
      setStep("form"); setSubmitError(null);
      setCustomer({ name: "", email: "", phone: "" });
      setLeatherColor("None"); setLeatherColorNote("");
      setLeatherType("None"); setLeatherTypeNote("");
      setInnerLining("None"); setInnerLiningNote("");
      setHardwareColor("None"); setHardwareColorNote("");
      setFurType("None"); setFurTypeNote(""); setFurColor("");
      setFurPlacement([]); setFurDensity(""); setFurRemovable(null);
      setArtwork({}); setArtworkOtherNote(""); setAdditionalNotes("");
    }
  }, [isOpen]);

  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  if (!isOpen) return null;

  const updateArtwork = (key, val) => setArtwork((prev) => ({ ...prev, [key]: val }));

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
          id: product._id || product.id || null,
          name: product.name,
          slug: product.slug || "",
          image: product.images?.[0] || product.image || "",
          price: product.price,
        },
        customizations: {
          leatherColor, leatherColorNote, leatherType, leatherTypeNote,
          innerLining, innerLiningNote, hardwareColor, hardwareColorNote,
          fur: { type: furType, typeNote: furTypeNote, color: furColor, placement: furPlacement, density: furDensity, removable: furRemovable },
          artwork: {
            ...Object.fromEntries(ARTWORK_SLOTS.map((s) => [s.key, artwork[s.key] || null])),
            ...(artwork.other ? { other: { ...artwork.other, note: artworkOtherNote } } : {}),
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
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-5">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative w-full max-w-xl max-h-[92dvh] bg-white flex flex-col overflow-hidden shadow-2xl border border-black animate-cp-up rounded-[var(--radius,0px)]">

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-black shrink-0">
          <div>
            <p className="text-[13px] sm:text-[15px] font-bold uppercase tracking-widest text-black">
              Customize Product
            </p>
            <p className="text-[9px] sm:text-[10px] font-semibold uppercase tracking-[0.15em] text-black/80 mt-0.5">
              Bespoke Design Inquiry
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center border border-black rounded-[var(--radius,0px)] hover:bg-black hover:text-white transition-all duration-300 active:scale-[0.98] text-black"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Success ── */}
        {step === "success" ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-5 px-8 py-12 text-center bg-white">
            <div className="w-14 h-14 bg-black rounded-full flex items-center justify-center">
              <Check className="w-6 h-6 text-white" strokeWidth={2.5} />
            </div>
            <div>
              <h3 className="text-[14px] font-bold text-black uppercase tracking-widest mb-2">Inquiry Received</h3>
              <p className="text-[12px] text-black leading-relaxed max-w-xs font-medium">
                We&apos;ve received your customization request for <strong>{product?.name}</strong>.
                Our design team will review your specs and contact you within 24 hours.
              </p>
            </div>
            <p className="text-[10px] text-black/60 uppercase tracking-widest font-bold">
              Confirmation sent to {customer.email}
            </p>
            <button
              type="button"
              onClick={onClose}
              className="h-11 px-8 bg-black text-white border border-black rounded-[var(--radius,0px)] text-[12px] md:text-[13px] font-bold uppercase tracking-widest hover:bg-black/90 transition-all active:scale-[0.98]"
            >
              Done
            </button>
          </div>
        ) : (
          <>
            {/* ── Scrollable Body ── */}
            <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4 min-h-0 bg-white">

              {/* Product badge */}
              {product && (
                <div className="flex items-center gap-3 p-3 border border-black rounded-[var(--radius,0px)] bg-black/[0.02]">
                  {(product.images?.[0] || product.image) && (
                    <img
                      src={product.images?.[0] || product.image}
                      alt={product.name}
                      className="w-10 h-10 object-cover rounded-[var(--radius,0px)] border border-black shrink-0"
                    />
                  )}
                  <div>
                    <p className="text-[12px] font-bold text-black leading-snug">{product.name}</p>
                    <p className="text-[9px] text-black/60 font-semibold uppercase tracking-wider">Bespoke Configuration</p>
                  </div>
                </div>
              )}

              {/* ─ Your Details ─ */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-black mb-3 pb-2 border-b border-black">
                  Your Details
                </p>
                <div className="space-y-2.5">
                  {[
                    { key: "name",  icon: User,  type: "text",  placeholder: "Full Name" },
                    { key: "email", icon: Mail,  type: "email", placeholder: "your@email.com" },
                    { key: "phone", icon: Phone, type: "tel",   placeholder: "Phone Number (Optional)" },
                  ].map((f) => (
                    <div key={f.key} className="relative">
                      <f.icon className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-black/50" />
                      <input
                        type={f.type}
                        placeholder={f.placeholder}
                        value={customer[f.key]}
                        onChange={(e) => setCustomer((p) => ({ ...p, [f.key]: e.target.value }))}
                        className={`${inputCls} pl-9`}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* ─ Design Preferences ─ */}
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-black pb-2 border-b border-black">
                Design Preferences
              </p>

              <Section icon={Palette} title="Leather Color">
                <PillSelect options={LEATHER_COLORS} value={leatherColor} onChange={setLeatherColor} />
                {leatherColor === "Other" && (
                  <input type="text" placeholder="Describe your custom leather color..." value={leatherColorNote} onChange={(e) => setLeatherColorNote(e.target.value)} className={`${inputCls} mt-1`} />
                )}
              </Section>

              <Section icon={Layers} title="Leather Type">
                <PillSelect options={LEATHER_TYPES} value={leatherType} onChange={setLeatherType} />
                {leatherType === "Other" && (
                  <input type="text" placeholder="Describe your custom leather type..." value={leatherTypeNote} onChange={(e) => setLeatherTypeNote(e.target.value)} className={`${inputCls} mt-1`} />
                )}
              </Section>

              <Section icon={Layers} title="Inner Lining">
                <PillSelect options={INNER_LININGS} value={innerLining} onChange={setInnerLining} />
                {innerLining === "Other" && (
                  <input type="text" placeholder="Describe your custom lining..." value={innerLiningNote} onChange={(e) => setInnerLiningNote(e.target.value)} className={`${inputCls} mt-1`} />
                )}
              </Section>

              <Section icon={Settings} title="Hardware Tone">
                <PillSelect options={HARDWARE_COLORS} value={hardwareColor} onChange={setHardwareColor} />
                {hardwareColor === "Other" && (
                  <input type="text" placeholder="Describe your custom hardware finish..." value={hardwareColorNote} onChange={(e) => setHardwareColorNote(e.target.value)} className={`${inputCls} mt-1`} />
                )}
              </Section>

              <Section icon={Feather} title="Fur Accent (Optional)">
                <div className="space-y-3.5">
                  <div>
                    <SubLabel>Fur Type</SubLabel>
                    <PillSelect options={FUR_TYPES} value={furType} onChange={setFurType} />
                    {furType === "Other" && (
                      <input type="text" placeholder="Describe your custom fur type..." value={furTypeNote} onChange={(e) => setFurTypeNote(e.target.value)} className={`${inputCls} mt-2`} />
                    )}
                  </div>
                  {furType !== "None" && (
                    <>
                      <div><SubLabel>Fur Color</SubLabel><PillSelect options={FUR_COLORS} value={furColor} onChange={setFurColor} /></div>
                      <div><SubLabel>Fur Placement</SubLabel><MultiPillSelect options={FUR_PLACEMENTS} values={furPlacement} onChange={setFurPlacement} /></div>
                      <div><SubLabel>Fur Density</SubLabel><PillSelect options={FUR_DENSITIES} value={furDensity} onChange={setFurDensity} /></div>
                      <div>
                        <SubLabel>Removable Fur?</SubLabel>
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

              <Section icon={ImageIcon} title="Artwork / Branding Logos">
                <div className="space-y-2">
                  <p className="text-[10px] font-bold text-black uppercase tracking-wide">
                    PNG, JPG, SVG, PDF, AI, EPS — Max 10 MB per file
                  </p>
                  {ARTWORK_SLOTS.map((slot) => (
                    <div key={slot.key} className="space-y-1">
                      <ArtworkSlot slot={slot} artwork={artwork[slot.key]} onChange={(v) => updateArtwork(slot.key, v)} />
                      {slot.key === "other" && artwork.other && (
                        <input type="text" placeholder="Describe the exact placement for this artwork..." value={artworkOtherNote} onChange={(e) => setArtworkOtherNote(e.target.value)} className={inputCls} />
                      )}
                    </div>
                  ))}
                </div>
              </Section>

              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-black mb-2">
                  Special Instructions / Design Vision
                </p>
                <textarea
                  rows={3}
                  value={additionalNotes}
                  onChange={(e) => setAdditionalNotes(e.target.value)}
                  placeholder="Describe your design vision in detail — stitching style, custom pockets, lining patterns, any special requests..."
                  className={`${inputCls} resize-none`}
                />
              </div>
            </div>

            {/* ── Footer ── */}
            <div className="px-5 py-4 border-t border-black bg-white shrink-0">
              <div className="flex items-start gap-2.5 mb-4 p-3 bg-amber-50 border border-amber-400 rounded-[var(--radius,0px)]">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-600 mt-1.5 shrink-0" />
                <p className="text-[11px] text-black leading-relaxed font-medium">
                  Design inquiries do not initiate any charges. We will review your request and send a formal invoice upon approval.
                </p>
              </div>

              {submitError && (
                <div className="flex items-center gap-2 mb-3 text-[11px] text-red-600 bg-red-50 border border-red-300 rounded-[var(--radius,0px)] px-3 py-2.5 font-bold">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  {submitError}
                </div>
              )}

              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting}
                className="w-full h-12 rounded-[var(--radius,0px)] font-bold uppercase tracking-[0.2em] text-[12px] md:text-[13px] flex items-center justify-center gap-2.5 bg-black text-white hover:bg-black/90 border border-black transition-all duration-300 active:scale-[0.98] disabled:opacity-60"
              >
                {submitting ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Submitting Inquiry...</>
                ) : (
                  "Submit Custom Design Request"
                )}
              </button>
            </div>
          </>
        )}
      </div>

      <style>{`
        @keyframes cpUp {
          from { opacity: 0; scale: 0.95; transform: translateY(16px); }
          to   { opacity: 1; scale: 1; transform: translateY(0); }
        }
        .animate-cp-up { animation: cpUp 0.25s cubic-bezier(0.16, 1, 0.3, 1) both; }
      `}</style>
    </div>
  );
}