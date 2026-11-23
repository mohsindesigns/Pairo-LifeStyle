# Pairo Lifestyle Orders API Integration

Documentation for connecting Pairo Lifestyle orders with your CRM (`app.mohsindesigns.com`).

---

## 1. Retrieve Orders Endpoint (GET)

**Method:** `GET`  
**URL:** `https://pairolifestyle.com/api/orders` *(also available at `https://pairolifestyle.com/api/crm/orders`)*  
**Content-Type:** `application/json`  
**CORS:** Cross-origin requests are supported (`Access-Control-Allow-Origin: *`). Can be called from CRM backend or frontend directly without cookies or credentials.  
**Authentication:** Required on the live site. Set `CRM_API_KEY` in the website environment and pass it with every request via header `x-api-key: <key>`, `Authorization: Bearer <key>` (the key is not accepted in the URL; it must be at least 32 characters; 10 wrong keys from one address lock it out for 15 minutes; `GET /api/crm/verify` checks the key without returning data). If the key is not set, the live site refuses all requests (only a local development server allows access without a key).

### Query Parameters

| Key | Label | Type | Required | Default | Description |
| --- | --- | --- | --- | --- | --- |
| `page` | Page Number | `integer` | No | `1` | Pagination page offset |
| `limit` | Page Size | `integer` | No | `20` | Number of orders per page (Max: `100`) |
| `status` | Order Status | `select` | No | `all` | Filter by status: `Pending`, `Confirmed`, `Processing`, `Packed`, `Shipped`, `Out for Delivery`, `Delivered`, `Cancelled`, `Refunded` |
| `since` | Updated Since | `string` | No | — | ISO 8601 date string (e.g. `2026-10-01T00:00:00Z`). Returns orders updated since this timestamp for syncing. |
| `orderNumber` | Order Number | `text` | No | — | Exact or partial search on order code (e.g. `PAI-1042`) |
| `email` | Customer Email | `email` | No | — | Filter orders matching customer email |

### Example Request

```bash
curl -X GET "https://pairolifestyle.com/api/orders?status=Confirmed&limit=10" \
  -H "Accept: application/json"
```

### Example Success Response (200 OK)

```json
{
  "success": true,
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 42,
    "totalPages": 5
  },
  "orders": [
    {
      "id": "66f12ab45c3de70123456789",
      "orderNumber": "PAI-1042",
      "status": "Confirmed",
      "createdAt": "2026-10-02T14:30:00.000Z",
      "updatedAt": "2026-10-02T14:32:00.000Z",
      "customer": {
        "userId": null,
        "email": "customer@example.com",
        "isGuest": true,
        "ipAddress": "192.168.1.1"
      },
      "shippingAddress": {
        "fullName": "James Sterling",
        "street": "742 Evergreen Terrace",
        "city": "Springfield",
        "state": "OR",
        "zip": "97477",
        "country": "United States",
        "phone": "+1 (555) 234-5678"
      },
      "financials": {
        "subtotal": 1250.00,
        "shippingCost": 0.00,
        "tax": 87.50,
        "discountTotal": 100.00,
        "total": 1237.50,
        "currency": "USD",
        "promoCode": "AUTUMN100"
      },
      "payment": {
        "method": "Card",
        "status": "Paid",
        "provider": "stripe",
        "stripePaymentIntentId": "pi_3PqL81A2bC9dEf01",
        "paidAt": "2026-10-02T14:31:45.000Z",
        "refundedAmount": 0
      },
      "items": [
        {
          "productId": "66810f22d0c2e...",
          "name": "Men's B-3 Aviator Shearling Bomber Jacket",
          "slug": "mens-b3-aviator-shearling-bomber",
          "sku": "PAI-B3-BRN-XL",
          "image": "/uploads/products/b3-front.jpg",
          "priceAtPurchase": 1250.00,
          "quantity": 1,
          "selectedVariant": {
            "title": "Size: XL / Color: Vintage Brown",
            "options": {
              "Size": "XL",
              "Color": "Vintage Brown"
            }
          },
          "madeToMeasure": {
            "enabled": true,
            "unit": "inches",
            "surcharge": 25,
            "measurements": {
              "chest": 44,
              "waist": 36,
              "shoulderWidth": 19.5,
              "sleeveLength": 26,
              "jacketLength": 27.5,
              "fitPreference": "Regular"
            }
          },
          "customization": null
        }
      ],
      "customerNote": "Please ring door bell upon arrival.",
      "affiliateReferralCode": "VIP_AFFILIATE",
      "adminNotes": [],
      "timeline": [
        {
          "status": "Pending",
          "message": "Order created via online checkout",
          "timestamp": "2026-10-02T14:30:00.000Z",
          "source": "System"
        },
        {
          "status": "Confirmed",
          "message": "Payment verified via Stripe",
          "timestamp": "2026-10-02T14:31:45.000Z",
          "source": "System"
        }
      ]
    }
  ]
}
```

