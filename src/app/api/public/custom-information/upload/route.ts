import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthSession } from "@/lib/auth";
import { isFeatureEnabled } from "@/lib/feature-resolver";
import { uploadFile, getSignedUrl } from "@/lib/storage";
import { getCurrentEnvironment } from "@/lib/env-domains";
import path from "path";
import { writeFile, mkdir } from "fs/promises";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".pdf"]);

/**
 * POST /api/public/custom-information/upload
 *
 * Upload an image file for a custom info IMAGE-type question.
 * Returns the created/updated response with file URL.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const athleteId = formData.get("athleteId") as string | null;
    const organizationId = formData.get("organizationId") as string | null;
    const questionId = formData.get("questionId") as string | null;

    if (!file || !athleteId || !organizationId || !questionId) {
      return NextResponse.json({ error: "file, athleteId, organizationId, and questionId are required" }, { status: 400 });
    }

    const enabled = await isFeatureEnabled(organizationId, "customInformation");
    if (!enabled) {
      return NextResponse.json({ error: "Feature not enabled" }, { status: 403 });
    }

    // Verify guardian access
    const guardian = await db.athleteGuardian.findFirst({
      where: { athleteId, user: { email: session.user.email! } },
      select: { id: true },
    });
    if (!guardian) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Validate question
    const question = await db.customInfoQuestion.findFirst({
      where: { id: questionId, organizationId, isActive: true, questionType: "IMAGE" },
    });
    if (!question) {
      return NextResponse.json({ error: "Invalid question" }, { status: 400 });
    }

    // Validate file
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "File too large (max 10 MB)" }, { status: 400 });
    }
    const ext = path.extname(file.name).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      return NextResponse.json({ error: `File type ${ext} not allowed` }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const timestamp = Date.now();
    const fileName = `${athleteId}-${timestamp}${ext}`;
    const storageKey = `organizations/${organizationId}/custom-info/${questionId}/${fileName}`;

    let fileUrl: string;
    let savedStorageKey: string | null = null;

    const useS3 = process.env.USE_S3_STORAGE === "true" || getCurrentEnvironment() !== "local" || !!process.env.S3_ENDPOINT;

    if (useS3) {
      await uploadFile("documents", storageKey, buffer, {
        contentType: file.type,
        isPublic: false,
      });
      fileUrl = await getSignedUrl("documents", storageKey);
      savedStorageKey = storageKey;
    } else {
      const localDir = path.join(process.cwd(), "public", "uploads", "custom-info", organizationId);
      await mkdir(localDir, { recursive: true });
      const localPath = path.join(localDir, fileName);
      await writeFile(localPath, buffer);
      fileUrl = `/uploads/custom-info/${organizationId}/${fileName}`;
    }

    const response = await db.customInfoResponse.upsert({
      where: {
        athleteId_organizationId_questionId: {
          athleteId,
          organizationId,
          questionId,
        },
      },
      update: {
        fileUrl,
        storageKey: savedStorageKey,
        fileName: file.name,
        contentType: file.type,
        respondedAt: new Date(),
        respondedById: session.user.id,
      },
      create: {
        athleteId,
        organizationId,
        questionId,
        fileUrl,
        storageKey: savedStorageKey,
        fileName: file.name,
        contentType: file.type,
        respondedAt: new Date(),
        respondedById: session.user.id,
      },
    });

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    console.error("Error uploading custom info file:", error);
    return NextResponse.json({ error: "Failed to upload file" }, { status: 500 });
  }
}
