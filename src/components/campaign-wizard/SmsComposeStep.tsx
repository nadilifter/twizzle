"use client";

import React, { useMemo, useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Braces, Hash, MessageSquare } from "lucide-react";
import { calculateSegmentsClient } from "./sms-segments";
import {
  SMS_PLACEHOLDER_DEFS,
  SMS_QUICK_PLACEHOLDERS,
  type SmsPlaceholderDef,
} from "./sms-placeholders";

type Props = {
  membershipsEnabled: boolean;
  messageBody: string;
  onMessageBodyChange: (v: string) => void;
  onValidityChange: (valid: boolean) => void;
};

export function SmsComposeStep({
  membershipsEnabled,
  messageBody,
  onMessageBodyChange,
  onValidityChange,
}: Props) {
  const [placeholderSearch, setPlaceholderSearch] = useState("");
  const [placeholderOpen, setPlaceholderOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const activePlaceholders = useMemo(
    () =>
      membershipsEnabled
        ? SMS_PLACEHOLDER_DEFS
        : SMS_PLACEHOLDER_DEFS.filter((p) => p.category !== "membership"),
    [membershipsEnabled]
  );
  const activeQuickPlaceholders = useMemo(
    () =>
      membershipsEnabled
        ? SMS_QUICK_PLACEHOLDERS
        : SMS_QUICK_PLACEHOLDERS.filter((k) => k !== "membershipName"),
    [membershipsEnabled]
  );

  const segmentInfo = useMemo(() => calculateSegmentsClient(messageBody), [messageBody]);

  useEffect(() => {
    onValidityChange(messageBody.trim().length > 0);
  }, [messageBody, onValidityChange]);

  const insertPlaceholder = useCallback(
    (key: string) => {
      const placeholder = `{{${key}}}`;
      const textarea = textareaRef.current;
      if (textarea) {
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const newValue = messageBody.substring(0, start) + placeholder + messageBody.substring(end);
        onMessageBodyChange(newValue);
        setTimeout(() => {
          textarea.focus();
          textarea.setSelectionRange(start + placeholder.length, start + placeholder.length);
        }, 0);
      } else {
        onMessageBodyChange(messageBody + placeholder);
      }
      setPlaceholderOpen(false);
    },
    [messageBody, onMessageBodyChange]
  );

  const filteredPlaceholders: SmsPlaceholderDef[] = placeholderSearch
    ? activePlaceholders.filter(
        (p) =>
          p.label.toLowerCase().includes(placeholderSearch.toLowerCase()) ||
          p.key.toLowerCase().includes(placeholderSearch.toLowerCase())
      )
    : activePlaceholders;

  return (
    <div className="overflow-y-auto max-h-[calc(90vh-280px)] px-1 space-y-5 py-2">
      <div className="grid gap-2">
        <div className="flex items-center justify-between">
          <Label>Message Body</Label>
          <Popover open={placeholderOpen} onOpenChange={setPlaceholderOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-8">
                <Braces className="mr-1.5 h-3.5 w-3.5" />
                Insert Placeholder
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-[300px] p-3">
              <div className="space-y-3">
                <div>
                  <p className="text-sm font-medium mb-1">Insert Placeholder</p>
                  <p className="text-xs text-muted-foreground">
                    Click to insert at cursor position.
                  </p>
                </div>
                <Input
                  placeholder="Search..."
                  value={placeholderSearch}
                  onChange={(e) => setPlaceholderSearch(e.target.value)}
                  className="h-8 text-xs"
                />
                <div
                  className="max-h-[240px] overflow-y-auto space-y-1"
                  onWheel={(e) => {
                    const el = e.currentTarget;
                    if (el.scrollHeight > el.clientHeight) {
                      el.scrollTop += e.deltaY;
                      e.stopPropagation();
                    }
                  }}
                >
                  {filteredPlaceholders.map((p) => (
                    <button
                      key={p.key}
                      type="button"
                      onClick={() => insertPlaceholder(p.key)}
                      className="flex items-center justify-between w-full px-2 py-1.5 text-left text-xs rounded-md hover:bg-muted transition-colors"
                    >
                      <div>
                        <span className="font-medium">{p.label}</span>
                        <span className="text-muted-foreground ml-2">{p.example}</span>
                      </div>
                    </button>
                  ))}
                  {filteredPlaceholders.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-2">No matches.</p>
                  )}
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>
        <Textarea
          ref={textareaRef}
          placeholder="Type your message here... Use placeholders like {{guardianFirstName}} for personalization."
          value={messageBody}
          onChange={(e) => onMessageBodyChange(e.target.value)}
          rows={8}
          className="resize-none font-mono text-sm"
          maxLength={1600}
        />

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <Hash className="h-3 w-3" />
              {messageBody.length} characters
            </span>
            <span className="flex items-center gap-1">
              <MessageSquare className="h-3 w-3" />
              {segmentInfo.segments} {segmentInfo.segments === 1 ? "segment" : "segments"} (
              {segmentInfo.encoding})
            </span>
          </div>
          <span>{segmentInfo.charsRemaining} chars remaining in segment</span>
        </div>
      </div>

      <div className="border rounded-md p-3">
        <Label className="text-sm font-medium mb-2 block">Quick Insert</Label>
        <div className="flex flex-wrap gap-1.5">
          {activeQuickPlaceholders.map((key) => {
            const def = activePlaceholders.find((p) => p.key === key);
            if (!def) return null;
            return (
              <TooltipProvider key={key} delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => insertPlaceholder(key)}
                      className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 hover:border-blue-300 transition-colors cursor-pointer dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800 dark:hover:bg-blue-900"
                    >
                      {def.label}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <p className="text-xs">{def.description}</p>
                    <p className="text-xs text-muted-foreground">e.g. {def.example}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            );
          })}
        </div>
      </div>

      <div className="rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3">
        <p className="text-xs text-amber-800 dark:text-amber-300">
          <strong>Note:</strong> Recipients can reply STOP to opt out of future messages. This is
          required for A2P 10DLC compliance.
        </p>
      </div>
    </div>
  );
}
