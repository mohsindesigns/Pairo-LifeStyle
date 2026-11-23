import { guarded } from "../guard";
import { queueFromPhotos } from "@/lib/rack3d/server";

// POST /api/admin/rack-3d/models { productId, color, views: { front?, back? }, quality?, addToRack? }
// Queues a 3D model of one product colour made from its photos (uses the Tripo API key's credits).
export async function POST(req) {
  return guarded("products.edit", async () => queueFromPhotos(await req.json().catch(() => ({}))));
}
