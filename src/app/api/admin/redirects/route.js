import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import dbConnect from "@/lib/db";
import Redirect from "@/models/Redirect";
import { can } from "@/lib/rbac";
import { registerRedirect, normalizePath, isReservedPath } from "@/lib/redirect-resolver";

export async function GET(req) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user.isStaff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user, "settings.view")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await dbConnect();
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || "";
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "10", 10);
    const skip = (page - 1) * limit;

    let query = {};
    if (search) {
      query = {
        $or: [
          { oldPath: { $regex: search, $options: "i" } },
          { newPath: { $regex: search, $options: "i" } }
        ]
      };
    }

    const [items, total] = await Promise.all([
      Redirect.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Redirect.countDocuments(query)
    ]);

    // Map fields oldPath/newPath to match component's sourceUrl/targetUrl
    const formattedItems = items.map(item => ({
      _id: item._id,
      sourceUrl: item.oldPath,
      targetUrl: item.newPath,
      statusCode: item.statusCode || 301,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt
    }));

    return NextResponse.json({ items: formattedItems, total });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user.isStaff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user, "settings.edit")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await dbConnect();
  try {
    const { sourceUrl, targetUrl, statusCode } = await req.json();

    if (!sourceUrl || !targetUrl) {
      return NextResponse.json({ error: "Source path and target path are required." }, { status: 400 });
    }

    const cleanSource = normalizePath(sourceUrl);
    if (isReservedPath(cleanSource)) {
      return NextResponse.json({ error: "Cannot redirect from a reserved system path." }, { status: 400 });
    }

    const record = await registerRedirect(sourceUrl, targetUrl, statusCode ? parseInt(statusCode, 10) : 301);
    if (!record) {
      return NextResponse.json({ error: "Invalid redirect rule or circular loop detected." }, { status: 400 });
    }

    return NextResponse.json({ success: true, item: record });
  } catch (error) {
    if (error.code === 11000) {
      return NextResponse.json({ error: "A redirect rule already exists for this source path." }, { status: 400 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user.isStaff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user, "settings.edit")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await dbConnect();
  try {
    const { _id, sourceUrl, targetUrl, statusCode } = await req.json();

    if (!_id) {
      return NextResponse.json({ error: "Redirect ID is required for editing." }, { status: 400 });
    }
    if (!sourceUrl || !targetUrl) {
      return NextResponse.json({ error: "Source path and target path are required." }, { status: 400 });
    }

    const cleanSource = normalizePath(sourceUrl);
    if (isReservedPath(cleanSource)) {
      return NextResponse.json({ error: "Cannot redirect from a reserved system path." }, { status: 400 });
    }

    // Check circular redirect
    const cleanTarget = normalizePath(targetUrl.split('?')[0]);
    if (cleanTarget === cleanSource) {
      return NextResponse.json({ error: "Source and target paths cannot be identical." }, { status: 400 });
    }

    // Check duplicate oldPath (except for this record)
    const duplicate = await Redirect.findOne({ oldPath: cleanSource, _id: { $ne: _id } });
    if (duplicate) {
      return NextResponse.json({ error: "A redirect rule already exists for this source path." }, { status: 400 });
    }

    const record = await Redirect.findByIdAndUpdate(
      _id,
      { oldPath: cleanSource, newPath: targetUrl, statusCode: statusCode ? parseInt(statusCode, 10) : 301 },
      { new: true, runValidators: true }
    );

    if (!record) {
      return NextResponse.json({ error: "Redirect rule not found." }, { status: 404 });
    }

    return NextResponse.json({ success: true, item: record });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user.isStaff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user, "settings.edit")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await dbConnect();
  try {
    const { ids } = await req.json();
    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "No IDs provided." }, { status: 400 });
    }

    await Redirect.deleteMany({ _id: { $in: ids } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
