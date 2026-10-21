import { NextResponse } from "next/server";
import PDFDocument from "pdfkit";
import dbConnect from "@/lib/db";
import Product from "@/models/Product";
import "@/models/Category";
import "@/models/SizeChart";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { can } from "@/lib/rbac";
import { resolveProductSizeChart } from "@/lib/orderSizeCharts";
import { SIZES_CM, SIZES_IN } from "@/lib/sizeChartDefaults";
import { orderLookupQuery } from "@/lib/orderLookup";

export const runtime = "nodejs";

// ─── Layout constants (mirrors src/scripts/generate-crm-pdf.js's palette) ──────
const COLOR_PRIMARY = "#0F172A";
const COLOR_HEADER = "#1E293B";
const COLOR_ACCENT = "#D97706";
const COLOR_ACCENT_BG = "#FFFBEB";
const COLOR_TEXT = "#334155";
const COLOR_TEXT_MUTED = "#64748B";
const COLOR_BORDER = "#E2E8F0";

const PAGE_LEFT = 40;
const PAGE_WIDTH = 515; // 595 (A4 width) - 2*40 margin
const PAGE_BOTTOM = 770;

function absoluteUrl(url) {
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url;
  const base = (process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXTAUTH_URL || "").replace(/\/$/, "");
  return url.startsWith("/") ? `${base}${url}` : url;
}

