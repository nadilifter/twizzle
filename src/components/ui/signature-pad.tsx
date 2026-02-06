"use client";

import React, { useRef, useEffect, useCallback, useState } from "react";
import SignaturePadLib from "signature_pad";
import { Button } from "@/components/ui/button";
import { Eraser } from "lucide-react";
import { cn } from "@/lib/utils";

interface SignaturePadProps {
  onSignatureChange?: (isEmpty: boolean) => void;
  width?: number;
  height?: number;
  className?: string;
  disabled?: boolean;
}

export interface SignaturePadRef {
  toDataURL: () => string;
  isEmpty: () => boolean;
  clear: () => void;
}

export const SignaturePad = React.forwardRef<SignaturePadRef, SignaturePadProps>(
  ({ onSignatureChange, width, height = 200, className, disabled = false }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const signaturePadRef = useRef<SignaturePadLib | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [canvasWidth, setCanvasWidth] = useState(width || 600);

    // Resize canvas to fit container
    const resizeCanvas = useCallback(() => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;

      const ratio = Math.max(window.devicePixelRatio || 1, 1);
      const containerWidth = width || container.offsetWidth;
      setCanvasWidth(containerWidth);

      canvas.width = containerWidth * ratio;
      canvas.height = height * ratio;
      canvas.style.width = `${containerWidth}px`;
      canvas.style.height = `${height}px`;

      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.scale(ratio, ratio);
      }

      // Clear after resize to avoid distorted content
      if (signaturePadRef.current) {
        signaturePadRef.current.clear();
      }
    }, [width, height]);

    // Initialize signature pad
    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      // Detect dark mode to set canvas colors appropriately
      const isDark = document.documentElement.classList.contains("dark");
      const bgColor = isDark ? "rgb(30, 30, 30)" : "rgb(255, 255, 255)";
      const penClr = isDark ? "rgb(255, 255, 255)" : "rgb(0, 0, 0)";

      signaturePadRef.current = new SignaturePadLib(canvas, {
        backgroundColor: bgColor,
        penColor: penClr,
      });

      if (disabled) {
        signaturePadRef.current.off();
      }

      signaturePadRef.current.addEventListener("endStroke", () => {
        onSignatureChange?.(signaturePadRef.current?.isEmpty() ?? true);
      });

      resizeCanvas();

      return () => {
        signaturePadRef.current?.off();
      };
    }, [disabled, onSignatureChange, resizeCanvas]);

    // Handle window resize
    useEffect(() => {
      if (width) return; // Skip if explicit width is provided
      const handleResize = () => resizeCanvas();
      window.addEventListener("resize", handleResize);
      return () => window.removeEventListener("resize", handleResize);
    }, [width, resizeCanvas]);

    // Expose methods via ref
    React.useImperativeHandle(ref, () => ({
      toDataURL: () => {
        return signaturePadRef.current?.toDataURL("image/png") || "";
      },
      isEmpty: () => {
        return signaturePadRef.current?.isEmpty() ?? true;
      },
      clear: () => {
        signaturePadRef.current?.clear();
        onSignatureChange?.(true);
      },
    }));

    const handleClear = () => {
      signaturePadRef.current?.clear();
      onSignatureChange?.(true);
    };

    return (
      <div ref={containerRef} className={cn("w-full", className)}>
        <div className="relative border rounded-md overflow-hidden">
          <canvas
            ref={canvasRef}
            style={{ width: canvasWidth, height }}
            className="touch-none cursor-crosshair"
          />
          {/* Signature line */}
          <div
            className="absolute bottom-10 left-8 right-8 border-b border-muted-foreground/30"
            style={{ pointerEvents: "none" }}
          />
          <p
            className="absolute bottom-3 left-8 text-xs text-muted-foreground/50"
            style={{ pointerEvents: "none" }}
          >
            Sign above
          </p>
          {!disabled && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="absolute top-2 right-2 h-8 w-8 p-0"
              onClick={handleClear}
              title="Clear signature"
            >
              <Eraser className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    );
  }
);

SignaturePad.displayName = "SignaturePad";
