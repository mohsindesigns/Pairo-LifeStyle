import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { can } from "@/lib/rbac";
import { NextResponse } from "next/server";
import path from "path";
import fs from "fs";

export async function GET(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.isStaff || !can(session.user, "affiliates.view")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const filename = searchParams.get("file");

    if (!filename) {
      return NextResponse.json({ error: "Filename is required" }, { status: 400 });
    }

    // Resolve path inside the private directory
    const privateDir = path.resolve(process.cwd(), "private", "kyc");
    const filePath = path.resolve(privateDir, path.basename(filename)); // basename avoids path traversal

    // Check path traversal vulnerability explicitly
    if (!filePath.startsWith(privateDir)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    const fileStream = fs.createReadStream(filePath);
    
    // Determine content type
    let contentType = "application/octet-stream";
    const ext = path.extname(filename).toLowerCase();
    if (ext === ".pdf") contentType = "application/pdf";
    else if (ext === ".png") contentType = "image/png";
    else if (ext === ".jpg" || ext === ".jpeg") contentType = "image/jpeg";

    return new Response(fileStream, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `inline; filename="${filename}"`
      }
    });

  } catch (error) {
    console.error("[KYCDocStream Error]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
