import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ThumbsUp, MessageSquare, Calendar, Clock } from "lucide-react";
import { FeatureRequest } from "./types";
import { getStatusVariant, formatStatus, formatQuarter } from "./utils";
import { formatDistanceToNow } from "date-fns";

interface FeatureListProps {
  features: FeatureRequest[];
  onVote: (id: string) => void;
  onSelect: (feature: FeatureRequest) => void;
  isLoggedIn: boolean;
}

export function FeatureList({ features, onVote, onSelect, isLoggedIn }: FeatureListProps) {
  return (
    <ScrollArea className="h-full">
      <div className="flex flex-col space-y-2 pr-4 pb-4">
        {features.map((feature) => (
          <div 
            key={feature.id} 
            className="flex items-start gap-4 p-4 rounded-lg border bg-card text-card-foreground shadow-sm hover:border-primary/50 transition-colors cursor-pointer group"
            onClick={() => onSelect(feature)}
          >
            {/* Vote Box */}
            <div className="flex flex-col items-center gap-1 min-w-[60px] pt-1">
               <Button
                variant={feature.hasVoted ? "default" : "outline"}
                size="sm"
                className={`h-auto py-2 flex flex-col gap-1 w-full ${
                  feature.hasVoted 
                    ? "bg-primary text-primary-foreground" 
                    : "hover:bg-primary hover:text-primary-foreground group-hover:border-primary/50"
                }`}
                onClick={(e) => {
                  e.stopPropagation();
                  onVote(feature.id);
                }}
                title={isLoggedIn ? (feature.hasVoted ? "Remove vote" : "Vote for this feature") : "Sign in to vote"}
              >
                <ThumbsUp className={`h-4 w-4 ${feature.hasVoted ? "fill-current" : ""}`} />
                <span className="font-bold text-lg">{feature.voteCount}</span>
              </Button>
            </div>

            {/* Content */}
            <div className="flex-1 space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-lg group-hover:text-primary transition-colors">
                  {feature.title}
                </h3>
                <div className="flex items-center gap-2 md:hidden">
                    <Badge variant={getStatusVariant(feature.status)}>
                        {formatStatus(feature.status)}
                    </Badge>
                </div>
              </div>
              
              <p className="text-muted-foreground line-clamp-2 text-sm">
                {feature.description}
              </p>
              
              <div className="flex items-center gap-3 pt-1 text-xs text-muted-foreground flex-wrap">
                <span className="font-medium text-foreground">{feature.author?.name || "Anonymous"}</span>
                <span>•</span>
                <span>{new Date(feature.createdAt).toLocaleDateString()}</span>
                {feature.targetDate && (
                  <>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {formatQuarter(feature.targetDate)}
                    </span>
                  </>
                )}
                <div className="hidden sm:flex items-center gap-2 ml-2">
                    {feature.categories.slice(0, 3).map(cat => (
                        <Badge key={cat} variant="secondary" className="text-[10px] h-5 px-1.5 font-normal">
                            {cat}
                        </Badge>
                    ))}
                    {feature.categories.length > 3 && (
                      <Badge variant="secondary" className="text-[10px] h-5 px-1.5 font-normal">
                        +{feature.categories.length - 3}
                      </Badge>
                    )}
                </div>
              </div>
            </div>

            {/* Metadata (Right side desktop) */}
            <div className="hidden md:flex flex-col items-end gap-3 min-w-[140px]">
               <Badge variant={getStatusVariant(feature.status)} className="w-fit">
                  {formatStatus(feature.status)}
               </Badge>
               {feature.statusChangedAt && (
                 <div className="flex items-center gap-1 text-xs text-muted-foreground">
                   <Clock className="h-3 w-3" />
                   <span>Updated {formatDistanceToNow(new Date(feature.statusChangedAt), { addSuffix: true })}</span>
                 </div>
               )}
               <div className="flex items-center gap-1.5 text-muted-foreground text-sm mt-auto">
                 <MessageSquare className="h-4 w-4" />
                 <span>{feature.commentCount}</span>
               </div>
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
