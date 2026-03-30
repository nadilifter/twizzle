"use client";

import {
  Bold,
  Italic,
  Code,
  Link as LinkIcon,
  List,
  ListOrdered,
  Strikethrough,
  Underline as UnderlineIcon,
  Quote,
  AlignLeft,
  AlignCenter,
  AlignRight,
} from "lucide-react";
import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Link from "@tiptap/extension-link";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function RichTextEditor({ value, onChange, placeholder }: RichTextEditorProps) {
  const [isLinkDialogOpen, setIsLinkDialogOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: placeholder || "Enter text...",
        emptyEditorClass: "is-editor-empty",
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: "text-primary underline",
        },
      }),
      Underline,
      TextAlign.configure({
        types: ["heading", "paragraph"],
      }),
    ],
    content: value,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class:
          "min-h-[150px] w-full py-2 px-3 text-sm outline-none overflow-y-auto [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4 [&_blockquote]:border-l-2 [&_blockquote]:border-primary [&_blockquote]:pl-4 [&_blockquote]:italic [&_code]:bg-muted [&_code]:rounded [&_code]:px-1 [&_code]:font-mono",
      },
    },
  });

  // Sync content if value changes externally (e.g. initial load)
  useEffect(() => {
    if (editor && value) {
      const currentContent = editor.getHTML();
      // Simple check to avoid loops, though HTML comparison is flaky.
      // We only set it if the editor is empty, which handles the initial load case.
      if (editor.isEmpty && value !== "<p></p>") {
        editor.commands.setContent(value);
      }
    }
  }, [value, editor]);

  const handleSaveLink = () => {
    if (editor) {
      if (linkUrl === "") {
        editor.chain().focus().extendMarkRange("link").unsetLink().run();
      } else {
        editor.chain().focus().extendMarkRange("link").setLink({ href: linkUrl }).run();
      }
    }
    setIsLinkDialogOpen(false);
    setLinkUrl("");
  };

  if (!editor) {
    return null;
  }

  return (
    <div className="flex flex-col w-full border rounded-md bg-background">
      {/* Toolbar */}
      <div className="flex items-center gap-1 p-1 border-b bg-muted/30 overflow-x-auto no-scrollbar flex-wrap">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleBold().run()}
          disabled={!editor.can().chain().focus().toggleBold().run()}
          className={cn("h-8 w-8 p-0", editor.isActive("bold") && "bg-muted")}
        >
          <Bold className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          disabled={!editor.can().chain().focus().toggleItalic().run()}
          className={cn("h-8 w-8 p-0", editor.isActive("italic") && "bg-muted")}
        >
          <Italic className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          disabled={!editor.can().chain().focus().toggleUnderline().run()}
          className={cn("h-8 w-8 p-0", editor.isActive("underline") && "bg-muted")}
        >
          <UnderlineIcon className="w-4 h-4" />
        </Button>

        <div className="w-px h-4 bg-border mx-1" />

        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().setTextAlign("left").run()}
          className={cn("h-8 w-8 p-0", editor.isActive({ textAlign: "left" }) && "bg-muted")}
        >
          <AlignLeft className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().setTextAlign("center").run()}
          className={cn("h-8 w-8 p-0", editor.isActive({ textAlign: "center" }) && "bg-muted")}
        >
          <AlignCenter className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().setTextAlign("right").run()}
          className={cn("h-8 w-8 p-0", editor.isActive({ textAlign: "right" }) && "bg-muted")}
        >
          <AlignRight className="w-4 h-4" />
        </Button>

        <div className="w-px h-4 bg-border mx-1" />

        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={cn("h-8 w-8 p-0", editor.isActive("bulletList") && "bg-muted")}
        >
          <List className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={cn("h-8 w-8 p-0", editor.isActive("orderedList") && "bg-muted")}
        >
          <ListOrdered className="w-4 h-4" />
        </Button>

        <div className="w-px h-4 bg-border mx-1" />

        <Dialog
          open={isLinkDialogOpen}
          onOpenChange={(open) => {
            setIsLinkDialogOpen(open);
            if (open && editor) {
              const previousUrl = editor.getAttributes("link").href;
              setLinkUrl(previousUrl || "");
            }
          }}
        >
          <DialogTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className={cn("h-8 w-8 p-0", editor.isActive("link") && "bg-muted")}
            >
              <LinkIcon className="w-4 h-4" />
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Insert Link</DialogTitle>
              <DialogDescription>Enter the URL for the link.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="url" className="text-right">
                  URL
                </Label>
                <Input
                  id="url"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  placeholder="https://example.com"
                  className="col-span-3"
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" onClick={handleSaveLink}>
                Save changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <EditorContent editor={editor} />
    </div>
  );
}
