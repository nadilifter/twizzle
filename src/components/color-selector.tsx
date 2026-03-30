"use client";

import { Check, Palette } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { COLOR_PRESETS } from "@/lib/color-presets";

interface ColorSelectorProps {
  value: string;
  onChange: (color: string) => void;
  label?: string;
}

export function ColorSelector({ value, onChange, label = "Color" }: ColorSelectorProps) {
  return (
    <div className="grid gap-2">
      <Label>{label}</Label>
      <div className="flex flex-wrap gap-2">
        {COLOR_PRESETS.map((color) => (
          <button
            key={color}
            type="button"
            className="w-8 h-8 rounded-full border-2 flex items-center justify-center transition-transform hover:scale-110"
            style={{
              backgroundColor: color,
              borderColor: value === color ? "white" : "transparent",
              boxShadow: value === color ? `0 0 0 2px ${color}` : "none",
            }}
            onClick={() => onChange(color)}
          >
            {value === color && <Check className="h-4 w-4 text-white" />}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2 mt-2">
        <Palette className="h-4 w-4 text-muted-foreground" />
        <Input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-12 h-8 p-1 cursor-pointer"
        />
        <span className="text-sm text-muted-foreground">{value}</span>
      </div>
    </div>
  );
}
