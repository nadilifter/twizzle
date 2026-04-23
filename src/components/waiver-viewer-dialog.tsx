"use client";

import { format } from "date-fns";
import { AlertCircle, FileText } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { sanitizeHtml } from "@/lib/sanitize";
import type { AthleteWaiverSummary } from "@/types/athletes";

export function WaiverViewerDialog({
  waiver,
  onClose,
}: {
  waiver: AthleteWaiverSummary | null;
  onClose: () => void;
}) {
  if (!waiver) return null;

  return (
    <Dialog
      open={!!waiver}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {waiver.title}
          </DialogTitle>
          <DialogDescription>
            {waiver.signed && waiver.signedAt
              ? `Signed on ${format(new Date(waiver.signedAt), "MMMM d, yyyy 'at' h:mm a")}`
              : "This waiver has not been signed"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {waiver.pages.map((page) => (
            <div key={page.id} className="space-y-4">
              {page.title && (
                <h3 className="font-semibold text-sm">
                  {waiver.pages.length > 1 && `Page ${page.pageNumber}: `}
                  {page.title}
                </h3>
              )}

              <div
                className="prose prose-sm max-w-none text-sm border rounded-lg p-4 bg-muted/30"
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(page.content) }}
              />

              {page.signature ? (
                <div className="border rounded-lg p-4 space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Signature
                  </p>
                  <div className="bg-white rounded border p-2 inline-block">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={page.signature.signatureData}
                      alt={`Signature by ${page.signature.signedByName}`}
                      className="h-20 w-auto"
                    />
                  </div>
                  <div className="text-xs text-muted-foreground space-y-0.5">
                    <p>
                      Signed by: {page.signature.signedByName} ({page.signature.signedByEmail})
                    </p>
                    <p>
                      Date: {format(new Date(page.signature.signedAt), "MMMM d, yyyy 'at' h:mm a")}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="border rounded-lg p-4 border-dashed">
                  <p className="text-sm text-muted-foreground flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    No signature on file for this page
                  </p>
                </div>
              )}

              {page.pageNumber < waiver.pages.length && <Separator />}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
