import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { 
  uploadFile, 
  getOrganizationAssetKey, 
  getPublicUrl 
} from "@/lib/storage";
import { getCurrentEnvironment } from "@/lib/env-domains";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

// Content type mapping for common image types
const CONTENT_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

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

    const ext = path.extname(file.name).toLowerCase();
    const contentType = CONTENT_TYPES[ext] || file.type || 'application/octet-stream';
    
    // Generate storage key for the organization asset
    const key = getOrganizationAssetKey(
      session.user.organizationId,
      file.name,
      type
    );

    // Check if we should use S3 or local storage
    const useS3 = process.env.USE_S3_STORAGE === 'true' || 
                  getCurrentEnvironment() !== 'local' ||
                  process.env.S3_ENDPOINT; // If MinIO is configured locally

    let publicUrl: string;

    if (useS3) {
      // Upload to S3/MinIO
      await uploadFile('assets', key, buffer, {
        contentType,
        isPublic: true,
      });
      publicUrl = getPublicUrl(key);
    } else {
      // Fallback to local filesystem (for local dev without MinIO)
      const uploadsDir = path.join(process.cwd(), "public", "uploads", session.user.organizationId);
      await mkdir(uploadsDir, { recursive: true });

      const timestamp = Date.now();
      const sanitizedType = (type || "file").replace(/[^a-z0-9]/gi, "_");
      const filename = `${sanitizedType}-${timestamp}${ext}`;
      const filePath = path.join(uploadsDir, filename);

      await writeFile(filePath, buffer);
      publicUrl = `/uploads/${session.user.organizationId}/${filename}`;
    }

    return NextResponse.json({ 
      url: publicUrl,
      key: useS3 ? key : undefined,
    });
  } catch (error) {
    console.error("Error uploading file:", error);
    return NextResponse.json({ error: "Failed to upload file" }, { status: 500 });
  }
}
