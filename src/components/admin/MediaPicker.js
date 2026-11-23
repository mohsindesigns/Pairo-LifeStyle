"use client";

import { useState } from "react";
import { ImageIcon, X, Plus } from "lucide-react";
import MediaPickerModal from "./MediaPickerModal";

/**
 * MediaPicker — Drop-in replacement for any image input in the admin
 *
 * Single image usage:
 *   <MediaPicker value={imageUrl} onChange={(url) => setImage(url)} label="Featured Image" />
 *
 * Multiple images (gallery):
 *   <MediaPicker multiple value={gallery} onChange={(urls) => setGallery(urls)} label="Gallery" />
 */
export default function MediaPicker({ value, onChange, label, multiple = false, className = "" }) {
  const [open, setOpen] = useState(false);

  const handleSelect = (selected) => {
    if (multiple) {
      const newUrls = Array.isArray(selected) ? selected.map(s => s.url) : [selected.url];
      const existing = Array.isArray(value) ? value : [];
      // Merge without duplicates
      const merged = [...existing, ...newUrls.filter(u => !existing.includes(u))];
      onChange(merged);
    } else {
      onChange(selected.url, selected);
    }
  };

  const removeImage = (url) => {
    if (multiple) {
      onChange((Array.isArray(value) ? value : []).filter(u => u !== url));
    } else {
      onChange('', null);
    }
  };

  const images = multiple
    ? (Array.isArray(value) ? value : [])
    : (value ? [value] : []);

  const linkBtn = { background: "none", border: 0, padding: 0, cursor: "pointer", font: "inherit", textDecoration: "underline", minHeight: 30 };

  return (
    <>
      <div className={`flex flex-col gap-2 ${className}`}>
        {label && (
          <span className="wp-label">{label}</span>
        )}

        {/* Preview area */}
        {images.length > 0 && (
          <div className={`${multiple ? "flex flex-wrap gap-2" : ""}`}>
            {images.map((url, i) => (
              <div key={i} className="relative">
                <div style={{ overflow: "hidden", background: "#f0f0f1", border: "1px solid #dcdcde" }} className={multiple ? "w-20 h-20" : "w-full h-40"}>
                  <img src={url} alt="" className={`w-full h-full ${multiple ? "object-cover" : "object-contain"}`} />
                </div>
                {multiple && (
                  <button
                    type="button"
                    onClick={() => removeImage(url)}
                    aria-label="Remove image"
                    title="Remove image"
                    className="absolute flex items-center justify-center"
                    style={{ top: -8, right: -8, width: 24, height: 24, borderRadius: "50%", background: "#fff", border: "1px solid #c3c4c7", color: "#b32d2e", cursor: "pointer", boxShadow: "0 1px 2px rgba(0,0,0,0.1)" }}
                  >
                    <X className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                )}
              </div>
            ))}
            {/* Add more button for gallery */}
            {multiple && (
              <button
                type="button"
                onClick={() => setOpen(true)}
                aria-label="Add images"
                title="Add images"
                className="w-20 h-20 flex items-center justify-center"
                style={{ border: "1px dashed #8c8f94", background: "#f6f7f7", color: "#2271b1", cursor: "pointer" }}
              >
                <Plus className="w-5 h-5" aria-hidden="true" />
              </button>
            )}
          </div>
        )}

        {/* Upload / Select button */}
        {(!multiple && images.length === 0) || (multiple && images.length === 0) ? (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="w-full flex flex-col items-center gap-2"
            style={{ border: "1px dashed #8c8f94", background: "#f6f7f7", padding: 20, cursor: "pointer", color: "#2271b1" }}
          >
            <ImageIcon className="w-7 h-7" aria-hidden="true" style={{ color: "#8c8f94" }} />
            <span style={{ textDecoration: "underline" }}>
              {multiple ? "Add Images" : "Select Image"}
            </span>
          </button>
        ) : !multiple ? (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <button
              type="button"
              onClick={() => setOpen(true)}
              style={{ ...linkBtn, color: "#2271b1" }}
            >
              Change Image
            </button>
            <button
              type="button"
              onClick={() => removeImage(images[0])}
              style={{ ...linkBtn, color: "#b32d2e" }}
            >
              Remove image
            </button>
          </div>
        ) : null}
      </div>

      <MediaPickerModal
        open={open}
        onClose={() => setOpen(false)}
        onSelect={handleSelect}
        multiple={multiple}
        title={label || (multiple ? "Select Images" : "Select Image")}
      />
    </>
  );
}
