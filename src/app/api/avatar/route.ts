import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { uploadFile, deleteFile, getPublicUrl, parseStorageUrl } from "@/lib/storage";
import { getCurrentEnvironment } from "@/lib/env-domains";
import { checkApiRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { validateFileContent } from "@/lib/file-validation";
import { writeFile, mkdir, unlink } from "fs/promises";
import path from "path";
import { db } from "@/lib/db"; // tenant-isolation-ok: User is not a tenant model
import { Prisma } from "@prisma/client";
import { syncUserToSelfAthlete } from "@/lib/sync-self-athlete";
import { z } from "zod";

const cropDataSchema = z.object({
  x: z.number().min(0).max(100),
  y: z.number().min(0).max(100),
  width: z.number().positive().max(100),
  height: z.number().positive().max(100),
});

export async function POST(request: NextRequest) {
  const rateLimitResponse = await checkApiRateLimit(
    request,
    "avatar-upload",
    RATE_LIMITS.sensitive
  );
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

    const maxSize = 5 * 1024 * 1024;
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    if (buffer.length > maxSize) {
      return NextResponse.json({ error: "Image must be smaller than 5MB" }, { status: 400 });
    }

    const ext = path.extname(file.name).toLowerCase() || ".jpg";
    const validation = await validateFileContent(buffer, ext, { allowedCategory: "image" });
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    let cropData = null;
    const cropDataRaw = formData.get("cropData");
    if (cropDataRaw) {
      let rawParsed: unknown;
      try {
        rawParsed = JSON.parse(cropDataRaw as string);
      } catch {
        return NextResponse.json({ error: "Invalid cropData JSON" }, { status: 400 });
      }
      const parsed = cropDataSchema.safeParse(rawParsed);
      if (parsed.success) {
        cropData = parsed.data;
      }
    }

    const userId = session.user.id;
    const timestamp = Date.now();
    const key = `avatars/users/${userId}-${timestamp}${ext}`;

    const useS3 =
      process.env.USE_S3_STORAGE === "true" ||
      getCurrentEnvironment() !== "local" ||
      process.env.S3_ENDPOINT;

    let publicUrl: string;

    if (useS3) {
      await uploadFile("assets", key, buffer, {
        contentType: file.type || "image/jpeg",
        isPublic: true,
      });
      publicUrl = getPublicUrl(key);
    } else {
      const uploadsDir = path.join(process.cwd(), "public", "uploads", "avatars");
      await mkdir(uploadsDir, { recursive: true });
      const filename = `user-${userId}-${timestamp}${ext}`;
      const filePath = path.join(uploadsDir, filename);
      await writeFile(filePath, buffer);
      publicUrl = `/uploads/avatars/${filename}`;
    }

    const user = await db.user.findUnique({
      where: { id: userId },
      select: { avatar: true },
    });

    if (user?.avatar) {
      // Route cleanup by the stored URL's shape, not the *current* useS3
      // flag — the old avatar may have been written under a previous env
      // configuration. A missing file is fine to ignore.
      try {
        const oldKey = parseStorageUrl(user.avatar);
        if (oldKey) {
          await deleteFile("assets", oldKey);
        } else if (user.avatar.startsWith("/uploads/")) {
          await unlink(path.join(process.cwd(), "public", user.avatar));
        }
      } catch {
        // Old file may not exist; safe to ignore
      }
    }

    await db.user.update({
      where: { id: userId },
      data: { avatar: publicUrl, avatarCrop: cropData ?? Prisma.DbNull },
    });

    // Best-effort sync — the user update has already committed. If the
    // mirror to the self-athlete row fails, surface via logs and continue
    // rather than 500-ing a request whose primary mutation succeeded.
    try {
      await syncUserToSelfAthlete(userId);
    } catch (syncError) {
      console.error("Failed to sync user to self-athlete:", syncError);
    }

    return NextResponse.json({ url: publicUrl, avatarCrop: cropData });
  } catch (error) {
    console.error("Error uploading avatar:", error);
    return NextResponse.json({ error: "Failed to upload avatar" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const rateLimitResponse = await checkApiRateLimit(
    request,
    "avatar-crop-update",
    RATE_LIMITS.sensitive
  );
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = cropDataSchema.safeParse(body.cropData);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid crop data" }, { status: 400 });
    }

    const userId = session.user.id;
    await db.user.update({
      where: { id: userId },
      data: { avatarCrop: parsed.data },
    });

    // Best-effort sync — the user update has already committed. If the
    // mirror to the self-athlete row fails, surface via logs and continue
    // rather than 500-ing a request whose primary mutation succeeded.
    try {
      await syncUserToSelfAthlete(userId);
    } catch (syncError) {
      console.error("Failed to sync user to self-athlete:", syncError);
    }

    return NextResponse.json({ success: true, avatarCrop: parsed.data });
  } catch (error) {
    console.error("Error updating avatar crop:", error);
    return NextResponse.json({ error: "Failed to update crop" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const rateLimitResponse = await checkApiRateLimit(
    request,
    "avatar-delete",
    RATE_LIMITS.sensitive
  );
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
      // Route by URL shape so we clean up whichever backend the file
      // actually lives in (see POST for the same pattern).
      try {
        const oldKey = parseStorageUrl(user.avatar);
        if (oldKey) {
          await deleteFile("assets", oldKey);
        } else if (user.avatar.startsWith("/uploads/")) {
          await unlink(path.join(process.cwd(), "public", user.avatar));
        }
      } catch {
        // Safe to ignore
      }
    }

    await db.user.update({
      where: { id: userId },
      data: { avatar: null, avatarCrop: Prisma.DbNull },
    });

    // Best-effort sync — the user update has already committed. If the
    // mirror to the self-athlete row fails, surface via logs and continue
    // rather than 500-ing a request whose primary mutation succeeded.
    try {
      await syncUserToSelfAthlete(userId);
    } catch (syncError) {
      console.error("Failed to sync user to self-athlete:", syncError);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting avatar:", error);
    return NextResponse.json({ error: "Failed to delete avatar" }, { status: 500 });
  }
}
