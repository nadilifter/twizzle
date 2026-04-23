"use client";

import { useState } from "react";
import { Plus, Trash2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { BulkDiscount } from "@/lib/bulk-discounts";
import { validateBulkDiscount } from "@/lib/bulk-discounts";

interface ProgramDiscountsEditorProps {
  discounts: BulkDiscount[];
  onChange: (discounts: BulkDiscount[]) => void;
  effectivePrice: number;
  registrationType: "ALL_INSTANCES" | "PER_INSTANCE";
}

interface AddForm {
  minQuantity: string;
  discountValue: string;
  discountType: "FIXED_AMOUNT" | "PERCENTAGE";
}

const defaultForm = (): AddForm => ({
  minQuantity: "1",
  discountValue: "",
  discountType: "FIXED_AMOUNT",
});

export function ProgramDiscountsEditor({
  discounts,
  onChange,
  effectivePrice,
  registrationType,
}: ProgramDiscountsEditorProps) {
  const [addingMultiSession, setAddingMultiSession] = useState(false);
  const [msForm, setMsForm] = useState<AddForm>(defaultForm);
  const [addingFamilySibling, setAddingFamilySibling] = useState(false);
  const [fsForm, setFsForm] = useState<AddForm>(defaultForm);

  const handleAdd = (type: "MULTI_SESSION" | "FAMILY_SIBLING") => {
    const form = type === "MULTI_SESSION" ? msForm : fsForm;
    const minQuantity = parseInt(form.minQuantity);
    const value = parseFloat(form.discountValue);

    if (!minQuantity || minQuantity < 1) {
      toast.error("Minimum quantity must be at least 1");
      return;
    }
    const error = validateBulkDiscount(
      { type, minQuantity, discountType: form.discountType, discountValue: value },
      effectivePrice
    );
    if (error) {
      toast.error(error);
      return;
    }
    if (discounts.some((d) => d.type === type && d.minQuantity === minQuantity)) {
      toast.error(
        `A ${type === "MULTI_SESSION" ? "session" : "family"} discount for that quantity already exists`
      );
      return;
    }

    const next: BulkDiscount = {
      id: `${type}:${minQuantity}`,
      type: type as BulkDiscount["type"],
      minQuantity,
      discountType: form.discountType as BulkDiscount["discountType"],
      discountValue: value,
    };

    onChange(
      [...discounts, next].sort((a, b) =>
        a.type === b.type ? a.minQuantity - b.minQuantity : a.type.localeCompare(b.type)
      )
    );

    if (type === "MULTI_SESSION") {
      setAddingMultiSession(false);
      setMsForm(defaultForm());
    } else {
      setAddingFamilySibling(false);
      setFsForm(defaultForm());
    }
  };

  const handleRemove = (id: string) => {
    onChange(discounts.filter((d) => d.id !== id));
  };

  const atLimit = discounts.length >= 5;

  return (
    <div className="space-y-3">
      {/* Session Discounts — PER_INSTANCE only */}
      {registrationType === "PER_INSTANCE" && (
        <DiscountSection
          title="Session Discounts"
          description="Reward athletes who book multiple sessions"
          rows={discounts.filter((d) => d.type === "MULTI_SESSION")}
          rowLabel={(d) => `${d.minQuantity}+ sessions`}
          onRemove={handleRemove}
          adding={addingMultiSession}
          addDisabled={atLimit}
          form={msForm}
          onFormChange={setMsForm}
          onAdd={() => handleAdd("MULTI_SESSION")}
          onCancelAdd={() => {
            setAddingMultiSession(false);
            setMsForm(defaultForm());
          }}
          onStartAdd={() => setAddingMultiSession(true)}
          minLabel="Min sessions"
          addLabel="Add session discount"
        />
      )}

      {/* Family Discounts — all paid programs */}
      <DiscountSection
        title="Family Discounts"
        description="Reward families enrolling multiple athletes"
        rows={discounts.filter((d) => d.type === "FAMILY_SIBLING")}
        rowLabel={(d) => `${d.minQuantity}+ kids`}
        onRemove={handleRemove}
        adding={addingFamilySibling}
        addDisabled={atLimit}
        form={fsForm}
        onFormChange={setFsForm}
        onAdd={() => handleAdd("FAMILY_SIBLING")}
        onCancelAdd={() => {
          setAddingFamilySibling(false);
          setFsForm(defaultForm());
        }}
        onStartAdd={() => setAddingFamilySibling(true)}
        minLabel="Min kids"
        addLabel="Add family discount"
      />
    </div>
  );
}

interface DiscountSectionProps {
  title: string;
  description: string;
  rows: BulkDiscount[];
  rowLabel: (d: BulkDiscount) => string;
  onRemove: (id: string) => void;
  adding: boolean;
  addDisabled: boolean;
  form: AddForm;
  onFormChange: (f: AddForm) => void;
  onAdd: () => void;
  onCancelAdd: () => void;
  onStartAdd: () => void;
  minLabel: string;
  addLabel: string;
}

function DiscountSection({
  title,
  description,
  rows,
  rowLabel,
  onRemove,
  adding,
  addDisabled,
  form,
  onFormChange,
  onAdd,
  onCancelAdd,
  onStartAdd,
  minLabel,
  addLabel,
}: DiscountSectionProps) {
  return (
    <div className="rounded-lg border p-4 space-y-3">
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>

      {rows.length > 0 && (
        <div className="space-y-1.5">
          {rows.map((d) => (
            <div
              key={d.id}
              className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2 text-sm"
            >
              <span>
                {rowLabel(d)} —{" "}
                <span className="font-medium">
                  {d.discountType === "PERCENTAGE"
                    ? `${Number(d.discountValue)}% off`
                    : `$${Number(d.discountValue).toFixed(2)} off`}
                </span>
              </span>
              <button
                type="button"
                onClick={() => onRemove(d.id)}
                className="text-muted-foreground hover:text-destructive transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {adding ? (
        <div className="flex items-end gap-2 flex-wrap">
          <div className="space-y-1">
            <Label className="text-xs">{minLabel}</Label>
            <Input
              type="number"
              min={1}
              className="w-24 h-8 text-sm"
              value={form.minQuantity}
              onChange={(e) => onFormChange({ ...form, minQuantity: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Type</Label>
            <div className="flex rounded-md border overflow-hidden h-8">
              <button
                type="button"
                className={`px-3 text-xs transition-colors ${form.discountType === "FIXED_AMOUNT" ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted"}`}
                onClick={() => onFormChange({ ...form, discountType: "FIXED_AMOUNT" })}
              >
                $
              </button>
              <button
                type="button"
                className={`px-3 text-xs border-l transition-colors ${form.discountType === "PERCENTAGE" ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted"}`}
                onClick={() => onFormChange({ ...form, discountType: "PERCENTAGE" })}
              >
                %
              </button>
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Amount</Label>
            <Input
              type="number"
              min={0}
              step={form.discountType === "PERCENTAGE" ? 1 : 0.01}
              max={form.discountType === "PERCENTAGE" ? 100 : undefined}
              className="w-24 h-8 text-sm"
              placeholder={form.discountType === "PERCENTAGE" ? "10" : "0.00"}
              value={form.discountValue}
              onChange={(e) => onFormChange({ ...form, discountValue: e.target.value })}
            />
          </div>
          <Button size="sm" className="h-8" onClick={onAdd}>
            Add
          </Button>
          <Button size="sm" variant="ghost" className="h-8" onClick={onCancelAdd}>
            Cancel
          </Button>
        </div>
      ) : addDisabled ? (
        <p className="text-xs text-muted-foreground">5 discount limit reached</p>
      ) : (
        <Button size="sm" variant="outline" className="h-8 text-xs" onClick={onStartAdd}>
          <Plus className="h-3.5 w-3.5 mr-1" />
          {addLabel}
        </Button>
      )}
    </div>
  );
}
