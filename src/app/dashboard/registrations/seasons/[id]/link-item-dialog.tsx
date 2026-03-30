"use client";

import * as React from "react";
import { toast } from "sonner";
import { Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface LinkableItem {
  id: string;
  name: string;
}

interface LinkItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  seasonId: string;
  type: "program" | "membership" | "competition";
  onLinked: () => void;
}

const TYPE_CONFIG = {
  program: { label: "Program", plural: "Programs", endpoint: "/api/programs" },
  membership: { label: "Membership", plural: "Memberships", endpoint: "/api/memberships" },
  competition: { label: "Competition", plural: "Competitions", endpoint: "/api/competitions" },
} as const;

export function LinkItemDialog({
  open,
  onOpenChange,
  seasonId,
  type,
  onLinked,
}: LinkItemDialogProps) {
  const config = TYPE_CONFIG[type];
  const [items, setItems] = React.useState<LinkableItem[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [linking, setLinking] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [selectedId, setSelectedId] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) {
      setItems([]);
      setSearch("");
      setSelectedId(null);
      return;
    }

    const fetchItems = async () => {
      setLoading(true);
      try {
        const res = await fetch(`${config.endpoint}?limit=200`);
        if (res.ok) {
          const data = await res.json();
          const all: LinkableItem[] = (data.data ?? []).map((item: any) => ({
            id: item.id,
            name: item.name,
            seasonId: item.seasonId,
          }));
          setItems(all.filter((item: any) => !item.seasonId));
        }
      } catch {
        toast.error(`Failed to load ${config.plural.toLowerCase()}`);
      } finally {
        setLoading(false);
      }
    };

    fetchItems();
  }, [open, config.endpoint, config.plural]);

  const filteredItems = React.useMemo(() => {
    if (!search) return items;
    const q = search.toLowerCase();
    return items.filter((item) => item.name.toLowerCase().includes(q));
  }, [items, search]);

  const handleLink = async () => {
    if (!selectedId) return;
    setLinking(true);
    try {
      const res = await fetch(`/api/seasons/${seasonId}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, itemId: selectedId }),
      });
      if (res.ok) {
        toast.success(`${config.label} added to season`);
        onLinked();
        onOpenChange(false);
      } else {
        const err = await res.json();
        toast.error(err.error || `Failed to add ${config.label.toLowerCase()}`);
      }
    } catch {
      toast.error(`Failed to add ${config.label.toLowerCase()}`);
    } finally {
      setLinking(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Add {config.label}</DialogTitle>
          <DialogDescription>
            Select an existing {config.label.toLowerCase()} to link to this season.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={`Search ${config.plural.toLowerCase()}...`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <ScrollArea className="h-[280px] rounded-md border">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                {items.length === 0
                  ? `No unlinked ${config.plural.toLowerCase()} available`
                  : "No results match your search"}
              </div>
            ) : (
              <div className="p-1">
                {filteredItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setSelectedId(item.id === selectedId ? null : item.id)}
                    className={cn(
                      "w-full text-left px-3 py-2 rounded-md text-sm transition-colors",
                      item.id === selectedId
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-muted"
                    )}
                  >
                    {item.name}
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleLink} disabled={!selectedId || linking}>
            {linking && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Add {config.label}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
