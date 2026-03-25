import { FeatureRequest, Status } from "./types";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronUp, MessageSquare, Calendar } from "lucide-react";
import { getStatusVariant, formatStatus, formatQuarter, getQuarterSortValue } from "./utils";

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
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {COLUMNS.map((status) => (
        <div key={status} className="flex flex-col rounded-xl bg-muted/30">
          <div className="px-4 py-3 flex items-center gap-2.5 border-b border-border/50">
            <Badge variant={getStatusVariant(status)} className="h-2 w-2 rounded-full p-0" />
            <h3 className="font-semibold text-sm">{formatStatus(status)}</h3>
            <span className="ml-auto text-xs font-medium text-muted-foreground tabular-nums">
              {getFeaturesByStatus(status).length}
            </span>
          </div>
          
          <div className="p-3 flex flex-col gap-3">
            {getFeaturesByStatus(status).map((feature) => (
              <Card 
                key={feature.id} 
                className="cursor-pointer border-transparent shadow-sm hover:shadow-md hover:border-primary/20 transition-all"
                onClick={() => onSelect(feature)}
              >
                <CardContent className="p-4 space-y-2">
                  <h4 className="text-sm font-semibold leading-snug">{feature.title}</h4>
                  <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                    {feature.description}
                  </p>
                  {feature.targetDate && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      <span>{formatQuarter(feature.targetDate)}</span>
                    </div>
                  )}
                </CardContent>
                <CardFooter className="px-4 pb-3 pt-0 flex items-center justify-between">
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <div className={`inline-flex items-center gap-1 text-xs ${feature.hasVoted ? "text-primary" : ""}`}>
                      <ChevronUp className={`h-3.5 w-3.5 ${feature.hasVoted ? "fill-current" : ""}`} />
                      <span className="font-medium">{feature.voteCount}</span>
                    </div>
                    <div className="inline-flex items-center gap-1 text-xs">
                      <MessageSquare className="h-3 w-3" />
                      <span>{feature.commentCount}</span>
                    </div>
                  </div>
                </CardFooter>
              </Card>
            ))}
            {getFeaturesByStatus(status).length === 0 && (
              <div className="text-center text-sm text-muted-foreground py-12">
                No features yet
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
