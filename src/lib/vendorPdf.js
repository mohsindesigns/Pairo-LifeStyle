import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";

// ─── Layout ───────────────────────────────────────────────────────────────────────────────────
// Every coordinate below was measured off the vendor-sheet design mockup (1345 x 896 px) and is
// scaled onto a 1080pt-wide landscape page, so the output keeps the design's exact proportions.
// One page is produced per order line item.
const MOCK_W = 1345;
const MOCK_H = 896;
const PAGE_W = 1080;
const S = PAGE_W / MOCK_W;
const PAGE_H = MOCK_H * S;
const p = (px) => px * S;

const BG = "#FDFCF8";
const INK = "#0B0B0B";
const BRAND = "#3A2B25";
const PLACEHOLDER = "#C9D0DA";

const IMAGE_BOX = { x: 90, y: 175, w: 538, h: 643 };
const COL_X = 673;
const COL_BOTTOM = 818;
const TABLE = { x: 684, w: 564 };

const ASSET_DIR = path.join(/* turbopackIgnore: true */ process.cwd(), "src", "assets");
const assetCache = new Map();
function readAsset(...parts) {
  const key = parts.join("/");
  if (!assetCache.has(key)) {
    try {
      assetCache.set(key, fs.readFileSync(path.join(ASSET_DIR, ...parts)));
    } catch {
      assetCache.set(key, null);
    }
  }
  return assetCache.get(key);
}

function setupFonts(doc) {
  const fonts = { bold: "Helvetica-Bold", semi: "Helvetica-Bold", regular: "Helvetica" };
  for (const [key, file] of [["bold", "Poppins-Bold.ttf"], ["semi", "Poppins-SemiBold.ttf"], ["regular", "Poppins-Regular.ttf"]]) {
    const buf = readAsset("fonts", file);
    if (!buf) continue;
    try {
      doc.registerFont(`pairo-${key}`, buf);
      fonts[key] = `pairo-${key}`;
    } catch {
      /* keep the built-in fallback */
    }
  }
  return fonts;
}

// ─── Images ───────────────────────────────────────────────────────────────────────────────────
function absoluteUrl(url) {
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url;
  const base = (process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXTAUTH_URL || "").replace(/\/$/, "");
  return url.startsWith("/") ? `${base}${url}` : url;
}

// pdfkit can only embed JPEG and PNG. Store images are often WebP/AVIF (and logos can be SVG),
// which makes .image() throw — so everything is normalized to a flat, size-capped JPEG first.
// Returns null when sharp is unavailable or the image can't be decoded.
async function toPdfImage(buf) {
  try {
    const sharp = (await import("sharp")).default;
    return await sharp(buf)
      .rotate()
      .resize({ width: 1100, height: 1100, fit: "inside", withoutEnlargement: true })
      .flatten({ background: "#ffffff" })
      .jpeg({ quality: 88 })
      .toBuffer();
  } catch {
    return null;
  }
}

