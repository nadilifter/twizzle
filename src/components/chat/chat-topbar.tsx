"use client";

import React from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Info, Phone, Video } from "lucide-react";
import { UserData } from "./data";
import { Badge } from "@/components/ui/badge";

interface ChatTopbarProps {
  selectedUser: UserData;
}

export default function ChatTopbar({ selectedUser }: ChatTopbarProps) {
  return (
    <div className="w-full h-20 flex p-4 justify-between items-center border-b">
      <div className="flex items-center gap-2">
        <Avatar className="flex justify-center items-center">
          <AvatarImage
            src={selectedUser.avatar}
            alt={selectedUser.name}
            width={6}
            height={6}
            className="w-10 h-10 "
          />
          <AvatarFallback>{selectedUser.name[0]}</AvatarFallback>
        </Avatar>
        <div className="flex flex-col">
          <span className="font-medium flex items-center gap-2">
            {selectedUser.name}
            {selectedUser.isMinor && (
              <Badge variant="secondary" className="text-[10px] h-5 px-1">
                Minor
              </Badge>
            )}
          </span>
          <span className="text-xs text-muted-foreground">Active now</span>
        </div>
      </div>

      <div className="flex gap-2">
      </div>
    </div>
  );
}
