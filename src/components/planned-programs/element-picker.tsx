"use client";

import { useMemo, useState } from "react";
import { Loader2, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { ISU_ELEMENTS, type IsuElement } from "@/../prisma/isu-elements";
import { api, ApiError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const KIND_TABS: Array<{ value: IsuElement["kind"]; label: string }> = [
  { value: "jump", label: "Jumps" },
  { value: "spin", label: "Spins" },
  { value: "stepSequence", label: "Steps" },
  { value: "chorSequence", label: "Chor" },
  { value: "throw", label: "Throws" },
  { value: "lift", label: "Lifts" },
  { value: "deathSpiral", label: "DSpirals" },
];

interface ElementPickerProps {
  programId: string;
  /** Called after a successful add so the parent can refresh the program. */
  onAdded?: () => void;
}

// Side-panel picker that lets a coach pick ISU elements to append to the
// planned program. Tabs by kind, search by code or name (substring match,
// case-insensitive). Click an element row to POST it to the program.
export function ElementPicker({ programId, onAdded }: ElementPickerProps) {
  const [open, setOpen] = useState(false);
  const [activeKind, setActiveKind] = useState<IsuElement["kind"]>("jump");
  const [query, setQuery] = useState("");
  const [addingCode, setAddingCode] = useState<string | null>(null);

  // Pre-group the catalog once.
  const byKind = useMemo(() => {
    const map = new Map<IsuElement["kind"], IsuElement[]>();
    for (const e of ISU_ELEMENTS) {
      const arr = map.get(e.kind) ?? [];
      arr.push(e);
      map.set(e.kind, arr);
    }
    return map;
  }, []);

  // Search filter — applied to the active kind. Matches both the code
  // ("3T", "FSSp4") and the readable name ("Triple Toe Loop") substring.
  const visible = useMemo(() => {
    const all = byKind.get(activeKind) ?? [];
    const q = query.trim().toLowerCase();
    if (!q) return all;
    return all.filter((e) => e.code.toLowerCase().includes(q) || e.name.toLowerCase().includes(q));
  }, [byKind, activeKind, query]);

  const handleAdd = async (element: IsuElement) => {
    setAddingCode(element.code);
    try {
      await api.post(`/api/planned-programs/${programId}/elements`, {
        elementCode: element.code,
      });
      toast.success(`Added ${element.code} — ${element.name}`);
      onAdded?.();
      // Keep the sheet open so the user can keep adding without re-opening.
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to add element");
    } finally {
      setAddingCode(null);
    }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button>
          <Plus className="h-4 w-4" />
          Add element
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-md flex flex-col p-0">
        <SheetHeader className="p-6 pb-4 space-y-1">
          <SheetTitle>Add element</SheetTitle>
          <SheetDescription>
            Click an element to append it to the program. Picker stays open so you can add several
            in a row.
          </SheetDescription>
        </SheetHeader>

        <div className="px-6 pb-3">
          <div className="relative">
            <Search className="h-4 w-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search by code (3T, FSSp4) or name…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-8"
            />
          </div>
        </div>

        <Tabs
          value={activeKind}
          onValueChange={(v) => setActiveKind(v as IsuElement["kind"])}
          className="flex flex-col flex-1 min-h-0"
        >
          <TabsList className="mx-6 grid grid-cols-4 lg:grid-cols-7 h-auto">
            {KIND_TABS.map((t) => (
              <TabsTrigger key={t.value} value={t.value} className="text-xs px-1.5">
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {KIND_TABS.map((t) => (
            <TabsContent
              key={t.value}
              value={t.value}
              className="flex-1 min-h-0 overflow-y-auto mx-0 mt-3 px-6 pb-6"
            >
              {visible.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  No matches for &ldquo;{query}&rdquo; in {t.label.toLowerCase()}.
                </p>
              ) : (
                <ul className="space-y-1">
                  {visible.map((e) => {
                    const isAdding = addingCode === e.code;
                    return (
                      <li key={e.code}>
                        <button
                          type="button"
                          onClick={() => handleAdd(e)}
                          disabled={isAdding}
                          className="w-full flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-left text-sm hover:bg-muted/50 disabled:opacity-50 disabled:pointer-events-none transition-colors"
                        >
                          <span className="flex items-center gap-3 min-w-0">
                            <span className="font-mono font-medium text-xs w-12 shrink-0">
                              {e.code}
                            </span>
                            <span className="truncate">{e.name}</span>
                          </span>
                          <span className="flex items-center gap-2 shrink-0">
                            <span className="font-mono text-xs text-muted-foreground">
                              {e.baseValue.toFixed(2)}
                            </span>
                            {isAdding ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Plus className="h-3.5 w-3.5 text-muted-foreground" />
                            )}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </TabsContent>
          ))}
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
