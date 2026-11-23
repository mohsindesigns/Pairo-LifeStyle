import { describe, it, expect } from "vitest";
import {
  formatRefundAmount,
  buildRefundIdempotencyKey,
  refundedAmountMatch,
} from "@/app/api/admin/orders/[id]/refund/helpers";

describe("admin refund helpers", () => {
  it("formats the refund in the order currency", () => {
    expect(formatRefundAmount(12.5, "USD")).toBe("$12.50");
    expect(formatRefundAmount(12.5, "eur")).toBe("€12.50");
    expect(formatRefundAmount(1200, "PKR")).toMatch(/PKR\s?1,200\.00/);
    expect(formatRefundAmount(3)).toBe("$3.00");
  });

  it("falls back gracefully for an invalid currency code", () => {
    expect(formatRefundAmount(5, "NOT-A-CODE")).toBe("NOT-A-CODE 5.00");
  });

  it("derives a stable idempotency key from order + refunded-so-far + amount", () => {
    const a = buildRefundIdempotencyKey("abc", 10, 5.5);
    expect(a).toBe("admin-refund:abc:1000:550");
    expect(buildRefundIdempotencyKey("abc", 10, 5.5)).toBe(a);
    expect(buildRefundIdempotencyKey("abc", 15.5, 5.5)).not.toBe(a);
    expect(buildRefundIdempotencyKey("abc", 0.1 + 0.2, 1)).toBe("admin-refund:abc:30:100");
  });

  it("compare-and-set filter matches a missing field when nothing was refunded", () => {
    expect(refundedAmountMatch(0)).toEqual({ $in: [0, null] });
    expect(refundedAmountMatch(undefined)).toEqual({ $in: [0, null] });
    expect(refundedAmountMatch(12.34)).toBe(12.34);
  });
});
