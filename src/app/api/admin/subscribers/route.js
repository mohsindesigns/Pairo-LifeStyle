import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import dbConnect from "@/lib/db";
import Subscriber from "@/models/Subscriber";
import { can } from "@/lib/rbac";

export async function GET(req) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user.isStaff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user, "settings.view")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await dbConnect();
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || '';

    const query = {};
    if (search) {
      query.email = { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
    }

    const subscribers = await Subscriber.find(query).sort({ createdAt: -1 }).lean();
    return NextResponse.json(JSON.parse(JSON.stringify(subscribers)));
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
