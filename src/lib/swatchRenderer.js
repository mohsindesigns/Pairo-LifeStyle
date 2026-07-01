// src/lib/swatchRenderer.js
/**
 * Utility to generate CSS background strings for swatch rendering.
 * Handles single, dual, triple and quad color modes and optional texture overlay.
 */

export const TEXTURE_CATALOG = {
  // Leather textures
  'leather-smooth': "repeating-linear-gradient(45deg, #a52a2a 0%, #b5651d 2%, #a52a2a 4%)",
  'leather-full-grain': "repeating-linear-gradient(45deg, #5e2f1b 0%, #734c33 2%, #5e2f1b 4%)",
  // Denim textures
  'denim-classic': "linear-gradient(135deg, #1e3a8a 25%, transparent 25%) 0 0 / 8px 8px repeat",
  // Cotton textures
  'cotton-brushed': "repeating-linear-gradient(0deg, #f5f5f5 0%, #e0e0e0 50%)",
  // Wool textures
  'wool-tweed': "repeating-linear-gradient(45deg, #4b4b4b 0%, #6b6b6b 1%, #4b4b4b 2%)",
  // Fleece textures
  'fleece-polar': "radial-gradient(circle at 50% 50%, #e0e5ec 0%, #c5cbd3 100%)",
  // Puffer textures
  'puffer-quilted': "linear-gradient(45deg, #d1d5db 25%, transparent 25%) 0 0 / 6px 6px repeat",
  // Technical fabrics
  'technical-softshell': "linear-gradient(135deg, #2d3748 25%, transparent 25%) 0 0 / 10px 10px repeat",
  // Luxury materials
  'luxury-velvet': "radial-gradient(circle at 50% 50%, #8b5cf6 0%, #5b21b6 100%)",
  // Knit materials
  'knit-cable': "repeating-linear-gradient(90deg, #111827 0%, #1f2937 1%, #111827 2%)",
};

/**
 * Returns a CSS background value for a given swatch value object.
 * Supports up to 4 colors and optional texture overlay.
 */
export function getSwatchBackground(value) {
  if (!value) return "#ccc";

  // If an explicit image swatch is used, fallback to that image
  if (value.swatchType === "image" && value.image) {
    return `url(${value.image})`;
  }

  const mode = value.colorMode || "single";
  const colors = [value.hex, value.hex2, value.hex3, value.hex4].filter(Boolean);

  // Construct CSS gradient based on mode
  let gradient = "";
  if (mode === "single" || colors.length === 1) {
    gradient = colors[0];
  } else if (mode === "dual" && colors.length >= 2) {
    gradient = `linear-gradient(90deg, ${colors[0]} 0%, ${colors[1]} 100%)`;
  } else if (mode === "triple" && colors.length >= 3) {
    gradient = `linear-gradient(90deg, ${colors[0]} 0%, ${colors[1]} 50%, ${colors[2]} 100%)`;
  } else if (mode === "quad" && colors.length >= 4) {
    gradient = `linear-gradient(90deg, ${colors[0]} 0%, ${colors[1]} 33%, ${colors[2]} 66%, ${colors[3]} 100%)`;
  }

  // Apply texture overlay if set
  if (value.texture && TEXTURE_CATALOG[value.texture]) {
    // Multiple background layers: gradient over texture pattern
    return `${gradient}, ${TEXTURE_CATALOG[value.texture]}`;
  }

  return gradient;
}

export function getSwatchClasses(value) {
  const hex = (value.hex || "").toLowerCase();
  if (hex === "#ffd700" || value.texture?.includes("gold")) return "metallic-gold";
  if (hex === "#c0c0c0" || value.texture?.includes("silver")) return "metallic-silver";
  if (hex === "#b87333" || value.texture?.includes("copper")) return "metallic-copper";
  return "";
}
