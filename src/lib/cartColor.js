// The cart stores the colour by NAME ("Brown", "Cognac"). Using that name as a CSS colour showed the wrong swatch
// (CSS "brown" is a reddish #a52a2a) or none at all for shop-specific names. Look the real swatch up on the product's own
// colour attribute, and fall back to the name only when it is also a valid CSS colour.
export function cartColorHex(item) {
  const name = String(item?.selectedColor || "").trim();
  if (!name) return null;
  const attrs = Array.isArray(item?.attributes) ? item.attributes : [];
  const colorAttr = attrs.find((a) => a?.type === "color" || /colou?r/i.test(a?.name || ""));
  const match = colorAttr?.values?.find((v) => [v?.value, v?.label].some((x) => String(x || "").toLowerCase() === name.toLowerCase()));
  if (match?.hex) return match.hex;
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(name) ? name : null;
}
