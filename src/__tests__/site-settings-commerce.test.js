import { describe, it, expect, vi, beforeEach } from "vitest";

// The config document is shared by the whole app (and by other test files), so the database call is replaced and only
// the update the route sends is checked.
const update = vi.hoisted(() => ({ calls: [] }));
vi.mock("next-auth", () => ({ default: () => () => {}, getServerSession: () => Promise.resolve({ user: { id: "s1", isStaff: true, role: { slug: "super-admin" } } }) }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("@/lib/db", () => ({ default: async () => {} }));
vi.mock("@/models/SiteConfig", () => ({
  default: {
    findOneAndUpdate: vi.fn(async (filter, change) => {
      update.calls.push({ filter, change });
      return { toObject: () => ({ key: "main" }) };
    }),
  },
}));

import { PUT } from "@/app/api/admin/site-settings/route";

const put = (body) => PUT(new Request("http://localhost/api/admin/site-settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }));

describe("saving General settings", () => {
  beforeEach(() => { update.calls.length = 0; });

  it("never writes the recovery-email settings, so a stale page cannot undo them", async () => {
    const res = await put({
      _id: "x", __v: 1, createdAt: "t", updatedAt: "t",
      brand: { name: "Pairo" },
      commerce: { storeCurrency: "USD", shippingEnabled: true, abandonedCart: { enabled: true, idleMinutes: 30, maxAgeHours: 72, lastRun: { scanned: 9 } } },
    });
    expect(res.status).toBe(200);
    const { change } = update.calls[0];
    expect(change.$set.brand).toEqual({ name: "Pairo" });
    expect(change.$set["commerce.storeCurrency"]).toBe("USD");
    expect(change.$set["commerce.shippingEnabled"]).toBe(true);
    // neither the whole subtree (which would wipe the recovery settings) nor the recovery key itself
    expect(change.$set).not.toHaveProperty("commerce");
    expect(Object.keys(change.$set).some((k) => k.startsWith("commerce.abandonedCart"))).toBe(false);
    expect(change.$set).not.toHaveProperty("_id");
  });

  it("still saves everything else, and tolerates a body without commerce", async () => {
    expect((await put({ brand: { name: "Pairo" }, headerConfig: { logoUrl: "/l.png" } })).status).toBe(200);
    expect(update.calls[0].change.$set).toEqual({ brand: { name: "Pairo" }, headerConfig: { logoUrl: "/l.png" } });
    expect((await put({ commerce: null, brand: { name: "P" } })).status).toBe(200);
    expect(update.calls[1].change.$set).toEqual({ brand: { name: "P" } });
  });
});
