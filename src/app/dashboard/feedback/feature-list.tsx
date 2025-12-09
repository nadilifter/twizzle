import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ThumbsUp, MessageSquare } from "lucide-react";
import { FeatureRequest } from "./types";
import { getStatusVariant, formatStatus } from "./utils";

interface FeatureListProps {
  features: FeatureRequest[];
  onVote: (id: string) => void;
  onSelect: (feature: FeatureRequest) => void;
}

export function FeatureList({ features, onVote, onSelect }: FeatureListProps) {
  // Sort by votes (descending)
  const sortedFeatures = [...features].sort((a, b) => b.votes - a.votes);

  return (
    <ScrollArea className="h-full">
      <div className="flex flex-col space-y-2 pr-4 pb-4">
        {sortedFeatures.map((feature) => (
          <div 
            key={feature.id} 
            className="flex items-start gap-4 p-4 rounded-lg border bg-card text-card-foreground shadow-sm hover:border-primary/50 transition-colors cursor-pointer group"
            onClick={() => onSelect(feature)}
          >
            {/* Vote Box */}
            <div className="flex flex-col items-center gap-1 min-w-[60px] pt-1">
               <Button
                variant="outline"
                size="sm"
                className="h-auto py-2 flex flex-col gap-1 w-full hover:bg-primary hover:text-primary-foreground group-hover:border-primary/50"
                onClick={(e) => {
                  e.stopPropagation();
                  onVote(feature.id);
                }}
              >
                <ThumbsUp className="h-4 w-4" />
                <span className="font-bold text-lg">{feature.votes}</span>
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
              
              <div className="flex items-center gap-3 pt-1 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{feature.author}</span>
                <span>•</span>
                <span>{new Date(feature.createdAt).toLocaleDateString()}</span>
                <div className="hidden sm:flex items-center gap-2 ml-2">
                    {feature.tags.map(tag => (
                        <Badge key={tag} variant="secondary" className="text-[10px] h-5 px-1.5 font-normal">
                            {tag}
                        </Badge>
                    ))}
                </div>
              </div>
            </div>

            {/* Metadata (Right side desktop) */}
            <div className="hidden md:flex flex-col items-end gap-3 min-w-[120px]">
               <Badge variant={getStatusVariant(feature.status)} className="w-fit">
                  {formatStatus(feature.status)}
               </Badge>
               <div className="flex items-center gap-1.5 text-muted-foreground text-sm mt-auto">
                 <MessageSquare className="h-4 w-4" />
                 <span>{feature.comments.length}</span>
               </div>
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
