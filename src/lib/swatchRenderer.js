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
function adjustColorBrightness(hex, percent) {
  if (!hex || hex[0] !== '#') return hex || '#ccc';
  let cleanHex = hex;
  if (hex.length === 4) {
    cleanHex = `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`;
  }
  let R = parseInt(cleanHex.substring(1, 3), 16);
  let G = parseInt(cleanHex.substring(3, 5), 16);
  let B = parseInt(cleanHex.substring(5, 7), 16);

  R = parseInt(R * (100 + percent) / 100);
  G = parseInt(G * (100 + percent) / 100);
  B = parseInt(B * (100 + percent) / 100);

  R = Math.min(255, Math.max(0, R));
  G = Math.min(255, Math.max(0, G));
  B = Math.min(255, Math.max(0, B));

  const rHex = R.toString(16).padStart(2, '0');
  const gHex = G.toString(16).padStart(2, '0');
  const bHex = B.toString(16).padStart(2, '0');

  return `#${rHex}${gHex}${bHex}`;
}

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

  if (colors.length === 0) return "#ccc";

  // Pre-calculate gradient colors for each slot
  const c1_start = adjustColorBrightness(colors[0], 12);
  const c1_end   = adjustColorBrightness(colors[0], -15);
  
  const c2_start = colors[1] ? adjustColorBrightness(colors[1], 12) : "";
  const c2_end   = colors[1] ? adjustColorBrightness(colors[1], -15) : "";
  
  const c3_start = colors[2] ? adjustColorBrightness(colors[2], 12) : "";
  const c3_end   = colors[2] ? adjustColorBrightness(colors[2], -15) : "";
  
  const c4_start = colors[3] ? adjustColorBrightness(colors[3], 12) : "";
  const c4_end   = colors[3] ? adjustColorBrightness(colors[3], -15) : "";

  // Construct CSS gradient based on mode
  let gradient = "";
  if (mode === "single" || colors.length === 1) {
    gradient = `linear-gradient(135deg, ${c1_start} 0%, ${c1_end} 100%)`;
  } else if (mode === "dual" && colors.length >= 2) {
    gradient = `conic-gradient(from 0deg, ${c1_start} 0deg, ${c1_end} 180deg, ${c2_start} 180deg, ${c2_end} 360deg)`;
  } else if (mode === "triple" && colors.length >= 3) {
    gradient = `conic-gradient(from 0deg, ${c1_start} 0deg, ${c1_end} 120deg, ${c2_start} 120deg, ${c2_end} 240deg, ${c3_start} 240deg, ${c3_end} 360deg)`;
  } else if (mode === "quad" && colors.length >= 4) {
    gradient = `conic-gradient(from 0deg, ${c1_start} 0deg, ${c1_end} 90deg, ${c2_start} 90deg, ${c2_end} 180deg, ${c3_start} 180deg, ${c3_end} 270deg, ${c4_start} 270deg, ${c4_end} 360deg)`;
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
