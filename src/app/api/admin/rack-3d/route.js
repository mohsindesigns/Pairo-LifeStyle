import { guarded } from "./guard";
import { adminView, saveRack } from "@/lib/rack3d/server";

// GET /api/admin/rack-3d — products with their 3D models, and what hangs on the rack
export async function GET() {
  return guarded("products.view", () => adminView());
}

// PUT /api/admin/rack-3d { items: [{ id, scale }] } — save the rack, left to right
export async function PUT(req) {
  return guarded("products.edit", async () => {
    const body = await req.json().catch(() => ({}));
    return { ok: true, count: await saveRack(body.items) };
  });
}
