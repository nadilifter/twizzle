import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronUp, MessageSquare, Calendar } from "lucide-react";
import { FeatureRequest } from "./types";
import { getStatusVariant, formatStatus, formatQuarter } from "./utils";

interface FeatureListProps {
  features: FeatureRequest[];
  onVote: (id: string) => void;
  onSelect: (feature: FeatureRequest) => void;
  isLoggedIn: boolean;
}

export function FeatureList({ features, onVote, onSelect, isLoggedIn }: FeatureListProps) {
  return (
    <div className="flex flex-col gap-3">
      {features.map((feature) => (
        <div
          key={feature.id}
          className="flex items-start gap-5 rounded-xl border bg-card p-5 transition-all hover:shadow-md hover:border-primary/30 cursor-pointer group"
          onClick={() => onSelect(feature)}
        >
          {/* Vote column */}
          <Button
            variant={feature.hasVoted ? "default" : "outline"}
            size="sm"
            className={`h-auto w-14 shrink-0 flex flex-col items-center gap-0.5 py-2.5 rounded-lg ${
              feature.hasVoted
                ? ""
                : "hover:bg-primary/10 hover:text-primary hover:border-primary/40"
            }`}
            onClick={(e) => {
              e.stopPropagation();
              onVote(feature.id);
            }}
            title={
              isLoggedIn
                ? feature.hasVoted
                  ? "Remove vote"
                  : "Vote for this feature"
                : "Sign in to vote"
            }
          >
            <ChevronUp className="h-4 w-4" />
            <span className="font-semibold text-base leading-none">{feature.voteCount}</span>
          </Button>

          {/* Content */}
          <div className="flex-1 min-w-0 space-y-1.5">
            <div className="flex items-start justify-between gap-3">
              <h3 className="font-semibold text-[15px] leading-snug group-hover:text-primary transition-colors">
                {feature.title}
              </h3>
              <Badge variant={getStatusVariant(feature.status)} className="shrink-0 text-[11px]">
                {formatStatus(feature.status)}
              </Badge>
            </div>

            <p className="text-muted-foreground text-sm leading-relaxed line-clamp-2">
              {feature.description}
            </p>

            <div className="flex items-center gap-3 pt-1 text-xs text-muted-foreground flex-wrap">
              {feature.categories.slice(0, 3).map((cat) => (
                <Badge
                  key={cat}
                  variant="secondary"
                  className="text-[11px] h-5 px-2 font-normal rounded-full"
                >
                  {cat}
                </Badge>
              ))}
              {feature.categories.length > 3 && (
                <Badge
                  variant="secondary"
                  className="text-[11px] h-5 px-2 font-normal rounded-full"
                >
                  +{feature.categories.length - 3}
                </Badge>
              )}

              <span className="text-muted-foreground/60">·</span>

              {feature.targetDate && (
                <>
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {formatQuarter(feature.targetDate)}
                  </span>
                  <span className="text-muted-foreground/60">·</span>
                </>
              )}

              <span className="inline-flex items-center gap-1">
                <MessageSquare className="h-3 w-3" />
                {feature.commentCount}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