---

## 2. Order Fields (Complete Schema)

| Key | Label | Type | Required | Description / Value Shape |
| --- | --- | --- | --- | --- |
| `id` | Order ID | `text` | Yes | MongoDB unique ObjectId string |
| `orderNumber` | Order Code | `text` | Yes | Unique reference (e.g. `PAI-1042`) |
| `status` | Lifecycle Status | `select` | Yes | `Pending`, `Confirmed`, `Processing`, `Packed`, `Shipped`, `Out for Delivery`, `Delivered`, `Cancelled`, `Refunded` |
| `createdAt` | Created Date | `string` | Yes | ISO 8601 creation timestamp |
| `updatedAt` | Updated Date | `string` | Yes | ISO 8601 last modified timestamp |
| `customer.email` | Email | `email` | Yes | Primary customer contact email |
| `customer.isGuest` | Guest Flag | `boolean` | Yes | `true` if customer ordered without an account |
| `shippingAddress.fullName` | Full Name | `text` | Yes | Shipping recipient full name |
| `shippingAddress.phone` | Phone | `phone` | No | Shipping contact phone number |
| `shippingAddress.street` | Street Address | `text` | Yes | Delivery street address and unit/suite |
| `shippingAddress.city` | City | `text` | Yes | Delivery city |
| `shippingAddress.state` | State / Province | `text` | No | Delivery state or region |
| `shippingAddress.zip` | Postal Code | `text` | No | ZIP / Postal code |
| `shippingAddress.country` | Country | `text` | Yes | Destination country name (e.g. `United States`) |
| `financials.total` | Net Total | `number` | Yes | Final order total charged to customer |
| `financials.subtotal` | Subtotal | `number` | Yes | Item sum before discounts/shipping/tax |
| `financials.shippingCost` | Shipping Fee | `number` | Yes | Shipping cost charged |
| `financials.tax` | Tax Amount | `number` | Yes | Tax collected |
| `financials.discountTotal` | Total Discount | `number` | Yes | Sum of coupon or promotional deductions |
| `financials.currency` | Currency | `text` | Yes | Default: `USD` |
| `financials.promoCode` | Promo Code | `text` | No | Coupon code applied by customer |
| `payment.method` | Payment Method | `select` | Yes | `Card` (Stripe), `Cash on Delivery`, `Custom Order`, `Manual/Gift` |
| `payment.status` | Payment Status | `select` | Yes | `Paid`, `Pending`, `Failed`, `Refunded`, `Partially Refunded` |
| `payment.stripePaymentIntentId` | Stripe Intent ID | `text` | No | Stripe PaymentIntent ID (e.g. `pi_3PqL...`) |
| `payment.paidAt` | Paid Timestamp | `string` | No | Timestamp when card charge completed |
| `items` | Order Items | `array` | Yes | Array of jackets/accessories ordered |
| `items[].name` | Product Name | `text` | Yes | e.g. `Men's B-3 Aviator Shearling Bomber Jacket` |
| `items[].sku` | SKU | `text` | No | Stock keeping unit |
| `items[].priceAtPurchase` | Unit Price | `number` | Yes | Authoritative price at checkout |
| `items[].quantity` | Quantity | `number` | Yes | Quantity purchased |
| `items[].selectedVariant` | Variant / Size | `object` | No | `{ "title": "Size: XL", "options": { "Size": "XL", "Color": "Brown" } }` |
| `items[].madeToMeasure` | Tailoring Specs | `object` | No | 12 custom body dimensions (chest, waist, hips, shoulders, sleeve length, etc.) |
| `items[].customization` | Bespoke Specs | `object` | No | Bespoke leather type, color, lining, hardware, fur, and artwork |
| `customerNote` | Customer Note | `textarea` | No | Delivery instructions entered by customer |
| `adminNotes` | Admin Notes | `array` | No | Internal notes and tracking logs |
| `timeline` | Order Timeline | `array` | No | Audit log of all milestone changes |

