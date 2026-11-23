import { guarded } from "../guard";
import { trashedModels } from "@/lib/rack3d/server";

// GET /api/admin/rack-3d/trash — 3D models in the Trash (for the global Trash screen)
export async function GET() {
  return guarded("products.view", () => trashedModels());
}
