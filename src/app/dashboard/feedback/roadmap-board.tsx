import { FeatureRequest, Status } from "./types";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Plus, MoreHorizontal, MessageSquare, ThumbsUp } from "lucide-react";
import { getStatusVariant, formatStatus } from "./utils";

interface RoadmapBoardProps {
  features: FeatureRequest[];
  onStatusChange: (id: string, status: Status) => void;
  onSelect: (feature: FeatureRequest) => void;
}

const COLUMNS: Status[] = ["planned", "in-progress", "done"];

export function RoadmapBoard({ features, onSelect }: RoadmapBoardProps) {
  const getFeaturesByStatus = (status: Status) => 
    features.filter(f => f.status === status);

  return (
    <div className="flex h-full gap-6 overflow-x-auto pb-4">
      {COLUMNS.map((status) => (
        <div key={status} className="flex-1 min-w-[320px] max-w-[400px] flex flex-col h-full rounded-xl bg-muted/40 border">
          {/* Column Header */}
          <div className="p-4 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
               <Badge variant={getStatusVariant(status)} className="h-2 w-2 rounded-full p-0" />
               <h3 className="font-semibold text-sm uppercase tracking-tight">{formatStatus(status)}</h3>
               <span className="text-xs text-muted-foreground font-medium ml-1">
                 {getFeaturesByStatus(status).length}
               </span>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                <Plus className="h-4 w-4" />
            </Button>
          </div>
          
          {/* Column Content */}
          <ScrollArea className="flex-1 px-4 pb-4">
            <div className="flex flex-col gap-3">
              {getFeaturesByStatus(status).map((feature) => (
                <Card 
                  key={feature.id} 
                  className="cursor-pointer hover:shadow-md transition-all duration-200 border-none shadow-sm ring-1 ring-border/50"
                  onClick={() => onSelect(feature)}
                >
                  <CardHeader className="p-4 pb-2 space-y-2">
                    <div className="flex justify-between items-start">
                        <CardTitle className="text-sm font-semibold leading-snug">{feature.title}</CardTitle>
                         <Button variant="ghost" size="icon" className="h-6 w-6 -mr-2 -mt-2 text-muted-foreground">
                            <MoreHorizontal className="h-3 w-3" />
                         </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 pt-0 text-xs text-muted-foreground line-clamp-2">
                    {feature.description}
                  </CardContent>
                  <CardFooter className="p-4 pt-0 flex items-center justify-between mt-2">
                    <div className="flex items-center gap-3 text-muted-foreground">
                        <div className="flex items-center gap-1 text-xs">
                             <ThumbsUp className="h-3 w-3" />
                             <span>{feature.votes}</span>
                        </div>
                        <div className="flex items-center gap-1 text-xs">
                             <MessageSquare className="h-3 w-3" />
                             <span>{feature.comments.length}</span>
                        </div>
                    </div>
                    {/* Mock Avatar for Author - in real app would match user ID */}
                    <div className="flex -space-x-2 overflow-hidden">
                        <Avatar className="h-6 w-6 border-2 border-background">
                            <AvatarFallback className="text-[10px] bg-primary/10 text-primary">{feature.author[0]}</AvatarFallback>
                        </Avatar>
                    </div>
                  </CardFooter>
                </Card>
              ))}
            </div>
          </ScrollArea>
        </div>
      ))}
    </div>
  );
}
