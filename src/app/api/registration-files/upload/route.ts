import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { uploadFile, getRegistrationFileKey, getPublicUrl, deleteFile } from "@/lib/storage";
import { getCurrentEnvironment } from "@/lib/env-domains";
import { writeFile, mkdir, unlink } from "fs/promises";
import path from "path";
import { db } from "@/lib/db";
import {
  MAX_FILE_SIZE_BYTES,
  EXTENSION_MIME_MAP,
  resolveAcceptedExtensions,
  type FileRequirementConfig,
} from "@/types/file-requirements";

export async function POST(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;
    const athleteId = formData.get("athleteId") as string;
    const organizationId = session.user.organizationId;
    const programId = (formData.get("programId") as string) || null;
    const competitionId = (formData.get("competitionId") as string) || null;
    const eventId = (formData.get("eventId") as string) || null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }
    if (!athleteId || !organizationId) {
      return NextResponse.json({ error: "athleteId and organizationId are required" }, { status: 400 });
    }

    const entityCount = [programId, competitionId, eventId].filter(Boolean).length;
    if (entityCount !== 1) {
      return NextResponse.json(
        { error: "Exactly one of programId, competitionId, or eventId must be provided" },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const fileSizeBytes = buffer.length;

    if (fileSizeBytes > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { error: `File exceeds the maximum size of ${MAX_FILE_SIZE_BYTES / (1024 * 1024)} MB` },
        { status: 400 }
      );
    }

    // Resolve the entity and its file requirement config
    let fileReqConfig: FileRequirementConfig | null = null;
    let entityType: "program" | "competition" | "event";
    let entityId: string;

    if (programId) {
      entityType = "program";
      entityId = programId;
      const program = await db.program.findUnique({
        where: { id: programId },
        select: { hasFileRequirement: true, fileRequirementConfig: true, organizationId: true },
      });
      if (!program || program.organizationId !== organizationId) {
        return NextResponse.json({ error: "Program not found" }, { status: 404 });
      }
      if (!program.hasFileRequirement || !program.fileRequirementConfig) {
        return NextResponse.json({ error: "This program does not require a file upload" }, { status: 400 });
      }
      fileReqConfig = program.fileRequirementConfig as unknown as FileRequirementConfig;
    } else if (competitionId) {
      entityType = "competition";
      entityId = competitionId;
      const competition = await db.competition.findUnique({
        where: { id: competitionId },
        select: { hasFileRequirement: true, fileRequirementConfig: true, organizationId: true },
      });
      if (!competition || competition.organizationId !== organizationId) {
        return NextResponse.json({ error: "Competition not found" }, { status: 404 });
      }
      if (!competition.hasFileRequirement || !competition.fileRequirementConfig) {
        return NextResponse.json({ error: "This competition does not require a file upload" }, { status: 400 });
      }
      fileReqConfig = competition.fileRequirementConfig as unknown as FileRequirementConfig;
    } else {
      entityType = "event";
      entityId = eventId!;
      const event = await db.event.findUnique({
        where: { id: eventId! },
        select: { hasFileRequirement: true, fileRequirementConfig: true, organizationId: true },
      });
      if (!event || event.organizationId !== organizationId) {
        return NextResponse.json({ error: "Event not found" }, { status: 404 });
      }
      if (!event.hasFileRequirement || !event.fileRequirementConfig) {
        return NextResponse.json({ error: "This event does not require a file upload" }, { status: 400 });
      }
      fileReqConfig = event.fileRequirementConfig as unknown as FileRequirementConfig;
    }

    // Validate file extension against accepted types
    const ext = path.extname(file.name).toLowerCase();
    const acceptedExtensions = resolveAcceptedExtensions(fileReqConfig);
    if (acceptedExtensions.length > 0 && !acceptedExtensions.includes(ext)) {
      return NextResponse.json(
        { error: `File type ${ext} is not accepted. Allowed: ${acceptedExtensions.join(", ")}` },
        { status: 400 }
      );
    }

    // Check org storage limits
    const organization = await db.organization.findUnique({
      where: { id: organizationId },
      include: { subscription: { include: { plan: true } } },
    });

    if (organization?.subscription?.plan?.maxStorageMB) {
      const maxStorageMB = organization.subscription.plan.maxStorageMB;
      const storageUsage = await db.media.aggregate({
        where: { organizationId },
        _sum: { fileSize: true },
      });
      const regFileUsage = await db.registrationFile.aggregate({
        where: { organizationId },
        _sum: { fileSize: true },
      });
      const currentBytes =
        (storageUsage._sum.fileSize || 0) + (regFileUsage._sum.fileSize || 0);
      const currentMB = currentBytes / (1024 * 1024);
      const fileSizeMB = fileSizeBytes / (1024 * 1024);

      if (currentMB + fileSizeMB > maxStorageMB) {
        const remainingMB = Math.max(0, maxStorageMB - currentMB);
        return NextResponse.json(
          {
            error: `Storage limit exceeded. Your plan allows ${maxStorageMB >= 1000 ? `${maxStorageMB / 1000} GB` : `${maxStorageMB} MB`} of storage. You have ${remainingMB.toFixed(1)} MB remaining, but this file is ${fileSizeMB.toFixed(1)} MB.`,
          },
          { status: 400 }
        );
      }
    }

    const contentType = EXTENSION_MIME_MAP[ext] || file.type || "application/octet-stream";
    const key = getRegistrationFileKey(organizationId, athleteId, entityType, entityId, file.name);

    const useS3 =
      process.env.USE_S3_STORAGE === "true" ||
      getCurrentEnvironment() !== "local" ||
      !!process.env.S3_ENDPOINT;

    let publicUrl: string;
    let storageKey: string | null = null;

    if (useS3) {
      await uploadFile("documents", key, buffer, { contentType, isPublic: false });
      storageKey = key;
      publicUrl = getPublicUrl(key);
    } else {
      const uploadsDir = path.join(
        process.cwd(),
        "public",
        "uploads",
        "registration-files",
        organizationId
      );
      await mkdir(uploadsDir, { recursive: true });
      const timestamp = Date.now();
      const filename = `${athleteId}-${timestamp}${ext}`;
      const filePath = path.join(uploadsDir, filename);
      await writeFile(filePath, buffer);
      publicUrl = `/uploads/registration-files/${organizationId}/${filename}`;
    }

    // Delete previous file from storage if replacing
    const whereClause = programId
      ? { athleteId_programId: { athleteId, programId } }
      : competitionId
        ? { athleteId_competitionId: { athleteId, competitionId } }
        : { athleteId_eventId: { athleteId, eventId: eventId! } };

    const existing = await db.registrationFile.findUnique({ where: whereClause as any });

    if (existing) {
      if (existing.storageKey) {
        try {
          await deleteFile("documents", existing.storageKey);
        } catch {
          // Best-effort cleanup
        }
      } else if (existing.url.startsWith("/uploads/")) {
        try {
          await unlink(path.join(process.cwd(), "public", existing.url));
        } catch {
          // Best-effort cleanup
        }
      }
    }

    // Upsert the registration file record
    const registrationFile = await db.registrationFile.upsert({
      where: whereClause as any,
      update: {
        fileName: file.name,
        fileSize: fileSizeBytes,
        contentType,
        storageKey,
        url: publicUrl,
        uploadedById: session.user.id,
        updatedAt: new Date(),
      },
      create: {
        organizationId,
        athleteId,
        uploadedById: session.user.id,
        programId,
        competitionId,
        eventId,
        fileName: file.name,
        fileSize: fileSizeBytes,
        contentType,
        storageKey,
        url: publicUrl,
      },
    });

    return NextResponse.json({
      id: registrationFile.id,
      url: publicUrl,
      fileName: file.name,
      fileSize: fileSizeBytes,
    });
  } catch (error) {
    console.error("Error uploading registration file:", error);
    return NextResponse.json({ error: "Failed to upload file" }, { status: 500 });
  }
}
