import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import dbConnect from "@/lib/db";
import ProductProcess from "@/models/ProductProcess";
import { can } from "@/lib/rbac";
import { logAction } from "@/lib/audit";
import { reindexSteps, validateProcessSteps } from "@/lib/admin-products-utils";

const DEFAULT_TITLE = "Our Craftsmanship Process";

// Keep only the editable fields of a step (drops client-only keys); `_id` is kept so existing
// sub-documents keep their id across saves.
function cleanStep(s = {}) {
  const out = {
    id: String(s.id || ""),
    image: String(s.image || "").trim(),
    heading: String(s.heading || "").trim(),
    subheading: String(s.subheading || "").trim(),
    description: String(s.description || "").trim(),
  };
  if (s._id) out._id = s._id;
  if (!out.id) delete out.id; // schema default generates one
  return out;
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user.isStaff) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!can(session.user, "products.view")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await dbConnect();
    let process = await ProductProcess.findOne({ key: "global" }).select("+trashedSteps").lean();

    if (!process) {
      process = (await ProductProcess.create({
        key: "global",
        title: DEFAULT_TITLE,
        subtitle: "How we create our signature shearling masterpiece garments",
        steps: []
      })).toObject();
    }

    return NextResponse.json({ ...process, trashedSteps: process.trashedSteps || [] });
  } catch (error) {
    console.error("GET Product Process Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PUT(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user.isStaff) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!can(session.user, "products.edit")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const { title, subtitle } = body;
    const steps = reindexSteps((Array.isArray(body.steps) ? body.steps : []).map(cleanStep));

    // Every live step is shown on every product page, so it needs a heading and an image.
    const stepError = validateProcessSteps(steps);
    if (stepError) return NextResponse.json({ error: stepError }, { status: 400 });

    const update = {
      title: String(title || "").trim() || DEFAULT_TITLE,
      subtitle: String(subtitle || "").trim(),
      steps,
    };
    // Older clients don't send the trash list; leave it untouched in that case.
    if (Array.isArray(body.trashedSteps)) {
      update.trashedSteps = body.trashedSteps.map((s) => ({
        ...cleanStep(s),
        deletedAt: s.deletedAt ? new Date(s.deletedAt) : new Date(),
      }));
    }

    await dbConnect();
    const updated = await ProductProcess.findOneAndUpdate(
      { key: "global" },
      { $set: update },
      { new: true, upsert: true, runValidators: true }
    ).select("+trashedSteps");

    await logAction(req, session, "UPDATE_PRODUCT_PROCESS", "product_process", { title: update.title, subtitle: update.subtitle, stepsCount: steps.length, trashedCount: updated.trashedSteps?.length || 0 }, String(updated._id));

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PUT Product Process Error:", error);
    if (error?.name === "ValidationError") {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
