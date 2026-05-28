"use client";

import { useMemo, useState } from "react";
import { Award, Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RIBBON_DIMENSION_STYLE } from "@/lib/canskate-ribbons";
import { cn } from "@/lib/utils";
import type { EvaluationTemplateWithSkills } from "@/types/evaluations";

/**
 * Threshold above which the picker swaps from a plain Select to a searchable
 * combobox. With the full Skate Canada catalog seeded (~66 templates per org)
 * the flat dropdown is unusable; under ~14 templates a plain Select is
 * actually nicer to use.
 */
const SEARCH_THRESHOLD = 14;

interface TemplatePickerProps {
  templates: EvaluationTemplateWithSkills[];
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  loading?: boolean;
  /** Override the default search threshold for testing/edge cases. */
  searchThreshold?: number;
}

interface SortedGroups {
  ribbons: EvaluationTemplateWithSkills[];
  others: EvaluationTemplateWithSkills[];
}

const DIM_ORDER: Record<string, number> = {
  Balance: 0,
  Control: 1,
  Agility: 2,
  Achievement: 0,
};

function groupAndSort(templates: EvaluationTemplateWithSkills[]): SortedGroups {
  const ribbons: EvaluationTemplateWithSkills[] = [];
  const others: EvaluationTemplateWithSkills[] = [];
  for (const t of templates) {
    if (t.ribbonMeta) ribbons.push(t);
    else others.push(t);
  }
  ribbons.sort((a, b) => {
    const sa = a.ribbonMeta!.stage;
    const sb = b.ribbonMeta!.stage;
    if (sa !== sb) return sa - sb;
    return (DIM_ORDER[a.ribbonMeta!.dimension] ?? 99) - (DIM_ORDER[b.ribbonMeta!.dimension] ?? 99);
  });
  others.sort((a, b) => a.name.localeCompare(b.name));
  return { ribbons, others };
}

