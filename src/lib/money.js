// Money for display: whole dollars stay "$199", cents always show two digits ("$24.50"), same separators for everyone.
export function formatMoney(n) {
  const v = Math.round((Number(n) || 0) * 100) / 100;
  return v.toLocaleString("en-US", { minimumFractionDigits: Number.isInteger(v) ? 0 : 2, maximumFractionDigits: 2 });
}
