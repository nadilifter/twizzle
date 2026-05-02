"use client";

import { useRef, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { AvatarCropData } from "@/components/ui/avatar";
import type { Area } from "react-easy-crop";
import { Camera, Crop, Loader2, Trash2 } from "lucide-react";

const ImageCropDialog = dynamic(() => import("@/components/image-crop-dialog"), {
  ssr: false,
});
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface AvatarUploadProps {
  currentAvatar?: string | null;
  currentAvatarCrop?: AvatarCropData | null;
  name: string;
  uploadUrl: string;
  deleteUrl?: string;
  onAvatarChange: (url: string | null, crop: AvatarCropData | null) => void;
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

const sizeClasses = {
  sm: "h-16 w-16",
  md: "h-20 w-20",
  lg: "h-24 w-24",
};

const iconSizeClasses = {
  sm: "h-3.5 w-3.5",
  md: "h-4 w-4",
  lg: "h-5 w-5",
};

function areaToCropData(area: Area): AvatarCropData {
  return { x: area.x, y: area.y, width: area.width, height: area.height };
}

function cropDataToArea(crop: AvatarCropData): Area {
  return { x: crop.x, y: crop.y, width: crop.width, height: crop.height };
}

export function AvatarUpload({
  currentAvatar,
  currentAvatarCrop,
  name,
  uploadUrl,
  deleteUrl,
  onAvatarChange,
  size = "md",
  disabled = false,
}: AvatarUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const pendingFileRef = useRef<File | null>(null);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [cropDialogOpen, setCropDialogOpen] = useState(false);
  const [isRecrop, setIsRecrop] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isLoadingRecrop, setIsLoadingRecrop] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }

    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error("Image must be smaller than 10MB");
      return;
    }

    pendingFileRef.current = file;
    const reader = new FileReader();
    reader.onload = () => {
      setImageSrc(reader.result as string);
      setIsRecrop(false);
      setCropDialogOpen(true);
    };
    reader.readAsDataURL(file);

    e.target.value = "";
  }, []);

  const handleCropSelect = async (croppedArea: Area) => {
    setCropDialogOpen(false);
    const cropData = areaToCropData(croppedArea);

    if (isRecrop) {
      setImageSrc(null);
      setIsUploading(true);
      try {
        const res = await fetch(uploadUrl, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cropData }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Failed to update crop");
        }
        onAvatarChange(currentAvatar ?? null, cropData);
        toast.success("Profile picture updated");
      } catch (error) {
        console.error("Avatar crop update error:", error);
        toast.error(error instanceof Error ? error.message : "Failed to update crop");
      } finally {
        setIsUploading(false);
      }
      return;
    }

    const file = pendingFileRef.current;
    if (!file) return;
    pendingFileRef.current = null;
    setImageSrc(null);
    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("cropData", JSON.stringify(cropData));

      const res = await fetch(uploadUrl, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Upload failed");
      }

      const data = await res.json();
      onAvatarChange(data.url, cropData);
      toast.success("Profile picture updated");
    } catch (error) {
      console.error("Avatar upload error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to upload profile picture");
    } finally {
      setIsUploading(false);
    }
  };

  const handleRecrop = useCallback(async () => {
    if (!currentAvatar || isLoadingRecrop) return;
    setIsLoadingRecrop(true);
    try {
      const res = await fetch(currentAvatar);
      const blob = await res.blob();
      const reader = new FileReader();
      reader.onload = () => {
        setImageSrc(reader.result as string);
        setIsRecrop(true);
        setCropDialogOpen(true);
        setIsLoadingRecrop(false);
      };
      reader.onerror = () => {
        toast.error("Failed to load image for re-cropping");
        setIsLoadingRecrop(false);
      };
      reader.readAsDataURL(blob);
    } catch {
      toast.error("Failed to load image for re-cropping");
      setIsLoadingRecrop(false);
    }
  }, [currentAvatar, isLoadingRecrop]);

  const handleDelete = async () => {
    if (!deleteUrl) return;
    setIsDeleting(true);

    try {
      const res = await fetch(deleteUrl, { method: "DELETE" });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to remove photo");
      }

      onAvatarChange(null, null);
      toast.success("Profile picture removed");
    } catch (error) {
      console.error("Avatar delete error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to remove profile picture");
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const isBusy = isUploading || isDeleting;

  return (
    <>
      <div className="relative group">
        <div
          className={cn("relative cursor-pointer", disabled && "pointer-events-none opacity-50")}
          onClick={() => !isBusy && inputRef.current?.click()}
        >
          <Avatar className={cn(sizeClasses[size], "border-2 border-background shadow-sm")}>
            <AvatarImage
              src={currentAvatar ?? undefined}
              alt={name}
              crop={currentAvatarCrop ?? undefined}
            />
            <AvatarFallback className="text-lg font-bold bg-primary/10 text-primary">
              {getInitials(name)}
            </AvatarFallback>
          </Avatar>
          <div
            className={cn(
              "absolute inset-0 flex items-center justify-center rounded-full",
              "bg-black/50 text-white transition-opacity",
              isBusy ? "opacity-100" : "opacity-0 group-hover:opacity-100"
            )}
          >
            {isBusy ? (
              <Loader2 className={cn(iconSizeClasses[size], "animate-spin")} />
            ) : (
              <Camera className={iconSizeClasses[size]} />
            )}
          </div>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileSelect}
            disabled={isBusy || disabled}
          />
        </div>

        {currentAvatar && !isBusy && (
          // Always visible on touch / small screens; hover-only on ≥sm so the
          // desktop behavior stays clean. (Tailwind v3's `group-hover` fires on
          // touch-tap unreliably, which made these buttons effectively
          // unreachable on phones.)
          <div className="absolute -top-1 -right-1 flex gap-0.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
            <button
              type="button"
              className="p-1 rounded-full bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 disabled:opacity-60"
              title="Re-crop photo"
              aria-label="Re-crop photo"
              disabled={isLoadingRecrop}
              onClick={(e) => {
                e.stopPropagation();
                handleRecrop();
              }}
            >
              {isLoadingRecrop ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Crop className="h-3 w-3" />
              )}
            </button>
            {deleteUrl && (
              <button
                type="button"
                className="p-1 rounded-full bg-destructive text-white shadow-sm hover:bg-destructive/90"
                title="Remove photo"
                aria-label="Remove photo"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowDeleteConfirm(true);
                }}
              >
                <Trash2 className="h-3 w-3" />
              </button>
            )}
          </div>
        )}
      </div>

      {imageSrc && (
        <ImageCropDialog
          open={cropDialogOpen}
          onOpenChange={(open) => {
            setCropDialogOpen(open);
            if (!open) {
              setImageSrc(null);
              pendingFileRef.current = null;
            }
          }}
          imageSrc={imageSrc}
          onCropSelect={handleCropSelect}
          initialCroppedAreaPercentages={
            isRecrop && currentAvatarCrop ? cropDataToArea(currentAvatarCrop) : undefined
          }
          aspect={1}
          cropShape="round"
          title="Crop Profile Picture"
        />
      )}

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove profile picture?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the current profile picture. You can upload a new one at any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Removing...
                </>
              ) : (
                "Remove"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export default AvatarUpload;
