"use client";

import { cn } from "@/lib/utils";
import React, { useRef } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Message, UserData } from "./data";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ShieldAlert } from "lucide-react";

interface ChatListProps {
  messages?: Message[];
  selectedUser: UserData;
  sendMessage: (newMessage: Message) => void;
  isMobile: boolean;
}

export function ChatList({
  messages,
  selectedUser,
  sendMessage,
  isMobile,
}: ChatListProps) {
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop =
        messagesContainerRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <div className="w-full overflow-y-auto overflow-x-hidden h-full flex flex-col">
      <div
        ref={messagesContainerRef}
        className="w-full overflow-y-auto overflow-x-hidden h-full flex flex-col"
      >
        <div className="flex flex-col gap-4 p-4">
          {selectedUser.isMinor && (
            <Alert variant="destructive" className="bg-yellow-50 border-yellow-200 text-yellow-800 dark:bg-yellow-950 dark:border-yellow-900 dark:text-yellow-200">
              <ShieldAlert className="h-4 w-4" />
              <AlertTitle>Parental Notice</AlertTitle>
              <AlertDescription>
                This conversation is with a minor and will be viewable by their parent or guardian.
              </AlertDescription>
            </Alert>
          )}
          
          {messages?.map((message, index) => (
            <div
              key={index}
              className={cn(
                "flex gap-2 items-end max-w-[75%]",
                message.name === selectedUser.name
                  ? "self-start" // Received messages
                  : "self-end flex-row-reverse" // Sent messages
              )}
            >
              <Avatar className="flex justify-center items-center">
                <AvatarImage
                  src={message.avatar}
                  alt={message.name}
                  width={6}
                  height={6}
                />
                <AvatarFallback>
                  {message.name[0]}
                </AvatarFallback>
              </Avatar>
              <span className=" bg-accent p-3 rounded-md max-w-xs sm:max-w-md md:max-w-lg lg:max-w-xl break-words">
                 {/* Render HTML content safely */}
                <span 
                    className="[&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4 [&_blockquote]:border-l-2 [&_blockquote]:border-primary [&_blockquote]:pl-4 [&_blockquote]:italic [&_code]:bg-muted [&_code]:rounded [&_code]:px-1 [&_code]:font-mono break-words"
                    dangerouslySetInnerHTML={{ __html: message.message }}
                />
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
