"use client";

import * as React from "react";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { ChatHeaderButton } from "./chat-header";

interface ChatPanelsContextValue {
  hasSelection: boolean;
  onBack: () => void;
}

const ChatPanelsContext = React.createContext<ChatPanelsContextValue | null>(null);

function useChatPanels() {
  const ctx = React.useContext(ChatPanelsContext);
  if (!ctx) throw new Error("ChatPanels subcomponents must be used inside <ChatPanels>");
  return ctx;
}

export interface ChatPanelsProps extends React.ComponentProps<"div"> {
  hasSelection: boolean;
  onBack: () => void;
  children?: React.ReactNode;
}

export function ChatPanels({
  hasSelection,
  onBack,
  children,
  className,
  ...props
}: ChatPanelsProps) {
  const value = React.useMemo(() => ({ hasSelection, onBack }), [hasSelection, onBack]);
  return (
    <ChatPanelsContext.Provider value={value}>
      <div className={cn("flex h-full", className)} {...props}>
        {children}
      </div>
    </ChatPanelsContext.Provider>
  );
}

export interface ChatPanelsSidebarProps extends React.ComponentProps<"div"> {
  children?: React.ReactNode;
}

export function ChatPanelsSidebar({ children, className, ...props }: ChatPanelsSidebarProps) {
  const { hasSelection } = useChatPanels();
  return (
    <div
      className={cn(
        "w-full md:w-[300px] md:shrink-0",
        hasSelection ? "hidden md:block" : "block",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export interface ChatPanelsMainProps extends React.ComponentProps<"div"> {
  children?: React.ReactNode;
}

export function ChatPanelsMain({ children, className, ...props }: ChatPanelsMainProps) {
  const { hasSelection } = useChatPanels();
  return (
    <div
      className={cn("flex-1 min-w-0", hasSelection ? "block" : "hidden md:block", className)}
      {...props}
    >
      {children}
    </div>
  );
}

export type ChatPanelsBackButtonProps = Omit<
  React.ComponentProps<typeof ChatHeaderButton>,
  "onClick"
>;

export function ChatPanelsBackButton({ className, ...props }: ChatPanelsBackButtonProps) {
  const { onBack } = useChatPanels();
  return (
    <ChatHeaderButton
      onClick={onBack}
      aria-label="Back to conversations"
      className={cn("md:hidden", className)}
      {...props}
    >
      <ArrowLeft className="h-4 w-4" />
    </ChatHeaderButton>
  );
}
