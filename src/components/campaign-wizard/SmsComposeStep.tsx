"use client";

import React, { useEffect, useImperativeHandle, useMemo, useState, forwardRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { Label } from "@/components/ui/label";
import { Hash, MessageSquare } from "lucide-react";
import {
  PlaceholderChip,
  deserializePlaceholders,
} from "@/components/tiptap-placeholder-extension";
import { PlaceholderPicker } from "@/components/placeholder-picker";
import { calculateSegmentsClient } from "./sms-segments";
import { SMS_PLACEHOLDER_DEFS, SMS_PLACEHOLDER_LABEL_MAP } from "./sms-placeholders";

export type SmsComposeStepHandle = {
  reset: () => void;
  applyDraft: (body: string) => void;
};

type Props = {
  membershipsEnabled: boolean;
  onMessageBodyChange: (v: string) => void;
  onValidityChange: (valid: boolean) => void;
};

export const SmsComposeStep = forwardRef<SmsComposeStepHandle, Props>(function SmsComposeStep(
  { membershipsEnabled, onMessageBodyChange, onValidityChange },
  ref
) {
  const [currentText, setCurrentText] = useState("");

  const activePlaceholders = useMemo(
    () =>
      membershipsEnabled
        ? SMS_PLACEHOLDER_DEFS
        : SMS_PLACEHOLDER_DEFS.filter((p) => p.category !== "membership"),
    [membershipsEnabled]
  );

  const activePlaceholderLabelMap = useMemo(() => {
    const map: Record<string, string> = {};
    activePlaceholders.forEach((p) => {
      map[p.key] = p.label;
    });
    return map;
  }, [activePlaceholders]);

  const segmentInfo = useMemo(() => calculateSegmentsClient(currentText), [currentText]);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: false,
        bold: false,
        italic: false,
        strike: false,
        code: false,
        codeBlock: false,
        blockquote: false,
        horizontalRule: false,
        bulletList: false,
        orderedList: false,
        listItem: false,
      }),
      Placeholder.configure({ placeholder: "Type your SMS message..." }),
      PlaceholderChip.configure({ labelMap: activePlaceholderLabelMap }),
    ],
    content: "",
    onUpdate: ({ editor: e }) => {
      const text = e.getText({ blockSeparator: "\n" }).trim();
      setCurrentText(text);
      onMessageBodyChange(text);
      onValidityChange(text.length > 0);
    },
    editorProps: {
      attributes: {
        class:
          "min-h-[160px] w-full resize-none rounded-t-none rounded-b-none px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      },
    },
  });

  useEffect(() => {
    onValidityChange(currentText.length > 0);
  }, [currentText, onValidityChange]);

  useImperativeHandle(ref, () => ({
    reset: () => {
      editor?.commands.clearContent();
      setCurrentText("");
    },
    applyDraft: (body: string) => {
      if (editor && body) {
        const html = "<p>" + body.replace(/\n/g, "</p><p>") + "</p>";
        editor.commands.setContent(deserializePlaceholders(html, SMS_PLACEHOLDER_LABEL_MAP));
        const text = editor.getText({ blockSeparator: "\n" }).trim();
        setCurrentText(text);
        onMessageBodyChange(text);
        onValidityChange(text.length > 0);
      }
    },
  }));

  return (
    <div className="overflow-y-auto max-h-[calc(90vh-280px)] px-1 space-y-5 py-2">
      <div className="grid gap-2">
        <Label>Message Body</Label>
        {editor && (
          <div className="border rounded-md">
            <EditorContent editor={editor} className="p-1" />
            <div className="px-3 py-2 border-t">
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1">
                    <Hash className="h-3 w-3" />
                    {currentText.length} characters
                  </span>
                  <span className="flex items-center gap-1">
                    <MessageSquare className="h-3 w-3" />
                    {segmentInfo.segments} {segmentInfo.segments === 1 ? "segment" : "segments"} (
                    {segmentInfo.encoding})
                  </span>
                </div>
                <span>{segmentInfo.charsRemaining} chars remaining in segment</span>
              </div>
              <PlaceholderPicker editor={editor} placeholders={activePlaceholders} />
            </div>
          </div>
        )}
      </div>

      <div className="rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3">
        <p className="text-xs text-amber-800 dark:text-amber-300">
          <strong>Note:</strong> Recipients can reply STOP to opt out of future messages. This is
          required for A2P 10DLC compliance.
        </p>
      </div>
    </div>
  );
});
