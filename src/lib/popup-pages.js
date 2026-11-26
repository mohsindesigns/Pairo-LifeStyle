// Page targeting for the storefront popup (Settings → Site → Popup → "Show on").
// Client-safe: used by the storefront popup and by the admin settings tab.

export const POPUP_PAGE_RULES = ["all", "include", "exclude"];

/**
 * Turn whatever the admin typed or pasted (a full URL, a path, with or without a trailing slash, query or hash)
 * into a comparable path: "/collections/sale". A trailing "*" is kept and means "this path and everything under it".
 * Returns "" for a blank line.
 */
export function normalizePopupPath(input) {
  let value = String(input ?? "").trim();
  if (!value) return "";

  // Full URL → keep only the path
  if (/^https?:\/\//i.test(value) || value.startsWith("//")) {
    const rest = value.replace(/^(https?:)?\/\//i, "");
    const slash = rest.indexOf("/");
    value = slash === -1 ? "/" : rest.slice(slash);
  }

  value = value.split("#")[0].split("?")[0];

  const wildcard = value.endsWith("*");
  if (wildcard) value = value.slice(0, -1);

  if (!value.startsWith("/")) value = `/${value}`;
  value = value.replace(/\/{2,}/g, "/");
  if (value.length > 1) value = value.replace(/\/+$/, "");

  try {
    value = decodeURI(value);
  } catch {
    // Malformed escape: compare it as typed
  }
  value = value.toLowerCase();

  if (!wildcard) return value;
  return value === "/" ? "/*" : `${value}/*`;
}

/** Normalised, de-duplicated list from an array of lines or a multi-line string. */
export function normalizePopupPaths(input) {
  const lines = Array.isArray(input) ? input : String(input ?? "").split(/\r?\n/);
  const seen = new Set();
  for (const line of lines) {
    const path = normalizePopupPath(line);
    if (path) seen.add(path);
  }
  return [...seen];
}

function matchesAny(pathname, paths) {
  const current = normalizePopupPath(pathname);
  if (!current) return false;
  return normalizePopupPaths(paths).some((rule) => {
    if (rule === "/*") return true;
    if (rule.endsWith("/*")) {
      const base = rule.slice(0, -2);
      return current === base || current.startsWith(`${base}/`);
    }
    return current === rule;
  });
}

/**
 * Whether the popup may show on `pathname` under the saved rule.
 * - "all" (or anything unknown): every page
 * - "include": only the listed pages (an empty list means nowhere)
 * - "exclude": every page except the listed ones
 */
export function isPopupAllowedOnPath(pathname, pageRule, pagePaths) {
  if (pageRule === "include") return matchesAny(pathname, pagePaths);
  if (pageRule === "exclude") return !matchesAny(pathname, pagePaths);
  return true;
}
