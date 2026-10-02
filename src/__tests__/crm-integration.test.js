import { describe, it, expect, vi, beforeEach } from "vitest";
import crypto from "crypto";

// Mock database and models
vi.mock("@/lib/db", () => ({
  default: vi.fn().mockResolvedValue(true),
}));

const mockOrders = [
  {
    _id: "660000000000000000000001",
    orderNumber: "PL-1001",
    status: "Pending",
    createdAt: new Date("2026-10-01T10:00:00Z"),
    updatedAt: new Date("2026-10-01T10:00:00Z"),
    customer: { email: "customer@example.com", isGuest: false },
    financials: { total: 350, currency: "USD" },
    payment: { method: "Card", status: "Paid" },
    items: [
      {
        productId: "660000000000000000000002",
        name: "Vintage B3 Shearling Jacket",
        priceAtPurchase: 350,
        quantity: 1,
      },
    ],
    timeline: [],
    save: vi.fn().mockResolvedValue(true),
  },
];

vi.mock("@/models/Order", () => {
  const mockQuery = {
    sort: vi.fn().mockReturnThis(),
    skip: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    lean: vi.fn().mockResolvedValue(mockOrders),
  };

  return {
    default: {
      find: vi.fn().mockReturnValue(mockQuery),
      findOne: vi.fn().mockImplementation(({ orderNumber }) => {
        const found = mockOrders.find((o) => o.orderNumber === orderNumber);
        return Promise.resolve(found || null);
      }),
      countDocuments: vi.fn().mockResolvedValue(1),
    },
  };
});

vi.mock("@/lib/events", () => ({
  default: {
    dispatch: vi.fn(),
    on: vi.fn(),
  },
}));

vi.mock("@/lib/queue", () => ({
  default: {
    push: vi.fn((name, fn) => fn()),
  },
}));

vi.mock("@/models/AuditLog", () => ({
  default: {
    create: vi.fn().mockResolvedValue(true),
  },
}));

