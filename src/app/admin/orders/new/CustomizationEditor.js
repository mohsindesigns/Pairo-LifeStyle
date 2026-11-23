"use client";

import { useState, useRef, useId } from "react";
import { Upload, X, FileText, Loader2, AlertCircle, Check } from "lucide-react";
import {
  CHANGE_LEATHER_COLORS, CHANGE_LEATHER_TYPES, CHANGE_INNER_LININGS, CHANGE_HARDWARE_COLORS,
  CHANGE_FUR_TYPES, CHANGE_FUR_COLORS, CHANGE_FUR_PLACEMENTS, CHANGE_FUR_DENSITIES,
  ARTWORK_SLOTS, ARTWORK_ACCEPTED_FORMATS,
} from "@/lib/customizationOptions";
import ThemedSelect from "@/components/ui/ThemedSelect";

const inputClass = "wp-select wp-full";
const textClass = "wp-input wp-full";
const labelClass = "wp-label";

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
    <div>
      <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8, padding: "6px 0", borderBottom: "1px solid #f0f0f1" }}>
        <span style={{ width: 110, flex: "none" }}>{label}</span>
        {artwork?.url ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
            <span className="wp-thumb" style={{ width: 32, height: 32 }}>
              {artwork.url.match(/\.(png|jpg|jpeg|svg|webp)$/i) ? (
                <img src={artwork.url} alt={artwork.name} />
              ) : (
                <FileText className="w-4 h-4" aria-hidden="true" />
              )}
            </span>
            <span className="wp-strong" style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{artwork.name}</span>
            <button
              type="button"
              onClick={() => onChange(null)}
              className="wp-btn"
              aria-label={`Remove ${label} artwork`}
              style={{ minWidth: 32, padding: "0 6px", color: "#d63638", borderColor: "#d63638", flex: "none" }}
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="wp-btn"
          >
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <Upload className="w-4 h-4" aria-hidden="true" />}
            {uploading ? "Uploading..." : "Upload file"}
          </button>
        )}
        <input ref={inputRef} type="file" accept={ARTWORK_ACCEPTED_FORMATS} className="hidden" aria-label={`Upload ${label} artwork`} onChange={(e) => handleFile(e.target.files?.[0])} />
      </div>
      {error && (
        <p role="alert" className="wp-small" style={{ margin: "4px 0 0", color: "#d63638", display: "flex", alignItems: "center", gap: 4 }}>
          <AlertCircle className="w-3 h-3" aria-hidden="true" />{error}
        </p>
      )}
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

  const uid = useId();
  const fid = (name) => `${uid}-${name}`;
  const grid = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "4px 12px" };
  const section = { borderTop: "1px solid #dcdcde", paddingTop: 12, marginTop: 4 };

  return (
    <div style={{ border: "1px solid #dcdcde", background: "#f6f7f7", padding: 12 }}>
      <div style={grid}>
        <div className="wp-field">
          <label htmlFor={fid("leather-color")} className={labelClass}>Leather color</label>
          <ThemedSelect id={fid("leather-color")} className={inputClass} value={c.leatherColor} onChange={(e) => set({ leatherColor: e.target.value })}>
            {CHANGE_LEATHER_COLORS.map(o => <option key={o} value={o}>{o}</option>)}
          </ThemedSelect>
          {c.leatherColor === "Other" && (
            <input type="text" aria-label="Custom leather color" placeholder="Describe custom color..." value={c.leatherColorNote} onChange={(e) => set({ leatherColorNote: e.target.value })} className={textClass} style={{ marginTop: 6 }} />
          )}
        </div>
        <div className="wp-field">
          <label htmlFor={fid("leather-type")} className={labelClass}>Leather type</label>
          <ThemedSelect id={fid("leather-type")} className={inputClass} value={c.leatherType} onChange={(e) => set({ leatherType: e.target.value })}>
            {CHANGE_LEATHER_TYPES.map(o => <option key={o} value={o}>{o}</option>)}
          </ThemedSelect>
          {c.leatherType === "Other" && (
            <input type="text" aria-label="Custom leather type" placeholder="Describe custom type..." value={c.leatherTypeNote} onChange={(e) => set({ leatherTypeNote: e.target.value })} className={textClass} style={{ marginTop: 6 }} />
          )}
        </div>
        <div className="wp-field">
          <label htmlFor={fid("inner-lining")} className={labelClass}>Inner lining</label>
          <ThemedSelect id={fid("inner-lining")} className={inputClass} value={c.innerLining} onChange={(e) => set({ innerLining: e.target.value })}>
            {CHANGE_INNER_LININGS.map(o => <option key={o} value={o}>{o}</option>)}
          </ThemedSelect>
          {c.innerLining === "Other" && (
            <input type="text" aria-label="Custom inner lining" placeholder="Describe custom lining..." value={c.innerLiningNote} onChange={(e) => set({ innerLiningNote: e.target.value })} className={textClass} style={{ marginTop: 6 }} />
          )}
        </div>
        <div className="wp-field">
          <label htmlFor={fid("hardware")} className={labelClass}>Hardware tone</label>
          <ThemedSelect id={fid("hardware")} className={inputClass} value={c.hardwareColor} onChange={(e) => set({ hardwareColor: e.target.value })}>
            {CHANGE_HARDWARE_COLORS.map(o => <option key={o} value={o}>{o}</option>)}
          </ThemedSelect>
          {c.hardwareColor === "Other" && (
            <input type="text" aria-label="Custom hardware finish" placeholder="Describe custom finish..." value={c.hardwareColorNote} onChange={(e) => set({ hardwareColorNote: e.target.value })} className={textClass} style={{ marginTop: 6 }} />
          )}
        </div>
      </div>

      <div style={section}>
        <div className="wp-field">
          <label htmlFor={fid("fur-type")} className={labelClass}>Fur accent (optional)</label>
          <ThemedSelect id={fid("fur-type")} className={inputClass} value={c.fur.type} onChange={(e) => setFur({ type: e.target.value })}>
            {CHANGE_FUR_TYPES.map(o => <option key={o} value={o}>{o}</option>)}
          </ThemedSelect>
          {c.fur.type === "Other" && (
            <input type="text" aria-label="Custom fur type" placeholder="Describe custom fur type..." value={c.fur.typeNote} onChange={(e) => setFur({ typeNote: e.target.value })} className={textClass} style={{ marginTop: 6 }} />
          )}
        </div>

        {c.fur.type !== "None" && (
          <>
            <div style={grid}>
              <div className="wp-field">
                <label htmlFor={fid("fur-color")} className={labelClass}>Fur color</label>
                <ThemedSelect id={fid("fur-color")} className={inputClass} value={c.fur.color} onChange={(e) => setFur({ color: e.target.value })}>
                  <option value="">Select...</option>
                  {CHANGE_FUR_COLORS.map(o => <option key={o} value={o}>{o}</option>)}
                </ThemedSelect>
              </div>
              <div className="wp-field">
                <label htmlFor={fid("fur-density")} className={labelClass}>Fur density</label>
                <ThemedSelect id={fid("fur-density")} className={inputClass} value={c.fur.density} onChange={(e) => setFur({ density: e.target.value })}>
                  <option value="">Select...</option>
                  {CHANGE_FUR_DENSITIES.map(o => <option key={o} value={o}>{o}</option>)}
                </ThemedSelect>
              </div>
              <div className="wp-field">
                <label htmlFor={fid("fur-removable")} className={labelClass}>Removable?</label>
                <ThemedSelect
                  id={fid("fur-removable")}
                  className={inputClass}
                  value={c.fur.removable === true ? "Yes" : c.fur.removable === false ? "No" : ""}
                  onChange={(e) => setFur({ removable: e.target.value === "Yes" ? true : e.target.value === "No" ? false : null })}
                >
                  <option value="">Select...</option>
                  <option value="Yes">Yes</option>
                  <option value="No">No</option>
                </ThemedSelect>
              </div>
            </div>
            <fieldset className="wp-field" style={{ border: 0, padding: 0, margin: 0 }}>
              <legend className={labelClass}>Fur placement</legend>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {CHANGE_FUR_PLACEMENTS.map(p => {
                  const on = (c.fur.placement || []).includes(p);
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => togglePlacement(p)}
                      aria-pressed={on}
                      className={on ? "wp-btn wp-btn-primary" : "wp-btn"}
                    >
                      {on && <Check className="w-3 h-3" strokeWidth={3} aria-hidden="true" />}
                      {p}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          </>
        )}
      </div>

      <div style={section}>
        <div className={labelClass}>Artwork / branding logos</div>
        {ARTWORK_SLOTS.map(slot => (
          <div key={slot.key}>
            <ArtworkSlot label={slot.label} artwork={c.artwork[slot.key]} onChange={(v) => setArtwork(slot.key, v)} />
            {slot.key === "other" && c.artwork.other && (
              <input
                type="text"
                aria-label="Exact placement of other artwork"
                placeholder="Describe the exact placement..."
                value={c.artwork.other?.note || ""}
                onChange={(e) => setArtwork("other", { ...c.artwork.other, note: e.target.value })}
                className={textClass}
                style={{ marginTop: 6 }}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
