"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  MoreHorizontal,
  RotateCcw,
  Ban,
  CheckCircle,
  DollarSign,
  MessageSquare,
} from "lucide-react";

type InvoiceStatus = "PENDING" | "PROCESSING" | "PAID" | "FAILED" | "VOID";

interface InvoiceActionsProps {
  invoiceId: string;
  reference: string;
  status: InvoiceStatus;
  amount: number;
  orgName: string;
  notes?: string | null;
}

type DialogType = "void" | "mark-paid" | "adjust" | "add-note" | null;

export function InvoiceActions({
  invoiceId,
  reference,
  status,
  amount,
  orgName,
  notes,
}: InvoiceActionsProps) {
  const router = useRouter();
  const [activeDialog, setActiveDialog] = useState<DialogType>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reason, setReason] = useState("");
  const [newAmount, setNewAmount] = useState(amount.toFixed(2));
  const [noteText, setNoteText] = useState("");

  const isPaid = status === "PAID";
  const isVoid = status === "VOID";
  const canRetry = status === "FAILED" || status === "PENDING";
  const canVoid = !isPaid && !isVoid;
  const canMarkPaid = !isPaid && !isVoid;
  const canAdjust = !isPaid && !isVoid;

  const resetForm = () => {
    setReason("");
    setNewAmount(amount.toFixed(2));
    setNoteText("");
    setActiveDialog(null);
  };

  const performAction = async (action: string, body: Record<string, unknown>) => {
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/superadmin/subscription-invoices/${invoiceId}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...body }),
      });
      const data = await res.json();

      if (res.ok && data.success !== false) {
        toast.success(data.message || "Action completed successfully.");
        resetForm();
        router.refresh();
      } else {
        toast.error(data.error || data.message || "Action failed.");
      }
    } catch {
      toast.error("An error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
            <MoreHorizontal className="h-4 w-4" />
            <span className="sr-only">Actions</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {canRetry && (
            <DropdownMenuItem onClick={() => performAction("retry", {})}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Retry Payment
            </DropdownMenuItem>
          )}
          {canMarkPaid && (
            <DropdownMenuItem onClick={() => setActiveDialog("mark-paid")}>
              <CheckCircle className="mr-2 h-4 w-4" />
              Mark as Paid
            </DropdownMenuItem>
          )}
          {canAdjust && (
            <DropdownMenuItem onClick={() => setActiveDialog("adjust")}>
              <DollarSign className="mr-2 h-4 w-4" />
              Adjust Amount
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={() => setActiveDialog("add-note")}>
            <MessageSquare className="mr-2 h-4 w-4" />
            Add Note
          </DropdownMenuItem>
          {canVoid && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setActiveDialog("void")}
                className="text-destructive focus:text-destructive"
              >
                <Ban className="mr-2 h-4 w-4" />
                Void Invoice
              </DropdownMenuItem>
            </>
          )}
          {notes && (
            <>
              <DropdownMenuSeparator />
              <div className="px-2 py-1.5 max-w-[280px]">
                <p className="text-xs font-medium text-muted-foreground mb-1">Notes:</p>
                <p className="text-xs text-muted-foreground whitespace-pre-wrap line-clamp-6">
                  {notes}
                </p>
              </div>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Void Dialog */}
      <Dialog open={activeDialog === "void"} onOpenChange={(open) => !open && resetForm()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Void Invoice</DialogTitle>
            <DialogDescription>
              Void invoice <span className="font-mono">{reference}</span> for{" "}
              <span className="font-medium">{orgName}</span>. This will cancel the invoice without
              charging the customer.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="void-reason">Reason</Label>
              <Textarea
                id="void-reason"
                placeholder="e.g. Billing error, duplicate invoice, goodwill write-off..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={resetForm} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => performAction("void", { reason })}
              disabled={isSubmitting || !reason.trim()}
            >
              {isSubmitting ? "Voiding..." : "Void Invoice"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mark Paid Dialog */}
      <Dialog open={activeDialog === "mark-paid"} onOpenChange={(open) => !open && resetForm()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark as Paid</DialogTitle>
            <DialogDescription>
              Manually mark invoice <span className="font-mono">{reference}</span> as paid for{" "}
              <span className="font-medium">{orgName}</span>. This will clear any grace period and
              restore the subscription to active.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="paid-note">Note (required)</Label>
              <Textarea
                id="paid-note"
                placeholder="e.g. Payment received via wire transfer, goodwill credit applied..."
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={resetForm} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              onClick={() => performAction("mark-paid", { note: noteText })}
              disabled={isSubmitting || !noteText.trim()}
            >
              {isSubmitting ? "Saving..." : "Mark as Paid"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Adjust Amount Dialog */}
      <Dialog open={activeDialog === "adjust"} onOpenChange={(open) => !open && resetForm()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adjust Invoice Amount</DialogTitle>
            <DialogDescription>
              Change the amount on invoice <span className="font-mono">{reference}</span> for{" "}
              <span className="font-medium">{orgName}</span>. Current amount: ${amount.toFixed(2)}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="new-amount">New Amount ($)</Label>
              <Input
                id="new-amount"
                type="number"
                step="0.01"
                min="0"
                value={newAmount}
                onChange={(e) => setNewAmount(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="adjust-reason">Reason</Label>
              <Textarea
                id="adjust-reason"
                placeholder="e.g. Proration adjustment, courtesy discount, billing correction..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={resetForm} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              onClick={() =>
                performAction("adjust-amount", {
                  newAmount: parseFloat(newAmount),
                  reason,
                })
              }
              disabled={isSubmitting || !reason.trim() || isNaN(parseFloat(newAmount))}
            >
              {isSubmitting ? "Adjusting..." : "Adjust Amount"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Note Dialog */}
      <Dialog open={activeDialog === "add-note"} onOpenChange={(open) => !open && resetForm()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Internal Note</DialogTitle>
            <DialogDescription>
              Add a support note to invoice <span className="font-mono">{reference}</span> for{" "}
              <span className="font-medium">{orgName}</span>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="note-text">Note</Label>
              <Textarea
                id="note-text"
                placeholder="Internal support note..."
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
              />
            </div>
            {notes && (
              <div>
                <Label className="text-muted-foreground">Existing Notes</Label>
                <pre className="text-xs text-muted-foreground bg-muted p-2 rounded mt-1 whitespace-pre-wrap max-h-32 overflow-y-auto">
                  {notes}
                </pre>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={resetForm} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              onClick={() => performAction("add-note", { note: noteText })}
              disabled={isSubmitting || !noteText.trim()}
            >
              {isSubmitting ? "Saving..." : "Add Note"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
