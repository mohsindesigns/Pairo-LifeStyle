import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import dbConnect from "@/lib/db";
import Page from "@/models/Page";
import { can } from "@/lib/rbac";

export async function GET(req, { params }) {
  const { slug } = await params;
  
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user.isStaff) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();
    
    // Check permission
    if (!can(session.user, "pages.view")) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const page = await Page.findOne({ slug }).lean();
    if (!page) {
      return NextResponse.json({ error: "Page not found" }, { status: 404 });
    }

    return NextResponse.json(page);
  } catch (error) {
    console.error("GET Page by Slug Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