/** Fetches a (likely remote) image URL into a Buffer pdfkit's .image() can embed. Never throws. */
async function fetchImageBuffer(url) {
  const absolute = absoluteUrl(url);
  if (!absolute) return null;
  try {
    const res = await fetch(absolute, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") || "";
    if (contentType.includes("svg")) return null; // pdfkit cannot rasterize SVG
    const buf = Buffer.from(await res.arrayBuffer());
    return buf.length ? buf : null;
  } catch {
    return null;
  }
}

/**
 * Rebuilds the same plain {heading, columns, rows} shape that
 * src/lib/orderSizeCharts.js's (private) toEmailChart() produces, from the
 * shared resolveProductSizeChart() primitive — mirroring the size-confirmation
 * email's chart resolution rather than inventing a new one.
 */
function buildChartForProduct(product) {
  const resolved = resolveProductSizeChart(product);
  if (!resolved) return null;

  if (resolved.type === "reusable") {
    const c = resolved.chart;
    return {
      heading: c.publicHeading || c.label || "Size Chart",
      columns: c.columns || [],
      rows: c.rows || [],
    };
  }

  const g = resolved.sizeGuide || {};
  const cm = g.sizesCm?.length ? g.sizesCm : SIZES_CM;
  const inch = g.sizesIn?.length ? g.sizesIn : SIZES_IN;
  const sizeLabel = (g.sizeName || "").trim() || "Size";
  return {
    heading: "Size Chart",
    columns: [sizeLabel, "US", "EU", "Chest (cm)", "Chest (in)", "Sleeves (cm)", "Sleeves (in)"],
    rows: cm.map((r, i) => [r.size, r.us, r.eu, r.chest, inch[i]?.chest ?? "", r.sleeves, inch[i]?.sleeves ?? ""]),
  };
}

/** Pulls the ordered "Size" option off a line item, falling back to parsing the variant title. */
function getSelectedSizeLabel(item) {
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
  extrasmall: "xs",
  xsmall: "xs",
  small: "s",
  medium: "m",
  med: "m",
  large: "l",
  extralarge: "xl",
  xlarge: "xl",
  doubleextralarge: "2xl",
  xxlarge: "2xl",
  xxl: "2xl",
  tripleextralarge: "3xl",
  xxxlarge: "3xl",
  xxxl: "3xl",
  quadrupleextralarge: "4xl",
  xxxxlarge: "4xl",
  xxxxl: "4xl",
};

function normalizeSize(s) {
  if (!s) return "";
  const t = String(s).trim().toLowerCase().replace(/[\s\-_.]/g, "");
  return SIZE_ALIASES[t] || t;
}

function findHighlightRowIndex(rows, selectedSize) {
  if (!selectedSize || !rows?.length) return -1;
  const target = normalizeSize(selectedSize);
  if (!target) return -1;
  return rows.findIndex((row) => normalizeSize(row?.[0]) === target);
}

function addHeader(doc, order) {
  doc.rect(PAGE_LEFT, 35, PAGE_WIDTH, 70).fill(COLOR_PRIMARY);
  doc.fontSize(16).font("Helvetica-Bold").fillColor("#FFFFFF").text("PAIRO LIFESTYLE", PAGE_LEFT + 15, 48);
  doc.fontSize(10).font("Helvetica").fillColor(COLOR_ACCENT).text("VENDOR PRODUCTION SHEET", PAGE_LEFT + 15, 70);
  doc
    .fontSize(8)
    .font("Helvetica")
    .fillColor("#94A3B8")
    .text(`Generated ${new Date().toLocaleString()}`, PAGE_LEFT + 15, 86);
  doc.y = 118;

  doc
    .fontSize(13)
    .font("Helvetica-Bold")
    .fillColor(COLOR_PRIMARY)
    .text(`ORDER NUMBER: ${order.orderNumber}`, PAGE_LEFT, doc.y);
  doc.moveDown(0.6);
  doc
    .strokeColor(COLOR_ACCENT)
    .lineWidth(1.2)
    .moveTo(PAGE_LEFT, doc.y)
    .lineTo(PAGE_LEFT + PAGE_WIDTH, doc.y)
    .stroke();
  doc.moveDown(0.6);
}

/** Draws a size-chart table, with the row matching highlightIndex visually highlighted. */
function renderSizeTable(doc, startX, startY, width, columns, rows, highlightIndex) {
  const colWidth = width / columns.length;
  let y = startY;

  const drawHeaderRow = () => {
    doc.rect(startX, y, width, 16).fill(COLOR_HEADER);
    doc.fontSize(7.5).font("Helvetica-Bold").fillColor("#FFFFFF");
    columns.forEach((col, i) => {
      doc.text(String(col ?? ""), startX + i * colWidth + 4, y + 4.5, { width: colWidth - 8, ellipsis: true });
    });
    y += 16;
  };

  drawHeaderRow();

  rows.forEach((row, rIdx) => {
    if (y > PAGE_BOTTOM) {
      doc.addPage();
      y = 45;
      drawHeaderRow();
    }

    const isHighlight = rIdx === highlightIndex;
    const bg = isHighlight ? COLOR_ACCENT_BG : rIdx % 2 === 0 ? "#FFFFFF" : "#F8FAFC";
    doc.rect(startX, y, width, 16).fillAndStroke(bg, COLOR_BORDER);
    if (isHighlight) {
      doc.lineWidth(1.4).strokeColor(COLOR_ACCENT).rect(startX, y, width, 16).stroke();
    }

    columns.forEach((_, i) => {
      doc
        .fontSize(7.5)
        .font(isHighlight ? "Helvetica-Bold" : "Helvetica")
        .fillColor(isHighlight ? "#92400E" : COLOR_TEXT);
      doc.text(String(row?.[i] ?? "-"), startX + i * colWidth + 4, y + 4.5, { width: colWidth - 8, ellipsis: true });
    });

    if (isHighlight) {
      doc
        .fontSize(7)
        .font("Helvetica-Bold")
        .fillColor(COLOR_ACCENT)
        .text("<- ORDERED SIZE", startX + width + 6, y + 4.5, { width: 90, lineBreak: false });
    }

    y += 16;
  });

  return y + 8;
}

export async function GET(req, { params }) {
  try {
    await dbConnect();
    const session = await getServerSession(authOptions);

    if (!session || !session.user?.isStaff) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!can(session.user, "orders.view")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const order = await orderLookupQuery(id).lean();
    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const items = order.items || [];
    const productIds = [
      ...new Set(
        items
          .filter((it) => it.productId && !it.madeToMeasure?.enabled && !it.corporateGifting?.enabled)
          .map((it) => String(it.productId))
      ),
    ];

    let productById = new Map();
    if (productIds.length) {
      const products = await Product.find({ _id: { $in: productIds } })
        .populate({ path: "categories", populate: { path: "sizeChart" } })
        .populate({ path: "primaryCategory", populate: { path: "sizeChart" } })
        .populate("sizeChart")
        .lean();
      productById = new Map(products.map((p) => [String(p._id), p]));
    }

    // Fetch all item images AND every Corporate Gifting selection's uploaded logo/artwork in
    // one batch (started together, not one batch awaited before the next starts) — this pays
    // for the slowest single fetch across the whole order instead of the slowest image fetch
    // plus the slowest artwork fetch stacked on top of it.
    const imageBuffersPromise = Promise.all(items.map((it) => fetchImageBuffer(it.image)));
    const artworkBuffersPromise = Promise.all(
      items.map((it) => {
        const selections = it.corporateGifting?.enabled ? (it.corporateGifting.selections || []) : [];
        return Promise.all(selections.map((sel) => fetchImageBuffer(sel.artwork?.url)));
      })
    );
    const [imageBuffers, artworkBuffers] = await Promise.all([imageBuffersPromise, artworkBuffersPromise]);

    const doc = new PDFDocument({
      size: "A4",
      margins: { top: 35, bottom: 40, left: PAGE_LEFT, right: 40 },
      bufferPages: true,
    });

    addHeader(doc, order);

    const IMAGE_SIZE = 90;
    const TEXT_X = PAGE_LEFT + IMAGE_SIZE + 16;
    const TEXT_WIDTH = PAGE_WIDTH - IMAGE_SIZE - 16;

    items.forEach((item, idx) => {
      // Rough height estimate so we can break to a new page before an item splits awkwardly.
      const giftingSelCount = item.corporateGifting?.enabled ? (item.corporateGifting.selections || []).length : 0;
      const contentRowsEstimate = giftingSelCount > 0 ? giftingSelCount * 3 : 8; // ~3 "rows" per 48px gifting thumbnail row vs. a size-chart row
      const estimatedHeight = IMAGE_SIZE + 20 + 16 + contentRowsEstimate * 16 + 30;
      if (doc.y + estimatedHeight > PAGE_BOTTOM && idx !== 0) {
        doc.addPage();
        doc.y = 45;
      }

      const blockTop = doc.y;

      // Left: product image
      doc.rect(PAGE_LEFT, blockTop, IMAGE_SIZE, IMAGE_SIZE).lineWidth(1).stroke(COLOR_BORDER);
      const imgBuf = imageBuffers[idx];
      if (imgBuf) {
        try {
          doc.image(imgBuf, PAGE_LEFT + 2, blockTop + 2, {
            fit: [IMAGE_SIZE - 4, IMAGE_SIZE - 4],
            align: "center",
            valign: "center",
          });
        } catch {
          doc
            .fontSize(7)
            .font("Helvetica")
            .fillColor(COLOR_TEXT_MUTED)
            .text("Image unavailable", PAGE_LEFT + 8, blockTop + IMAGE_SIZE / 2 - 4, { width: IMAGE_SIZE - 16 });
        }
      } else {
        doc
          .fontSize(7)
          .font("Helvetica")
          .fillColor(COLOR_TEXT_MUTED)
          .text("No image", PAGE_LEFT + 8, blockTop + IMAGE_SIZE / 2 - 4, { width: IMAGE_SIZE - 16, align: "center" });
      }

      // Right: product name, SKU, quantity, selected size
      const selectedSize = getSelectedSizeLabel(item);
      doc.fontSize(11).font("Helvetica-Bold").fillColor(COLOR_PRIMARY).text(item.name || "Item", TEXT_X, blockTop, { width: TEXT_WIDTH });
      let infoY = doc.y + 2;
      if (item.sku) {
        doc.fontSize(8).font("Helvetica").fillColor(COLOR_TEXT_MUTED).text(`SKU: ${item.sku}`, TEXT_X, infoY, { width: TEXT_WIDTH });
        infoY = doc.y + 2;
      }
      doc.fontSize(8).font("Helvetica").fillColor(COLOR_TEXT_MUTED).text(`Quantity: ${item.quantity ?? 1}`, TEXT_X, infoY, { width: TEXT_WIDTH });
      infoY = doc.y + 4;

      if (item.madeToMeasure?.enabled) {
        doc.fontSize(9).font("Helvetica-Bold").fillColor(COLOR_ACCENT).text("Made to Measure (see measurements below)", TEXT_X, infoY, { width: TEXT_WIDTH });
      } else if (item.corporateGifting?.enabled) {
        const selCount = (item.corporateGifting.selections || []).length;
        doc.fontSize(9).font("Helvetica-Bold").fillColor(COLOR_ACCENT).text(`Corporate Gifting — ${selCount} item${selCount === 1 ? "" : "s"} customized (see below)`, TEXT_X, infoY, { width: TEXT_WIDTH });
      } else if (selectedSize) {
        doc.fontSize(9).font("Helvetica-Bold").fillColor(COLOR_ACCENT).text(`Selected Size: ${selectedSize}`, TEXT_X, infoY, { width: TEXT_WIDTH });
      } else {
        doc.fontSize(9).font("Helvetica").fillColor(COLOR_TEXT_MUTED).text("No size selected", TEXT_X, infoY, { width: TEXT_WIDTH });
      }

      const rightBottom = doc.y;
      let y = Math.max(blockTop + IMAGE_SIZE, rightBottom) + 10;

      if (item.madeToMeasure?.enabled) {
        const m = item.madeToMeasure.measurements || {};
        const unit = item.madeToMeasure.unit || "inches";
        const entries = Object.entries(m).filter(([, v]) => v !== undefined && v !== null && v !== "");
        if (entries.length) {
          doc.fontSize(8).font("Helvetica-Bold").fillColor(COLOR_PRIMARY).text(`Custom Measurements (${unit}):`, PAGE_LEFT, y, { width: PAGE_WIDTH });
          y = doc.y + 2;
          const line = entries.map(([k, v]) => `${k}: ${v}`).join("   |   ");
          doc.fontSize(8).font("Helvetica").fillColor(COLOR_TEXT).text(line, PAGE_LEFT, y, { width: PAGE_WIDTH });
          y = doc.y + 10;
        }
      } else if (item.corporateGifting?.enabled) {
        const selections = item.corporateGifting.selections || [];
        const selectionArtwork = artworkBuffers[idx] || [];
        const THUMB = 40;
        selections.forEach((sel, selIdx) => {
          const rowTop = y;
          const artBuf = selectionArtwork[selIdx];
          doc.rect(PAGE_LEFT, rowTop, THUMB, THUMB).lineWidth(0.75).stroke(COLOR_BORDER);
          if (artBuf) {
            try {
              doc.image(artBuf, PAGE_LEFT + 2, rowTop + 2, { fit: [THUMB - 4, THUMB - 4], align: "center", valign: "center" });
            } catch {
              doc.fontSize(6).font("Helvetica").fillColor(COLOR_TEXT_MUTED).text("Logo\nunavailable", PAGE_LEFT + 4, rowTop + 12, { width: THUMB - 8, align: "center" });
            }
          } else {
            doc.fontSize(6).font("Helvetica").fillColor(COLOR_TEXT_MUTED).text("No logo\nuploaded", PAGE_LEFT + 4, rowTop + 12, { width: THUMB - 8, align: "center" });
          }
          const rowTextX = PAGE_LEFT + THUMB + 10;
          doc.fontSize(8.5).font("Helvetica-Bold").fillColor(COLOR_PRIMARY).text(sel.name || "Item", rowTextX, rowTop + 2, { width: PAGE_WIDTH - THUMB - 10 });
          doc.fontSize(7.5).font("Helvetica").fillColor(COLOR_TEXT_MUTED).text(
            sel.artwork?.name ? `Logo file: ${sel.artwork.name}` : "No logo uploaded for this item",
            rowTextX, doc.y + 1, { width: PAGE_WIDTH - THUMB - 10 }
          );
          y = Math.max(rowTop + THUMB, doc.y) + 8;
        });
      } else {
        const product = item.productId ? productById.get(String(item.productId)) : null;
        const chart = product ? buildChartForProduct(product) : null;

        if (chart && chart.columns?.length && chart.rows?.length) {
          doc.fontSize(8.5).font("Helvetica-Bold").fillColor(COLOR_PRIMARY).text(chart.heading, PAGE_LEFT, y, { width: PAGE_WIDTH });
          y = doc.y + 4;
          const highlightIndex = findHighlightRowIndex(chart.rows, selectedSize);
          y = renderSizeTable(doc, PAGE_LEFT, y, PAGE_WIDTH - 100, chart.columns, chart.rows, highlightIndex);
          if (highlightIndex === -1 && selectedSize) {
            doc.fontSize(7.5).font("Helvetica-Oblique").fillColor(COLOR_TEXT_MUTED).text(`Note: "${selectedSize}" did not exactly match a chart row above.`, PAGE_LEFT, y, { width: PAGE_WIDTH });
            y = doc.y + 6;
          }
        } else {
          doc.fontSize(8).font("Helvetica-Oblique").fillColor(COLOR_TEXT_MUTED).text("No size chart available for this product.", PAGE_LEFT, y, { width: PAGE_WIDTH });
          y = doc.y + 10;
        }
      }

      doc.strokeColor(COLOR_BORDER).lineWidth(0.75).moveTo(PAGE_LEFT, y).lineTo(PAGE_LEFT + PAGE_WIDTH, y).stroke();
      doc.y = y + 14;
    });

    if (items.length === 0) {
      doc.fontSize(10).font("Helvetica").fillColor(COLOR_TEXT_MUTED).text("This order has no line items.", PAGE_LEFT, doc.y);
    }

    // Footer page numbers (requires bufferPages: true, drawn before .end()).
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      doc
        .fontSize(7.5)
        .font("Helvetica")
        .fillColor("#94A3B8")
        .text(`Order #${order.orderNumber} — Vendor Production Sheet — Page ${i + 1} of ${range.count}`, PAGE_LEFT, 800, {
          align: "center",
          width: PAGE_WIDTH,
        });
    }

    const pdfBuffer = await new Promise((resolve, reject) => {
      const chunks = [];
      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);
      doc.end();
    });

    const filename = `order-${order.orderNumber}-vendor.pdf`;
    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${filename}"`,
        "Content-Length": String(pdfBuffer.length),
      },
    });
  } catch (error) {
    console.error("[vendor-pdf] generation failed:", error);
    return NextResponse.json({ error: "Failed to generate vendor PDF" }, { status: 500 });
  }
}
