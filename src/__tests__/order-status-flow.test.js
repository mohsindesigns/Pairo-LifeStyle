import { describe, it, expect } from "vitest";
import { nextOrderStatus, orderStatusChangeError } from "@/lib/order-status-flow";

describe("order status flow", () => {
  it("allows exactly the next step", () => {
    expect(nextOrderStatus("Pending")).toBe("Confirmed");
    expect(orderStatusChangeError("Pending", "Confirmed")).toBeNull();
    expect(orderStatusChangeError("Out for Delivery", "Delivered")).toBeNull();
  });

  it("rejects skipping or going back", () => {
    expect(orderStatusChangeError("Pending", "Shipped")).toMatch(/one step at a time/);
    expect(orderStatusChangeError("Shipped", "Processing")).toMatch(/Out for Delivery/);
    expect(orderStatusChangeError("Delivered", "Pending")).toMatch(/can't be moved/);
  });

  it("allows cancelling and refunding a cancelled order", () => {
    expect(orderStatusChangeError("Processing", "Cancelled")).toBeNull();
    expect(orderStatusChangeError("Cancelled", "Refunded")).toBeNull();
    expect(orderStatusChangeError("Delivered", "Refunded")).toMatch(/Only a cancelled order/);
    expect(orderStatusChangeError("Refunded", "Cancelled")).toMatch(/can't be cancelled/);
    expect(orderStatusChangeError("Cancelled", "Pending")).toMatch(/can't be moved/);
  });

  it("treats no change as allowed", () => {
    expect(orderStatusChangeError("Packed", "Packed")).toBeNull();
    expect(orderStatusChangeError("Packed", undefined)).toBeNull();
  });
});
