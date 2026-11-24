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

describe("recovery email design rules", () => {
  const base = { items: [{ name: "Red Coat", price: 249.99, quantity: 1, image: "/uploads/red coat.png" }] };

  it("never greets with the store name or an email address", () => {
    const a = buildAbandonedCartEmail({ ...base, contact: { firstName: "Pairo" } }, "PAIRO15", {}).html;
    expect(a).toContain("Hey,");
    expect(a).not.toMatch(/Hi Pairo/i);
    const b = buildAbandonedCartEmail({ ...base, contact: { firstName: "jo@x.com" } }, "PAIRO15", {}).html;
    expect(b).toContain("Hey,");
    const c = buildAbandonedCartEmail({ ...base, contact: { firstName: "Donald" } }, "DONALD15", {}).html;
    expect(c).toContain("Hi Donald,");
  });

  it("uses absolute, mail-safe image URLs (relative paths were the broken image box)", () => {
    const { html } = buildAbandonedCartEmail(base, "PAIRO15", {});
    const src = html.match(/<img src="([^"]+)"/)[1];
    expect(src.startsWith("https://") || src.startsWith("http://")).toBe(true);
    expect(src).toContain("em=1");
    expect(html).not.toContain("&#x2F;");
    const noImg = buildAbandonedCartEmail({ items: [{ name: "X", price: 1, quantity: 1, image: "data:image/png;base64,AAAA" }] }, "C", {}).html;
    expect(noImg).not.toContain("data:image");
  });

  it("shows an expiry line only when the code really has an end date", () => {
    const soon = new Date(Date.now() + 47 * 3600 * 1000);
    expect(buildAbandonedCartEmail(base, "PAIRO15", { voucherExpiresAt: soon }).html).toMatch(/Expires in 4[78] hours/);
    expect(buildAbandonedCartEmail(base, "PAIRO15", {}).html).not.toMatch(/Expires in/);
    expect(buildAbandonedCartEmail(base, "PAIRO15", { voucherExpiresAt: new Date(Date.now() - 1000) }).html).not.toMatch(/Expires in/);
  });

  it("includes only real social proof it is given", () => {
    const none = buildAbandonedCartEmail(base, "PAIRO15", {}).html;
    expect(none).not.toMatch(/Customer favorites/i);
    expect(none).not.toMatch(/Verified/i);
    const withExtras = buildAbandonedCartEmail(base, "PAIRO15", { extras: { review: { text: "Great jacket, perfect fit." }, favorites: [{ _id: "a", name: "Fav One", slug: "fav-one", price: 10 }] } }).html;
    expect(withExtras).toMatch(/Customer favorites/i);
    expect(withExtras).toContain("Great jacket, perfect fit.");
    expect(withExtras).toContain("/product/fav-one");
  });
});
