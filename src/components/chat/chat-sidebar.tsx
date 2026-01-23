"use client";

import Link from "next/link";
import { MoreHorizontal, SquarePen } from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonVariants, Button } from "@/components/ui/button"; // Ensure Button is imported
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { UserData, userData } from "@/components/chat/data"; // Import userData for the list
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"; // Import Dialog components

interface ChatSidebarProps {
  isCollapsed: boolean;
  links: UserData[];
  isMobile: boolean;
  onClick?: (user: UserData) => void;
  selectedUser?: UserData;
}

export function ChatSidebar({
  links,
  isCollapsed,
  isMobile,
  onClick,
  selectedUser,
}: ChatSidebarProps) {
  return (
    <div
      data-collapsed={isCollapsed}
      className="group relative flex flex-col h-full gap-4 p-2 data-[collapsed=true]:p-2 "
    >
      {!isCollapsed && (
        <div className="flex justify-between p-2 items-center">
          <div className="flex gap-2 items-center text-2xl">
            <p className="font-medium">Chats</p>
            <span className="text-zinc-300">({links.length})</span>
          </div>

          <div>
            <Dialog>
              <DialogTrigger asChild>
                <Link
                  href="#"
                  className={cn(
                    buttonVariants({ variant: "ghost", size: "icon" }),
                    "h-9 w-9"
                  )}
                >
                  <SquarePen size={20} />
                </Link>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>New Chat</DialogTitle>
                  <DialogDescription>
                    Select a user to start a conversation with.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  {/* Ideally this would be a searchable list or Select component */}
                  {/* For MVP, we'll list all available users to pick from */}
                  <div className="flex flex-col gap-2">
                    {userData.map((user) => (
                      <Button
                        key={user.id}
                        variant="ghost"
                        className="justify-start gap-4 h-14"
                        onClick={() => {
                          onClick && onClick(user);
                          // In a real app, we'd close the dialog here, but DialogTrigger handles open state usually.
                          // We might need a controlled dialog if we want to close it programmatically.
                          // For MVP, user can click outside or press escape, or we can make this controlled.
                          // Let's keep it simple for now.
                        }}
                      >
                         <Avatar className="flex justify-center items-center">
                            <AvatarImage
                                src={user.avatar}
                                alt={user.avatar}
                                width={6}
                                height={6}
                                className="w-10 h-10 "
                            />
                            <AvatarFallback>{user.name[0]}</AvatarFallback>
                        </Avatar>
                        <span className="font-medium">{user.name}</span>
                      </Button>
                    ))}
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      )}
      <nav className="grid gap-1 px-2 group-[[data-collapsed=true]]:justify-center group-[[data-collapsed=true]]:px-2">
        {links.map((link, index) =>
          isCollapsed ? (
            <TooltipProvider key={index}>
              <Tooltip delayDuration={0}>
                <TooltipTrigger asChild>
                  <div
                    onClick={() => onClick && onClick(link)}
                    className={cn(
                      buttonVariants({ variant: link.id === selectedUser?.id ? "secondary" : "ghost", size: "icon" }),
                      "h-11 w-11 md:h-16 md:w-16 cursor-pointer",
                      link.id === selectedUser?.id && "dark:bg-muted dark:text-muted-foreground dark:hover:bg-muted dark:hover:text-white"
                    )}
                  >
                    <Avatar className="flex justify-center items-center">
                      <AvatarImage
                        src={link.avatar}
                        alt={link.avatar}
                        width={6}
                        height={6}
                        className="w-10 h-10 "
                      />
                      <AvatarFallback>{link.name[0]}</AvatarFallback>
                    </Avatar>
                    <span className="sr-only">{link.name}</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent
                  side="right"
                  className="flex items-center gap-4"
                >
                  {link.name}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : (
            <div
              key={index}
              onClick={() => onClick && onClick(link)}
              className={cn(
                buttonVariants({ variant: link.id === selectedUser?.id ? "secondary" : "ghost", size: "lg" }),
                "justify-start gap-4 px-2 md:px-4 py-8 md:py-6 cursor-pointer",
                link.id === selectedUser?.id && "dark:bg-muted dark:text-white dark:hover:bg-muted dark:hover:text-white shrink-0"
              )}
            >
              <Avatar className="flex justify-center items-center">
                <AvatarImage
                  src={link.avatar}
                  alt={link.avatar}
                  width={6}
                  height={6}
                  className="w-10 h-10 "
                />
                <AvatarFallback>{link.name[0]}</AvatarFallback>
              </Avatar>
              <div className="flex flex-col max-w-28">
                <div className="flex justify-between items-center w-full">
                  <span className="font-medium truncate">{link.name}</span>
                  {link.messages && link.messages.length > 0 && (
                    <span className="text-[10px] text-zinc-400 whitespace-nowrap ml-1">
                      {link.messages[link.messages.length - 1].timestamp}
                    </span>
                  )}
                </div>
                {link.messages && link.messages.length > 0 && (
                  <span className="text-xs text-zinc-300 truncate">
                    {link.messages[link.messages.length - 1].name.split(" ")[0]}
                    : {link.messages[link.messages.length - 1].message}
                  </span>
                )}
              </div>
            </div>
          )
        )}
      </nav>
    </div>
  );
}
