"use client";

import React, { useState, useEffect, useRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Braces } from "lucide-react";
import {
  PlaceholderChip,
  deserializePlaceholders,
} from "@/components/tiptap-placeholder-extension";
import type { PlaceholderDefinition } from "@/components/placeholder-picker";

export function SubjectLineInput({
  value,
  onChange,
  placeholders,
  labelMap,
  quickPlaceholders,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholders: PlaceholderDefinition[];
  labelMap: Record<string, string>;
  quickPlaceholders: string[];
}) {
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [search, setSearch] = useState("");
  const isInternalChange = useRef(false);

  const subjectEditor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: false,
        bulletList: false,
        orderedList: false,
        blockquote: false,
        codeBlock: false,
        code: false,
        horizontalRule: false,
        bold: false,
        italic: false,
        strike: false,
        listItem: false,
        dropcursor: false,
        gapcursor: false,
      }),
      PlaceholderChip.configure({ labelMap }),
      Placeholder.configure({
        placeholder: "e.g., Important Update for Athlete Name",
      }),
    ],
    content: "",
    onUpdate: ({ editor: e }) => {
      isInternalChange.current = true;
      onChange(e.getText());
      setTimeout(() => {
        isInternalChange.current = false;
      }, 0);
    },
    editorProps: {
      attributes: {
        class:
          "subject-line-editor flex items-center min-h-[40px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-within:outline-none focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
      },
      handleKeyDown: (_view, event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          return true;
        }
        return false;
      },
    },
  });

  useEffect(() => {
    if (!subjectEditor || isInternalChange.current) return;
    const currentText = subjectEditor.getText();
    if (currentText !== value) {
      if (!value) {
        subjectEditor.commands.clearContent();
      } else {
        const chipHtml = deserializePlaceholders(value, labelMap);
        subjectEditor.commands.setContent(`<p>${chipHtml}</p>`);
      }
    }
  }, [value, subjectEditor, labelMap]);

  const insertPlaceholder = (key: string) => {
    subjectEditor?.chain().focus().insertPlaceholder(key).run();
    setPopoverOpen(false);
  };

  const filteredPlaceholders = search
    ? placeholders.filter(
        (p) =>
          p.label.toLowerCase().includes(search.toLowerCase()) ||
          p.key.toLowerCase().includes(search.toLowerCase())
      )
    : placeholders;

  return (
    <div className="grid gap-2">
      <div className="flex items-center gap-2">
        <Label>Subject Line</Label>
      </div>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <EditorContent editor={subjectEditor} />
        </div>
        <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className="shrink-0 h-10"
              title="Insert placeholder"
            >
              <Braces className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-[300px] p-3">
            <div className="space-y-3">
              <div>
                <p className="text-sm font-medium mb-1">Insert Placeholder</p>
                <p className="text-xs text-muted-foreground">Click to insert at cursor position.</p>
              </div>
              <Input
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
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
      <div className="flex flex-wrap gap-1.5">
        {quickPlaceholders.map((key) => {
          const def = placeholders.find((p) => p.key === key);
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
  );
}
