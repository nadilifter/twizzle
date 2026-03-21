"use client";

import { useRef, useState, useCallback } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AvatarCropDialog } from "@/components/avatar-crop-dialog";
import { Camera, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface AvatarUploadProps {
  currentAvatar?: string | null;
  name: string;
  uploadUrl: string;
  onAvatarChange: (url: string | null) => void;
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

export function AvatarUpload({
  currentAvatar,
  name,
  uploadUrl,
  onAvatarChange,
  size = "md",
  disabled = false,
}: AvatarUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [cropDialogOpen, setCropDialogOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      if (!file.type.startsWith("image/")) {
        toast.error("Please select an image file");
        return;
      }

      const maxSize = 10 * 1024 * 1024; // 10MB
      if (file.size > maxSize) {
        toast.error("Image must be smaller than 10MB");
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        setImageSrc(reader.result as string);
        setCropDialogOpen(true);
      };
      reader.readAsDataURL(file);

      // Reset input so the same file can be re-selected
      e.target.value = "";
    },
    []
  );

  const handleCropComplete = async (blob: Blob) => {
    setCropDialogOpen(false);
    setImageSrc(null);
    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", blob, "avatar.jpg");

      const res = await fetch(uploadUrl, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Upload failed");
      }

      const data = await res.json();
      onAvatarChange(data.url);
      toast.success("Profile picture updated");
    } catch (error) {
      console.error("Avatar upload error:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to upload profile picture"
      );
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <>
      <div
        className={cn(
          "relative group cursor-pointer",
          disabled && "pointer-events-none opacity-50"
        )}
        onClick={() => !isUploading && inputRef.current?.click()}
      >
        <Avatar className={cn(sizeClasses[size], "border-2 border-background shadow-sm")}>
          <AvatarImage src={currentAvatar ?? undefined} alt={name} />
          <AvatarFallback className="text-lg font-bold bg-primary/10 text-primary">
            {getInitials(name)}
          </AvatarFallback>
        </Avatar>
        <div
          className={cn(
            "absolute inset-0 flex items-center justify-center rounded-full",
            "bg-black/50 text-white transition-opacity",
            isUploading ? "opacity-100" : "opacity-0 group-hover:opacity-100"
          )}
        >
          {isUploading ? (
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
          disabled={isUploading || disabled}
        />
      </div>

      {imageSrc && (
        <AvatarCropDialog
          open={cropDialogOpen}
          onOpenChange={(open) => {
            setCropDialogOpen(open);
            if (!open) setImageSrc(null);
          }}
          imageSrc={imageSrc}
          onCropComplete={handleCropComplete}
        />
      )}
    </>
  );
}
