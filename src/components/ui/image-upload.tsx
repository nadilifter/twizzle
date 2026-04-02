import React, { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, X } from "lucide-react";
import Image from "next/image";

interface ImageUploadProps {
  label: string;
  value?: string | null;
  onChange: (url: string | null) => void;
  type: "logo" | "favicon" | "hero" | "program" | "product" | "team" | "category";
  required?: boolean;
}

export function ImageUpload({ label, value, onChange, type, required = false }: ImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("type", type);

    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error("Upload failed");

      const data = await res.json();
      onChange(data.url);
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Failed to upload image. Please try again.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <Label>
        {label}
        {required ? (
          <span className="text-destructive ml-1">*</span>
        ) : (
          <span className="text-muted-foreground ml-1 text-xs font-normal">(Optional)</span>
        )}
      </Label>
      <div className="flex items-start gap-4">
        {value ? (
          <div className="relative group">
            <div className="relative w-32 h-32 border rounded-md overflow-hidden bg-muted flex items-center justify-center">
              <Image src={value} alt={label} fill className="object-contain" sizes="128px" />
            </div>
            <Button
              type="button"
              variant="destructive"
              size="icon"
              className="absolute -top-2 -right-2 w-6 h-6 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={() => onChange(null)}
            >
              <X className="w-3 h-3" />
            </Button>
          </div>
        ) : (
          <div
            className="w-32 h-32 border-2 border-dashed rounded-md flex flex-col items-center justify-center gap-2 text-muted-foreground bg-muted/50 hover:bg-muted cursor-pointer transition-colors"
            onClick={() => inputRef.current?.click()}
          >
            <Upload className="w-6 h-6" />
            <span className="text-xs">Upload</span>
          </div>
        )}
        <div className="flex flex-col gap-2">
          <Input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleUpload}
            disabled={isUploading}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => inputRef.current?.click()}
            disabled={isUploading}
          >
            {isUploading ? "Uploading..." : "Select Image"}
          </Button>
          <p className="text-xs text-muted-foreground">
            Recommended:{" "}
            {type === "favicon"
              ? "32x32px"
              : type === "logo"
                ? "Transparent PNG"
                : type === "program"
                  ? "Landscape, 800×450px"
                  : type === "product"
                    ? "Square, 800×800px"
                    : type === "team"
                      ? "Portrait, 600×800px"
                      : type === "category"
                        ? "Landscape, 800×450px"
                        : "1920x1080px"}
          </p>
        </div>
      </div>
    </div>
  );
}
