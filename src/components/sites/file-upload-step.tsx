"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  ChevronLeft,
  ChevronRight,
  Upload,
  FileAudio,
  FileImage,
  FileVideo,
  FileText,
  File,
  Loader2,
  Check,
  X,
  Replace,
} from "lucide-react";
import { toast } from "sonner";
import {
  type FileRequirementConfig,
  resolveAcceptedExtensions,
  MAX_FILE_SIZE_BYTES,
} from "@/types/file-requirements";

interface ExistingFile {
  id: string;
  fileName: string;
  fileSize: number;
  contentType: string;
}

interface FileUploadStepProps {
  config: FileRequirementConfig;
  organizationId: string;
  athleteId: string;
  programId?: string;
  competitionId?: string;
  eventId?: string;
  onComplete: (fileId: string) => void;
  onBack: () => void;
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

export function FileUploadStep({
  config,
  organizationId,
  athleteId,
  programId,
  competitionId,
  eventId,
  onComplete,
  onBack,
}: FileUploadStepProps) {
  const [existingFile, setExistingFile] = useState<ExistingFile | null>(null);
  const [isCheckingExisting, setIsCheckingExisting] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadedFileId, setUploadedFileId] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const acceptedExtensions = resolveAcceptedExtensions(config);
  const acceptAttr = acceptedExtensions.join(",");

  // Check for existing file on mount
  useEffect(() => {
    const checkExisting = async () => {
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
            setExistingFile(data.file);
            setUploadedFileId(data.file.id);
          }
        }
      } catch {
        // Ignore - will show upload form
      } finally {
        setIsCheckingExisting(false);
      }
    };
    checkExisting();
  }, [athleteId, programId, competitionId, eventId]);

  const handleUpload = useCallback(
    async (file: globalThis.File) => {
      const ext = "." + file.name.split(".").pop()?.toLowerCase();
      if (acceptedExtensions.length > 0 && !acceptedExtensions.includes(ext)) {
        toast.error(`File type ${ext} is not accepted. Allowed: ${acceptedExtensions.join(", ")}`);
        return;
      }

      if (file.size > MAX_FILE_SIZE_BYTES) {
        toast.error(`File exceeds the maximum size of ${MAX_FILE_SIZE_BYTES / (1024 * 1024)} MB`);
        return;
      }

      setIsUploading(true);
      setUploadProgress(10);

      const formData = new FormData();
      formData.append("file", file);
      formData.append("organizationId", organizationId);
      formData.append("athleteId", athleteId);
      if (programId) formData.append("programId", programId);
      if (competitionId) formData.append("competitionId", competitionId);
      if (eventId) formData.append("eventId", eventId);

      try {
        setUploadProgress(30);
        const res = await fetch("/api/registration-files/upload", {
          method: "POST",
          body: formData,
        });
        setUploadProgress(80);

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Upload failed");
        }

        const data = await res.json();
        setUploadProgress(100);
        setUploadedFileId(data.id);
        setExistingFile({
          id: data.id,
          fileName: data.fileName,
          fileSize: data.fileSize,
          contentType: file.type,
        });
        toast.success("File uploaded successfully");
      } catch (error: any) {
        toast.error(error.message || "Failed to upload file");
      } finally {
        setIsUploading(false);
        setUploadProgress(0);
      }
    },
    [acceptedExtensions, organizationId, athleteId, programId, competitionId, eventId]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragActive(false);
      const file = e.dataTransfer.files[0];
      if (file) handleUpload(file);
    },
    [handleUpload]
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleUpload(file);
      if (inputRef.current) inputRef.current.value = "";
    },
    [handleUpload]
  );

  if (isCheckingExisting) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto mb-4" />
          <p className="text-sm text-muted-foreground">Checking for existing files...</p>
        </CardContent>
      </Card>
    );
  }

  const FileIcon = existingFile ? getFileIcon(existingFile.contentType) : File;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          {config.label || "File Upload"}
        </CardTitle>
        {config.description && (
          <p className="text-sm text-muted-foreground">{config.description}</p>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Accepted types */}
        <div className="flex flex-wrap gap-1">
          <span className="text-xs text-muted-foreground mr-1">Accepted:</span>
          {acceptedExtensions.map((ext) => (
            <Badge key={ext} variant="outline" className="text-xs">
              {ext}
            </Badge>
          ))}
        </div>

        {/* Existing / uploaded file */}
        {existingFile && !isUploading && (
          <div className="flex items-center gap-3 rounded-lg border bg-muted/30 p-4">
            <FileIcon className="h-8 w-8 text-primary shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{existingFile.fileName}</p>
              <p className="text-xs text-muted-foreground">
                {formatFileSize(existingFile.fileSize)}
              </p>
            </div>
            <Check className="h-5 w-5 text-green-600 shrink-0" />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => inputRef.current?.click()}
              className="gap-1"
            >
              <Replace className="h-4 w-4" />
              Replace
            </Button>
          </div>
        )}

        {/* Upload progress */}
        {isUploading && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Uploading...</span>
            </div>
            <Progress value={uploadProgress} className="h-2" />
          </div>
        )}

        {/* Drop zone (shown when no file is uploaded or user wants to replace) */}
        {!existingFile && !isUploading && (
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
              dragActive
                ? "border-primary bg-primary/5"
                : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50"
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
          >
            <Upload className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm font-medium">Drag and drop your file here, or click to browse</p>
            <p className="text-xs text-muted-foreground mt-1">
              Max file size: {MAX_FILE_SIZE_BYTES / (1024 * 1024)} MB
            </p>
          </div>
        )}

        <input
          ref={inputRef}
          type="file"
          accept={acceptAttr}
          className="hidden"
          onChange={handleFileChange}
          disabled={isUploading}
        />
      </CardContent>

      <CardFooter className="flex justify-between">
        <Button variant="outline" onClick={onBack} disabled={isUploading}>
          <ChevronLeft className="mr-1 h-4 w-4" />
          Back
        </Button>
        <Button
          onClick={() => {
            if (!uploadedFileId) {
              toast.error("Please upload a file before continuing");
              return;
            }
            onComplete(uploadedFileId);
          }}
          disabled={isUploading || !uploadedFileId}
        >
          Continue
          <ChevronRight className="ml-1 h-4 w-4" />
        </Button>
      </CardFooter>
    </Card>
  );
}
