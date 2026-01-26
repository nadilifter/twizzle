import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

export async function POST(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;
    const type = formData.get("type") as string; // logo, favicon, hero

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Create uploads directory if it doesn't exist
    const uploadsDir = path.join(process.cwd(), "public", "uploads", session.user.organizationId);
    await mkdir(uploadsDir, { recursive: true });

    // Sanitize filename and add timestamp to avoid caching/conflicts
    const timestamp = Date.now();
    const ext = path.extname(file.name);
    // Simple sanitization
    const sanitizedType = (type || "file").replace(/[^a-z0-9]/gi, "_");
    const filename = `${sanitizedType}-${timestamp}${ext}`;
    const filePath = path.join(uploadsDir, filename);

    await writeFile(filePath, buffer);

    const publicUrl = `/uploads/${session.user.organizationId}/${filename}`;

    return NextResponse.json({ url: publicUrl });
  } catch (error) {
    console.error("Error uploading file:", error);
    return NextResponse.json({ error: "Failed to upload file" }, { status: 500 });
  }
}
