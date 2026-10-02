const fs = require("fs");
const PDFDocument = require("pdfkit");

const outputPath = "C:\\Users\\dell\\Desktop\\Pairo_Orders_API_Integration.pdf";

console.log("Generating clean API Integration PDF at:", outputPath);

const doc = new PDFDocument({
  size: "A4",
  margins: { top: 35, bottom: 40, left: 40, right: 40 },
  bufferPages: true,
});

const writeStream = fs.createWriteStream(outputPath);
doc.pipe(writeStream);

// Luxury Minimalist Color Palette (Pairo Black & Amber)
const COLOR_PRIMARY = "#0F172A";    // Slate 900
const COLOR_HEADER = "#1E293B";     // Slate 800
const COLOR_ACCENT = "#D97706";     // Amber 600
const COLOR_ACCENT_BG = "#FFFBEB";  // Amber 50
const COLOR_TEXT = "#334155";       // Slate 700
const COLOR_TEXT_MUTED = "#64748B"; // Slate 500
const COLOR_CODE_BG = "#F8FAFC";    // Slate 50
const COLOR_BORDER = "#E2E8F0";     // Slate 200

function addHeaderBadge(title) {
  doc.rect(40, 35, 515, 75).fill(COLOR_PRIMARY);
  doc.fontSize(18).font("Helvetica-Bold").fillColor("#FFFFFF").text("PAIRO LIFESTYLE", 55, 48);
  doc.fontSize(11).font("Helvetica").fillColor(COLOR_ACCENT).text("ORDERS API INTEGRATION SPECIFICATION", 55, 72);
  doc.fontSize(7.5).font("Helvetica").fillColor("#94A3B8").text("Standard Webhook & REST API Document for CRM Developers | October 2026", 55, 90);
  doc.y = 125;
}

function addSectionTitle(title) {
  doc.moveDown(0.6);
  doc.fontSize(13).font("Helvetica-Bold").fillColor(COLOR_PRIMARY).text(title);
  doc.strokeColor(COLOR_ACCENT).lineWidth(1.2).moveTo(doc.x, doc.y + 2).lineTo(doc.x + 515, doc.y + 2).stroke();
  doc.moveDown(0.5);
}

function addSubSectionTitle(title) {
  doc.moveDown(0.3);
  doc.fontSize(10).font("Helvetica-Bold").fillColor(COLOR_HEADER).text(title);
  doc.moveDown(0.2);
}

function addCodeBox(text) {
  const startX = 40;
  const startY = doc.y;
  const width = 515;

  doc.fontSize(7.5).font("Courier").fillColor(COLOR_PRIMARY);
  const textHeight = doc.heightOfString(text, { width: width - 16 });
  const boxHeight = textHeight + 14;

  doc.rect(startX, startY, width, boxHeight).fillAndStroke(COLOR_CODE_BG, COLOR_BORDER);
  doc.fillColor(COLOR_PRIMARY).text(text, startX + 8, startY + 7, { width: width - 16 });
  doc.y = startY + boxHeight + 6;
}

function renderTable(headers, rows, colWidths) {
  const startX = 40;
  let curY = doc.y;

  // Header row
  doc.rect(startX, curY, 515, 18).fillAndStroke(COLOR_HEADER, COLOR_BORDER);
  doc.fontSize(7.5).font("Helvetica-Bold").fillColor("#FFFFFF");

  let colX = startX + 6;
  headers.forEach((h, i) => {
    doc.text(h, colX, curY + 5, { width: colWidths[i] - 10 });
    colX += colWidths[i];
  });

  curY += 18;

  // Data rows
  rows.forEach((row, rowIndex) => {
    // Check page break
    if (curY > 740) {
      doc.addPage();
      curY = 45;
      // Re-draw table header
      doc.rect(startX, curY, 515, 18).fillAndStroke(COLOR_HEADER, COLOR_BORDER);
      doc.fontSize(7.5).font("Helvetica-Bold").fillColor("#FFFFFF");
      let hX = startX + 6;
      headers.forEach((h, i) => {
        doc.text(h, hX, curY + 5, { width: colWidths[i] - 10 });
        hX += colWidths[i];
      });
      curY += 18;
    }

    const rowBg = rowIndex % 2 === 0 ? "#FFFFFF" : "#F8FAFC";
    doc.rect(startX, curY, 515, 15).fillAndStroke(rowBg, COLOR_BORDER);

    colX = startX + 6;
    row.forEach((cell, i) => {
      const isKey = i === 0;
      doc.fontSize(7).font(isKey ? "Courier" : "Helvetica").fillColor(isKey ? COLOR_ACCENT : COLOR_TEXT);
      doc.text(cell || "—", colX, curY + 4, { width: colWidths[i] - 8, ellipsis: true });
      colX += colWidths[i];
    });

    curY += 15;
  });

  doc.y = curY + 6;
}

