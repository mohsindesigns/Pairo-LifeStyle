"use client";

import { useState, useRef } from "react";
import { Upload, X, FileText, Loader2, AlertCircle, Check } from "lucide-react";
import {
  CHANGE_LEATHER_COLORS, CHANGE_LEATHER_TYPES, CHANGE_INNER_LININGS, CHANGE_HARDWARE_COLORS,
  CHANGE_FUR_TYPES, CHANGE_FUR_COLORS, CHANGE_FUR_PLACEMENTS, CHANGE_FUR_DENSITIES,
  ARTWORK_SLOTS, ARTWORK_ACCEPTED_FORMATS,
} from "@/lib/customizationOptions";

const inputClass = "w-full bg-white border border-[#8c8f94] rounded-[3px] px-3 py-2 text-[13px] outline-none focus:border-[#2271b1] transition-all text-black";
const labelClass = "block text-[11px] font-bold text-[#3c434a] uppercase tracking-wide mb-1";

export function defaultCustomization() {
  return {
    enabled: true,
    leatherColor: "None", leatherColorNote: "",
    leatherType: "None", leatherTypeNote: "",
    innerLining: "None", innerLiningNote: "",
    hardwareColor: "None", hardwareColorNote: "",
    fur: { type: "None", typeNote: "", color: "", placement: [], density: "", removable: null },
    artwork: {},
  };
}

