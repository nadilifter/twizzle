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
import { ThumbsUp, Send } from "lucide-react";
import { useState } from "react";
import { FeatureRequest } from "./types";
import { formatStatus, getStatusVariant } from "./utils";

interface FeatureDetailDialogProps {
  feature: FeatureRequest;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddComment: (featureId: string, content: string) => void;
  onVote: (featureId: string) => void;
}

export function FeatureDetailDialog({ 
  feature, 
  open, 
  onOpenChange,
  onAddComment,
  onVote
}: FeatureDetailDialogProps) {
  const [comment, setComment] = useState("");

  const handleCommentSubmit = () => {
    if (!comment.trim()) return;
    onAddComment(feature.id, comment);
    setComment("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] h-[80vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-2">
            <Badge variant={getStatusVariant(feature.status)}>
              {formatStatus(feature.status)}
            </Badge>
            <span className="text-sm text-muted-foreground">
              {new Date(feature.createdAt).toLocaleDateString()}
            </span>
          </div>
          <DialogTitle className="text-2xl">{feature.title}</DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 flex flex-col gap-6 overflow-hidden">
          <div className="space-y-4 shrink-0">
            <p className="text-muted-foreground">
              {feature.description}
            </p>
            <div className="flex items-center justify-between">
              <div className="flex gap-2">
                {feature.tags.map(tag => (
                  <Badge key={tag} variant="outline">{tag}</Badge>
                ))}
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                className="gap-2"
                onClick={() => onVote(feature.id)}
              >
                <ThumbsUp className="h-4 w-4" />
                {feature.votes} Votes
              </Button>
            </div>
          </div>

          <Separator />

          <div className="flex-1 flex flex-col min-h-0">
            <h3 className="font-semibold mb-4">Comments ({feature.comments.length})</h3>
            <ScrollArea className="flex-1 pr-4">
              <div className="space-y-4">
                {feature.comments.map((comment) => (
                  <div key={comment.id} className="flex gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={comment.avatar} />
                      <AvatarFallback>{comment.author[0]}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{comment.author}</span>
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
                {feature.comments.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No comments yet. Be the first to share your thoughts!
                  </p>
                )}
              </div>
            </ScrollArea>
          </div>

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
              disabled={!comment.trim()}
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