---

## 3. Update Order Fulfillment Endpoint (PATCH)

**Method:** `PATCH`  
**URL:** `https://pairolifestyle.com/api/orders` *(also available at `https://pairolifestyle.com/api/crm/orders`)*  
**Content-Type:** `application/json`  
**CORS:** Cross-origin requests are supported.  
**Purpose:** Use this endpoint whenever fulfillment status updates in your CRM (e.g., mark as `Processing`, `Packed`, or `Shipped` with courier tracking number). Pairo automatically updates customer tracking and timeline.

### Fields

| Key | Label | Type | Required | Description |
| --- | --- | --- | --- | --- |
| `orderNumber` | Order Number | `text` | Yes | The target order to update (e.g. `PAI-1042`) |
| `status` | New Status | `select` | No | `Pending`, `Confirmed`, `Processing`, `Packed`, `Shipped`, `Out for Delivery`, `Delivered`, `Cancelled`, `Refunded` |
| `carrier` | Carrier Name | `text` | No | Courier name (e.g. `DHL Express`, `FedEx`, `UPS`) |
| `trackingNumber` | Tracking Number | `text` | No | Tracking code provided by courier (e.g. `DHL9876543210`) |
| `trackingUrl` | Tracking Link | `text` | No | Direct public URL for tracking package |
| `adminNote` | CRM Note | `textarea` | No | Internal production / dispatch note appended to order |

### Example Request

```bash
curl -X PATCH "https://pairolifestyle.com/api/orders" \
  -H "Content-Type: application/json" \
  -d '{
    "orderNumber": "PAI-1042",
    "status": "Shipped",
    "carrier": "DHL Express",
    "trackingNumber": "DHL9876543210",
    "trackingUrl": "https://www.dhl.com/en/express/tracking.html?AWB=DHL9876543210",
    "adminNote": "Custom jacket completed QA and dispatched via DHL priority."
  }'
```

### Example Success Response (200 OK)

```json
{
  "success": true,
  "message": "Order PAI-1042 successfully updated by CRM.",
  "order": {
    "orderNumber": "PAI-1042",
    "status": "Shipped",
    "updatedAt": "2026-10-02T16:00:00.000Z"
  }
}
```

---

## 4. Real-Time Webhook Push (Pairo -> CRM)

If your CRM has a webhook URL to receive new orders automatically:
1. Configure `CRM_WEBHOOK_URL` in `/var/www/pairolifestyle.com/.env.local` (e.g. `https://app.mohsindesigns.com/api/webhooks/orders`).
2. Whenever a customer places an order, Pairo automatically sends an HTTP `POST` to your CRM webhook URL.
3. Includes header `X-Pairo-Signature: sha256=<hash>` and `X-Pairo-Event: ORDER_CREATED`.


---

# Two-way sync (create, update, delete, webhooks)

All endpoints use the same key (`x-api-key: <key>`, or `Authorization: Bearer <key>`). Base: `https://pairolifestyle.com/api/crm`. Every order object has the shape shown in section 1, plus `isDeleted`, `deletedAt`, `paymentStatus`, and `tracking {number, carrier, url, updatedAt}` (also flat as `trackingNumber`, `carrier`, `trackingUrl`).

## 5. Endpoints

| Method | Path | What it does |
|---|---|---|
| GET | `/orders` | List. Query: `page`, `limit` (max 100), `status`, `since` (ISO date, orders created or changed since), `orderNumber`, `email`, `includeDeleted=true` (also return Trash orders, with `isDeleted: true`) |
| POST | `/orders` | Create an order (below) |
| PATCH | `/orders` | Update; `orderNumber` in the body (older form, still works) |
| GET | `/orders/{orderNumber}` | One order (Trash orders too) |
| PATCH | `/orders/{orderNumber}` | Update (below) |
| DELETE | `/orders/{orderNumber}` | Move to Trash (never erased for good). Safe to repeat |
| GET | `/products` | Catalogue: `search`, `sku`, `page`, `limit`. Returns `id, name, sku, price, stock, manageStock, status, slug, variants[]` |

