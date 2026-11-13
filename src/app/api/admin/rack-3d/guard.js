import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import dbConnect from "@/lib/db";
import { can } from "@/lib/rbac";

// Runs a 3D-rack admin handler behind the staff session + permission check, mapping errors to JSON.
export async function guarded(permission, fn) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isStaff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user, permission)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  await dbConnect();
  try {
    return NextResponse.json(await fn());
  } catch (e) {
    const status = e.status || 500;
    if (status >= 500) console.error("[rack-3d]", e);
    return NextResponse.json({ error: status >= 500 && !e.status ? "Something went wrong." : e.message }, { status });
  }
}