export function TemplatePicker({
  templates,
  value,
  onValueChange,
  placeholder = "Select a template...",
  loading = false,
  searchThreshold = SEARCH_THRESHOLD,
}: TemplatePickerProps) {
  const [open, setOpen] = useState(false);
  const grouped = useMemo(() => groupAndSort(templates), [templates]);
  const useSearchable = templates.length > searchThreshold;

  const selected = useMemo(() => templates.find((t) => t.id === value) ?? null, [templates, value]);

  // ---- Small list: use the plain Select for the simple case ----
  if (!useSearchable) {
    return (
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {loading ? (
            <SelectItem value="loading" disabled>
              Loading...
            </SelectItem>
          ) : templates.length === 0 ? (
            <SelectItem value="none" disabled>
              No templates found
            </SelectItem>
          ) : (
            <>
              {grouped.ribbons.length > 0 && (
                <SelectGroup>
                  <SelectLabel className="flex items-center gap-1.5">
                    <Award className="h-3.5 w-3.5" />
                    CanSkate Ribbons ({grouped.ribbons.length})
                  </SelectLabel>
                  {grouped.ribbons.map((t) => {
                    const style = RIBBON_DIMENSION_STYLE[t.ribbonMeta!.dimension];
                    return (
                      <SelectItem key={t.id} value={t.id}>
                        <span className="flex items-center gap-2">
                          <span
                            className={cn("inline-block h-2 w-2 rounded-full shrink-0", style.dot)}
                          />
                          <span className="font-medium">{t.ribbonMeta!.label}</span>
                          <span className="text-muted-foreground text-xs">
                            ({t.skills.length} goals)
                          </span>
                        </span>
                      </SelectItem>
                    );
                  })}
                </SelectGroup>
              )}
              {grouped.ribbons.length > 0 && grouped.others.length > 0 && <SelectSeparator />}
              {grouped.others.length > 0 && (
                <SelectGroup>
                  {grouped.ribbons.length > 0 && <SelectLabel>Other templates</SelectLabel>}
                  {grouped.others.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name} ({t.skills.length} skills)
                    </SelectItem>
                  ))}
                </SelectGroup>
              )}
            </>
          )}
        </SelectContent>
      </Select>
    );
  }

  // ---- Large list: searchable combobox ----
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          {selected ? (
            <span className="flex items-center gap-2 truncate">
              {selected.ribbonMeta && (
                <span
                  className={cn(
                    "inline-block h-2 w-2 rounded-full shrink-0",
                    RIBBON_DIMENSION_STYLE[selected.ribbonMeta.dimension].dot
                  )}
                />
              )}
              <span className="truncate">
                {selected.ribbonMeta ? selected.ribbonMeta.label : selected.name}
              </span>
              <span className="text-muted-foreground text-xs">
                ({selected.skills.length} {selected.ribbonMeta ? "goals" : "skills"})
              </span>
            </span>
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
          // Substring AND-match across value + keywords. Predictable for a
          // domain with overlapping vocabulary (STAR / freeskate / pattern
          // dance share many letters and the default fuzzy matcher returned
          // unrelated items).
          filter={(value, search, keywords) => {
            const haystack = [value, ...(keywords ?? [])].join(" ").toLowerCase();
            const needle = search.toLowerCase().trim();
            if (!needle) return 1;
            const terms = needle.split(/\s+/).filter(Boolean);
            return terms.every((t) => haystack.includes(t)) ? 1 : 0;
          }}
        >
          <CommandInput placeholder="Search templates..." />
          <CommandList>
            {loading ? (
              <CommandEmpty>Loading...</CommandEmpty>
            ) : templates.length === 0 ? (
              <CommandEmpty>No templates found.</CommandEmpty>
            ) : (
              <CommandEmpty>No matches.</CommandEmpty>
            )}

            {grouped.ribbons.length > 0 && (
              <CommandGroup
                heading={
                  <span className="flex items-center gap-1.5">
                    <Award className="h-3.5 w-3.5" />
                    CanSkate Ribbons ({grouped.ribbons.length})
                  </span>
                }
              >
                {grouped.ribbons.map((t) => {
                  const meta = t.ribbonMeta!;
                  const style = RIBBON_DIMENSION_STYLE[meta.dimension];
                  // value = template id (unique, sent back via onSelect).
                  // keywords add the searchable terms (short label, ribbon
                  // dimension, "canskate", full name, description). cmdk
                  // fuzzy-matches across all of them.
                  return (
                    <CommandItem
                      key={t.id}
                      value={t.id}
                      keywords={[
                        t.name,
                        meta.label,
                        meta.shortLabel,
                        `CanSkate ${meta.stage}`,
                        `Stage ${meta.stage}`,
                        meta.dimension,
                        "canskate",
                        "ribbon",
                      ]}
                      onSelect={(v) => {
                        onValueChange(v);
                        setOpen(false);
                      }}
                    >
                      <span className="flex items-center gap-2 flex-1 min-w-0">
                        <span
                          className={cn("inline-block h-2 w-2 rounded-full shrink-0", style.dot)}
                        />
                        <span className="font-medium truncate">{meta.label}</span>
                        <span className="text-muted-foreground text-xs shrink-0">
                          ({t.skills.length} goals)
                        </span>
                      </span>
                      {t.id === value && <Check className="ml-2 h-4 w-4 shrink-0" />}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            )}

            {grouped.ribbons.length > 0 && grouped.others.length > 0 && <CommandSeparator />}

            {grouped.others.length > 0 && (
              <CommandGroup heading="STAR test sheets & other templates">
                {grouped.others.map((t) => (
                  <CommandItem
                    key={t.id}
                    value={t.id}
                    keywords={[t.name, t.description ?? ""]}
                    onSelect={(v) => {
                      onValueChange(v);
                      setOpen(false);
                    }}
                  >
                    <span className="flex-1 truncate">{t.name}</span>
                    <span className="text-muted-foreground text-xs ml-2 shrink-0">
                      {t.skills.length} skills
                    </span>
                    {t.id === value && <Check className="ml-2 h-4 w-4 shrink-0" />}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
