"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { X, Plus } from "lucide-react";
import { useState } from "react";
import {
  FILE_PRESETS,
  type FilePresetKey,
  type FileRequirementConfig,
  resolveAcceptedExtensions,
  isKnownExtension,
} from "@/types/file-requirements";

interface FileRequirementConfigEditorProps {
  config: FileRequirementConfig;
  onChange: (config: FileRequirementConfig) => void;
}

const PRESET_KEYS = Object.keys(FILE_PRESETS) as FilePresetKey[];

export function FileRequirementConfigEditor({
  config,
  onChange,
}: FileRequirementConfigEditorProps) {
  const [newExtension, setNewExtension] = useState("");
  const [extensionError, setExtensionError] = useState<string | null>(null);

  const togglePreset = (preset: FilePresetKey) => {
    const current = config.acceptedPresets || [];
    const updated = current.includes(preset)
      ? current.filter((p) => p !== preset)
      : [...current, preset];
    onChange({ ...config, acceptedPresets: updated });
  };

  const addExtension = () => {
    const ext = newExtension.trim().toLowerCase();
    if (!ext) return;
    const normalized = ext.startsWith(".") ? ext : `.${ext}`;

    if (!/^\.[a-z0-9]{1,10}$/.test(normalized)) {
      setExtensionError("Enter a valid extension like .mp3 or .pdf");
      return;
    }

    if (!isKnownExtension(normalized)) {
      setExtensionError(`"${normalized}" is not a recognized file type`);
      return;
    }

    if (config.acceptedExtensions.includes(normalized)) {
      setExtensionError(`"${normalized}" is already added`);
      return;
    }

    setExtensionError(null);
    onChange({
      ...config,
      acceptedExtensions: [...config.acceptedExtensions, normalized],
    });
    setNewExtension("");
  };

  const removeExtension = (ext: string) => {
    onChange({
      ...config,
      acceptedExtensions: config.acceptedExtensions.filter((e) => e !== ext),
    });
  };

  const allAccepted = resolveAcceptedExtensions(config);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="file-req-label">Requirement Label</Label>
        <Input
          id="file-req-label"
          placeholder="e.g. Routine Music"
          value={config.label}
          onChange={(e) => onChange({ ...config, label: e.target.value })}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="file-req-desc">Description (optional)</Label>
        <Textarea
          id="file-req-desc"
          placeholder="Instructions for the registrant, e.g. 'Upload your routine music (max 4 minutes)'"
          value={config.description || ""}
          onChange={(e) => onChange({ ...config, description: e.target.value || undefined })}
          rows={2}
        />
      </div>

      <div className="space-y-2">
        <Label>Accepted File Types</Label>
        <div className="grid grid-cols-2 gap-3">
          {PRESET_KEYS.map((key) => {
            const preset = FILE_PRESETS[key];
            const isChecked = config.acceptedPresets.includes(key);
            return (
              <label key={key} className="flex items-start gap-2 cursor-pointer">
                <Checkbox checked={isChecked} onCheckedChange={() => togglePreset(key)} />
                <div className="space-y-0.5">
                  <span className="text-sm font-medium">{preset.label}</span>
                  <p className="text-xs text-muted-foreground">{preset.extensions.join(", ")}</p>
                </div>
              </label>
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        <Label>Additional File Extensions</Label>
        <div className="flex gap-2">
          <Input
            placeholder=".mp3"
            value={newExtension}
            onChange={(e) => {
              setNewExtension(e.target.value);
              if (extensionError) setExtensionError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addExtension();
              }
            }}
            className="max-w-[120px]"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addExtension}
            disabled={!newExtension.trim()}
          >
            <Plus className="h-4 w-4 mr-1" />
            Add
          </Button>
        </div>
        {extensionError && <p className="text-xs text-destructive">{extensionError}</p>}
        {config.acceptedExtensions.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-1">
            {config.acceptedExtensions.map((ext) => (
              <Badge
                key={ext}
                variant="secondary"
                className="gap-1 cursor-pointer"
                onClick={() => removeExtension(ext)}
              >
                {ext}
                <X className="h-3 w-3" />
              </Badge>
            ))}
          </div>
        )}
      </div>

      {allAccepted.length > 0 && (
        <div className="rounded-md bg-muted p-3">
          <p className="text-xs font-medium text-muted-foreground mb-1">All accepted extensions:</p>
          <div className="flex flex-wrap gap-1">
            {allAccepted.map((ext) => (
              <Badge key={ext} variant="outline" className="text-xs">
                {ext}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
