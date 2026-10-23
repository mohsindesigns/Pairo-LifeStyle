import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import dbConnect from "@/lib/db";
import Redirect from "@/models/Redirect";
import { can } from "@/lib/rbac";
import { registerRedirect, normalizePath, isReservedPath } from "@/lib/redirect-resolver";
import mongoose from "mongoose";

const escapeRegex = (str) => String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const parseStatus = (code) => (parseInt(code, 10) === 302 ? 302 : 301);

export async function GET(req) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user.isStaff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user, "settings.view")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await dbConnect();
  try {
    const { searchParams } = new URL(req.url);
    const search = (searchParams.get("search") || "").trim();
    // Clamp paging so a bad query string can't produce NaN skips or unbounded reads.
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "10", 10) || 10));
    const skip = (page - 1) * limit;

    let query = {};
    if (search) {
      query = {
        $or: [
          { oldPath: { $regex: escapeRegex(search), $options: "i" } },
          { newPath: { $regex: escapeRegex(search), $options: "i" } }
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

    if (typeof sourceUrl !== "string" || typeof targetUrl !== "string") {
      return NextResponse.json({ error: "Source path and target path must be text." }, { status: 400 });
    }
    const record = await registerRedirect(sourceUrl, targetUrl, parseStatus(statusCode));
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

    if (!_id || !mongoose.isValidObjectId(_id)) {
      return NextResponse.json({ error: "Redirect ID is required for editing." }, { status: 400 });
    }
    if (!sourceUrl || !targetUrl || typeof sourceUrl !== "string" || typeof targetUrl !== "string") {
      return NextResponse.json({ error: "Source path and target path are required." }, { status: 400 });
    }

    const cleanSource = normalizePath(sourceUrl);
    if (isReservedPath(cleanSource)) {
      return NextResponse.json({ error: "Cannot redirect from a reserved system path." }, { status: 400 });
    }

    // Normalize the target the same way registerRedirect does (path part only; query kept as typed).
    const [targetPathOnly, targetQuery] = targetUrl.trim().split("?");
    const cleanTarget = normalizePath(targetPathOnly);
    const finalTarget = targetQuery ? `${cleanTarget}?${targetQuery}` : cleanTarget;
    if (!cleanSource || !cleanTarget) {
      return NextResponse.json({ error: "Source path and target path are required." }, { status: 400 });
    }

    // Check circular redirect
    if (cleanTarget === cleanSource) {
      return NextResponse.json({ error: "Source and target paths cannot be identical." }, { status: 400 });
    }

    // Direct loop: the target already redirects back to this source.
    const loop = await Redirect.findOne({ oldPath: cleanTarget, _id: { $ne: _id } }).lean();
    if (loop && normalizePath(String(loop.newPath || "").split("?")[0]) === cleanSource) {
      return NextResponse.json({ error: "This would create a redirect loop." }, { status: 400 });
    }

    // Check duplicate oldPath (except for this record)
    const duplicate = await Redirect.findOne({ oldPath: cleanSource, _id: { $ne: _id } });
    if (duplicate) {
      return NextResponse.json({ error: "A redirect rule already exists for this source path." }, { status: 400 });
    }

    const record = await Redirect.findByIdAndUpdate(
      _id,
      { oldPath: cleanSource, newPath: finalTarget, statusCode: parseStatus(statusCode) },
      { new: true, runValidators: true }
    );

    if (!record) {
      return NextResponse.json({ error: "Redirect rule not found." }, { status: 404 });
    }

    return NextResponse.json({ success: true, item: record });
  } catch (error) {
    if (error.code === 11000) {
      return NextResponse.json({ error: "A redirect rule already exists for this source path." }, { status: 400 });
    }
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
    const validIds = ids.filter((id) => mongoose.isValidObjectId(id));
    if (validIds.length === 0) {
      return NextResponse.json({ error: "No valid IDs provided." }, { status: 400 });
    }

    const { deletedCount } = await Redirect.deleteMany({ _id: { $in: validIds } });
    return NextResponse.json({ success: true, deleted: deletedCount });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
