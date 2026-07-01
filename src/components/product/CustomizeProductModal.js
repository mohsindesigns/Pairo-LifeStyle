"use client";

import { useState, useEffect, useRef } from "react";
import { X, Upload, ChevronDown, Palette, Layers, Settings, Feather, Image as ImageIcon, FileText, Check, Send, Loader2, User, Mail, Phone } from "lucide-react";

/* ─── Option definitions ─────────────────────────────────────────────── */
const LEATHER_COLORS = ["None", "Black", "Brown", "Blue", "Other"];
const LEATHER_TYPES  = ["None", "Sheepskin", "Goatskin", "Cowhide", "Calfhide", "Other"];
const INNER_LININGS  = [
  "None",
  "Non Quilted (Polyester)",
  "Change Color (Quilted)",
  "Change Color (Non-Quilted)",
  "Synthetic Fur",
  "Other"
];
const HARDWARE_COLORS = ["None", "Silver", "Brass", "Black", "Other"];
const FUR_TYPES    = ["None", "Faux Fur", "Shearling", "Rabbit", "Fox", "Mink", "Wool", "Other"];
const FUR_COLORS   = ["White", "Black", "Brown", "Grey", "Cream", "Beige", "Custom"];
const FUR_PLACEMENTS = ["Collar", "Hood", "Sleeves", "Cuffs", "Front", "Back"];
const FUR_DENSITIES  = ["Light", "Medium", "Heavy"];
const ARTWORK_SLOTS  = [
  { key: "leftChest",  label: "Left Chest" },
  { key: "rightChest", label: "Right Chest" },
  { key: "leftArm",    label: "Left Arm" },
  { key: "rightArm",   label: "Right Arm" },
  { key: "back",       label: "Back" },
  { key: "other",      label: "Other Placement" }
];
const ACCEPTED_FORMATS = ".png,.jpg,.jpeg,.svg,.pdf,.ai,.eps";

/* ─── Section accordion ──────────────────────────────────────────────── */
function Section({ icon: Icon, title, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-black/5 rounded-[2px] overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-white hover:bg-black/[0.01] transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          <Icon className="w-3 h-3 text-primary/60" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-primary/80">{title}</span>
        </div>
        <ChevronDown className={`w-3.5 h-3.5 text-primary/30 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="px-4 pb-4 pt-1.5 space-y-3 border-t border-black/[0.03] bg-neutral-50/20">{children}</div>}
    </div>
  );
}

/* ─── Pill select ────────────────────────────────────────────────────── */
function PillSelect({ options, value, onChange }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map(opt => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt)}
          className={`px-2.5 py-1 rounded-[2px] text-[9px] font-bold uppercase tracking-wider border transition-all ${
            value === opt
              ? "bg-primary text-white border-primary"
              : "bg-white text-primary/60 border-black/10 hover:border-primary/45 hover:text-primary"
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
  const toggle = v => {
    if (values.includes(v)) onChange(values.filter(x => x !== v));
    else onChange([...values, v]);
  };
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map(opt => (
        <button
          key={opt}
          type="button"
          onClick={() => toggle(opt)}
          className={`px-2.5 py-1 rounded-[2px] text-[9px] font-bold uppercase tracking-wider border transition-all flex items-center gap-1 ${
            values.includes(opt)
              ? "bg-primary text-white border-primary"
              : "bg-white text-primary/60 border-black/10 hover:border-primary/45 hover:text-primary"
          }`}
        >
          {values.includes(opt) && <Check className="w-2.5 h-2.5" strokeWidth={2.5} />}
          {opt}
        </button>
      ))}
    </div>
  );
}

/* ─── Artwork upload slot ────────────────────────────────────────────── */
function ArtworkSlot({ slot, artwork, onChange }) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef(null);

  const handleFile = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/admin/media/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (data.url) {
        onChange({ url: data.url, name: file.name });
      }
    } catch (e) {
      console.error("Upload failed", e);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex items-center gap-2.5 p-2.5 border border-black/5 rounded-[2px] bg-white">
      <div className="shrink-0 w-24">
        <p className="text-[9px] font-bold uppercase tracking-wider text-primary/55">{slot.label}</p>
      </div>
      <div className="flex-1 flex items-center gap-2">
        {artwork?.url ? (
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="w-6.5 h-6.5 rounded-[1px] border border-black/10 overflow-hidden shrink-0">
              {artwork.url.match(/\.(png|jpg|jpeg|svg)$/i) ? (
                <img src={artwork.url} alt={artwork.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-primary/5 flex items-center justify-center">
                  <FileText className="w-3.5 h-3.5 text-primary/30" />
                </div>
              )}
            </div>
            <span className="text-[9px] text-primary/55 truncate flex-1">{artwork.name}</span>
            <button
              type="button"
              onClick={() => onChange(null)}
              className="text-primary/30 hover:text-red-500 transition-colors shrink-0"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-primary/45 hover:text-primary border border-dashed border-black/10 hover:border-primary/25 px-2.5 py-1.5 rounded-[2px] transition-all bg-neutral-50/50"
          >
            {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
            {uploading ? "Uploading..." : "Upload File"}
          </button>
        )}
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_FORMATS}
          className="hidden"
          onChange={e => handleFile(e.target.files?.[0])}
        />
      </div>
    </div>
  );
}

