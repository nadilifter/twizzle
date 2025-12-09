"use client";

import {
  FileImage,
  Mic,
  Paperclip,
  PlusCircle,
  SendHorizontal,
  Smile,
  ThumbsUp,
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
import React, { useRef, useState, useEffect } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Message, loggedInUserData } from "./data";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Link from "@tiptap/extension-link";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import EmojiPicker, { EmojiClickData } from "emoji-picker-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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

interface ChatBottombarProps {
  sendMessage: (newMessage: Message) => void;
  isMobile: boolean;
}

export default function ChatBottombar({
  sendMessage,
  isMobile,
}: ChatBottombarProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isLinkDialogOpen, setIsLinkDialogOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: "Type a message...",
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
    content: "",
    editorProps: {
      attributes: {
        class:
          "min-h-[60px] w-full resize-none border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 py-2 px-3 text-sm outline-none max-h-[200px] overflow-y-auto [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4 [&_blockquote]:border-l-2 [&_blockquote]:border-primary [&_blockquote]:pl-4 [&_blockquote]:italic [&_code]:bg-muted [&_code]:rounded [&_code]:px-1 [&_code]:font-mono",
      },
    },
  });

  const handleSendMessage = () => {
    if (editor && !editor.isEmpty) {
      const newMessage: Message = {
        id: Date.now(),
        name: loggedInUserData.name,
        avatar: loggedInUserData.avatar,
        message: editor.getHTML(),
      };
      sendMessage(newMessage);
      editor.commands.clearContent();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      console.log("File selected:", e.target.files[0]);
      alert(`File selected: ${e.target.files[0].name}`);
      e.target.value = "";
    }
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleEmojiClick = (emojiData: EmojiClickData) => {
    if (editor) {
      editor.commands.insertContent(emojiData.emoji);
    }
  };

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

  useEffect(() => {
    if (editor) {
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          handleSendMessage();
        }
      };
      // Tiptap doesn't attach this listener automatically.
    }
  }, [editor]);

  if (!editor) {
    return null;
  }

  return (
    <div className="p-2 flex justify-between w-full items-center gap-2">
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        onChange={handleFileChange}
      />
      
      <div className="flex flex-col w-full border rounded-md bg-background">
        {/* Toolbar */}
        <div className="flex items-center gap-1 p-1 border-b bg-muted/30 overflow-x-auto no-scrollbar">
          {/* Text Formatting */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => editor.chain().focus().toggleBold().run()}
            disabled={!editor.can().chain().focus().toggleBold().run()}
            className={cn("h-8 w-8 shrink-0", editor.isActive("bold") && "bg-muted")}
          >
            <Bold className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => editor.chain().focus().toggleItalic().run()}
            disabled={!editor.can().chain().focus().toggleItalic().run()}
            className={cn("h-8 w-8 shrink-0", editor.isActive("italic") && "bg-muted")}
          >
            <Italic className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            disabled={!editor.can().chain().focus().toggleUnderline().run()}
            className={cn("h-8 w-8 shrink-0", editor.isActive("underline") && "bg-muted")}
          >
            <UnderlineIcon className="w-4 h-4" />
          </Button>
           <Button
            variant="ghost"
            size="icon"
            onClick={() => editor.chain().focus().toggleStrike().run()}
            disabled={!editor.can().chain().focus().toggleStrike().run()}
            className={cn("h-8 w-8 shrink-0", editor.isActive("strike") && "bg-muted")}
          >
            <Strikethrough className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => editor.chain().focus().toggleCode().run()}
            disabled={!editor.can().chain().focus().toggleCode().run()}
            className={cn("h-8 w-8 shrink-0", editor.isActive("code") && "bg-muted")}
          >
            <Code className="w-4 h-4" />
          </Button>
          
          <div className="w-px h-4 bg-border mx-1 shrink-0" />
          
          {/* Alignment */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => editor.chain().focus().setTextAlign('left').run()}
            className={cn("h-8 w-8 shrink-0", editor.isActive({ textAlign: 'left' }) && "bg-muted")}
          >
            <AlignLeft className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => editor.chain().focus().setTextAlign('center').run()}
            className={cn("h-8 w-8 shrink-0", editor.isActive({ textAlign: 'center' }) && "bg-muted")}
          >
            <AlignCenter className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => editor.chain().focus().setTextAlign('right').run()}
            className={cn("h-8 w-8 shrink-0", editor.isActive({ textAlign: 'right' }) && "bg-muted")}
          >
            <AlignRight className="w-4 h-4" />
          </Button>

           <div className="w-px h-4 bg-border mx-1 shrink-0" />

          {/* Lists & Quotes */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={cn("h-8 w-8 shrink-0", editor.isActive("bulletList") && "bg-muted")}
          >
            <List className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            className={cn("h-8 w-8 shrink-0", editor.isActive("orderedList") && "bg-muted")}
          >
            <ListOrdered className="w-4 h-4" />
          </Button>
           <Button
            variant="ghost"
            size="icon"
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            className={cn("h-8 w-8 shrink-0", editor.isActive("blockquote") && "bg-muted")}
          >
            <Quote className="w-4 h-4" />
          </Button>

          <div className="w-px h-4 bg-border mx-1 shrink-0" />
          
          <Dialog open={isLinkDialogOpen} onOpenChange={(open) => {
            setIsLinkDialogOpen(open);
            if (open && editor) {
              const previousUrl = editor.getAttributes("link").href;
              setLinkUrl(previousUrl || "");
            }
          }}>
            <DialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn("h-8 w-8 shrink-0", editor.isActive("link") && "bg-muted")}
              >
                <LinkIcon className="w-4 h-4" />
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Insert Link</DialogTitle>
                <DialogDescription>
                  Enter the URL for the link.
                </DialogDescription>
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
                <Button type="submit" onClick={handleSaveLink}>Save changes</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

        </div>

        <div className="relative min-h-[60px] w-full">
            <EditorContent editor={editor} />
        </div>

        <div className="flex items-center justify-between p-2">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 text-muted-foreground hover:text-foreground"
              onClick={handleUploadClick}
            >
              <PlusCircle className="w-5 h-5" />
            </Button>
            
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 text-muted-foreground hover:text-foreground"
                >
                  <Smile className="w-5 h-5" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-0 border-none">
                <EmojiPicker onEmojiClick={handleEmojiClick} />
              </PopoverContent>
            </Popover>

            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 text-muted-foreground hover:text-foreground"
              onClick={handleUploadClick}
            >
              <FileImage className="w-5 h-5" />
            </Button>
          </div>

          <Button
            className="h-9 w-9 shrink-0"
            variant="default"
            size="icon"
            onClick={handleSendMessage}
            disabled={editor.isEmpty}
          >
            <SendHorizontal className="w-5 h-5 text-white" />
          </Button>
        </div>
      </div>
    </div>
  );
}
