"use client";

import { useMemo, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { levelSearchKeywords } from "@/lib/evaluation-search";
import { cn } from "@/lib/utils";

interface LevelOption {
  id: string;
  name: string;
  color?: string | null;
}

interface LevelComboboxProps {
  levels: LevelOption[];
  value: string; // empty string = "no level"
  onValueChange: (id: string) => void;
  placeholder?: string;
  /** Below this threshold, fall back to a plain Select (search adds no value). */
  searchThreshold?: number;
  /** id for the trigger button (mirrors plain Select's id prop). */
  id?: string;
  className?: string;
}

const SEARCH_THRESHOLD = 8;
const NONE_VALUE = "__none__";

/**
 * Searchable Level dropdown. Mirrors TemplatePicker's behavior:
 *
 * - Below ~8 options, renders a plain Select (a combobox is overkill).
 * - Above the threshold, renders a Popover + cmdk Command with
 *   shorthand-aware filtering (`cs3`, `star5`, `precs`) sourced from
 *   `levelSearchKeywords`.
 *
 * Empty `value` represents "No level" (the existing convention in the
 * evaluations page). The combobox includes a "No level" item at the top.
 */
export function LevelCombobox({
  levels,
  value,
  onValueChange,
  placeholder = "Select a level",
  searchThreshold = SEARCH_THRESHOLD,
  id,
  className,
}: LevelComboboxProps) {
  const [open, setOpen] = useState(false);

  const selected = useMemo(() => levels.find((l) => l.id === value) ?? null, [levels, value]);

  // ---- Small list: plain Select ----
  if (levels.length <= searchThreshold) {
    return (
      <Select
        value={value || NONE_VALUE}
        onValueChange={(v) => onValueChange(v === NONE_VALUE ? "" : v)}
      >
        <SelectTrigger id={id} className={className}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE_VALUE}>No level</SelectItem>
          {levels.map((level) => (
            <SelectItem key={level.id} value={level.id}>
              {level.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  // ---- Large list: cmdk-backed combobox with shorthand search ----
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between font-normal", className)}
        >
          {selected ? (
            <span className="flex items-center gap-2 truncate">
              {selected.color && (
                <span
                  className="inline-block h-2 w-2 rounded-full shrink-0"
                  style={{ backgroundColor: selected.color }}
                />
              )}
              <span className="truncate">{selected.name}</span>
            </span>
          ) : value === "" ? (
            <span className="truncate">No level</span>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[--radix-popover-trigger-width] p-0"
        align="start"
        sideOffset={4}
      >
        <Command
          // AND-tokenized substring across cmdk's default value + keywords.
          // Same matcher TemplatePicker uses — keeps shorthand semantics
          // identical across both surfaces.
          filter={(itemValue, search, keywords) => {
            const haystack = [itemValue, ...(keywords ?? [])].join(" ").toLowerCase();
            const needle = search.toLowerCase().trim();
            if (!needle) return 1;
            const terms = needle.split(/\s+/).filter(Boolean);
            return terms.every((t) => haystack.includes(t)) ? 1 : 0;
          }}
        >
          <CommandInput placeholder="Search levels..." />
          <CommandList>
            <CommandEmpty>No matches.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value={NONE_VALUE}
                keywords={["no level", "none"]}
                onSelect={() => {
                  onValueChange("");
                  setOpen(false);
                }}
              >
                <span className="flex-1 truncate text-muted-foreground">No level</span>
                {value === "" && <Check className="ml-2 h-4 w-4 shrink-0" />}
              </CommandItem>
              {levels.map((level) => (
                <CommandItem
                  key={level.id}
                  value={level.id}
                  keywords={levelSearchKeywords(level.name)}
                  onSelect={(v) => {
                    onValueChange(v);
                    setOpen(false);
                  }}
                >
                  <span className="flex items-center gap-2 flex-1 truncate">
                    {level.color && (
                      <span
                        className="inline-block h-2 w-2 rounded-full shrink-0"
                        style={{ backgroundColor: level.color }}
                      />
                    )}
                    <span className="truncate">{level.name}</span>
                  </span>
                  {value === level.id && <Check className="ml-2 h-4 w-4 shrink-0" />}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