describe("CRM & Orders Integration Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.CRM_API_KEY;
    delete process.env.CRM_WEBHOOK_URL;
    delete process.env.CRM_WEBHOOK_SECRET;
  });

  describe("CORS Preflight (OPTIONS)", () => {
    it("should return HTTP 204 with full permissive CORS headers", async () => {
      const { OPTIONS } = await import("@/app/api/crm/orders/route");
      const res = await OPTIONS();

      expect(res.status).toBe(204);
      expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
      expect(res.headers.get("Access-Control-Allow-Methods")).toContain("GET");
      expect(res.headers.get("Access-Control-Allow-Methods")).toContain("PATCH");
      expect(res.headers.get("Access-Control-Allow-Headers")).toContain("Content-Type");
    });
  });

  describe("GET /api/crm/orders", () => {
    it("should retrieve formatted orders with pagination metadata", async () => {
      const { GET } = await import("@/app/api/crm/orders/route");
      const req = new Request("http://localhost:3000/api/crm/orders?page=1&limit=10");
      const res = await GET(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.pagination.page).toBe(1);
      expect(data.pagination.total).toBe(1);
      expect(data.orders).toHaveLength(1);
      expect(data.orders[0].orderNumber).toBe("PL-1001");
      expect(data.orders[0].financials.total).toBe(350);
      expect(data.orders[0].items[0].name).toBe("Vintage B3 Shearling Jacket");
    });

    it("should safely escape regex characters in search parameters", async () => {
      const { GET } = await import("@/app/api/crm/orders/route");
      const Order = (await import("@/models/Order")).default;

      const orderParam = encodeURIComponent("PL-[1001]");
      const emailParam = encodeURIComponent("user+test.*@domain.com");
      const req = new Request(`http://localhost:3000/api/crm/orders?orderNumber=${orderParam}&email=${emailParam}`);
      const res = await GET(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);

      // Verify that find was called with escaped regex, preventing injection
      expect(Order.find).toHaveBeenCalledWith(
        expect.objectContaining({
          orderNumber: { $regex: "PL-\\[1001\\]", $options: "i" },
          "customer.email": { $regex: "user\\+test\\.\\*@domain\\.com", $options: "i" },
        })
      );
    });

    it("should reject request when CRM_API_KEY is configured and provided key is invalid", async () => {
      process.env.CRM_API_KEY = "secret-crm-key-123";
      const { GET } = await import("@/app/api/crm/orders/route");

      const req = new Request("http://localhost:3000/api/crm/orders", {
        headers: { "x-api-key": "wrong-key" },
      });
      const res = await GET(req);
      const data = await res.json();

      expect(res.status).toBe(401);
      expect(data.success).toBe(false);
      expect(data.error).toContain("Unauthorized");
    });

    it("should authorize request when CRM_API_KEY matches via header or bearer token", async () => {
      process.env.CRM_API_KEY = "secret-crm-key-123";
      const { GET } = await import("@/app/api/crm/orders/route");

      const req = new Request("http://localhost:3000/api/crm/orders", {
        headers: { Authorization: "Bearer secret-crm-key-123" },
      });
      const res = await GET(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
    });
  });

  describe("PATCH /api/crm/orders", () => {
    it("should update order status and tracking info", async () => {
      const { PATCH } = await import("@/app/api/crm/orders/route");
      const pairoEvents = (await import("@/lib/events")).default;

      const req = new Request("http://localhost:3000/api/crm/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderNumber: "PL-1001",
          status: "Shipped",
          carrier: "DHL Express",
          trackingNumber: "DHL987654321",
          trackingUrl: "https://dhl.com/track/DHL987654321",
          adminNote: "Dispatched from London warehouse",
        }),
      });

      const res = await PATCH(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.order.status).toBe("Shipped");
      expect(pairoEvents.dispatch).toHaveBeenCalledWith(
        "ORDER_STATUS_UPDATED",
        expect.objectContaining({
          newStatus: "Shipped",
          oldStatus: "Pending",
        })
      );
    });

    it("should reject invalid status with 400 Bad Request", async () => {
      const { PATCH } = await import("@/app/api/crm/orders/route");

      const req = new Request("http://localhost:3000/api/crm/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderNumber: "PL-1001",
          status: "InvalidNonExistentStatus",
        }),
      });

      const res = await PATCH(req);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain("Invalid status");
    });
  });

  describe("Webhook Dispatcher (dispatchOrderToCRM)", () => {
    it("should calculate correct HMAC SHA256 signature and push to queue", async () => {
      process.env.CRM_WEBHOOK_URL = "https://app.mohsindesigns.com/api/public/lead-forms/otXOxJkQULota1Ghk8Fh8ZQgGfFcmu4o/submit";
      process.env.CRM_WEBHOOK_SECRET = "test-secret-key";

      const QueueService = (await import("@/lib/queue")).default;
      const { dispatchOrderToCRM } = await import("@/lib/crmWebhook");

      const sampleOrder = {
        _id: "660000000000000000000001",
        orderNumber: "PL-9999",
        status: "Confirmed",
        financials: { total: 499 },
        items: [{ name: "Jacket", priceAtPurchase: 499, quantity: 1 }],
      };

      // Mock fetch
      const fetchSpy = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
      });
      global.fetch = fetchSpy;

      await dispatchOrderToCRM("ORDER_CREATED", sampleOrder);

      expect(QueueService.push).toHaveBeenCalled();
      expect(fetchSpy).toHaveBeenCalled();

      const fetchCallArgs = fetchSpy.mock.calls[0];
      const headers = fetchCallArgs[1].headers;
      const body = fetchCallArgs[1].body;

      expect(fetchCallArgs[0]).toBe(process.env.CRM_WEBHOOK_URL);
      expect(headers["X-Pairo-Event"]).toBe("ORDER_CREATED");

      // Verify HMAC SHA256 Signature
      const expectedSig = crypto
        .createHmac("sha256", "test-secret-key")
        .update(body)
        .digest("hex");

      expect(headers["X-Pairo-Signature"]).toBe(`sha256=${expectedSig}`);
    });

    it("should gracefully do nothing if CRM_WEBHOOK_URL is not configured", async () => {
      delete process.env.CRM_WEBHOOK_URL;
      const QueueService = (await import("@/lib/queue")).default;
      const { dispatchOrderToCRM } = await import("@/lib/crmWebhook");

      await dispatchOrderToCRM("ORDER_CREATED", { orderNumber: "PL-001" });
      expect(QueueService.push).not.toHaveBeenCalled();
    });
  });

  describe("Alias Re-export /api/orders", () => {
    it("should re-export GET, PATCH, and OPTIONS identical to /api/crm/orders", async () => {
      const ordersRoute = await import("@/app/api/orders/route");
      const crmOrdersRoute = await import("@/app/api/crm/orders/route");

      expect(ordersRoute.GET).toBe(crmOrdersRoute.GET);
      expect(ordersRoute.PATCH).toBe(crmOrdersRoute.PATCH);
      expect(ordersRoute.OPTIONS).toBe(crmOrdersRoute.OPTIONS);
    });
  });
});
