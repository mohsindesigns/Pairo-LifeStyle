import { guarded } from "../../guard";
import { importGlb } from "@/lib/rack3d/server";

// POST /api/admin/rack-3d/models/import (multipart: productId, color, file=.glb)
// Optimises a model made elsewhere (e.g. on the Tripo website) for the rack — no API credits.
export async function POST(req) {
  return guarded("products.edit", async () => {
    const form = await req.formData();
    const file = form.get("file");
    if (!file || typeof file.arrayBuffer !== "function") return Promise.reject(Object.assign(new Error("Choose a .glb file."), { status: 400 }));
    if (file.size > 40 * 1024 * 1024) return Promise.reject(Object.assign(new Error("That file is over 40 MB. Export it without 8K textures."), { status: 400 }));
    const buf = Buffer.from(await file.arrayBuffer());
    return importGlb({ productId: form.get("productId"), color: form.get("color") || "", glb: `data:model/gltf-binary;base64,${buf.toString("base64")}` });
  });
}