// ─────────────────────────────────────────────────────────────
// PAGE 1
// ─────────────────────────────────────────────────────────────
addHeaderBadge();

addSectionTitle("1. Retrieve Orders Endpoint (GET)");

doc.fontSize(8.5).font("Helvetica").fillColor(COLOR_TEXT);
doc.text("Method: GET", { continued: true });
doc.text("   |   Content-Type: application/json", { continued: true });
doc.text("   |   CORS: Supported (Access-Control-Allow-Origin: *)");
doc.fontSize(8.5).font("Helvetica-Bold").fillColor(COLOR_PRIMARY).text("URL: https://pairolifestyle.com/api/orders");
doc.fontSize(8).font("Helvetica").fillColor(COLOR_TEXT_MUTED).text("(Alternative alias: https://pairolifestyle.com/api/crm/orders)");

doc.moveDown(0.3);
doc.fontSize(8).font("Helvetica").fillColor(COLOR_TEXT).text(
  "Cross-origin requests are fully supported. The CRM can query this endpoint directly from server backends or client browsers without cookies or credentials. If CRM_API_KEY is configured in the website environment, pass it via 'x-api-key' header or '?api_key=' parameter; otherwise public read access is open."
);

addSubSectionTitle("Query Parameters");

const queryParamHeaders = ["Key", "Label", "Type", "Required", "Default", "Description"];
const queryParamRows = [
  ["page", "Page Number", "integer", "No", "1", "Pagination page offset"],
  ["limit", "Limit", "integer", "No", "20", "Number of orders per page (Max: 100)"],
  ["status", "Order Status", "select", "No", "all", "Options: Pending, Confirmed, Processing, Packed, Shipped, Delivered, Cancelled"],
  ["since", "Updated Since", "string", "No", "—", "ISO 8601 date (e.g. 2026-10-01T00:00:00Z). Returns orders updated since this date."],
  ["orderNumber", "Order Number", "text", "No", "—", "Exact or partial search on order reference (e.g. PAI-1042)"],
  ["email", "Customer Email", "email", "No", "—", "Filter orders matching customer email"]
];
renderTable(queryParamHeaders, queryParamRows, [65, 80, 50, 55, 45, 220]);

addSubSectionTitle("Example cURL Request");
addCodeBox('curl -X GET "https://pairolifestyle.com/api/orders?status=Confirmed&limit=10" -H "Accept: application/json"');

addSubSectionTitle("Example Success Response (200 OK)");
addCodeBox(
`{
  "success": true,
  "pagination": { "page": 1, "limit": 10, "total": 42, "totalPages": 5 },
  "orders": [
    {
      "id": "66f12ab45c3de70123456789",
      "orderNumber": "PAI-1042",
      "status": "Confirmed",
      "createdAt": "2026-10-02T14:30:00.000Z",
      "customer": { "email": "james@example.com", "isGuest": true, "ipAddress": "192.168.1.1" },
      "shippingAddress": { "fullName": "James Sterling", "street": "742 Evergreen Terrace", "city": "Springfield", "country": "United States", "phone": "+1 555 234 5678" },
      "financials": { "total": 1237.50, "subtotal": 1250.00, "shippingCost": 0, "tax": 87.50, "currency": "USD", "promoCode": "AUTUMN100" },
      "payment": { "method": "Card", "status": "Paid", "provider": "stripe", "stripePaymentIntentId": "pi_3PqL81A2bC9dEf01" },
      "items": [
        {
          "name": "Men's B-3 Aviator Shearling Bomber Jacket",
          "sku": "PAI-B3-BRN-XL",
          "priceAtPurchase": 1250.00,
          "quantity": 1,
          "selectedVariant": { "title": "Size: XL / Color: Vintage Brown" },
          "madeToMeasure": { "enabled": true, "unit": "inches", "measurements": { "chest": 44, "waist": 36, "shoulderWidth": 19.5, "sleeveLength": 26 } }
        }
      ]
    }
  ]
}`
);

