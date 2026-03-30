"use client";

import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface GLCodeOption {
  id: string;
  code: string;
  description: string;
  type: string;
  isDefault: boolean;
  defaultForType: string | null;
}

const TYPE_COLORS: Record<string, string> = {
  REVENUE: "bg-emerald-500 text-white",
  EXPENSE: "bg-rose-500 text-white",
  LIABILITY: "bg-amber-500 text-white",
  ASSET: "bg-blue-500 text-white",
  EQUITY: "bg-purple-500 text-white",
};

// Entity types that generate revenue -- only show REVENUE GL codes for these
const REVENUE_ENTITY_TYPES = new Set<string>([
  "PROGRAM",
  "EVENT",
  "COMPETITION",
  "MEMBERSHIP",
  "PASS",
  "PRODUCT",
]);

interface GLCodeSelectorProps {
  value: string | null | undefined;
  onChange: (value: string | null) => void;
  entityType?: "PROGRAM" | "EVENT" | "COMPETITION" | "MEMBERSHIP" | "PASS" | "PRODUCT";
  label?: string;
  className?: string;
}

export function GLCodeSelector({
  value,
  onChange,
  entityType,
  label = "GL Code",
  className,
}: GLCodeSelectorProps) {
  const [glCodes, setGlCodes] = useState<GLCodeOption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/ledgers?status=ACTIVE&limit=200")
      .then((res) => res.json())
      .then((data) => {
        setGlCodes(data.data || []);

        // Auto-select the default for this entity type if no value is set
        if (!value && entityType) {
          const defaultCode = (data.data || []).find(
            (c: GLCodeOption) => c.isDefault && c.defaultForType === entityType
          );
          if (defaultCode) {
            onChange(defaultCode.id);
          }
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityType]);

  if (loading) {
    return (
      <div className={className}>
        <Label className="text-muted-foreground">{label}</Label>
        <div className="h-9 rounded-md border bg-muted animate-pulse mt-1" />
      </div>
    );
  }

  // For revenue-generating entities, only show REVENUE GL codes
  const filterByType = entityType && REVENUE_ENTITY_TYPES.has(entityType);
  const filtered = filterByType ? glCodes.filter((c) => c.type === "REVENUE") : glCodes;

  // Sort: default for this entity type first, then other defaults, then the rest
  const sorted = [...filtered].sort((a, b) => {
    const aIsDefault = a.isDefault && a.defaultForType === entityType;
    const bIsDefault = b.isDefault && b.defaultForType === entityType;
    if (aIsDefault && !bIsDefault) return -1;
    if (!aIsDefault && bIsDefault) return 1;
    return a.code.localeCompare(b.code);
  });

  return (
    <div className={className}>
      <Label>{label}</Label>
      <Select value={value || "none"} onValueChange={(v) => onChange(v === "none" ? null : v)}>
        <SelectTrigger className="mt-1">
          <SelectValue placeholder="Select GL code..." />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">
            <span className="text-muted-foreground">No GL code (uses default)</span>
          </SelectItem>
          {sorted.map((code) => (
            <SelectItem key={code.id} value={code.id}>
              <span className="flex items-center gap-2">
                <span className="font-mono text-xs">{code.code}</span>
                <span className="text-muted-foreground">-</span>
                <span>{code.description}</span>
                <Badge className={`${TYPE_COLORS[code.type] || ""} text-[10px] px-1.5 py-0`}>
                  {code.type.charAt(0) + code.type.slice(1).toLowerCase()}
                </Badge>
                {code.isDefault && code.defaultForType === entityType && (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                    Default
                  </Badge>
                )}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
