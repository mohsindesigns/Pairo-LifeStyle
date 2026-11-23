import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 });

const stored = [];
vi.mock("@/lib/storage", () => ({
  uploadToStorage: vi.fn(async (buffer, name) => { stored.push({ name, size: buffer.length }); return { url: `/uploads/${name}`, publicId: name }; }),
}));
let allow = true;
vi.mock("@/lib/rateLimit", () => ({ checkRateLimit: async () => ({ success: allow }), getClientIp: () => "203.0.113.5" }));
vi.mock("next-auth", () => ({ default: () => () => {}, getServerSession: () => Promise.resolve(null) }));
vi.mock("@/lib/geoIp", () => ({ resolveIpLocation: vi.fn(async (ip) => ({ ip, city: "Austin", state: "Texas", county: "Travis County", country: "United States", countryCode: "US", postal: "73301", lat: 30.27, lon: -97.74, mapsUrl: "https://www.google.com/maps?q=30.27,-97.74", isp: "Test ISP", timezone: "America/Chicago" })) }));

import Product from "@/models/Product";
import Review from "@/models/Review";
import AbandonedCart from "@/models/AbandonedCart";
import { sniffReviewMedia, isOwnUploadUrl, cleanReviewMedia } from "@/lib/reviewMedia";
import { resolveIpLocation } from "@/lib/geoIp";

const TAG = `rmu${Date.now()}`;
const pad = (...bytes) => Buffer.concat([Buffer.from(bytes), Buffer.alloc(64)]);
const MP4 = Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from("ftypmp42"), Buffer.alloc(64)]);
const MOV = Buffer.concat([Buffer.from([0, 0, 0, 20]), Buffer.from("ftypqt  "), Buffer.alloc(64)]);
const WEBM = pad(0x1a, 0x45, 0xdf, 0xa3);
const JPG = pad(0xff, 0xd8, 0xff, 0xe0);
const PNG = Buffer.concat([Buffer.from([0x89]), Buffer.from("PNG\r\n"), Buffer.from([0x1a, 0x0a]), Buffer.alloc(64)]);
const WEBP = Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(4), Buffer.from("WEBP"), Buffer.alloc(32)]);

const upload = async (buffer, name = "x.bin", type = "application/octet-stream") => {
  const { POST } = await import("@/app/api/reviews/upload/route");
  const form = new FormData();
  form.append("file", new File([buffer], name, { type }));
  return POST(new Request("http://localhost/api/reviews/upload", { method: "POST", body: form }));
};

