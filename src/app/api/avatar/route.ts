import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { uploadFile, deleteFile, getPublicUrl, parseStorageUrl } from "@/lib/storage";
import { getCurrentEnvironment } from "@/lib/env-domains";
import { checkApiRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { validateFileContent } from "@/lib/file-validation";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { db } from "@/lib/db"; // tenant-isolation-ok: User is not a tenant model
import { syncUserToSelfAthlete } from "@/lib/sync-self-athlete";

export async function POST(request: NextRequest) {
  const rateLimitResponse = await checkApiRateLimit(request, "avatar-upload", RATE_LIMITS.sensitive);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "File must be an image" }, { status: 400 });
    }

    const maxSize = 5 * 1024 * 1024; // 5MB
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    if (buffer.length > maxSize) {
      return NextResponse.json({ error: "Image must be smaller than 5MB" }, { status: 400 });
    }

    const ext = path.extname(file.name).toLowerCase();
    const validation = await validateFileContent(buffer, ext, { allowedCategory: "image" });
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const userId = session.user.id;
    const timestamp = Date.now();
    const key = `avatars/users/${userId}-${timestamp}.jpg`;

    const useS3 =
      process.env.USE_S3_STORAGE === "true" ||
      getCurrentEnvironment() !== "local" ||
      process.env.S3_ENDPOINT;

    let publicUrl: string;

    if (useS3) {
      await uploadFile("assets", key, buffer, {
        contentType: "image/jpeg",
        isPublic: true,
      });
      publicUrl = getPublicUrl(key);
    } else {
      const uploadsDir = path.join(process.cwd(), "public", "uploads", "avatars");
      await mkdir(uploadsDir, { recursive: true });
      const filename = `user-${userId}-${timestamp}.jpg`;
      const filePath = path.join(uploadsDir, filename);
      await writeFile(filePath, buffer);
      publicUrl = `/uploads/avatars/${filename}`;
    }

    // Delete old avatar from S3 if applicable
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { avatar: true },
    });

    if (user?.avatar) {
      const oldKey = parseStorageUrl(user.avatar);
      if (oldKey && useS3) {
        try {
          await deleteFile("assets", oldKey);
        } catch {
          // Old file may not exist; safe to ignore
        }
      }
    }

    await db.user.update({
      where: { id: userId },
      data: { avatar: publicUrl },
    });

    await syncUserToSelfAthlete(userId);

    return NextResponse.json({ url: publicUrl });
  } catch (error) {
    console.error("Error uploading avatar:", error);
    return NextResponse.json({ error: "Failed to upload avatar" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const rateLimitResponse = await checkApiRateLimit(request, "avatar-delete", RATE_LIMITS.sensitive);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { avatar: true },
    });

    if (user?.avatar) {
      const oldKey = parseStorageUrl(user.avatar);
      if (oldKey) {
        const useS3 =
          process.env.USE_S3_STORAGE === "true" ||
          getCurrentEnvironment() !== "local" ||
          process.env.S3_ENDPOINT;

        if (useS3) {
          try {
            await deleteFile("assets", oldKey);
          } catch {
            // Safe to ignore
          }
        }
      }
    }

    await db.user.update({
      where: { id: userId },
      data: { avatar: null },
    });

    await syncUserToSelfAthlete(userId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting avatar:", error);
    return NextResponse.json({ error: "Failed to delete avatar" }, { status: 500 });
  }
}