// ─────────────────────────────────────────────────────────────
// PAGE 2: ORDER FIELDS SCHEMA TABLE
// ─────────────────────────────────────────────────────────────
doc.addPage();

addSectionTitle("2. Order Fields (Complete Schema & Shapes)");

doc.fontSize(8).font("Helvetica").fillColor(COLOR_TEXT).text(
  "Every order object returned by the API contains the following structured fields. Multiselect and measurements are nested JSON objects."
);
doc.moveDown(0.4);

const fieldHeaders = ["Key", "Label", "Type", "Required", "Description / Shape"];
const fieldRows = [
  ["id", "Order ID", "text", "Yes", "Unique MongoDB string ID"],
  ["orderNumber", "Order Code", "text", "Yes", "Human reference code (e.g. 'PAI-1042')"],
  ["status", "Lifecycle Status", "select", "Yes", "Pending, Confirmed, Processing, Packed, Shipped, Delivered, Cancelled"],
  ["createdAt", "Created Date", "string", "Yes", "ISO 8601 creation timestamp"],
  ["updatedAt", "Updated Date", "string", "Yes", "ISO 8601 last modification timestamp"],
  ["customer.email", "Email", "email", "Yes", "Primary customer contact email"],
  ["customer.isGuest", "Guest Flag", "boolean", "Yes", "True if customer ordered as guest"],
  ["shippingAddress.fullName", "Full Name", "text", "Yes", "Recipient full name"],
  ["shippingAddress.phone", "Phone", "phone", "No", "Recipient phone number"],
  ["shippingAddress.street", "Street", "text", "Yes", "Delivery address line"],
  ["shippingAddress.city", "City", "text", "Yes", "Delivery city"],
  ["shippingAddress.state", "State", "text", "No", "State or province"],
  ["shippingAddress.zip", "Postal Code", "text", "No", "ZIP / Postal code"],
  ["shippingAddress.country", "Country", "text", "Yes", "Destination country (e.g. 'United States')"],
  ["financials.total", "Net Total", "number", "Yes", "Final amount charged to customer"],
  ["financials.subtotal", "Subtotal", "number", "Yes", "Item sum before discounts and taxes"],
  ["financials.shippingCost", "Shipping Fee", "number", "Yes", "Shipping cost charged"],
  ["financials.tax", "Tax", "number", "Yes", "Tax collected"],
  ["financials.discountTotal", "Discounts", "number", "Yes", "Total promotional deduction"],
  ["financials.currency", "Currency", "text", "Yes", "ISO currency (e.g. 'USD')"],
  ["financials.promoCode", "Promo Code", "text", "No", "Coupon code applied by customer"],
  ["payment.method", "Payment Method", "select", "Yes", "Card, Cash on Delivery, Custom Order, Manual/Gift"],
  ["payment.status", "Payment Status", "select", "Yes", "Paid, Pending, Failed, Refunded, Partially Refunded"],
  ["payment.stripePaymentIntentId", "Stripe Intent", "text", "No", "Stripe payment identifier (e.g. 'pi_...')"],
  ["items[].name", "Product Name", "text", "Yes", "Garment title (e.g. 'B-3 Aviator Shearling Bomber')"],
  ["items[].sku", "SKU", "text", "No", "Stock keeping unit"],
  ["items[].priceAtPurchase", "Unit Price", "number", "Yes", "Authoritative price at checkout"],
  ["items[].quantity", "Quantity", "number", "Yes", "Number of units ordered"],
  ["items[].selectedVariant", "Variant / Size", "object", "No", "{ title: 'Size: XL', options: { Size: 'XL' } }"],
  ["items[].madeToMeasure", "Tailoring Specs", "object", "No", "12 body dimensions: chest, waist, hips, shoulders, sleeve, etc."],
  ["items[].customization", "Bespoke Specs", "object", "No", "Bespoke leather type, lining, hardware, fur & artwork placement"],
  ["customerNote", "Customer Note", "textarea", "No", "Delivery instructions entered by customer"],
  ["adminNotes", "Admin Notes", "array", "No", "Internal notes & courier tracking updates"],
  ["timeline", "Order Timeline", "array", "No", "Audit log of all milestone changes"]
];