function ArtworkSlot({ label, artwork, onChange }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const inputRef = useRef(null);

  const handleFile = async (file) => {
    if (!file) return;
    setError(null);
    const ext = "." + file.name.split(".").pop().toLowerCase();
    if (!ARTWORK_ACCEPTED_FORMATS.split(",").includes(ext)) {
      setError("Unsupported file type");
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/uploads/artwork", { method: "POST", body: fd });
      const data = await res.json();
      if (res.ok && data.url) {
        onChange({ url: data.url, name: file.name });
      } else {
        setError(data.error || "Upload failed");
      }
    } catch {
      setError("Network error during upload");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 p-2 border border-[#dcdcde] rounded-[3px] bg-white">
        <p className="text-[10px] font-bold uppercase text-[#3c434a] w-20 shrink-0">{label}</p>
        {artwork?.url ? (
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="w-7 h-7 rounded-[2px] border border-[#dcdcde] overflow-hidden shrink-0 bg-[#f6f7f7]">
              {artwork.url.match(/\.(png|jpg|jpeg|svg|webp)$/i) ? (
                <img src={artwork.url} alt={artwork.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center"><FileText className="w-3 h-3 text-[#646970]" /></div>
              )}
            </div>
            <span className="text-[11px] text-black font-semibold truncate flex-1">{artwork.name}</span>
            <button type="button" onClick={() => onChange(null)} className="text-[#bc0b0d] hover:text-red-700 cursor-pointer shrink-0">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-[#2271b1] border border-dashed border-[#8c8f94] hover:border-[#2271b1] px-2.5 py-1 rounded-[3px] cursor-pointer disabled:opacity-50"
          >
            {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
            {uploading ? "Uploading..." : "Upload File"}
          </button>
        )}
        <input ref={inputRef} type="file" accept={ARTWORK_ACCEPTED_FORMATS} className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} />
      </div>
      {error && <p className="text-[10px] text-red-600 font-semibold flex items-center gap-1"><AlertCircle className="w-3 h-3" />{error}</p>}
    </div>
  );
}

export default function CustomizationEditor({ value, onChange }) {
  const c = value || defaultCustomization();

  const set = (patch) => onChange({ ...c, ...patch });
  const setFur = (patch) => onChange({ ...c, fur: { ...c.fur, ...patch } });
  const setArtwork = (key, val) => onChange({ ...c, artwork: { ...c.artwork, [key]: val } });
  const togglePlacement = (p) => {
    const current = c.fur.placement || [];
    setFur({ placement: current.includes(p) ? current.filter(x => x !== p) : [...current, p] });
  };

  return (
    <div className="border border-[#dcdcde] bg-[#fbfbfb] rounded-[3px] p-3 space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Leather Color</label>
          <select className={inputClass} value={c.leatherColor} onChange={(e) => set({ leatherColor: e.target.value })}>
            {CHANGE_LEATHER_COLORS.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
          {c.leatherColor === "Other" && (
            <input type="text" placeholder="Describe custom color..." value={c.leatherColorNote} onChange={(e) => set({ leatherColorNote: e.target.value })} className={`${inputClass} mt-1.5`} />
          )}
        </div>
        <div>
          <label className={labelClass}>Leather Type</label>
          <select className={inputClass} value={c.leatherType} onChange={(e) => set({ leatherType: e.target.value })}>
            {CHANGE_LEATHER_TYPES.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
          {c.leatherType === "Other" && (
            <input type="text" placeholder="Describe custom type..." value={c.leatherTypeNote} onChange={(e) => set({ leatherTypeNote: e.target.value })} className={`${inputClass} mt-1.5`} />
          )}
        </div>
        <div>
          <label className={labelClass}>Inner Lining</label>
          <select className={inputClass} value={c.innerLining} onChange={(e) => set({ innerLining: e.target.value })}>
            {CHANGE_INNER_LININGS.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
          {c.innerLining === "Other" && (
            <input type="text" placeholder="Describe custom lining..." value={c.innerLiningNote} onChange={(e) => set({ innerLiningNote: e.target.value })} className={`${inputClass} mt-1.5`} />
          )}
        </div>
        <div>
          <label className={labelClass}>Hardware Tone</label>
          <select className={inputClass} value={c.hardwareColor} onChange={(e) => set({ hardwareColor: e.target.value })}>
            {CHANGE_HARDWARE_COLORS.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
          {c.hardwareColor === "Other" && (
            <input type="text" placeholder="Describe custom finish..." value={c.hardwareColorNote} onChange={(e) => set({ hardwareColorNote: e.target.value })} className={`${inputClass} mt-1.5`} />
          )}
        </div>
      </div>

      <div className="border-t border-[#dcdcde] pt-3">
        <label className={labelClass}>Fur Accent (optional)</label>
        <select className={inputClass} value={c.fur.type} onChange={(e) => setFur({ type: e.target.value })}>
          {CHANGE_FUR_TYPES.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
        {c.fur.type === "Other" && (
          <input type="text" placeholder="Describe custom fur type..." value={c.fur.typeNote} onChange={(e) => setFur({ typeNote: e.target.value })} className={`${inputClass} mt-1.5`} />
        )}

        {c.fur.type !== "None" && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
            <div>
              <label className={labelClass}>Fur Color</label>
              <select className={inputClass} value={c.fur.color} onChange={(e) => setFur({ color: e.target.value })}>
                <option value="">Select...</option>
                {CHANGE_FUR_COLORS.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Fur Density</label>
              <select className={inputClass} value={c.fur.density} onChange={(e) => setFur({ density: e.target.value })}>
                <option value="">Select...</option>
                {CHANGE_FUR_DENSITIES.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Removable?</label>
              <select
                className={inputClass}
                value={c.fur.removable === true ? "Yes" : c.fur.removable === false ? "No" : ""}
                onChange={(e) => setFur({ removable: e.target.value === "Yes" ? true : e.target.value === "No" ? false : null })}
              >
                <option value="">Select...</option>
                <option value="Yes">Yes</option>
                <option value="No">No</option>
              </select>
            </div>
            <div className="sm:col-span-3">
              <label className={labelClass}>Fur Placement</label>
              <div className="flex flex-wrap gap-1.5">
                {CHANGE_FUR_PLACEMENTS.map(p => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => togglePlacement(p)}
                    className={`px-2.5 py-1 rounded-[3px] text-[10px] font-bold uppercase border cursor-pointer flex items-center gap-1 ${(c.fur.placement || []).includes(p) ? "bg-[#2271b1] text-white border-[#2271b1]" : "bg-white text-black border-[#8c8f94]"}`}
                  >
                    {(c.fur.placement || []).includes(p) && <Check className="w-2.5 h-2.5" strokeWidth={3} />}
                    {p}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-[#dcdcde] pt-3 space-y-2">
        <label className={labelClass}>Artwork / Branding Logos</label>
        {ARTWORK_SLOTS.map(slot => (
          <div key={slot.key}>
            <ArtworkSlot label={slot.label} artwork={c.artwork[slot.key]} onChange={(v) => setArtwork(slot.key, v)} />
            {slot.key === "other" && c.artwork.other && (
              <input
                type="text"
                placeholder="Describe the exact placement..."
                value={c.artwork.other?.note || ""}
                onChange={(e) => setArtwork("other", { ...c.artwork.other, note: e.target.value })}
                className={`${inputClass} mt-1`}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
