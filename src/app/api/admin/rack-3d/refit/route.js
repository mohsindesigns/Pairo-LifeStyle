import { guarded } from "../guard";
import { refitAll } from "@/lib/rack3d/server";

// POST /api/admin/rack-3d/refit — re-optimise all finished models (free) so they hang by their shoulders
export async function POST() {
  return guarded("products.edit", () => refitAll());
}