renderTable(fieldHeaders, fieldRows, [125, 80, 50, 50, 210]);

// ─────────────────────────────────────────────────────────────
// PAGE 3: FULFILLMENT UPDATE & WEBHOOK SPECIFICATION
// ─────────────────────────────────────────────────────────────
addSectionTitle("3. Update Order Fulfillment Endpoint (PATCH)");

doc.fontSize(8.5).font("Helvetica").fillColor(COLOR_TEXT);
doc.text("Method: PATCH", { continued: true });
doc.text("   |   Content-Type: application/json", { continued: true });
doc.text("   |   CORS: Supported");
doc.fontSize(8.5).font("Helvetica-Bold").fillColor(COLOR_PRIMARY).text("URL: https://pairolifestyle.com/api/orders");

doc.moveDown(0.2);
doc.fontSize(8).font("Helvetica").fillColor(COLOR_TEXT).text(
  "Use this endpoint whenever fulfillment status updates in your CRM (e.g., when a jacket is marked 'Processing', 'Packed', or 'Shipped' with courier tracking number). Pairo automatically updates customer order tracking and logs the timeline."
);

addSubSectionTitle("Update Fields");

const patchHeaders = ["Key", "Label", "Type", "Required", "Description"];
const patchRows = [
  ["orderNumber", "Order Number", "text", "Yes", "Target order reference (e.g. 'PAI-1042')"],
  ["status", "New Status", "select", "No", "Pending, Confirmed, Processing, Packed, Shipped, Delivered, Cancelled"],
  ["carrier", "Carrier Name", "text", "No", "Courier name (e.g. 'DHL Express', 'FedEx', 'UPS')"],
  ["trackingNumber", "Tracking Number", "text", "No", "Tracking code provided by courier"],
  ["trackingUrl", "Tracking Link", "text", "No", "Direct web URL for tracking package"],
  ["adminNote", "CRM Note", "textarea", "No", "Internal production / dispatch note appended to order"]
];
renderTable(patchHeaders, patchRows, [80, 80, 50, 55, 250]);

addSubSectionTitle("Example PATCH Request");
addCodeBox(
`curl -X PATCH "https://pairolifestyle.com/api/orders" \\
  -H "Content-Type: application/json" \\
  -d '{
    "orderNumber": "PAI-1042",
    "status": "Shipped",
    "carrier": "DHL Express",
    "trackingNumber": "DHL9876543210",
    "trackingUrl": "https://www.dhl.com/en/express/tracking.html?AWB=DHL9876543210",
    "adminNote": "Garment packaged in luxury garment bag and dispatched."
  }'`
);

addSubSectionTitle("Example Success Response");
addCodeBox(
`{
  "success": true,
  "message": "Order PAI-1042 successfully updated by CRM.",
  "order": {
    "orderNumber": "PAI-1042",
    "status": "Shipped",
    "updatedAt": "2026-10-02T16:00:00.000Z"
  }
}`
);

addSectionTitle("4. Real-Time Webhook Push (Pairo -> CRM)");
doc.fontSize(8).font("Helvetica").fillColor(COLOR_TEXT).text(
  "If your CRM has a webhook receiver URL, Pairo can automatically push new orders to your CRM the millisecond they are placed:\n" +
  "• Configure CRM_WEBHOOK_URL in /var/www/pairolifestyle.com/.env.local (e.g. https://app.mohsindesigns.com/api/...)\n" +
  "• On order creation, Pairo POSTs the full JSON order payload with header 'X-Pairo-Event: ORDER_CREATED'.\n" +
  "• Outbound requests include an HMAC-SHA256 signature in header 'X-Pairo-Signature: sha256=...' using CRM_WEBHOOK_SECRET."
);

// Add page numbers
const range = doc.bufferedPageRange();
for (let i = range.start; i < range.start + range.count; i++) {
  doc.switchToPage(i);
  doc.fontSize(7.5).font("Helvetica").fillColor("#94A3B8").text(
    `Pairo Lifestyle Orders API Specification — Page ${i + 1} of ${range.count}`,
    40,
    800,
    { align: "center", width: 515 }
  );
}

doc.end();

writeStream.on("finish", () => {
  console.log("Clean API Integration PDF generated successfully!");
});