`/api/orders` and `/api/orders/{orderNumber}` are aliases of the order endpoints.

Errors: `{ "success": false, "error": "...", "field": "items[0].quantity" }`. 400 bad input, 401 bad key, 404 not found, 409 conflict or not enough stock, 500 server.

## 6. Create an order (POST /orders)

```json
{
  "externalId": "CRM-5521",
  "customer": { "email": "buyer@example.com", "name": "Buyer", "phone": "+15550001" },
  "shippingAddress": { "fullName": "Buyer One", "street": "1 Main St", "city": "Austin", "state": "TX", "zip": "73301", "country": "United States" },
  "items": [ { "productId": "<id from /products>", "quantity": 2 }, { "sku": "JKT-BLK-M", "quantity": 1, "priceOverride": 99 } ],
  "shippingCost": 10,
  "status": "Confirmed",
  "payment": { "method": "Manual/Gift", "status": "Paid" },
  "note": "optional",
  "sendConfirmation": false
}
```

- `externalId` is required. Sending the same one again returns `200 { success: true, duplicate: true, order }` and creates nothing, so retries are safe.
- Each item needs `productId` or `sku` (product or variant sku); `quantity` is a whole number 1 to 1000. Price comes from our catalogue unless `priceOverride` is given. Draft or unknown products are refused (400); not enough stock gives 409 `insufficient_stock`.
- `payment.method`: `Manual/Gift`, `Cash on Delivery`, `Card`. `payment.status`: `Paid` or `Pending`. Default status of a new order is `Confirmed`.
- Stock is taken off immediately, the same as a website order. The customer gets no email unless `sendConfirmation: true`.
- Success: `201 { success: true, duplicate: false, order }`.

## 7. Update an order (PATCH /orders/{orderNumber})

Send only what changed. All fields optional:

`status`, `trackingNumber`, `carrier`, `trackingUrl`, `adminNote`, `paymentStatus` (`Pending, Paid, Failed, Refunded, Partially Refunded`), `shippingAddress` (partial: only the keys you send change), `customerNote`, `restore: true` (take it out of the Trash), `expectedUpdatedAt`.

Statuses: `Pending, Confirmed, Processing, Packed, Shipped, Out for Delivery, Delivered, Cancelled, Refunded`.

Response: `{ "success": true, "changed": ["status","tracking"], "order": { ... } }`. `changed` is empty when nothing differed (nothing is written, no webhook is sent).

A status change does everything the dashboard does: Cancelled puts stock back once (and un-cancelling takes it again, or returns 409 if stock is gone), coupon usage is released or restored, affiliate commissions are approved on Delivered and cancelled on Cancelled/Refunded.

Conflicts: send `expectedUpdatedAt` (the `updatedAt` you last read). If the order changed since, you get `409 { "error": "conflict", "currentUpdatedAt": "..." }`; re-read it and decide.

## 8. Webhooks (Pairo to CRM)

Set `CRM_WEBHOOK_URL` and `CRM_WEBHOOK_SECRET` on our server. We POST JSON for every change, whoever made it:

`ORDER_CREATED`, `ORDER_STATUS_UPDATED`, `ORDER_CANCELLED`, `ORDER_PAYMENT_UPDATED`, `ORDER_UPDATED` (address, tracking, notes), `ORDER_DELETED`, `ORDER_RESTORED`.

```json
{ "id": "uuid", "event": "ORDER_STATUS_UPDATED", "origin": "admin", "timestamp": "...", "environment": "production",
  "data": { "orderNumber": "PL-1001", "status": "Shipped", "oldStatus": "Packed", "newStatus": "Shipped", "isDeleted": false, "tracking": { ... }, "...": "full order as in section 1" } }
```

- Headers: `X-Pairo-Event`, `X-Pairo-Delivery` (same as `id`), `X-Pairo-Signature: sha256=<hex>`: HMAC-SHA256 of the **raw body** with the secret. Verify it with a constant-time compare.
- `id` is unique per delivery; we retry failed deliveries up to 3 times, so ignore an `id` you already processed.
- `origin` says who changed the order: `crm`, `admin`, `website`, `customer`, `system`. Changes you made yourself come back with `origin: "crm"`; skip them to avoid loops.
- Reply with any 2xx quickly.
