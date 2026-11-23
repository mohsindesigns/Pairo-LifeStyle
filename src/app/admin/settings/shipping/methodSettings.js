// Numeric settings per shipping provider. `required` fields must be a number on
// save; optional fields left blank are omitted (the providers in
// src/services/shipping/providers treat a missing value as 0 — e.g. a missing
// FREE_SHIPPING minimumOrderAmount means "no minimum, always free").
export const NUMERIC_METHOD_FIELDS = {
  FLAT_RATE: [{ key: "cost", label: "Shipping cost", required: true }],
  FREE_SHIPPING: [
    { key: "minimumOrderAmount", label: "Minimum order amount", required: false },
    { key: "fallbackCost", label: "Fallback cost", required: false },
  ],
  LOCAL_PICKUP: [{ key: "cost", label: "Handling fee", required: false }],
};

const isBlank = (v) => v === undefined || v === null || (typeof v === "string" && v.trim() === "");

/**
 * Turns the editor's raw settings (numeric inputs kept as strings while editing)
 * into what gets saved. Returns { settings } or { error }.
 */
export function normalizeMethodSettings(provider, settings) {
  const out = { ...(settings || {}) };
  for (const field of NUMERIC_METHOD_FIELDS[provider] || []) {
    const raw = out[field.key];
    if (isBlank(raw)) {
      if (field.required) return { error: `${field.label} is required.` };
      delete out[field.key];
      continue;
    }
    const n = typeof raw === "number" ? raw : Number(String(raw).trim());
    if (!Number.isFinite(n)) return { error: `${field.label} must be a number.` };
    if (n < 0) return { error: `${field.label} cannot be negative.` };
    out[field.key] = n;
  }
  return { settings: out };
}
