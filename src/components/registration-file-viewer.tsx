"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  FileAudio,
  FileImage,
  FileVideo,
  FileText,
  File,
  Download,
  Trash2,
  Upload,
  Loader2,
  Replace,
} from "lucide-react";
import { toast } from "sonner";
import { MAX_FILE_SIZE_BYTES } from "@/types/file-requirements";

interface RegistrationFileInfo {
  id: string;
  fileName: string;
  fileSize: number;
  contentType: string;
  downloadUrl?: string;
}

interface RegistrationFileViewerProps {
  organizationId?: string;
  athleteId: string;
  programId?: string;
  competitionId?: string;
  eventId?: string;
  /** Allow replacing / deleting the file */
  editable?: boolean;
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

export function RegistrationFileViewer({
  organizationId,
  athleteId,
  programId,
  competitionId,
  eventId,
  editable = false,
}: RegistrationFileViewerProps) {
  const [file, setFile] = useState<RegistrationFileInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const fetchFile = useCallback(async () => {
    try {
      const body: Record<string, string> = { athleteId };
      if (programId) body.programId = programId;
      if (competitionId) body.competitionId = competitionId;
      if (eventId) body.eventId = eventId;

      const res = await fetch("/api/public/registration-files/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.exists && data.file) {
          // Fetch full details with download URL
          const detailRes = await fetch(`/api/registration-files/${data.file.id}`);
          if (detailRes.ok) {
            const detail = await detailRes.json();
            setFile(detail);
            return;
          }
        }
      }
      setFile(null);
    } catch {
      setFile(null);
    } finally {
      setLoading(false);
    }
  }, [athleteId, programId, competitionId, eventId]);

  useEffect(() => {
    fetchFile();
  }, [fetchFile]);

  const handleUpload = async (selected: globalThis.File) => {
    if (selected.size > MAX_FILE_SIZE_BYTES) {
      toast.error(`File exceeds the maximum size of ${MAX_FILE_SIZE_BYTES / (1024 * 1024)} MB`);
      return;
    }

    setIsUploading(true);
    setUploadProgress(20);

    const formData = new FormData();
    formData.append("file", selected);
    formData.append("organizationId", organizationId || "");
    formData.append("athleteId", athleteId);
    if (programId) formData.append("programId", programId);
    if (competitionId) formData.append("competitionId", competitionId);
    if (eventId) formData.append("eventId", eventId);

    try {
      setUploadProgress(50);
      const res = await fetch("/api/registration-files/upload", {
        method: "POST",
        body: formData,
      });
      setUploadProgress(80);

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Upload failed");
      }

      setUploadProgress(100);
      toast.success("File replaced successfully");
      await fetchFile();
    } catch (error: any) {
      toast.error(error.message || "Failed to upload file");
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleDelete = async () => {
    if (!file) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/registration-files/${file.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Delete failed");
      }
      setFile(null);
      toast.success("File deleted");
    } catch (error: any) {
      toast.error(error.message || "Failed to delete file");
    } finally {
      setIsDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Loading file...</span>
      </div>
    );
  }

  if (!file) {
    if (!editable) return null;
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <File className="h-4 w-4" />
        <span>No file uploaded</span>
        {editable && (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => inputRef.current?.click()}
              disabled={isUploading}
              className="ml-2 gap-1"
            >
              <Upload className="h-3.5 w-3.5" />
              Upload
            </Button>
            <input
              ref={inputRef}
              type="file"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleUpload(f);
                if (inputRef.current) inputRef.current.value = "";
              }}
            />
          </>
        )}
      </div>
    );
  }

  const FileIcon = getFileIcon(file.contentType);

  return (
    <div className="space-y-2">
      {isUploading && (
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Uploading...</span>
          </div>
          <Progress value={uploadProgress} className="h-1.5" />
        </div>
      )}

      {!isUploading && (
        <div className="flex items-center gap-3 rounded-md border bg-muted/30 p-3">
          <FileIcon className="h-6 w-6 text-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{file.fileName}</p>
            <p className="text-xs text-muted-foreground">{formatFileSize(file.fileSize)}</p>
          </div>
          <div className="flex items-center gap-1">
            {file.downloadUrl && (
              <Button variant="ghost" size="icon" asChild className="h-8 w-8">
                <a href={file.downloadUrl} target="_blank" rel="noopener noreferrer">
                  <Download className="h-4 w-4" />
                </a>
              </Button>
            )}
            {editable && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => inputRef.current?.click()}
                  disabled={isUploading}
                >
                  <Replace className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive"
                  onClick={handleDelete}
                  disabled={isDeleting}
                >
                  {isDeleting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </Button>
              </>
            )}
          </div>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleUpload(f);
          if (inputRef.current) inputRef.current.value = "";
        }}
        disabled={isUploading}
      />
    </div>
  );
}
