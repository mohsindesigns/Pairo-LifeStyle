import { guarded } from "../../../guard";
import { retryModel } from "@/lib/rack3d/server";

// POST /api/admin/rack-3d/models/:id/retry — run a failed model again
export async function POST(req, { params }) {
  const { id } = await params;
  return guarded("products.edit", () => retryModel(id));
}
