"use client";

import { useCallback, useState } from "react";
import Cropper from "react-easy-crop";
import type { Area } from "react-easy-crop";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Loader2, RotateCcw } from "lucide-react";

const MIN_ZOOM = 1;
const MAX_ZOOM = 3;

interface ImageCropDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imageSrc: string;
  onCropComplete?: (blob: Blob) => void;
  onCropSelect?: (croppedArea: Area) => void;
  initialCroppedAreaPercentages?: Area;
  aspect?: number;
  cropShape?: "rect" | "round";
  title?: string;
  maxOutputWidth?: number;
  maxOutputHeight?: number;
}

function createImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new window.Image();
    image.addEventListener("load", () => resolve(image));
    image.addEventListener("error", (error) => reject(error));
    image.setAttribute("crossOrigin", "anonymous");
    image.src = url;
  });
}

async function getCroppedImg(
  imageSrc: string,
  pixelCrop: Area,
  maxWidth: number,
  maxHeight: number
): Promise<Blob> {
  const image = await createImage(imageSrc);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not get canvas context");

  const scale = Math.min(maxWidth / pixelCrop.width, maxHeight / pixelCrop.height, 1);
  canvas.width = Math.round(pixelCrop.width * scale);
  canvas.height = Math.round(pixelCrop.height * scale);

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const sx = Math.max(0, pixelCrop.x);
  const sy = Math.max(0, pixelCrop.y);
  const sx2 = Math.min(image.naturalWidth, pixelCrop.x + pixelCrop.width);
  const sy2 = Math.min(image.naturalHeight, pixelCrop.y + pixelCrop.height);
  const sw = sx2 - sx;
  const sh = sy2 - sy;

  const scaleX = canvas.width / pixelCrop.width;
  const scaleY = canvas.height / pixelCrop.height;
  const dx = (sx - pixelCrop.x) * scaleX;
  const dy = (sy - pixelCrop.y) * scaleY;
  const dw = sw * scaleX;
  const dh = sh * scaleY;

  ctx.drawImage(image, sx, sy, sw, sh, dx, dy, dw, dh);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Canvas toBlob failed"));
      },
      "image/jpeg",
      0.9
    );
  });
}

export function ImageCropDialog({
  open,
  onOpenChange,
  imageSrc,
  onCropComplete,
  onCropSelect,
  initialCroppedAreaPercentages,
  aspect = 3 / 4,
  cropShape = "rect",
  title = "Crop Image",
  maxOutputWidth = 1200,
  maxOutputHeight = 1600,
}: ImageCropDialogProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedArea, setCroppedArea] = useState<Area | null>(null);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleCropComplete = useCallback((area: Area, areaPixels: Area) => {
    setCroppedArea(area);
    setCroppedAreaPixels(areaPixels);
  }, []);

  const handleSave = async () => {
    if (onCropSelect && croppedArea) {
      onCropSelect(croppedArea);
      return;
    }
    if (!onCropComplete || !croppedAreaPixels) return;
    setIsSaving(true);
    try {
      const blob = await getCroppedImg(
        imageSrc,
        croppedAreaPixels,
        maxOutputWidth,
        maxOutputHeight
      );
      onCropComplete(blob);
    } catch (error) {
      console.error("Error cropping image:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedArea(null);
    setCroppedAreaPixels(null);
    onOpenChange(false);
  };

  const isPortrait = aspect < 1;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div
          className={`relative w-full rounded-lg overflow-hidden bg-muted ${
            isPortrait ? "aspect-[3/4]" : "aspect-square"
          }`}
        >
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            minZoom={MIN_ZOOM}
            maxZoom={MAX_ZOOM}
            aspect={aspect}
            cropShape={cropShape}
            showGrid={cropShape === "rect"}
            initialCroppedAreaPercentages={initialCroppedAreaPercentages}
            onCropChange={setCrop}
            onCropComplete={handleCropComplete}
            onZoomChange={setZoom}
          />
        </div>
        <div className="flex items-center gap-3 px-1">
          <span id="zoom-slider-label" className="text-xs text-muted-foreground shrink-0">
            Zoom
          </span>
          <Slider
            value={[zoom]}
            min={MIN_ZOOM}
            max={MAX_ZOOM}
            step={0.1}
            onValueChange={([value]) => setZoom(value)}
            className="flex-1"
            aria-labelledby="zoom-slider-label"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0"
            title="Reset crop"
            aria-label="Reset crop"
            onClick={() => {
              setCrop({ x: 0, y: 0 });
              setZoom(1);
            }}
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving || (!croppedArea && !croppedAreaPixels)}>
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Save"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ImageCropDialog;
