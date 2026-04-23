"use client";

import { format } from "date-fns";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface TimelineItem {
  title: string;
  date: Date | null;
  time: string | null;
  hollow: boolean;
}

interface RegistrationTimelineProps {
  items: TimelineItem[];
  title?: string;
}

export function RegistrationTimeline({
  items,
  title = "Registration Timeline",
}: RegistrationTimelineProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-0">
          {items.map((item, idx) => {
            const isLast = idx === items.length - 1;
            return (
              <div key={idx} className="relative flex gap-4">
                <div className="flex flex-col items-center">
                  <div
                    className={cn(
                      "h-3 w-3 rounded-full border-2 shrink-0 mt-1.5",
                      item.hollow
                        ? "bg-background border-muted-foreground/40"
                        : "bg-primary border-primary"
                    )}
                  />
                  {!isLast && <div className="w-[2px] flex-1 bg-border my-1" />}
                </div>
                <div className={cn("pb-5", isLast && "pb-0")}>
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-semibold">{item.title}</h4>
                    {item.hollow && (
                      <Badge variant="outline" className="text-[10px] h-5 px-1.5">
                        Upcoming
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {item.date
                      ? `${format(item.date, "MMMM d, yyyy")}${item.time ? ` at ${item.time}` : ""}`
                      : "Date pending"}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
