import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import dbConnect from "@/lib/db";
import Media from "@/models/Media";
import { can } from "@/lib/rbac";
import { mediaListQuery, parsePaging } from "./helpers";

export const dynamic = "force-dynamic";

// GET /api/admin/media — List media with search, filter, pagination
export async function GET(req) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user.isStaff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // "media.manage" is the only media permission a role can be given (and what the Media menu itself requires);
  // "media.view" does not exist, so asking for it locked everyone but the Super Admin out of the library.
  if (!can(session.user, "media.manage")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await dbConnect();
  const { searchParams } = new URL(req.url);

  const trash = searchParams.get('trash') === 'true';
  const sort  = searchParams.get('sort') || 'newest'; // newest, oldest, name

  // ?counts=true -> numbers for the "All media | Trash" views
  if (searchParams.get('counts') === 'true') {
    const [library, trashCount] = await Promise.all([
      Media.countDocuments(mediaListQuery({ trash: false })),
      Media.countDocuments(mediaListQuery({ trash: true })),
    ]);
    return NextResponse.json({ success: true, library, trash: trashCount });
  }

  const query = mediaListQuery({
    trash,
    search: searchParams.get('search') || '',
    type: searchParams.get('type') || 'all', // all, image, video, document
  });
  const { page, limit, skip } = parsePaging(searchParams.get('page'), searchParams.get('limit'));

  const sortMap = {
    newest: { createdAt: -1 },
    oldest: { createdAt: 1 },
    name: { filename: 1 },
  };

  const [items, total] = await Promise.all([
    Media.find(query).sort(sortMap[sort] || { createdAt: -1 }).skip(skip).limit(limit).lean(),
    Media.countDocuments(query),
  ]);

  return NextResponse.json({
    success: true,
    items,
    pagination: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    }
  });
}
