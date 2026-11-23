import { guarded } from "../guard";
import { queueMany } from "@/lib/rack3d/server";

// POST /api/admin/rack-3d/bulk { productIds: [...], addToRack?, quality? }
// Queues 3D models for many products from their own photos; they are made a few at a time.
export async function POST(req) {
  return guarded("products.edit", async () => queueMany(await req.json().catch(() => ({}))));
}
