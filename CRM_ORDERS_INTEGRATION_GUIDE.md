# Pairo Lifestyle Orders API Integration

Documentation for connecting Pairo Lifestyle orders with your CRM (`app.mohsindesigns.com`).

---

## 1. Retrieve Orders Endpoint (GET)

**Method:** `GET`  
**URL:** `https://pairolifestyle.com/api/orders` *(also available at `https://pairolifestyle.com/api/crm/orders`)*  
**Content-Type:** `application/json`  
**CORS:** Cross-origin requests are supported (`Access-Control-Allow-Origin: *`). Can be called from CRM backend or frontend directly without cookies or credentials.  
**Authentication:** Optional. If `CRM_API_KEY` is configured in the website environment, pass it via header `x-api-key: <key>`, `Authorization: Bearer <key>`, or query parameter `?api_key=<key>`. If unset, public read access is enabled.

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
