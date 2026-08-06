import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import dbConnect from "@/lib/db";
import Media from "@/models/Media";
import { can } from "@/lib/rbac";

export const dynamic = "force-dynamic";

// GET /api/admin/media — List media with search, filter, pagination
export async function GET(req) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user.isStaff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user, "media.view")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await dbConnect();
  const { searchParams } = new URL(req.url);

  const search   = searchParams.get('search') || '';
  const type     = searchParams.get('type') || 'all';    // all, image, video, document
  const trash    = searchParams.get('trash') === 'true';
  const page     = parseInt(searchParams.get('page') || '1');
  const limit    = parseInt(searchParams.get('limit') || '30');
  const sort     = searchParams.get('sort') || 'newest'; // newest, oldest, name

  const query = { isDeleted: trash };

  if (search) {
    query.$or = [
      { filename: { $regex: search, $options: 'i' } },
      { title: { $regex: search, $options: 'i' } },
      { altText: { $regex: search, $options: 'i' } },
      { tags: { $in: [new RegExp(search, 'i')] } },
    ];
  }

  if (type !== 'all') {
    query.mediaType = type;
  }

  const sortMap = {
    newest: { createdAt: -1 },
    oldest: { createdAt: 1 },
    name: { filename: 1 },
  };

  const skip = (page - 1) * limit;
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
