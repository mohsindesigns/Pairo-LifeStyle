import { guarded } from "../guard";
import { testConnection } from "@/lib/rack3d/server";

// POST /api/admin/rack-3d/test — checks the 3D service (and the Tripo balance when a key is set)
export async function POST() {
  return guarded("products.view", async () => ({ ok: true, message: await testConnection() }));
}
