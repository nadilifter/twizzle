"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { WaiverTable } from "./waiver-table";
import { WaiverBuilder } from "./waiver-builder";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { DashboardPageHeader } from "@/components/dashboard-page-header";
import { toast } from "sonner";
import type { Waiver } from "@/types/waivers";

export default function WaiversPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [waivers, setWaivers] = useState<Waiver[]>([]);
  const [loading, setLoading] = useState(true);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingWaiver, setEditingWaiver] = useState<Waiver | null>(null);
  const [loadingWaiver, setLoadingWaiver] = useState(false);

  useEffect(() => {
    if (searchParams.get("create") === "true") {
      setEditingWaiver(null);
      setSheetOpen(true);
      router.replace("/dashboard/athletes/waivers");
    }
  }, [searchParams, router]);

  const fetchWaivers = useCallback(async () => {
    try {
      const response = await fetch("/api/waivers");
      if (response.ok) {
        const data = await response.json();
        setWaivers(data.data || []);
      }
    } catch (error) {
      console.error("Failed to fetch waivers:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWaivers();
  }, [fetchWaivers]);

  const openCreateForm = () => {
    setEditingWaiver(null);
    setSheetOpen(true);
  };

  const openEditForm = async (waiver: Waiver) => {
    setLoadingWaiver(true);
    setEditingWaiver(null);
    setSheetOpen(true);

    try {
      const response = await fetch(`/api/waivers/${waiver.id}`);
      if (!response.ok) throw new Error("Failed to load waiver");
      const data = await response.json();
      setEditingWaiver(data);
    } catch {
      toast.error("Failed to load waiver");
      setSheetOpen(false);
    } finally {
      setLoadingWaiver(false);
    }
  };

  const handleSaved = () => {
    setSheetOpen(false);
    fetchWaivers();
  };

  const handleDelete = async (id: string) => {
    try {
      const response = await fetch(`/api/waivers/${id}`, { method: "DELETE" });
      if (response.ok) {
        setWaivers((prev) => prev.filter((w) => w.id !== id));
        toast.success("Waiver deleted");
      }
    } catch (error) {
      console.error("Failed to delete waiver:", error);
      toast.error("Failed to delete waiver");
    }
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      <DashboardPageHeader
        title="Waivers"
        description="Create and manage waivers for athletes and families."
        actions={
          <Button onClick={openCreateForm}>
            <Plus className="mr-2 h-4 w-4" /> Create Waiver
          </Button>
        }
      />
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <WaiverTable data={waivers} onEdit={openEditForm} onDelete={handleDelete} />
      )}

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="sm:max-w-3xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editingWaiver ? "Edit Waiver" : "Create New Waiver"}</SheetTitle>
            <SheetDescription>
              {editingWaiver
                ? `Update "${editingWaiver.title}" and its pages.`
                : "Define a new waiver with one or more pages for signers."}
            </SheetDescription>
          </SheetHeader>

          {loadingWaiver ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="py-4">
              <WaiverBuilder
                key={editingWaiver?.id ?? "new"}
                waiver={editingWaiver}
                onSaved={handleSaved}
                onCancel={() => setSheetOpen(false)}
              />
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
