import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ThumbsUp, Send, Calendar, Loader2, Shield, Clock } from "lucide-react";
import { useState } from "react";
import { FeatureRequest } from "./types";
import { formatStatus, getStatusVariant, formatQuarter } from "./utils";
import { formatDistanceToNow } from "date-fns";

interface FeatureDetailDialogProps {
  feature: FeatureRequest;
  loading?: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddComment: (featureId: string, content: string) => void;
  onVote: (featureId: string) => void;
  isLoggedIn: boolean;
}

export function FeatureDetailDialog({ 
  feature, 
  loading,
  open, 
  onOpenChange,
  onAddComment,
  onVote,
  isLoggedIn
}: FeatureDetailDialogProps) {
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleCommentSubmit = async () => {
    if (!comment.trim()) return;
    setSubmitting(true);
    try {
      await onAddComment(feature.id, comment);
      setComment("");
    } finally {
      setSubmitting(false);
    }
  };

  const comments = feature.comments || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] h-[80vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <Badge variant={getStatusVariant(feature.status)}>
              {formatStatus(feature.status)}
            </Badge>
            {feature.targetDate && (
              <Badge variant="outline" className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                Target: {formatQuarter(feature.targetDate)}
              </Badge>
            )}
            {feature.statusChangedAt && (
              <Badge variant="outline" className="flex items-center gap-1 text-muted-foreground">
                <Clock className="h-3 w-3" />
                Updated {formatDistanceToNow(new Date(feature.statusChangedAt), { addSuffix: true })}
              </Badge>
            )}
          </div>
          <DialogTitle className="text-2xl">{feature.title}</DialogTitle>
          <p className="text-xs text-muted-foreground">
            Submitted {new Date(feature.createdAt).toLocaleDateString()}
          </p>
        </DialogHeader>
        
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="flex-1 flex flex-col gap-6 overflow-hidden">
            <div className="space-y-4 shrink-0">
              <p className="text-muted-foreground">
                {feature.description}
              </p>
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex flex-wrap gap-2">
                  {feature.categories.map(cat => (
                    <Badge key={cat} variant="outline">{cat}</Badge>
                  ))}
                </div>
                <Button 
                  variant={feature.hasVoted ? "default" : "outline"} 
                  size="sm" 
                  className="gap-2"
                  onClick={() => onVote(feature.id)}
                  title={isLoggedIn ? (feature.hasVoted ? "Remove vote" : "Vote for this feature") : "Sign in to vote"}
                >
                  <ThumbsUp className={`h-4 w-4 ${feature.hasVoted ? "fill-current" : ""}`} />
                  {feature.voteCount} Votes
                </Button>
              </div>
              {feature.author && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Avatar className="h-6 w-6">
                    <AvatarImage src={feature.author.avatar || undefined} />
                    <AvatarFallback>{feature.author.name?.[0] || "?"}</AvatarFallback>
                  </Avatar>
                  <span>Submitted by <span className="font-medium text-foreground">{feature.author.name}</span></span>
                </div>
              )}
            </div>

            <Separator />

            <div className="flex-1 flex flex-col min-h-0">
              <h3 className="font-semibold mb-4">Comments ({comments.length})</h3>
              <ScrollArea className="flex-1 pr-4">
                <div className="space-y-4">
                  {comments.map((comment) => (
                    <div key={comment.id} className="flex gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={comment.author.avatar || undefined} />
                        <AvatarFallback>{comment.author.name?.[0] || "?"}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{comment.author.name}</span>
                            {(comment.isStaffReply || comment.author.isStaff) && (
                              <Badge variant="secondary" className="text-xs flex items-center gap-1 bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                                <Shield className="h-3 w-3" />
                                Uplifter Staff
                              </Badge>
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {new Date(comment.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {comment.content}
                        </p>
                      </div>
                    </div>
                  ))}
                  {comments.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No comments yet. {isLoggedIn ? "Be the first to share your thoughts!" : "Sign in to add a comment."}
                    </p>
                  )}
                </div>
              </ScrollArea>
            </div>

            {isLoggedIn ? (
              <div className="mt-4 flex gap-2 shrink-0">
                <Textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Add a comment..."
                  className="min-h-[60px]"
                />
                <Button 
                  size="icon" 
                  className="h-[60px] w-[60px] shrink-0"
                  onClick={handleCommentSubmit}
                  disabled={!comment.trim() || submitting}
                >
                  {submitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
            ) : (
              <div className="mt-4 text-center text-sm text-muted-foreground py-4 bg-muted/50 rounded-lg">
                Sign in to add a comment or vote on this feature
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
