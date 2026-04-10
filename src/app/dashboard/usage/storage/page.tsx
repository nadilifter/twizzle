import { redirect } from "next/navigation";
import {
  HardDrive,
  Files,
  Image as ImageIcon,
  Video,
  Music,
  FileText,
  File,
  Trophy,
  Calendar,
  Layers,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { StorageFilesTable, type StorageFile } from "./storage-files-table";

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatStorageMB(mb: number): string {
  if (mb >= 1000) return `${(mb / 1000).toFixed(1)} GB`;
  return `${mb} MB`;
}

function categorizeContentType(
  contentType: string
): "image" | "video" | "audio" | "document" | "other" {
  if (contentType.startsWith("image/")) return "image";
  if (contentType.startsWith("video/")) return "video";
  if (contentType.startsWith("audio/")) return "audio";
  if (
    contentType.startsWith("application/pdf") ||
    contentType.startsWith("application/msword") ||
    contentType.startsWith("application/vnd.openxmlformats")
  )
    return "document";
  return "other";
}

function categorizeMediaType(type: "IMAGE" | "VIDEO"): "image" | "video" {
  return type === "IMAGE" ? "image" : "video";
}

export default async function StoragePage() {
  const session = await getAuthSession();

  if (!session?.user?.organizationId) {
    redirect("/login");
  }

  const organizationId = session.user.organizationId;

  const [
    organization,
    mediaAgg,
    regFileAgg,
    mediaFiles,
    registrationFiles,
    regFilesByProgram,
    regFilesByCompetition,
    regFilesByEvent,
  ] = await Promise.all([
    db.organization.findUnique({
      where: { id: organizationId },
      include: { subscription: { include: { plan: true } } },
    }),
    db.media.aggregate({
      where: { organizationId },
      _sum: { fileSize: true },
      _count: true,
    }),
    db.registrationFile.aggregate({
      where: { organizationId },
      _sum: { fileSize: true },
      _count: true,
    }),
    db.media.findMany({
      where: { organizationId },
      select: {
        id: true,
        title: true,
        url: true,
        type: true,
        fileSize: true,
        createdAt: true,
        uploadedBy: { select: { name: true } },
        athlete: { select: { firstName: true, lastName: true } },
        event: { select: { title: true } },
      },
      orderBy: { fileSize: "desc" },
      take: 100,
    }),
    db.registrationFile.findMany({
      where: { organizationId },
      select: {
        id: true,
        fileName: true,
        fileSize: true,
        contentType: true,
        createdAt: true,
        uploadedBy: { select: { name: true } },
        program: { select: { name: true } },
        competition: { select: { name: true } },
        event: { select: { title: true } },
        athlete: { select: { firstName: true, lastName: true } },
      },
      orderBy: { fileSize: "desc" },
      take: 100,
    }),
    db.registrationFile.groupBy({
      by: ["programId"],
      where: { organizationId, programId: { not: null } },
      _sum: { fileSize: true },
      _count: true,
      orderBy: { _sum: { fileSize: "desc" } },
      take: 5,
    }),
    db.registrationFile.groupBy({
      by: ["competitionId"],
      where: { organizationId, competitionId: { not: null } },
      _sum: { fileSize: true },
      _count: true,
      orderBy: { _sum: { fileSize: "desc" } },
      take: 5,
    }),
    db.registrationFile.groupBy({
      by: ["eventId"],
      where: { organizationId, eventId: { not: null } },
      _sum: { fileSize: true },
      _count: true,
      orderBy: { _sum: { fileSize: "desc" } },
      take: 5,
    }),
  ]);

  if (!organization) {
    redirect("/login");
  }

  // Fetch entity names for top contributors
  const [programNames, competitionNames, eventNames] = await Promise.all([
    regFilesByProgram.length > 0
      ? db.program.findMany({
          where: { id: { in: regFilesByProgram.map((r) => r.programId!).filter(Boolean) } },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
    regFilesByCompetition.length > 0
      ? db.competition.findMany({
          where: { id: { in: regFilesByCompetition.map((r) => r.competitionId!).filter(Boolean) } },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
    regFilesByEvent.length > 0
      ? db.event.findMany({
          where: { id: { in: regFilesByEvent.map((r) => r.eventId!).filter(Boolean) } },
          select: { id: true, title: true },
        })
      : Promise.resolve([]),
  ]);

  const programNameMap = new Map(programNames.map((p) => [p.id, p.name]));
  const competitionNameMap = new Map(competitionNames.map((c) => [c.id, c.name]));
  const eventNameMap = new Map(eventNames.map((e) => [e.id, e.title]));

  // Aggregate stats (from accurate counts, not capped findMany)
  const mediaTotalBytes = mediaAgg._sum.fileSize || 0;
  const regTotalBytes = regFileAgg._sum.fileSize || 0;
  const mediaFileCount = mediaAgg._count;
  const regFileCount = regFileAgg._count;
  const totalBytes = mediaTotalBytes + regTotalBytes;
  const totalFiles = mediaFileCount + regFileCount;
  const totalUsedMB = Math.round((totalBytes / (1024 * 1024)) * 100) / 100;

  const maxStorageMB = organization.subscription?.plan?.maxStorageMB ?? null;
  const usagePercent = maxStorageMB ? Math.min(100, (totalUsedMB / maxStorageMB) * 100) : 0;

  // File type breakdown
  const typeBreakdown: Record<string, { count: number; bytes: number }> = {
    image: { count: 0, bytes: 0 },
    video: { count: 0, bytes: 0 },
    audio: { count: 0, bytes: 0 },
    document: { count: 0, bytes: 0 },
    other: { count: 0, bytes: 0 },
  };

  for (const f of mediaFiles) {
    const cat = categorizeMediaType(f.type as "IMAGE" | "VIDEO");
    typeBreakdown[cat].count++;
    typeBreakdown[cat].bytes += f.fileSize;
  }
  for (const f of registrationFiles) {
    const cat = categorizeContentType(f.contentType);
    typeBreakdown[cat].count++;
    typeBreakdown[cat].bytes += f.fileSize;
  }

  const typeEntries = Object.entries(typeBreakdown)
    .filter(([, v]) => v.count > 0)
    .sort((a, b) => b[1].bytes - a[1].bytes);

  // Top contributors (merge programs, competitions, events into one ranked list)
  type Contributor = {
    name: string;
    kind: "Program" | "Competition" | "Event";
    count: number;
    bytes: number;
  };
  const contributors: Contributor[] = [];

  for (const r of regFilesByProgram) {
    if (r.programId) {
      contributors.push({
        name: programNameMap.get(r.programId) || "Unknown Program",
        kind: "Program",
        count: r._count,
        bytes: r._sum.fileSize || 0,
      });
    }
  }
  for (const r of regFilesByCompetition) {
    if (r.competitionId) {
      contributors.push({
        name: competitionNameMap.get(r.competitionId) || "Unknown Competition",
        kind: "Competition",
        count: r._count,
        bytes: r._sum.fileSize || 0,
      });
    }
  }
  for (const r of regFilesByEvent) {
    if (r.eventId) {
      contributors.push({
        name: eventNameMap.get(r.eventId) || "Unknown Event",
        kind: "Event",
        count: r._count,
        bytes: r._sum.fileSize || 0,
      });
    }
  }

  contributors.sort((a, b) => b.bytes - a.bytes);
  const topContributors = contributors.slice(0, 8);

  // Build unified file list for table (sorted by size desc, top 50)
  const allFiles: StorageFile[] = [];

  for (const f of mediaFiles) {
    const source = f.event?.title
      ? f.event.title
      : f.athlete
        ? `${f.athlete.firstName} ${f.athlete.lastName}`
        : "Organization Asset";
    allFiles.push({
      id: f.id,
      name: f.title || f.url.split("/").pop() || "Untitled",
      fileSize: f.fileSize,
      type: "media",
      category: categorizeMediaType(f.type as "IMAGE" | "VIDEO"),
      source,
      uploadedBy: f.uploadedBy?.name || "Unknown",
      createdAt: f.createdAt.toISOString(),
    });
  }

  for (const f of registrationFiles) {
    const source = f.program?.name || f.competition?.name || f.event?.title || "Registration";
    allFiles.push({
      id: f.id,
      name: f.fileName,
      fileSize: f.fileSize,
      type: "registration",
      category: categorizeContentType(f.contentType),
      source,
      uploadedBy: f.uploadedBy?.name || `${f.athlete.firstName} ${f.athlete.lastName}`,
      createdAt: f.createdAt.toISOString(),
    });
  }

  allFiles.sort((a, b) => b.fileSize - a.fileSize);
  const tableFiles = allFiles.slice(0, 50);

  const typeIcons: Record<string, typeof File> = {
    image: ImageIcon,
    video: Video,
    audio: Music,
    document: FileText,
    other: File,
  };

  const typeLabels: Record<string, string> = {
    image: "Images",
    video: "Videos",
    audio: "Audio",
    document: "Documents",
    other: "Other",
  };

  const contributorIcons: Record<string, typeof Layers> = {
    Program: Layers,
    Competition: Trophy,
    Event: Calendar,
  };

  const contributorColors: Record<string, string> = {
    Program: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
    Competition: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300",
    Event: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300",
  };

  return (
    <div className="@container/main flex flex-1 flex-col gap-2">
      <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
        <div className="flex items-center justify-between px-4 lg:px-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">File Storage</h1>
            <p className="text-sm text-muted-foreground">
              {formatBytes(totalBytes)} used
              {maxStorageMB ? ` of ${formatStorageMB(maxStorageMB)}` : ""} across {totalFiles} files
            </p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 px-4 lg:px-6 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Storage</CardTitle>
              <HardDrive className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatBytes(totalBytes)}</div>
              {maxStorageMB ? (
                <div className="mt-2 space-y-1">
                  <Progress value={usagePercent} className="h-2" />
                  <p className="text-xs text-muted-foreground">
                    {Math.round(usagePercent)}% of {formatStorageMB(maxStorageMB)} used
                  </p>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">No storage limit</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Files</CardTitle>
              <Files className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalFiles}</div>
              <p className="text-xs text-muted-foreground">across all uploads</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Media Files</CardTitle>
              <ImageIcon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{mediaFileCount}</div>
              <p className="text-xs text-muted-foreground">{formatBytes(mediaTotalBytes)} total</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Registration Files</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{regFileCount}</div>
              <p className="text-xs text-muted-foreground">{formatBytes(regTotalBytes)} total</p>
            </CardContent>
          </Card>
        </div>

        {/* Breakdown Row */}
        <div className="grid gap-4 px-4 lg:px-6 md:grid-cols-2">
          {/* Storage by File Type */}
          <Card>
            <CardHeader>
              <CardTitle>Storage by File Type</CardTitle>
              <CardDescription>Breakdown of storage usage by file category</CardDescription>
            </CardHeader>
            <CardContent>
              {typeEntries.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  No files uploaded yet.
                </p>
              ) : (
                <div className="space-y-4">
                  {typeEntries.map(([type, data]) => {
                    const Icon = typeIcons[type] || File;
                    const proportion = totalBytes > 0 ? (data.bytes / totalBytes) * 100 : 0;
                    return (
                      <div key={type} className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <Icon className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{typeLabels[type]}</span>
                            <span className="text-muted-foreground">({data.count} files)</span>
                          </div>
                          <span className="font-medium tabular-nums">
                            {formatBytes(data.bytes)}
                          </span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full bg-primary transition-all"
                            style={{ width: `${Math.max(proportion, 1)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Top Storage Contributors */}
          <Card>
            <CardHeader>
              <CardTitle>Top Storage Contributors</CardTitle>
              <CardDescription>
                Programs, competitions, and events using the most storage
              </CardDescription>
            </CardHeader>
            <CardContent>
              {topContributors.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  No registration files yet.
                </p>
              ) : (
                <div className="space-y-3">
                  {topContributors.map((c, i) => {
                    const Icon = contributorIcons[c.kind] || Layers;
                    return (
                      <div
                        key={`${c.kind}-${i}`}
                        className="flex items-center justify-between gap-2"
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                          <span className="text-sm font-medium truncate">{c.name}</span>
                          <Badge
                            variant="secondary"
                            className={`shrink-0 text-xs ${contributorColors[c.kind]}`}
                          >
                            {c.kind}
                          </Badge>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-sm font-medium tabular-nums">
                            {formatBytes(c.bytes)}
                          </div>
                          <div className="text-xs text-muted-foreground">{c.count} files</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Largest Files Table */}
        <div className="px-4 lg:px-6">
          <Card>
            <CardHeader>
              <CardTitle>Largest Files</CardTitle>
              <CardDescription>
                Your largest files across all uploads, sorted by size
              </CardDescription>
            </CardHeader>
            <CardContent>
              {tableFiles.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <HardDrive className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No files uploaded yet.</p>
                </div>
              ) : (
                <StorageFilesTable files={tableFiles} />
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
