import { guarded } from "../../guard";
import { trashModel, restoreModel, deleteModelForever } from "@/lib/rack3d/server";

// DELETE /api/admin/rack-3d/models/:id            — move to Trash (the piece leaves the rack)
// DELETE /api/admin/rack-3d/models/:id?permanent=true — delete a trashed model and its files for good
export async function DELETE(req, { params }) {
  const { id } = await params;
  const permanent = new URL(req.url).searchParams.get("permanent") === "true";
  return guarded(permanent ? "products.delete" : "products.edit", async () => {
    if (permanent) await deleteModelForever(id); else await trashModel(id);
    return { ok: true };
  });
}

// PATCH /api/admin/rack-3d/models/:id { isDeleted: false } — restore from Trash
export async function PATCH(req, { params }) {
  const { id } = await params;
  return guarded("products.edit", async () => {
    const body = await req.json().catch(() => ({}));
    if (body.isDeleted === false) await restoreModel(id);
    return { ok: true };
  });
}
