import { FeatureRequest, Status } from "./types";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MessageSquare, ThumbsUp, Calendar, Clock } from "lucide-react";
import { getStatusVariant, formatStatus, formatQuarter, getQuarterSortValue } from "./utils";
import { formatDistanceToNow } from "date-fns";

interface RoadmapBoardProps {
  features: FeatureRequest[];
  onSelect: (feature: FeatureRequest) => void;
}

const COLUMNS: Status[] = ["PLANNED", "IN_PROGRESS", "DONE"];

export function RoadmapBoard({ features, onSelect }: RoadmapBoardProps) {
  const getFeaturesByStatus = (status: Status) => 
    features
      .filter(f => f.status === status)
      .sort((a, b) => getQuarterSortValue(a.targetDate) - getQuarterSortValue(b.targetDate));

  return (
    <div className="flex h-full gap-4 overflow-x-auto pb-4">
      {COLUMNS.map((status) => (
        <div key={status} className="flex-1 min-w-[280px] max-w-[320px] flex flex-col h-full rounded-xl bg-muted/40 border">
          {/* Column Header */}
          <div className="p-4 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
               <Badge variant={getStatusVariant(status)} className="h-2 w-2 rounded-full p-0" />
               <h3 className="font-semibold text-sm uppercase tracking-tight">{formatStatus(status)}</h3>
               <span className="text-xs text-muted-foreground font-medium ml-1">
                 {getFeaturesByStatus(status).length}
               </span>
            </div>
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
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                      {feature.targetDate && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          <span>Target: {formatQuarter(feature.targetDate)}</span>
                        </div>
                      )}
                      {feature.statusChangedAt && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          <span>Updated {formatDistanceToNow(new Date(feature.statusChangedAt), { addSuffix: true })}</span>
                        </div>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 pt-0 text-xs text-muted-foreground line-clamp-2">
                    {feature.description}
                  </CardContent>
                  <CardFooter className="p-4 pt-0 flex items-center justify-between mt-2">
                    <div className="flex items-center gap-3 text-muted-foreground">
                        <div className={`flex items-center gap-1 text-xs ${feature.hasVoted ? "text-primary" : ""}`}>
                             <ThumbsUp className={`h-3 w-3 ${feature.hasVoted ? "fill-current" : ""}`} />
                             <span>{feature.voteCount}</span>
                        </div>
                        <div className="flex items-center gap-1 text-xs">
                             <MessageSquare className="h-3 w-3" />
                             <span>{feature.commentCount}</span>
                        </div>
                    </div>
                    {feature.author && (
                      <div className="flex -space-x-2 overflow-hidden">
                          <Avatar className="h-6 w-6 border-2 border-background">
                              <AvatarImage src={feature.author.avatar || undefined} />
                              <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                                {feature.author.name?.[0] || "?"}
                              </AvatarFallback>
                          </Avatar>
                      </div>
                    )}
                  </CardFooter>
                </Card>
              ))}
              {getFeaturesByStatus(status).length === 0 && (
                <div className="text-center text-sm text-muted-foreground py-8">
                  No features yet
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      ))}
    </div>
  );
}
