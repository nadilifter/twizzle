"use client";

import React, { useState } from "react";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { cn } from "@/lib/utils";
import { ChatSidebar } from "./chat-sidebar";
import { ChatList } from "./chat-list";
import ChatBottombar from "./chat-bottombar";
import ChatTopbar from "./chat-topbar";
import { userData, UserData } from "./data";

interface ChatLayoutProps {
  defaultLayout: number[] | undefined;
  defaultCollapsed?: boolean;
  navCollapsedSize: number;
}

export function ChatLayout({
  defaultLayout = [30, 70],
  defaultCollapsed = false,
  navCollapsedSize,
}: ChatLayoutProps) {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
  const [selectedUser, setSelectedUser] = useState<UserData>(userData[0]);
  const [isMobile, setIsMobile] = useState(false);

  // Mock sending message
  const sendMessage = (newMessage: any) => {
      // In a real app, this would update the backend or state
      // For now we just log it or locally update if we had a full state
      console.log("Sending message:", newMessage);
      // For demo, we can't easily update the imported constant `userData` in a reactive way
      // without moving it to state.
      // Let's just wrap the messages in state for the selected user.
  };

  return (
    <ResizablePanelGroup
      direction="horizontal"
      onLayout={(sizes: number[]) => {
        document.cookie = `react-resizable-panels:layout=${JSON.stringify(
          sizes
        )}`;
      }}
      className="h-full items-stretch"
    >
      <ResizablePanel
        defaultSize={defaultLayout[0]}
        collapsedSize={navCollapsedSize}
        collapsible={true}
        minSize={15}
        maxSize={40}
        onCollapse={() => {
          setIsCollapsed(true);
          document.cookie = `react-resizable-panels:collapsed=${JSON.stringify(
            true
          )}`;
        }}
        onExpand={() => {
          setIsCollapsed(false);
          document.cookie = `react-resizable-panels:collapsed=${JSON.stringify(
            false
          )}`;
        }}
        className={cn(
          isCollapsed && "min-w-[50px] transition-all duration-300 ease-in-out"
        )}
      >
        <ChatSidebar
          isCollapsed={isCollapsed}
          links={userData}
          isMobile={isMobile}
          selectedUser={selectedUser}
          onClick={(user) => setSelectedUser(user)}
        />
      </ResizablePanel>
      <ResizableHandle withHandle />
      <ResizablePanel defaultSize={defaultLayout[1]} minSize={30}>
        <div className="flex flex-col h-full w-full">
             <ChatTopbar selectedUser={selectedUser} />
             <ChatList
                messages={selectedUser.messages}
                selectedUser={selectedUser}
                sendMessage={sendMessage}
                isMobile={isMobile}
             />
             <ChatBottombar sendMessage={sendMessage} isMobile={isMobile} />
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}

