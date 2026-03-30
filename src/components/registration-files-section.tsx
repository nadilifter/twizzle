"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  FileAudio,
  FileImage,
  FileVideo,
  FileText,
  File,
  Download,
  Trash2,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

interface RegistrationFileRecord {
  id: string;
  fileName: string;
  fileSize: number;
  contentType: string;
  downloadUrl?: string;
  programId: string | null;
  competitionId: string | null;
  eventId: string | null;
  entityName: string | null;
  createdAt: string;
}

interface RegistrationFilesSectionProps {
  athleteId: string;
  organizationId?: string;
  /** Admin can delete files; guardians can only view/download */
  canDelete?: boolean;
  /** Labels for the entity names, keyed by entity ID */
  entityLabels?: Record<string, string>;
}

function getFileIcon(contentType: string) {
  if (contentType.startsWith("audio/")) return FileAudio;
  if (contentType.startsWith("image/")) return FileImage;
  if (contentType.startsWith("video/")) return FileVideo;
  if (contentType === "application/pdf" || contentType.includes("document")) return FileText;
  return File;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function RegistrationFilesSection({
  athleteId,
  organizationId,
  canDelete = false,
  entityLabels = {},
}: RegistrationFilesSectionProps) {
  const [files, setFiles] = useState<RegistrationFileRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchFiles = useCallback(async () => {
    try {
      const res = await fetch(`/api/registration-files?athleteId=${athleteId}`);
      if (res.ok) {
        const data = await res.json();
        setFiles(data.files || []);
      }
    } catch {
      // Ignore errors
    } finally {
      setLoading(false);
    }
  }, [athleteId]);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  const handleDelete = async (fileId: string) => {
    setDeletingId(fileId);
    try {
      const res = await fetch(`/api/registration-files/${fileId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Delete failed");
      }
      setFiles((prev) => prev.filter((f) => f.id !== fileId));
      toast.success("File deleted");
    } catch (error: any) {
      toast.error(error.message || "Failed to delete file");
    } finally {
      setDeletingId(null);
    }
  };

  const getEntityLabel = (file: RegistrationFileRecord) => {
    if (file.entityName) return file.entityName;
    const entityId = file.programId || file.competitionId || file.eventId;
    if (entityId && entityLabels[entityId]) return entityLabels[entityId];
    if (file.programId) return "Program";
    if (file.competitionId) return "Competition";
    if (file.eventId) return "Event";
    return "Registration";
  };

  if (loading || files.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <File className="h-4 w-4" />
          Registration Files ({files.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {files.map((file) => {
          const FileIcon = getFileIcon(file.contentType);
          return (
            <div
              key={file.id}
              className="flex items-center gap-3 rounded-md border bg-muted/30 p-3"
            >
              <FileIcon className="h-5 w-5 text-primary shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{file.fileName}</p>
                <p className="text-xs text-muted-foreground">
                  {formatFileSize(file.fileSize)} · {getEntityLabel(file)}
                </p>
              </div>
              <div className="flex items-center gap-1">
                {file.downloadUrl && (
                  <Button variant="ghost" size="icon" asChild className="h-8 w-8">
                    <a href={file.downloadUrl} target="_blank" rel="noopener noreferrer">
                      <Download className="h-4 w-4" />
                    </a>
                  </Button>
                )}
                {canDelete && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive"
                    onClick={() => handleDelete(file.id)}
                    disabled={deletingId === file.id}
                  >
                    {deletingId === file.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