/* ─── Main Modal ─────────────────────────────────────────────────────── */
export default function CustomizeProductModal({ product, isOpen, onClose }) {
  const [step, setStep]         = useState("form");
  const [submitting, setSubmitting] = useState(false);

  // Customer info
  const [customer, setCustomer] = useState({ name: "", email: "", phone: "" });

  // Customization state
  const [leatherColor,     setLeatherColor]     = useState("None");
  const [leatherColorNote, setLeatherColorNote] = useState("");
  const [leatherType,      setLeatherType]      = useState("None");
  const [leatherTypeNote,  setLeatherTypeNote]  = useState("");
  const [innerLining,      setInnerLining]      = useState("None");
  const [innerLiningNote,  setInnerLiningNote]  = useState("");
  const [hardwareColor,    setHardwareColor]    = useState("None");
  const [hardwareColorNote,setHardwareColorNote]= useState("");

  // Fur
  const [furType,      setFurType]      = useState("None");
  const [furTypeNote,  setFurTypeNote]  = useState("");
  const [furColor,     setFurColor]     = useState("");
  const [furPlacement, setFurPlacement] = useState([]);
  const [furDensity,   setFurDensity]   = useState("");
  const [furRemovable, setFurRemovable] = useState(null);

  // Artwork
  const [artwork, setArtwork] = useState({});
  const [artworkOtherNote, setArtworkOtherNote] = useState("");

  // Notes
  const [additionalNotes, setAdditionalNotes] = useState("");

  // Reset on open
  useEffect(() => {
    if (isOpen) {
      setStep("form");
      setCustomer({ name: "", email: "", phone: "" });
      setLeatherColor("None"); setLeatherColorNote("");
      setLeatherType("None");  setLeatherTypeNote("");
      setInnerLining("None");  setInnerLiningNote("");
      setHardwareColor("None");setHardwareColorNote("");
      setFurType("None"); setFurTypeNote(""); setFurColor(""); setFurPlacement([]); setFurDensity(""); setFurRemovable(null);
      setArtwork({}); setArtworkOtherNote(""); setAdditionalNotes("");
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) { document.body.style.overflow = "hidden"; }
    else { document.body.style.overflow = ""; }
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  if (!isOpen) return null;

  const updateArtwork = (key, val) => setArtwork(prev => ({ ...prev, [key]: val }));

  const handleSubmit = async () => {
    if (!customer.name || !customer.email) {
      alert("Please enter your name and email.");
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        customer,
        product: {
          id: product._id || product.id,
          name: product.name,
          slug: product.slug,
          image: product.images?.[0] || product.image || "",
          price: product.price
        },
        customizations: {
          leatherColor, leatherColorNote,
          leatherType,  leatherTypeNote,
          innerLining,  innerLiningNote,
          hardwareColor,hardwareColorNote,
          fur: { type: furType, typeNote: furTypeNote, color: furColor, placement: furPlacement, density: furDensity, removable: furRemovable },
          artwork: {
            ...Object.fromEntries(
              ARTWORK_SLOTS.map(s => [s.key, artwork[s.key] || null])
            ),
            other: artwork.other ? { ...artwork.other, note: artworkOtherNote } : null
          }
        },
        additionalNotes
      };
      const res = await fetch("/api/customization-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        setStep("success");
      } else {
        const data = await res.json();
        alert(data.error || "Submission failed. Please try again.");
      }
    } catch (e) {
      alert("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[999] flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/55 backdrop-blur-[2px]" onClick={onClose} />

      {/* Panel */}
      <div className="relative w-full sm:max-w-xl max-h-[92dvh] bg-white rounded-t-[16px] sm:rounded-[3px] shadow-xl flex flex-col overflow-hidden animate-slideUp">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-black/5 shrink-0">
          <div className="flex items-center gap-2">
            <div>
              <h2 className="text-[12px] font-bold uppercase tracking-widest text-primary">Customize Product</h2>
              <p className="text-[9px] text-primary/50 uppercase tracking-[0.12em] font-medium mt-0.5">Bespoke Design Inquiry</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-black/5 rounded-full transition-colors">
            <X className="w-3.5 h-3.5 text-primary/60" />
          </button>
        </div>

        {step === "success" ? (
          /* ─── Success State ─── */
          <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6 py-12 text-center">
            <div className="w-12 h-12 bg-emerald-50 rounded-full flex items-center justify-center border border-emerald-100">
              <Check className="w-5 h-5 text-emerald-600" strokeWidth={2.5} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-primary uppercase tracking-wider">Inquiry Received</h3>
              <p className="text-[11px] text-primary/60 leading-relaxed max-w-xs mt-1.5">
                We've received your customization details for <strong>{product?.name}</strong>. Our design team will review your specs and contact you within 24 hours.
              </p>
            </div>
            <p className="text-[9px] text-primary/45 uppercase tracking-widest">A confirmation has been sent to {customer.email}</p>
            <button
              type="button"
              onClick={onClose}
              className="h-9 px-6 bg-primary text-white rounded-[2px] text-[10px] font-bold uppercase tracking-widest hover:bg-primary/95 transition-all"
            >
              Done
            </button>
          </div>
        ) : (
          /* ─── Form State ─── */
          <>
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3 min-h-0 bg-neutral-50/15">
              {/* Product Reference */}
              {product && (
                <div className="flex items-center gap-2.5 p-2.5 bg-primary/[0.02] border border-black/5 rounded-[2px]">
                  {(product.images?.[0] || product.image) && (
                    <img src={product.images?.[0] || product.image} alt={product.name} className="w-9 h-9 object-cover rounded-[1px] border border-black/5 shrink-0" />
                  )}
                  <div>
                    <p className="text-[11px] font-bold text-primary truncate max-w-[280px]">{product.name}</p>
                    <p className="text-[9px] text-primary/45 uppercase tracking-wider">Configure Custom Parameters</p>
                  </div>
                </div>
              )}

              {/* Customer Info */}
              <div className="space-y-2">
                <p className="text-[9px] font-bold uppercase tracking-widest text-primary/40 border-b border-black/5 pb-1">Your Details</p>
                <div className="grid grid-cols-1 gap-2">
                  {[
                    { key: "name",  label: "Full Name",      icon: User,  type: "text",  placeholder: "Full Name" },
                    { key: "email", label: "Email Address",   icon: Mail,  type: "email", placeholder: "your@email.com" },
                    { key: "phone", label: "Phone Number",    icon: Phone, type: "tel",   placeholder: "Phone Number" }
                  ].map(f => (
                    <div key={f.key} className="relative">
                      <f.icon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-primary/30" />
                      <input
                        type={f.type}
                        placeholder={f.placeholder}
                        value={customer[f.key]}
                        required={f.key !== "phone"}
                        onChange={e => setCustomer(p => ({ ...p, [f.key]: e.target.value }))}
                        className="w-full pl-8 pr-2.5 py-2 border border-black/8 rounded-[2px] text-[11px] text-primary outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/10 transition-all bg-white placeholder-primary/20"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <p className="text-[9px] font-bold uppercase tracking-widest text-primary/40 border-b border-black/5 pb-1 pt-1.5">Design Preferences</p>

              {/* Leather Color */}
              <Section icon={Palette} title="Leather Color">
                <PillSelect options={LEATHER_COLORS} value={leatherColor} onChange={setLeatherColor} />
                {leatherColor === "Other" && (
                  <input
                    type="text"
                    placeholder="Describe custom leather color..."
                    value={leatherColorNote}
                    onChange={e => setLeatherColorNote(e.target.value)}
                    className="w-full border border-black/8 rounded-[2px] px-2.5 py-2 text-[11px] text-primary outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/10 transition-all mt-1.5"
                  />
                )}
              </Section>

              {/* Leather Type */}
              <Section icon={Layers} title="Leather Type">
                <PillSelect options={LEATHER_TYPES} value={leatherType} onChange={setLeatherType} />
                {leatherType === "Other" && (
                  <input type="text" placeholder="Describe custom leather type..." value={leatherTypeNote} onChange={e => setLeatherTypeNote(e.target.value)}
                    className="w-full border border-black/8 rounded-[2px] px-2.5 py-2 text-[11px] text-primary outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/10 transition-all mt-1.5" />
                )}
              </Section>

              {/* Inner Lining */}
              <Section icon={Layers} title="Inner Lining">
                <PillSelect options={INNER_LININGS} value={innerLining} onChange={setInnerLining} />
                {innerLining === "Other" && (
                  <input type="text" placeholder="Describe custom lining..." value={innerLiningNote} onChange={e => setInnerLiningNote(e.target.value)}
                    className="w-full border border-black/8 rounded-[2px] px-2.5 py-2 text-[11px] text-primary outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/10 transition-all mt-1.5" />
                )}
              </Section>

              {/* Hardware Color */}
              <Section icon={Settings} title="Hardware Tone">
                <PillSelect options={HARDWARE_COLORS} value={hardwareColor} onChange={setHardwareColor} />
                {hardwareColor === "Other" && (
                  <input type="text" placeholder="Describe custom hardware..." value={hardwareColorNote} onChange={e => setHardwareColorNote(e.target.value)}
                    className="w-full border border-black/8 rounded-[2px] px-2.5 py-2 text-[11px] text-primary outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/10 transition-all mt-1.5" />
                )}
              </Section>

              {/* Fur Customization */}
              <Section icon={Feather} title="Fur Accent (Optional)">
                <div className="space-y-3 text-[11px]">
                  <div>
                    <p className="text-[9px] font-bold text-primary/50 mb-1.5 uppercase tracking-wide">Fur Type</p>
                    <PillSelect options={FUR_TYPES} value={furType} onChange={setFurType} />
                    {furType === "Other" && (
                      <input type="text" placeholder="Describe custom fur type..." value={furTypeNote} onChange={e => setFurTypeNote(e.target.value)}
                        className="w-full border border-black/8 rounded-[2px] px-2.5 py-2 text-[11px] text-primary outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/10 transition-all mt-1.5" />
                    )}
                  </div>
                  {furType !== "None" && (
                    <>
                      <div>
                        <p className="text-[9px] font-bold text-primary/50 mb-1.5 uppercase tracking-wide">Fur Color</p>
                        <PillSelect options={FUR_COLORS} value={furColor} onChange={setFurColor} />
                      </div>
                      <div>
                        <p className="text-[9px] font-bold text-primary/50 mb-1.5 uppercase tracking-wide">Fur Placement</p>
                        <MultiPillSelect options={FUR_PLACEMENTS} values={furPlacement} onChange={setFurPlacement} />
                      </div>
                      <div>
                        <p className="text-[9px] font-bold text-primary/50 mb-1.5 uppercase tracking-wide">Fur Density</p>
                        <PillSelect options={FUR_DENSITIES} value={furDensity} onChange={setFurDensity} />
                      </div>
                      <div>
                        <p className="text-[9px] font-bold text-primary/50 mb-1.5 uppercase tracking-wide">Removable Fur</p>
                        <PillSelect options={["Yes", "No"]} value={furRemovable === true ? "Yes" : furRemovable === false ? "No" : ""} onChange={v => setFurRemovable(v === "Yes")} />
                      </div>
                    </>
                  )}
                </div>
              </Section>

              {/* Artwork / Logo */}
              <Section icon={ImageIcon} title="Artwork / Branding Logos">
                <div className="space-y-2">
                  <p className="text-[9px] text-primary/45 leading-relaxed mb-2 uppercase tracking-wide font-medium">
                    Supports PNG, JPG, SVG, PDF, AI, EPS. Max 10MB per file.
                  </p>
                  {ARTWORK_SLOTS.map(slot => (
                    <div key={slot.key} className="space-y-1">
                      <ArtworkSlot slot={slot} artwork={artwork[slot.key]} onChange={v => updateArtwork(slot.key, v)} />
                      {slot.key === "other" && artwork.other && (
                        <input
                          type="text"
                          placeholder="Describe exact placement for this logo/artwork..."
                          value={artworkOtherNote}
                          onChange={e => setArtworkOtherNote(e.target.value)}
                          className="w-full border border-black/8 rounded-[2px] px-2 py-1.5 text-[10px] text-primary outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/10 transition-all"
                        />
                      )}
                    </div>
                  ))}
                </div>
              </Section>

              {/* Additional Notes */}
              <div className="space-y-1">
                <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-primary/60">Special Instructions / Ideas</p>
                <textarea
                  rows={3}
                  value={additionalNotes}
                  onChange={e => setAdditionalNotes(e.target.value)}
                  placeholder="Describe your design vision in detail (e.g. stitching style, custom pockets, lining patterns)..."
                  className="w-full border border-black/8 rounded-[2px] px-2.5 py-2 text-[11px] text-primary outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/10 transition-all resize-none bg-white"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="px-5 py-4 border-t border-black/5 bg-white shrink-0">
              <div className="flex items-start gap-2 mb-3.5 p-2.5 bg-amber-50/50 border border-amber-250/70 rounded-[2px]">
                <div className="w-1 h-1 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                <p className="text-[10px] text-amber-900 leading-relaxed">
                  Design inquiries do not initiate charges. We will review your requests and draft a formal invoice upon approval.
                </p>
              </div>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting}
                className="w-full h-10 rounded-[2px] font-bold uppercase tracking-[0.15em] text-[11px] flex items-center justify-center gap-2 bg-primary text-white hover:bg-primary/95 transition-all duration-300 active:scale-[0.99] disabled:opacity-65"
              >
                {submitting ? "Submitting Inquiry..." : "Submit Custom Design Request"}
              </button>
            </div>
          </>
        )}
      </div>

      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(30px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .animate-slideUp { animation: slideUp 0.3s cubic-bezier(0.16,1,0.3,1) both; }
      `}</style>
    </div>
  );
}
