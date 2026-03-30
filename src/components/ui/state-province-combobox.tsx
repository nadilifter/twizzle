"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Check, ChevronsUpDown } from "lucide-react";

import { getRegionsForCountry } from "@/lib/location-data";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface StateProvinceComboboxProps {
  country: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  error?: boolean;
}

/**
 * Searchable combobox for US states / CA provinces with a fallback
 * text input for other countries. Includes a hidden <input> with
 * autocomplete="address-level1" so browser autofill and password
 * managers (1Password, etc.) can populate the field automatically.
 */
export function StateProvinceCombobox({
  country,
  value,
  onChange,
  disabled,
  error,
}: StateProvinceComboboxProps) {
  const [open, setOpen] = useState(false);
  const autofillRef = useRef<HTMLInputElement>(null);
  const regions = getRegionsForCountry(country);

  const matchRegion = useCallback(
    (raw: string) => {
      if (!raw || regions.length === 0) return null;
      const trimmed = raw.trim();
      const lower = trimmed.toLowerCase();
      const byCode = regions.find((r) => r.code.toLowerCase() === lower);
      if (byCode) return byCode.code;
      const byName = regions.find((r) => r.name.toLowerCase() === lower);
      if (byName) return byName.code;
      return null;
    },
    [regions]
  );

  useEffect(() => {
    const el = autofillRef.current;
    if (!el) return;

    const sync = () => {
      const val = el.value;
      if (!val) return;
      const matched = matchRegion(val);
      if (matched) onChange(matched);
      el.value = "";
    };

    el.addEventListener("input", sync);
    el.addEventListener("change", sync);

    // Some browsers don't fire events on autofill; poll as a fallback.
    const interval = setInterval(() => {
      if (el.value) sync();
    }, 1000);

    return () => {
      el.removeEventListener("input", sync);
      el.removeEventListener("change", sync);
      clearInterval(interval);
    };
  }, [matchRegion, onChange]);

  if (regions.length === 0) {
    return (
      <Input
        autoComplete="address-level1"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        maxLength={2}
        placeholder="e.g. NY"
        className={error ? "border-destructive" : ""}
      />
    );
  }

  return (
    <div className="relative">
      <input
        ref={autofillRef}
        autoComplete="address-level1"
        name="state"
        tabIndex={-1}
        aria-hidden="true"
        className="absolute inset-0 w-full h-full opacity-0 pointer-events-none"
      />
      <Popover open={open} onOpenChange={disabled ? undefined : setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className={cn(
              "w-full justify-between font-normal",
              !value && "text-muted-foreground",
              error && "border-destructive"
            )}
          >
            {value
              ? (regions.find((r) => r.code === value)?.name ?? value)
              : `Select ${country === "CA" ? "province" : "state"}...`}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command>
            <CommandInput placeholder={`Search ${country === "CA" ? "provinces" : "states"}...`} />
            <CommandList>
              <CommandEmpty>No results found.</CommandEmpty>
              <CommandGroup>
                {regions.map((region) => (
                  <CommandItem
                    key={region.code}
                    value={region.name}
                    onSelect={() => {
                      onChange(region.code);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === region.code ? "opacity-100" : "opacity-0"
                      )}
                    />
                    {region.name}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
