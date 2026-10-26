import { describe, it, expect } from "vitest";
import { buildAbandonedCartEmail } from "@/lib/email";

describe("recovery email content", () => {
  const cart = {
    contact: { firstName: "Donald" },
    shippingAddress: { fullName: "Donald <b>O'Neil</b>" },
    items: [{ name: "Leather <i>Jacket</i>", price: 249, quantity: 1 }],
  };

  it("sends the shopper to checkout (where an email-locked code is checked against their email), not the cart", () => {
    const { html } = buildAbandonedCartEmail(cart, "DONALD15", { oneTime: true, discountLabel: "15% off" });
    expect(html).toMatch(/href="[^"]*\/checkout"/);
    expect(html).not.toMatch(/href="[^"]*\/cart"/);
  });

  it("tells the shopper to use the same email address, and shows their personal code", () => {
    const { html, subject } = buildAbandonedCartEmail(cart, "DONALD15", { oneTime: true, discountLabel: "15% off" });
    expect(html).toContain("DONALD15");
    expect(html).toMatch(/same email address/i);
    expect(html).toMatch(/created just for you and can be used once/i);
    expect(subject).toContain("15% off");
  });

  it("escapes names and product names", () => {
    const { html } = buildAbandonedCartEmail(cart, "DONALD15", { oneTime: true });
    expect(html).not.toContain("<b>O'Neil</b>");
    expect(html).not.toContain("<i>Jacket</i>");
    expect(html).toContain("Leather &lt;i&gt;Jacket&lt;");
  });
});