/** Fetches an image URL into a Buffer pdfkit can embed. Never throws; returns null on failure. */
export async function fetchImageBuffer(url) {
  const absolute = absoluteUrl(url);
  if (!absolute) return null;
  try {
    const res = await fetch(absolute, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") || "";
    const buf = Buffer.from(await res.arrayBuffer());
    if (!buf.length) return null;
    const converted = await toPdfImage(buf);
    if (converted) return converted;
    return contentType.includes("svg") ? null : buf;
  } catch {
    return null;
  }
}

// ─── Size handling ────────────────────────────────────────────────────────────────────────────
/** Pulls the ordered "Size" option off a line item, falling back to parsing the variant title. */
export function getSelectedSizeLabel(item) {
  const opts = item.selectedVariant?.options;
  if (opts && typeof opts === "object") {
    const key = Object.keys(opts).find((k) => k.toLowerCase() === "size");
    if (key && opts[key]) return String(opts[key]).trim();
  }
  const title = item.selectedVariant?.title || "";
  const m = title.match(/size\s*:\s*([^/|,]+)/i);
  return m ? m[1].trim() : "";
}

const SIZE_ALIASES = {
  extrasmall: "xs", xsmall: "xs", small: "s", medium: "m", med: "m", large: "l",
  extralarge: "xl", xlarge: "xl", doubleextralarge: "2xl", xxlarge: "2xl", xxl: "2xl",
  tripleextralarge: "3xl", xxxlarge: "3xl", xxxl: "3xl",
  quadrupleextralarge: "4xl", xxxxlarge: "4xl", xxxxl: "4xl",
};

function normalizeSize(s) {
  if (!s) return "";
  const t = String(s).trim().toLowerCase().replace(/[\s\-_.]/g, "");
  return SIZE_ALIASES[t] || t;
}

const SIZE_TOKEN = /^(xxs|xs|s|m|l|xl|2xl|3xl|4xl|5xl|6xl|\d{2})$/;
const isSizeToken = (v) => SIZE_TOKEN.test(normalizeSize(v));

/**
 * Charts come in two orientations — sizes across the header (one column per size) or sizes down
 * the first column (one row per size). The sheet always shows sizes across, so a size-per-row
 * chart is transposed.
 */
function orientSizesAcross(chart) {
  const columns = chart.columns || [];
  const rows = chart.rows || [];
  const across = columns.slice(1).filter(isSizeToken).length;
  const down = rows.map((r) => r?.[0]).filter(isSizeToken).length;
  if (down > across) {
    return {
      columns: ["Sizes", ...rows.map((r) => r?.[0] ?? "")],
      rows: columns.slice(1).map((label, j) => [label, ...rows.map((r) => r?.[j + 1] ?? "")]),
    };
  }
  return { columns, rows };
}

/** Index of the column holding the ordered size, or -1. */
export function findHighlightColumn(columns, selectedSize) {
  const target = normalizeSize(selectedSize);
  if (!target) return -1;
  const headKey = (c) => normalizeSize(String(c ?? "").split(/[\s(/,-]/)[0]);
  let idx = columns.findIndex((c, i) => i > 0 && normalizeSize(c) === target);
  if (idx === -1) idx = columns.findIndex((c, i) => i > 0 && headKey(c) === target);
  return idx;
}

// ─── Made to Measure ──────────────────────────────────────────────────────────────────────────
// Mirrors src/components/product/MadeToMeasureModal.js's field keys/labels/order.
const MEASUREMENT_FIELD_LABELS = [
  ["chest", "Chest"], ["neck", "Neck"], ["shoulder", "Shoulder"], ["sleeveLength", "Sleeve Length"],
  ["bicep", "Bicep"], ["wrist", "Wrist"], ["waist", "Waist"], ["lowerWaist", "Lower Waist"],
  ["hips", "Hips"], ["jacketLength", "Jacket Length"], ["height", "Height"], ["weight", "Weight"],
];

function humanizeKey(key) {
  return String(key).replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (c) => c.toUpperCase());
}

function measurementEntries(measurements) {
  const entries = [];
  const seen = new Set();
  for (const [key, label] of MEASUREMENT_FIELD_LABELS) {
    const v = measurements?.[key];
    if (v !== undefined && v !== null && v !== "") entries.push([label, String(v)]);
    seen.add(key);
  }
  for (const [key, v] of Object.entries(measurements || {})) {
    if (seen.has(key) || v === undefined || v === null || v === "") continue;
    entries.push([humanizeKey(key), String(v)]);
  }
  return entries;
}

// ─── Text helpers ─────────────────────────────────────────────────────────────────────────────
/** Font size (pt) at which `str` is exactly `targetPx` mockup-pixels wide. */
function fitSize(doc, font, str, targetPx) {
  doc.font(font).fontSize(100);
  return (100 * p(targetPx)) / doc.widthOfString(str);
}

/** Shrinks `size` until `str` fits within `maxPx` mockup-pixels (never below 45% of the original). */
function shrinkToFit(doc, font, size, str, maxPx) {
  doc.font(font).fontSize(size);
  const w = doc.widthOfString(str);
  const max = p(maxPx);
  if (w <= max) return size;
  return Math.max(size * 0.45, (size * max) / w);
}

/** Draws text so its baseline sits at `baselinePx` (pdfkit positions by the top of the line box). */
function drawText(doc, font, size, str, xPx, baselinePx, color, align = "left") {
  doc.font(font).fontSize(size).fillColor(color);
  const ascent = (doc._font.ascender / 1000) * size;
  let x = p(xPx);
  if (align === "center") x -= doc.widthOfString(str) / 2;
  else if (align === "right") x -= doc.widthOfString(str);
  doc.text(str, x, p(baselinePx) - ascent, { lineBreak: false });
}

const stripHtml = (s) => String(s ?? "").replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();

function buildBullets(item, specs) {
  const out = [];
  const seen = new Set();
  const opts = item.selectedVariant?.options;
  if (opts && typeof opts === "object") {
    for (const [k, v] of Object.entries(opts)) {
      if (!v || k.toLowerCase() === "size") continue;
      out.push(`${k}: ${v}`);
      seen.add(k.toLowerCase());
    }
  }
  for (const s of specs || []) {
    const label = stripHtml(s?.label);
    const value = stripHtml(s?.value);
    if (!label || !value || seen.has(label.toLowerCase())) continue;
    out.push(`${label}: ${value}`);
    seen.add(label.toLowerCase());
  }
  return out;
}

// ─── Drawing blocks ───────────────────────────────────────────────────────────────────────────
function drawWordmark(doc) {
  const buf = readAsset("pairo-wordmark.png");
  if (!buf) return;
  const length = p(262);
  const thickness = length / 4.47; // keep the logo's native proportions (trimmed 492 x 110)
  doc.save();
  doc.translate(p(43), p(468));
  doc.rotate(-90);
  doc.image(buf, -length / 2, -thickness / 2, { width: length, height: thickness });
  doc.restore();
}

function drawProductImage(doc, F, imageBuf) {
  const x = p(IMAGE_BOX.x), y = p(IMAGE_BOX.y), w = p(IMAGE_BOX.w), h = p(IMAGE_BOX.h);
  doc.rect(x, y, w, h).fill(PLACEHOLDER);
  if (imageBuf) {
    try {
      doc.save();
      doc.rect(x, y, w, h).clip();
      doc.image(imageBuf, x, y, { cover: [w, h], align: "center", valign: "center" });
      doc.restore();
      return;
    } catch {
      doc.restore();
    }
  }
  drawText(doc, F.regular, p(22), "No product image", IMAGE_BOX.x + IMAGE_BOX.w / 2, IMAGE_BOX.y + IMAGE_BOX.h / 2, "#8793A3", "center");
}

/**
 * Size/measurement table in the design's style: light header, uppercase bold row labels, the
 * ordered size's column picked out with a taupe fill and a black outline. Column widths follow
 * their content (like an auto-width table) and row height / font shrink for long charts.
 * Returns the bottom edge (in mockup px).
 */
function drawChartTable(doc, F, columns, rows, highlightCol, topPx, maxHeightPx) {
  const N = columns.length;
  const HEADER_H = 35;
  const rowH = Math.max(18, Math.min(36, (maxHeightPx - HEADER_H) / Math.max(rows.length, 1)));
  const PAD = 10;
  const widthPx = (font, sizePx, str) => {
    doc.font(font).fontSize(p(sizePx));
    return doc.widthOfString(String(str ?? "")) / S;
  };
  // Header cells and row labels are uppercase in the design; body values keep their own case.
  const label = (i, v, isHeader = false) => (i === 0 || isHeader ? String(v ?? "").toUpperCase() : String(v ?? ""));

  let fs = Math.min(12.5, Math.max(8.5, rowH * 0.36));
  let colW = null;
  for (let attempt = 0; attempt < 14 && !colW; attempt++) {
    const mins = columns.map((c, i) => {
      let w = widthPx(F.bold, fs, label(i, c, true));
      rows.forEach((r) => {
        w = Math.max(w, widthPx(i === 0 ? F.bold : F.regular, fs, label(i, r?.[i])));
      });
      return w + PAD * 2;
    });
    const total = mins.reduce((a, b) => a + b, 0);
    if (total <= TABLE.w || fs <= 7) {
      const extra = Math.max(0, TABLE.w - total) / N;
      colW = mins.map((m) => m + extra);
    } else {
      fs *= 0.92;
    }
  }
  const colLeft = (i) => TABLE.x + colW.slice(0, i).reduce((a, b) => a + b, 0);
  const tableH = HEADER_H + rows.length * rowH;

  // fills, clipped to the rounded outline
  doc.save();
  doc.roundedRect(p(TABLE.x), p(topPx), p(TABLE.w), p(tableH), p(4)).clip();
  doc.rect(p(TABLE.x), p(topPx), p(TABLE.w), p(HEADER_H)).fill("#F1EFE9");
  doc.rect(p(TABLE.x), p(topPx + HEADER_H), p(TABLE.w), p(rows.length * rowH)).fill("#F9F8F4");
  if (highlightCol > 0) {
    const hiW = Math.min(30, colW[highlightCol] - 4);
    doc.rect(p(colLeft(highlightCol) + (colW[highlightCol] - hiW) / 2), p(topPx), p(hiW), p(tableH)).fill("#8E8678");
  }
  doc.restore();

  // row separators
  doc.lineWidth(p(1));
  doc.strokeColor("#8C8C8C").moveTo(p(TABLE.x), p(topPx + HEADER_H)).lineTo(p(TABLE.x + TABLE.w), p(topPx + HEADER_H)).stroke();
  doc.strokeColor("#DAD6CD");
  for (let r = 1; r < rows.length; r++) {
    const ly = p(topPx + HEADER_H + r * rowH);
    doc.moveTo(p(TABLE.x), ly).lineTo(p(TABLE.x + TABLE.w), ly).stroke();
  }

  // text
  const capHalf = 0.35 * p(fs);
  columns.forEach((c, i) => {
    const font = F.bold;
    const baseline = topPx + HEADER_H / 2 + capHalf / S;
    const isHi = i === highlightCol;
    if (i === 0) drawText(doc, font, p(fs), label(i, c, true), colLeft(i) + PAD, baseline, BRAND);
    else drawText(doc, font, p(fs), label(i, c, true), colLeft(i) + colW[i] / 2, baseline, isHi ? "#1F1812" : BRAND, "center");
  });
  rows.forEach((row, r) => {
    const baseline = topPx + HEADER_H + r * rowH + rowH / 2 + capHalf / S;
    columns.forEach((_, i) => {
      if (i === 0) drawText(doc, F.bold, p(fs), label(i, row?.[i]), colLeft(i) + PAD, baseline, BRAND);
      else drawText(doc, F.regular, p(fs), label(i, row?.[i]), colLeft(i) + colW[i] / 2, baseline, i === highlightCol ? "#1F1812" : "#6B5B52", "center");
    });
  });

  // outline + highlighted-column outline
  doc.lineWidth(p(1)).strokeColor("#8C8C8C").roundedRect(p(TABLE.x), p(topPx), p(TABLE.w), p(tableH), p(4)).stroke();
  if (highlightCol > 0) {
    const hiW = Math.min(30, colW[highlightCol] - 4);
    doc.lineWidth(p(2)).strokeColor("#000000").rect(p(colLeft(highlightCol) + (colW[highlightCol] - hiW) / 2), p(topPx), p(hiW), p(tableH)).stroke();
  }
  return topPx + tableH;
}

/** "Product Specification:" heading plus its bullet list, flowing down from `topPx`. */
function drawSpecification(doc, F, SZ, bullets, headingBaselinePx) {
  drawText(doc, F.bold, SZ.spec, "Product Specification:", COL_X, headingBaselinePx, INK);

  if (!bullets.length) {
    drawText(doc, F.regular, SZ.bullet, "No specifications listed for this product.", COL_X + 40, headingBaselinePx + 40, "#6F655B");
    return;
  }
  const first = headingBaselinePx + 32;
  const available = COL_BOTTOM - first;
  const pitch = Math.min(33.1, available / Math.max(bullets.length - 0.4, 1));
  const scale = Math.max(0.6, Math.min(1, pitch / 33.1));

  bullets.forEach((text, i) => {
    const center = first + i * pitch;
    const size = shrinkToFit(doc, F.regular, SZ.bullet * scale, text, 1255 - 713);
    doc.circle(p(693), p(center), p(4.6 * scale)).fill(INK);
    drawText(doc, F.regular, size, text, 713, center + (0.36 * size) / S, INK);
  });
}

/** Corporate Gifting: one row per selected item with its uploaded logo. */
function drawGiftSelections(doc, F, SZ, item, artworkBufs, headingBaselinePx) {
  const selections = item.corporateGifting?.selections || [];
  drawText(doc, F.bold, SZ.spec, "Selected Items:", COL_X, headingBaselinePx, INK);
  const first = headingBaselinePx + 24;
  const pitch = Math.min(62, (COL_BOTTOM - first) / Math.max(selections.length, 1));
  const thumb = Math.min(48, pitch - 8);

  selections.forEach((sel, i) => {
    const top = first + i * pitch;
    doc.lineWidth(p(1)).rect(p(COL_X + 6), p(top), p(thumb), p(thumb)).fillAndStroke("#F6F2EA", "#E3DACB");
    const buf = artworkBufs?.[i];
    if (buf) {
      try {
        doc.image(buf, p(COL_X + 8), p(top + 2), { fit: [p(thumb - 4), p(thumb - 4)], align: "center", valign: "center" });
      } catch {
        /* leave the empty thumbnail box */
      }
    }
    const textX = COL_X + 6 + thumb + 16;
    const nameSize = shrinkToFit(doc, F.semi, SZ.bullet * 0.95, sel.name || "Item", 1255 - textX);
    drawText(doc, F.semi, nameSize, sel.name || "Item", textX, top + thumb * 0.42, INK);
    const detail = sel.artwork?.name ? `Logo: ${sel.artwork.name}` : "No logo uploaded";
    const detailSize = shrinkToFit(doc, F.regular, SZ.bullet * 0.7, detail, 1255 - textX);
    drawText(doc, F.regular, detailSize, detail, textX, top + thumb * 0.86, "#6F655B");
  });
}

// ─── Public API ───────────────────────────────────────────────────────────────────────────────
/**
 * Renders the vendor production sheet: one landscape page per line item, laid out like the
 * approved design. `lines` is parallel to order.items, each
 * `{ item, imageBuf, artworkBufs, chart, specs }` — the product image (already PDF-embeddable),
 * Corporate Gifting logo images, the resolved size chart `{columns, rows}` (or null) and the
 * product's `specifications` ({label, value}) list.
 */
export function buildVendorPdf({ order, lines }) {
  const doc = new PDFDocument({ size: [PAGE_W, PAGE_H], margin: 0, autoFirstPage: false });
  const F = setupFonts(doc);
  let SZ = null;

  const pages = lines.length ? lines : [null];
  pages.forEach((line) => {
    doc.addPage({ size: [PAGE_W, PAGE_H], margin: 0 });
    doc.rect(0, 0, PAGE_W, PAGE_H).fill(BG);

    // Font sizes fitted to the exact text widths measured in the mockup (measured once a page
    // exists, since pdfkit needs one to resolve fonts).
    if (!SZ) {
      SZ = {
        title: fitSize(doc, F.bold, "Order ID", 338),
        subtitle: fitSize(doc, F.regular, "Product Name", 230),
        label: fitSize(doc, F.bold, "Size:", 89),
        value: fitSize(doc, F.regular, "Large", 83),
        qtyLabel: fitSize(doc, F.bold, "Quantity:", 184),
        qtyValue: fitSize(doc, F.regular, "01", 36),
        spec: fitSize(doc, F.bold, "Product Specification:", 435),
        bullet: fitSize(doc, F.regular, "Material: Lambskin Leather", 311),
      };
    }
    drawWordmark(doc);

    const orderNo = String(order.orderNumber || "");
    const title = shrinkToFit(doc, F.bold, SZ.title, orderNo, 1100);
    drawText(doc, F.bold, title, orderNo, MOCK_W / 2, 84, INK, "center");

    if (!line) {
      drawText(doc, F.regular, SZ.subtitle, "This order has no line items.", MOCK_W / 2, 141, INK, "center");
      return;
    }

    const { item, imageBuf, artworkBufs, chart, specs } = line;
    const name = String(item.name || "Item");
    const subtitle = shrinkToFit(doc, F.regular, SZ.subtitle, name, 1000);
    drawText(doc, F.regular, subtitle, name, MOCK_W / 2, 141, INK, "center");

    drawProductImage(doc, F, imageBuf);

    // Size / Quantity row
    const isGifting = !!item.corporateGifting?.enabled;
    const isM2M = !!item.madeToMeasure?.enabled;
    const selectedSize = getSelectedSizeLabel(item);
    const sizeLabel = isGifting ? "Items:" : "Size:";
    const sizeValue = isGifting
      ? String((item.corporateGifting.selections || []).length)
      : isM2M ? "Custom" : selectedSize || "—";
    const qty = String(item.quantity ?? 1).padStart(2, "0");

    drawText(doc, F.bold, SZ.label, sizeLabel, COL_X, 214, INK);
    // The value starts at the design's x=803, but never closer than 14px to a wider label ("Items:").
    doc.font(F.bold).fontSize(SZ.label);
    const valueX = Math.max(803, COL_X + doc.widthOfString(sizeLabel) / S + 14);
    const valueSize = shrinkToFit(doc, F.regular, SZ.value, sizeValue, 960 - valueX);
    drawText(doc, F.regular, valueSize, sizeValue, valueX, 213, INK);
    drawText(doc, F.bold, SZ.qtyLabel, "Quantity:", 979, 214, INK);
    drawText(doc, F.regular, SZ.qtyValue, qty, 1254, 213, INK, "right");

    // Body: chart / measurements / gift selections, then the specification list.
    if (isGifting) {
      drawGiftSelections(doc, F, SZ, item, artworkBufs, 280);
      return;
    }

    const bullets = buildBullets(item, specs);
    if (isM2M && item.madeToMeasure.notes) bullets.push(`Fitting Notes: ${stripHtml(item.madeToMeasure.notes)}`);

    // A tall chart (e.g. 10 measurements) gets more room, paid for by tightening the bullet
    // spacing: budget = column height minus what the specification list needs at ~27px pitch.
    const specNeeds = 52 + 32 + Math.max(bullets.length - 1, 0) * 27 + 15;
    const chartMaxHeight = Math.max(215, Math.min(320, COL_BOTTOM - 240 - specNeeds - 12));

    let bottom = 255;
    if (isM2M) {
      const entries = measurementEntries(item.madeToMeasure.measurements);
      const unit = item.madeToMeasure.unit || "inches";
      if (entries.length) {
        const perTable = 6;
        let top = 240;
        for (let i = 0; i < entries.length; i += perTable) {
          const group = entries.slice(i, i + perTable);
          bottom = drawChartTable(
            doc, F,
            [`MEASURES (${unit})`.toUpperCase(), ...group.map(([l]) => l)],
            [["Value", ...group.map(([, v]) => v)]],
            -1, top, 90
          );
          top = bottom + 10;
        }
      }
    } else if (chart && chart.columns?.length && chart.rows?.length) {
      const oriented = orientSizesAcross(chart);
      const hiCol = findHighlightColumn(oriented.columns, selectedSize);
      bottom = drawChartTable(doc, F, oriented.columns, oriented.rows, hiCol, 240, chartMaxHeight);
      if (selectedSize && hiCol === -1) {
        drawText(doc, F.regular, p(9.5) * 1, `Ordered size "${selectedSize}" was not found in this chart.`, 684, bottom + 15, "#6F655B");
        bottom += 18;
      }
    }

    drawSpecification(doc, F, SZ, bullets, bottom + 52);
  });

  return new Promise((resolve, reject) => {
    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    doc.end();
  });
}
