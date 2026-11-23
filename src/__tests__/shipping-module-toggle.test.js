import { describe, it, expect, vi, beforeEach } from "vitest";
import SiteConfig from "@/models/SiteConfig";
import ShippingZone from "@/models/ShippingZone";
import ShippingMethod from "@/models/ShippingMethod";
import { shippingService } from "@/services/shipping/ShippingService";

vi.mock("@/lib/db", () => ({
  default: vi.fn().mockResolvedValue(true)
}));

vi.mock("next-auth", () => ({
  default: vi.fn(),
  getServerSession: vi.fn().mockResolvedValue({
    user: { isStaff: true, role: { slug: "super-admin" } }
  })
}));

// Mock models
vi.mock("@/models/SiteConfig", () => ({
  default: {
    findOne: vi.fn()
  }
}));

vi.mock("@/models/ShippingZone", () => ({
  default: {
    find: vi.fn()
  }
}));

vi.mock("@/models/ShippingMethod", () => ({
  default: {
    find: vi.fn()
  }
}));

describe("Shipping Module Toggle — ON / OFF Verification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return Free Delivery with $0 cost when shipping module is OFF (shippingEnabled: false)", async () => {
    // Mock SiteConfig with shippingEnabled = false
    SiteConfig.findOne.mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue({
          commerce: {
            storeCurrency: "USD",
            shippingEnabled: false
          }
        })
      })
    });

    const result = await shippingService.getRatesForAddress(
      { country: "US", state: "NY", city: "New York", zip: "10001" },
      150,
      [{ quantity: 1, weight: 1 }]
    );

    expect(result.shippingEnabled).toBe(false);
    expect(result.rates).toHaveLength(1);
    expect(result.rates[0]).toMatchObject({
      methodId: "free-delivery",
      methodName: "Free Delivery",
      cost: 0,
      provider: "FREE_SHIPPING"
    });
  });

  it("should evaluate zones and methods when shipping module is ON (shippingEnabled: true)", async () => {
    // Mock SiteConfig with shippingEnabled = true
    SiteConfig.findOne.mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue({
          commerce: {
            storeCurrency: "USD",
            shippingEnabled: true
          }
        })
      })
    });

    // Mock an active zone
    const mockZone = {
      _id: "zone-1",
      name: "United States",
      status: "Active",
      priority: 10,
      matchRules: [{ type: "country", values: ["US"] }]
    };

    ShippingZone.find.mockReturnValue({
      sort: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue([mockZone])
      })
    });

    // Mock an active flat rate method
    const mockMethod = {
      _id: "method-flat",
      zoneId: "zone-1",
      name: "Standard Flat Rate",
      provider: "FLAT_RATE",
      status: "Active",
      sortOrder: 1,
      settings: { cost: 15 },
      conditions: []
    };

    ShippingMethod.find.mockReturnValue({
      sort: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue([mockMethod])
      })
    });

    const result = await shippingService.getRatesForAddress(
      { country: "US", state: "NY", city: "New York", zip: "10001" },
      100,
      [{ quantity: 1, weight: 1 }]
    );

    expect(result.shippingEnabled).toBe(true);
    expect(result.zone).toBeTruthy();
    expect(result.rates.length).toBeGreaterThanOrEqual(1);
    expect(result.rates[0].cost).toBe(15);
  });

  it("should return shippingEnabled status via GET /api/shipping/calculate", async () => {
    const { GET } = await import("@/app/api/shipping/calculate/route");

    SiteConfig.findOne.mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue({
          commerce: {
            storeCurrency: "USD",
            shippingEnabled: false
          }
        })
      })
    });

    const res = await GET();
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.shippingEnabled).toBe(false);
  });

  it("should return Free Delivery via POST /api/shipping/calculate when module is OFF", async () => {
    const { POST } = await import("@/app/api/shipping/calculate/route");

    SiteConfig.findOne.mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue({
          commerce: {
            storeCurrency: "USD",
            shippingEnabled: false
          }
        })
      })
    });

    const req = {
      json: vi.fn().mockResolvedValue({
        address: { country: "US" },
        subtotal: 100,
        items: []
      })
    };

    const res = await POST(req);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.shippingEnabled).toBe(false);
    expect(data.rates[0]).toMatchObject({
      methodId: "free-delivery",
      methodName: "Free Delivery",
      cost: 0
    });
  });

  it("should update shippingEnabled via PUT /api/admin/shipping/settings", async () => {

    SiteConfig.findOneAndUpdate = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue({
          commerce: { shippingEnabled: false }
        })
      })
    });

    const { PUT } = await import("@/app/api/admin/shipping/settings/route");

    const req = {
      json: vi.fn().mockResolvedValue({ shippingEnabled: false })
    };

    const res = await PUT(req);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.shippingEnabled).toBe(false);
    expect(SiteConfig.findOneAndUpdate).toHaveBeenCalledWith(
      { key: "main" },
      { $set: { "commerce.shippingEnabled": false } },
      expect.any(Object)
    );
  });

  it("should verify authoritative shipping cost is $0 when shipping is disabled", async () => {
    SiteConfig.findOne.mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue({
          commerce: {
            storeCurrency: "USD",
            shippingEnabled: false
          }
        })
      })
    });

    const ratesResult = await shippingService.getRatesForAddress(
      { country: "US", state: "CA", city: "Los Angeles", zip: "90001" },
      100,
      [{ quantity: 1, price: 100 }]
    );

    expect(ratesResult.shippingEnabled).toBe(false);
    expect(ratesResult.rates[0].cost).toBe(0);
    expect(ratesResult.rates[0].methodId).toBe("free-delivery");
  });

  it("should validate Order creation with free-delivery snapshot without CastError", async () => {
    const Order = (await import("@/models/Order")).default;
    const order = new Order({
      orderNumber: "PAI-8888",
      shippingAddress: { fullName: "Jane Doe", street: "123 Main St", city: "NYC", country: "US" },
      customer: { email: "jane@example.com" },
      shippingSnapshot: {
        methodId: "free-delivery",
        zoneId: null,
        methodName: "Free Delivery",
        cost: 0,
        provider: "FREE_SHIPPING"
      }
    });

    const error = order.validateSync();
    expect(error).toBeUndefined();
    expect(order.shippingSnapshot.methodId).toBe("free-delivery");
    expect(order.shippingSnapshot.cost).toBe(0);
  });
});
