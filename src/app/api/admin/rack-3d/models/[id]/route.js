import { guarded } from "../../guard";
import { deleteModel } from "@/lib/rack3d/server";

// DELETE /api/admin/rack-3d/models/:id — removes the model and its stored files
export async function DELETE(req, { params }) {
  const { id } = await params;
  return guarded("products.edit", async () => { await deleteModel(id); return { ok: true }; });
}
