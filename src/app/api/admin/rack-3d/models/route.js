import { guarded } from "../guard";
import { makeFromPhotos } from "@/lib/rack3d/server";

// POST /api/admin/rack-3d/models { productId, color, views: { front, left?, back?, right? }, quality? }
// Makes a 3D model of one product colour from photos (uses the Tripo API key's credits).
export async function POST(req) {
  return guarded("products.edit", async () => makeFromPhotos(await req.json().catch(() => ({}))));
}
