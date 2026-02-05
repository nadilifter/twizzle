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
import { db } from "@/lib/db";

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
    const fileSizeBytes = buffer.length;
    const fileSizeMB = fileSizeBytes / (1024 * 1024);

    // Check storage limits
    const organization = await db.organization.findUnique({
      where: { id: session.user.organizationId },
      include: {
        subscription: {
          include: { plan: true }
        }
      }
    });

    if (organization?.subscription?.plan?.maxStorageMB) {
      const maxStorageMB = organization.subscription.plan.maxStorageMB;
      
      // Get current storage usage
      const storageUsage = await db.media.aggregate({
        where: { organizationId: session.user.organizationId },
        _sum: { fileSize: true },
      });
      const currentStorageBytes = storageUsage._sum.fileSize || 0;
      const currentStorageMB = currentStorageBytes / (1024 * 1024);
      
      // Check if adding this file would exceed the limit
      if (currentStorageMB + fileSizeMB > maxStorageMB) {
        const remainingMB = Math.max(0, maxStorageMB - currentStorageMB);
        return NextResponse.json({ 
          error: `Storage limit exceeded. Your plan allows ${maxStorageMB >= 1000 ? `${maxStorageMB / 1000} GB` : `${maxStorageMB} MB`} of storage. You have ${remainingMB.toFixed(1)} MB remaining, but this file is ${fileSizeMB.toFixed(1)} MB.` 
        }, { status: 400 });
      }
    }

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
