"use client";

import React, { useEffect, useImperativeHandle, useMemo, forwardRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Link from "@tiptap/extension-link";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  List,
  ListOrdered,
  AlignLeft,
  AlignCenter,
  AlignRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  PlaceholderChip,
  serializePlaceholders,
  deserializePlaceholders,
} from "@/components/tiptap-placeholder-extension";
import { PlaceholderPicker } from "@/components/placeholder-picker";
import { SubjectLineInput } from "./SubjectLineInput";
import {
  EMAIL_PLACEHOLDER_DEFS,
  EMAIL_PLACEHOLDER_LABEL_MAP,
  EMAIL_SUBJECT_QUICK_PLACEHOLDERS,
} from "./email-placeholders";

export type EmailComposeStepHandle = {
  getSerializedHtml: () => string;
  reset: () => void;
  applyDuplicate: (subject: string, htmlBody: string) => void;
};

type Props = {
  membershipsEnabled: boolean;
  subject: string;
  onSubjectChange: (v: string) => void;
  onValidityChange: (valid: boolean) => void;
};

export const EmailComposeStep = forwardRef<EmailComposeStepHandle, Props>(function EmailComposeStep(
  { membershipsEnabled, subject, onSubjectChange, onValidityChange },
  ref
) {
  const activePlaceholders = useMemo(
    () =>
      membershipsEnabled
        ? EMAIL_PLACEHOLDER_DEFS
        : EMAIL_PLACEHOLDER_DEFS.filter((p) => p.category !== "membership"),
    [membershipsEnabled]
  );
  const activePlaceholderLabelMap = useMemo(() => {
    const map: Record<string, string> = {};
    activePlaceholders.forEach((p) => {
      map[p.key] = p.label;
    });
    return map;
  }, [activePlaceholders]);
  const activeQuickPlaceholders = useMemo(
    () =>
      membershipsEnabled
        ? EMAIL_SUBJECT_QUICK_PLACEHOLDERS
        : EMAIL_SUBJECT_QUICK_PLACEHOLDERS.filter((k) => k !== "membershipName"),
    [membershipsEnabled]
  );

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: "Compose your email..." }),
      Link.configure({ openOnClick: false, HTMLAttributes: { class: "text-primary underline" } }),
      Underline,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      PlaceholderChip.configure({ labelMap: activePlaceholderLabelMap }),
    ],
    content: "",
    onUpdate: ({ editor: e }) => {
      const text = e.getText().trim();
      const subjOk = !!subject.trim();
      onValidityChange(subjOk && text.length > 0);
    },
    editorProps: {
      attributes: {
        class:
          "min-h-[250px] w-full resize-none rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 prose prose-sm max-w-none dark:prose-invert overflow-y-auto",
      },
    },
  });

  useEffect(() => {
    const subjOk = !!subject.trim();
    const bodyOk = !!editor?.getText().trim();
    onValidityChange(subjOk && bodyOk);
  }, [subject, editor, onValidityChange]);

  useImperativeHandle(ref, () => ({
    getSerializedHtml: () => {
      if (!editor) return "";
      return serializePlaceholders(editor.getHTML());
    },
    reset: () => {
      editor?.commands.clearContent();
    },
    applyDuplicate: (subj, htmlBody) => {
      onSubjectChange(subj);
      if (editor && htmlBody) {
        editor.commands.setContent(deserializePlaceholders(htmlBody, EMAIL_PLACEHOLDER_LABEL_MAP));
        onValidityChange(!!subj.trim() && !!editor.getText().trim());
      }
    },
  }));

  return (
    <div className="overflow-y-auto max-h-[calc(90vh-280px)] px-1 space-y-5 py-2">
      <SubjectLineInput
        value={subject}
        onChange={onSubjectChange}
        placeholders={activePlaceholders}
        labelMap={activePlaceholderLabelMap}
        quickPlaceholders={activeQuickPlaceholders}
      />

      <div className="grid gap-2">
        <Label>Email Body</Label>
        {editor && (
          <div className="border rounded-md">
            <div className="flex items-center gap-1 border-b p-2 bg-muted/20 flex-wrap">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => editor.chain().focus().toggleBold().run()}
                className={cn("h-8 w-8 p-0", editor.isActive("bold") && "bg-muted")}
              >
                <Bold className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => editor.chain().focus().toggleItalic().run()}
                className={cn("h-8 w-8 p-0", editor.isActive("italic") && "bg-muted")}
              >
                <Italic className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => editor.chain().focus().toggleUnderline().run()}
                className={cn("h-8 w-8 p-0", editor.isActive("underline") && "bg-muted")}
              >
                <UnderlineIcon className="h-4 w-4" />
              </Button>
              <div className="w-px h-4 bg-border mx-1" />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => editor.chain().focus().setTextAlign("left").run()}
                className={cn("h-8 w-8 p-0", editor.isActive({ textAlign: "left" }) && "bg-muted")}
              >
                <AlignLeft className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => editor.chain().focus().setTextAlign("center").run()}
                className={cn(
                  "h-8 w-8 p-0",
                  editor.isActive({ textAlign: "center" }) && "bg-muted"
                )}
              >
                <AlignCenter className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => editor.chain().focus().setTextAlign("right").run()}
                className={cn("h-8 w-8 p-0", editor.isActive({ textAlign: "right" }) && "bg-muted")}
              >
                <AlignRight className="h-4 w-4" />
              </Button>
              <div className="w-px h-4 bg-border mx-1" />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => editor.chain().focus().toggleBulletList().run()}
                className={cn("h-8 w-8 p-0", editor.isActive("bulletList") && "bg-muted")}
              >
                <List className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => editor.chain().focus().toggleOrderedList().run()}
                className={cn("h-8 w-8 p-0", editor.isActive("orderedList") && "bg-muted")}
              >
                <ListOrdered className="h-4 w-4" />
              </Button>
            </div>
            <EditorContent editor={editor} className="p-1" />
            <div className="p-3">
              <PlaceholderPicker editor={editor} placeholders={activePlaceholders} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
});
