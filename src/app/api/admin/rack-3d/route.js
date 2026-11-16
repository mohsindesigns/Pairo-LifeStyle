import { guarded } from "./guard";
import { adminView, saveRack } from "@/lib/rack3d/server";

// GET /api/admin/rack-3d[?q=&filter=all|with|without|onrack|busy|failed&page=] — products (with photos) and their
// 3D models, filter counts, and what hangs on the rack
export async function GET(req) {
  const sp = new URL(req.url).searchParams;
  return guarded("products.view", () => adminView({ q: sp.get("q") || "", filter: sp.get("filter") || "all", page: sp.get("page") || 1, per: sp.get("per") || 24 }));
}

// PUT /api/admin/rack-3d { items: [{ id, scale }] } — save the rack, left to right
export async function PUT(req) {
  return guarded("products.edit", async () => {
    const body = await req.json().catch(() => ({}));
    return { ok: true, count: await saveRack(body.items) };
  });
}
