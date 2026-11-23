import { guarded } from "../../../guard";
import { rotateModel } from "@/lib/rack3d/server";

// POST /api/admin/rack-3d/models/:id/rotate { degrees? } — turn a model round (free, no new generation)
export async function POST(req, { params }) {
  const { id } = await params;
  return guarded("products.edit", async () => rotateModel(id, (await req.json().catch(() => ({}))).degrees));
}
