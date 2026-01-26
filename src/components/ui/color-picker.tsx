import React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ColorPickerProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
}

export function ColorPicker({ label, value, onChange }: ColorPickerProps) {
  return (
    <div className="flex flex-col gap-2">
      <Label>{label}</Label>
      <div className="flex items-center gap-2">
        <div 
            className="w-10 h-10 rounded-full border shadow-sm" 
            style={{ backgroundColor: value }}
        />
        <Input 
            type="color" 
            value={value} 
            onChange={(e) => onChange(e.target.value)} 
            className="w-full h-10 p-1 cursor-pointer"
        />
        <Input 
            type="text" 
            value={value} 
            onChange={(e) => onChange(e.target.value)} 
            className="w-32 font-mono"
            placeholder="#000000"
        />
      </div>
    </div>
  );
}
