import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import dbConnect from "@/lib/db";
import Script from "@/models/Script";
import { can } from "@/lib/rbac";
import { logAction } from "@/lib/audit";
import { buildScriptCopy, copySlugCandidate, firstFreeSlug } from "../../helpers";

// POST /api/admin/scripts/[id]/duplicate -> a paused "(Copy)" of the script with a unique slug.
export async function POST(req, { params }) {
    const { id } = await params;
    const session = await getServerSession(authOptions);
    if (!session || !session.user.isStaff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    if (!can(session.user, "scripts.create")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    await dbConnect();
    try {
        const source = await Script.findById(id).lean();
        if (!source) return NextResponse.json({ error: "Script not found" }, { status: 404 });

        const slug = await firstFreeSlug((n) => copySlugCandidate(source.slug, n), (s) => Script.exists({ slug: s }));
        const copy = await Script.create(buildScriptCopy(source, slug, session.user.id));

        await logAction(req, session, 'CREATE_SCRIPT', 'script', {
            after: copy,
            message: `Duplicated script "${source.name}" as "${copy.name}"`
        }, String(copy._id));

        return NextResponse.json(copy, { status: 201 });
    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
