"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, ExternalLink, Monitor, Smartphone } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmailPreviewProps {
  html: string;
  subject?: string;
  recipientCount?: number;
  className?: string;
  showDeviceToggle?: boolean;
}

export function EmailPreview({
  html,
  subject,
  recipientCount,
  className,
  showDeviceToggle = true,
}: EmailPreviewProps) {
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Reset loading when html changes
    setIsLoading(true);
  }, [html]);

  const handleIframeLoad = () => {
    setIsLoading(false);
  };

  return (
    <Card className={cn("overflow-hidden", className)}>
      {(subject || showDeviceToggle) && (
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            {subject && <CardTitle className="text-sm font-medium">{subject}</CardTitle>}
            {showDeviceToggle && (
              <div className="flex items-center gap-1 bg-muted rounded-md p-1">
                <Button
                  variant={device === "desktop" ? "secondary" : "ghost"}
                  size="sm"
                  className="h-7 px-2"
                  onClick={() => setDevice("desktop")}
                >
                  <Monitor className="h-4 w-4" />
                </Button>
                <Button
                  variant={device === "mobile" ? "secondary" : "ghost"}
                  size="sm"
                  className="h-7 px-2"
                  onClick={() => setDevice("mobile")}
                >
                  <Smartphone className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
          {recipientCount !== undefined && (
            <p className="text-sm text-muted-foreground">
              Will be sent to <Badge variant="secondary">{recipientCount}</Badge> recipients
            </p>
          )}
        </CardHeader>
      )}
      <CardContent className="p-0">
        <div
          className={cn(
            "relative bg-gray-100 dark:bg-gray-900 transition-all duration-300 mx-auto",
            device === "desktop" ? "w-full" : "w-[375px]"
          )}
        >
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}
          <iframe
            srcDoc={html}
            className={cn(
              "w-full border-0 bg-white transition-all duration-300",
              device === "desktop" ? "h-[500px]" : "h-[600px]"
            )}
            title="Email Preview"
            onLoad={handleIframeLoad}
            sandbox="allow-same-origin"
          />
        </div>
      </CardContent>
    </Card>
  );
}

interface EmailPreviewModalProps {
  html: string;
  isOpen: boolean;
  onClose: () => void;
}

export function EmailPreviewModal({ html, isOpen, onClose }: EmailPreviewModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm">
      <div className="fixed inset-4 md:inset-10 bg-background border rounded-lg shadow-lg overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">Email Preview</h2>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <a
                href={`data:text/html;charset=utf-8,${encodeURIComponent(html)}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Open in New Tab
              </a>
            </Button>
            <Button variant="ghost" size="sm" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
        <div className="flex-1 overflow-auto p-4 bg-gray-100 dark:bg-gray-900">
          <div className="max-w-[700px] mx-auto bg-white shadow-lg rounded-lg overflow-hidden">
            <iframe
              srcDoc={html}
              className="w-full h-[calc(100vh-200px)] border-0"
              title="Email Preview"
              sandbox="allow-same-origin"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

interface LiveEmailPreviewProps {
  subject: string;
  body: string;
  targetScope: string;
  targetProgramId?: string;
  targetEventId?: string;
  targetMembershipStatus?: string;
  className?: string;
}

export function LiveEmailPreview({
  subject,
  body,
  targetScope,
  targetProgramId,
  targetEventId,
  targetMembershipStatus,
  className,
}: LiveEmailPreviewProps) {
  const [html, setHtml] = useState("");
  const [recipientCount, setRecipientCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPreview = async () => {
      if (!subject || !body) {
        setHtml("");
        setRecipientCount(0);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/email/campaigns/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            subject,
            htmlBody: body,
            targetScope,
            targetProgramId,
            targetEventId,
            targetMembershipStatus,
          }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Failed to generate preview");
        }

        const data = await response.json();
        setHtml(data.html);
        setRecipientCount(data.recipientCount);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    // Debounce the preview fetch
    const timeoutId = setTimeout(fetchPreview, 500);
    return () => clearTimeout(timeoutId);
  }, [subject, body, targetScope, targetProgramId, targetEventId, targetMembershipStatus]);

  if (error) {
    return (
      <Card className={cn("p-4", className)}>
        <p className="text-sm text-destructive">Error: {error}</p>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card className={cn("p-8", className)}>
        <div className="flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </Card>
    );
  }

  if (!html) {
    return (
      <Card className={cn("p-8", className)}>
        <p className="text-sm text-muted-foreground text-center">
          Enter a subject and content to see a preview
        </p>
      </Card>
    );
  }

  return (
    <EmailPreview
      html={html}
      subject={subject}
      recipientCount={recipientCount}
      className={className}
    />
  );
}
