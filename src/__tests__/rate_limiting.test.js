import { describe, it, expect } from "vitest";
import { checkRateLimit } from "@/lib/rateLimit";

describe("Rate Limiting Service", () => {
  it("should allow requests under the limit", async () => {
    const mockReq = {
      headers: {
        get: (header) => (header === "x-forwarded-for" ? "192.168.1.50" : null)
      }
    };

    const res1 = await checkRateLimit(mockReq, { limit: 3, window: 10, keyPrefix: "TEST_PASS" });
    expect(res1.success).toBe(true);
    expect(res1.remaining).toBe(2);

    const res2 = await checkRateLimit(mockReq, { limit: 3, window: 10, keyPrefix: "TEST_PASS" });
    expect(res2.success).toBe(true);
    expect(res2.remaining).toBe(1);
  });

  it("should block requests when rate limit is exceeded", async () => {
    const mockReq = {
      headers: {
        get: (header) => (header === "x-forwarded-for" ? "192.168.1.99" : null)
      }
    };

    // Use up the limit of 2
    await checkRateLimit(mockReq, { limit: 2, window: 10, keyPrefix: "TEST_BLOCK" });
    await checkRateLimit(mockReq, { limit: 2, window: 10, keyPrefix: "TEST_BLOCK" });

    // 3rd attempt should fail
    const blocked = await checkRateLimit(mockReq, { limit: 2, window: 10, keyPrefix: "TEST_BLOCK" });
    expect(blocked.success).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.resetIn).toBeGreaterThan(0);
  });
});