beforeAll(async () => {
  if (mongoose.connection.readyState === 0) await mongoose.connect(process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/pairo");
});
afterAll(async () => {
  await Review.deleteMany({ customerName: { $regex: TAG } });
  await AbandonedCart.deleteMany({ sessionKey: { $regex: TAG } });
  await Product.deleteMany({ slug: { $regex: TAG } });
  await mongoose.connection.close();
});

describe("review media checks", () => {
  it("recognises allowed files by their real content", () => {
    expect(sniffReviewMedia(MP4)).toMatchObject({ type: "video", ext: "mp4" });
    expect(sniffReviewMedia(MOV)).toMatchObject({ type: "video", ext: "mov" });
    expect(sniffReviewMedia(WEBM)).toMatchObject({ type: "video", ext: "webm" });
    expect(sniffReviewMedia(JPG)).toMatchObject({ type: "image", ext: "jpg" });
    expect(sniffReviewMedia(PNG)).toMatchObject({ type: "image", ext: "png" });
    expect(sniffReviewMedia(WEBP)).toMatchObject({ type: "image", ext: "webp" });
  });
  it("refuses everything else, whatever it is called", () => {
    expect(sniffReviewMedia(Buffer.from("<html><script>alert(1)</script></html>".padEnd(40)))).toBeNull();
    expect(sniffReviewMedia(Buffer.from("MZ" + "x".repeat(50)))).toBeNull(); // an .exe
    expect(sniffReviewMedia(Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'></svg>"))).toBeNull();
    expect(sniffReviewMedia(Buffer.alloc(4))).toBeNull();
    expect(sniffReviewMedia(null)).toBeNull();
  });
  it("only accepts addresses of files this site stored", () => {
    expect(isOwnUploadUrl("/uploads/review-ab12.mp4")).toBe(true);
    for (const bad of ["https://evil.example/x.mp4", "//evil.example/x.mp4", "javascript:alert(1)", "/uploads/../etc/passwd", "/uploads/a/b.mp4", "/other/x.mp4", "", null, 5]) expect(isOwnUploadUrl(bad), String(bad)).toBe(false);
  });
  it("cleans a media list: own uploads only, no duplicates, at most 3, type from the file", () => {
    const out = cleanReviewMedia([
      { url: "/uploads/a.mp4", type: "image" }, { url: "/uploads/a.mp4" }, { url: "https://evil.example/b.mp4" },
      { url: "/uploads/c.jpg", type: "video" }, { url: "/uploads/d.png" }, { url: "/uploads/e.png" }, "nope", null,
    ]);
    expect(out).toEqual([{ url: "/uploads/a.mp4", type: "video" }, { url: "/uploads/c.jpg", type: "image" }, { url: "/uploads/d.png", type: "image" }]);
    expect(cleanReviewMedia("x")).toEqual([]);
  });
});

describe("POST /api/reviews/upload", () => {
  it("stores a real video and a real photo under our own file names", async () => {
    allow = true;
    const v = await upload(MP4, "my holiday <script>.mp4", "video/mp4");
    expect(v.status).toBe(201);
    const body = await v.json();
    expect(body).toMatchObject({ success: true, type: "video" });
    expect(body.url).toMatch(/^\/uploads\/review-[0-9a-f]{12}\.mp4$/);
    expect(body.url).not.toMatch(/holiday|script/);
    const p = await upload(JPG, "a.jpg", "image/jpeg");
    expect((await p.json()).type).toBe("image");
  });
  it("refuses a file that only pretends to be a video", async () => {
    allow = true;
    const res = await upload(Buffer.from("<?php system($_GET['c']); ?>".padEnd(60)), "evil.mp4", "video/mp4");
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/video|photo/i);
  });
  it("refuses files that are too big, and a missing file", async () => {
    allow = true;
    const bigVideo = Buffer.concat([MP4, Buffer.alloc(20 * 1024 * 1024)]);
    expect((await upload(bigVideo, "big.mp4", "video/mp4")).status).toBe(413);
    const bigPhoto = Buffer.concat([JPG, Buffer.alloc(6 * 1024 * 1024)]);
    expect((await upload(bigPhoto, "big.jpg", "image/jpeg")).status).toBe(413);
    const { POST } = await import("@/app/api/reviews/upload/route");
    expect((await POST(new Request("http://localhost/x", { method: "POST", body: new FormData() }))).status).toBe(400);
  });
  it("is rate limited", async () => {
    allow = false;
    expect((await upload(MP4, "a.mp4", "video/mp4")).status).toBe(429);
    allow = true;
  });
});

describe("a review with a video waits for approval", () => {
  let product;
  beforeAll(async () => {
    product = await Product.create({ id: 3_000_000 + Math.floor(Math.random() * 900_000), name: `Video Test ${TAG}`, slug: `video-test-${TAG}`, price: 100, status: "Published" });
  });
  it("is saved as Pending with only our own files, and is not shown publicly until approved", async () => {
    const { POST, GET } = await import("@/app/api/products/[id]/reviews/route");
    const ctx = { params: Promise.resolve({ id: String(product._id) }) };
    const res = await POST(new Request("http://localhost/x", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rating: 5, customerName: `Vid ${TAG}`, guestEmail: `vid-${TAG}@example.invalid`, comment: "Loved it",
        media: [{ url: "/uploads/review-aaaaaaaaaaaa.mp4", type: "video" }, { url: "https://evil.example/x.mp4", type: "video" }] }),
    }), ctx);
    expect(res.status).toBe(200);
    const saved = await Review.findOne({ customerName: `Vid ${TAG}` }).lean();
    expect(saved.status).toBe("Pending");
    expect(saved.media).toEqual([expect.objectContaining({ url: "/uploads/review-aaaaaaaaaaaa.mp4", type: "video" })]);

    const listed = await (await GET(new Request(`http://localhost/x?limit=20`), ctx)).json();
    expect(listed.reviews.find((r) => r.customerName === `Vid ${TAG}`)).toBeUndefined(); // not visible before approval

    await Review.updateOne({ _id: saved._id }, { $set: { status: "Approved" } });
    const after = await (await GET(new Request(`http://localhost/x?limit=20`), ctx)).json();
    expect(after.reviews.find((r) => r.customerName === `Vid ${TAG}`).media).toEqual([{ url: "/uploads/review-aaaaaaaaaaaa.mp4", type: "video" }]);
  });
});

describe("abandoned cart location", () => {
  it("records where the visitor is once per IP, and keeps it on later autosaves", async () => {
    vi.mocked(resolveIpLocation).mockClear();
    const { POST } = await import("@/app/api/checkout/abandoned-cart/route");
    const send = (extra = {}) => POST(new Request("http://localhost/api/checkout/abandoned-cart", {
      method: "POST", headers: { "Content-Type": "application/json", "x-forwarded-for": "203.0.113.5" },
      body: JSON.stringify({ sessionKey: `${TAG}-loc`, items: [{ id: String(new mongoose.Types.ObjectId()), name: "J", price: 1, quantity: 1 }], cartSubtotal: 1, cartTotal: 1, contact: { email: "loc@example.invalid" }, shippingAddress: {}, ...extra }),
    }));
    expect((await send()).status).toBe(200);
    let cart = await AbandonedCart.findOne({ sessionKey: `${TAG}-loc` }).lean();
    expect(cart.ipAddress).toBeTruthy();
    expect(cart.ipLocation).toMatchObject({ city: "Austin", state: "Texas", county: "Travis County", country: "United States", countryCode: "US", postal: "73301", isp: "Test ISP" });
    expect(cart.ipLocation.lat).toBeCloseTo(30.27);
    expect(cart.ipLocation.ip).toBeUndefined();
    const lookups = vi.mocked(resolveIpLocation).mock.calls.length;
    expect(lookups).toBe(1);

    await send({ contact: { email: "loc@example.invalid", firstName: "Lee" } }); // another autosave of the same visit
    expect(vi.mocked(resolveIpLocation).mock.calls.length).toBe(1); // no second lookup
    cart = await AbandonedCart.findOne({ sessionKey: `${TAG}-loc` }).lean();
    expect(cart.ipLocation.city).toBe("Austin");
  });
});
