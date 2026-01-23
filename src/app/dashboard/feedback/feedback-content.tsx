"use client";

import { useState } from "react";
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { FeatureRequest, Status } from "./types";
import { initialFeatures } from "./data";
import { FeatureList } from "./feature-list";
import { RoadmapBoard } from "./roadmap-board";
import { SubmitFeatureDialog } from "./submit-feature-dialog";
import { FeatureDetailDialog } from "./feature-detail-dialog";

export function FeedbackContent() {
  const [features, setFeatures] = useState<FeatureRequest[]>(initialFeatures);
  const [isSubmitOpen, setIsSubmitOpen] = useState(false);
  const [selectedFeature, setSelectedFeature] = useState<FeatureRequest | null>(null);

  const handleVote = (id: string) => {
    setFeatures((prev) =>
      prev.map((f) =>
        f.id === id ? { ...f, votes: f.votes + 1 } : f
      )
    );
  };

  const handleSubmit = (feature: Omit<FeatureRequest, "id" | "votes" | "comments" | "createdAt" | "author">) => {
    const newFeature: FeatureRequest = {
      ...feature,
      id: Math.random().toString(36).substr(2, 9),
      votes: 0,
      comments: [],
      author: "Current User", // Mock user
      createdAt: new Date().toISOString(),
    };
    setFeatures([newFeature, ...features]);
    setIsSubmitOpen(false);
  };

  const handleAddComment = (featureId: string, content: string) => {
    setFeatures((prev) =>
      prev.map((f) => {
        if (f.id === featureId) {
          return {
            ...f,
            comments: [
              ...f.comments,
              {
                id: Math.random().toString(36).substr(2, 9),
                author: "Current User",
                avatar: "/avatars/shadcn.jpg", // Mock avatar
                content,
                createdAt: new Date().toISOString(),
              },
            ],
          };
        }
        return f;
      })
    );
    
    // Also update selected feature to reflect changes immediately
    if (selectedFeature && selectedFeature.id === featureId) {
        setSelectedFeature(prev => {
            if (!prev) return null;
            return {
                ...prev,
                 comments: [
                    ...prev.comments,
                    {
                        id: Math.random().toString(36).substr(2, 9),
                        author: "Current User",
                        avatar: "/avatars/shadcn.jpg",
                        content,
                        createdAt: new Date().toISOString(),
                    }
                ]
            }
        })
    }
  };
  
  const handleUpdateStatus = (id: string, newStatus: Status) => {
      setFeatures(prev => prev.map(f => f.id === id ? { ...f, status: newStatus } : f));
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] p-4 md:p-6 space-y-6 overflow-hidden">
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Product Feedback</h1>
          <p className="text-muted-foreground">
            Help us improve by voting on features or suggesting new ones.
          </p>
        </div>
        <Button onClick={() => setIsSubmitOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Submit Feedback
        </Button>
      </div>

      <Tabs defaultValue="requests" className="flex-1 flex flex-col min-h-0">
        <TabsList className="shrink-0 w-fit">
          <TabsTrigger value="requests">Feature Requests</TabsTrigger>
          <TabsTrigger value="roadmap">Roadmap</TabsTrigger>
        </TabsList>
        <TabsContent value="requests" className="flex-1 mt-4 min-h-0">
          <FeatureList 
            features={features} 
            onVote={handleVote} 
            onSelect={setSelectedFeature} 
          />
        </TabsContent>
        <TabsContent value="roadmap" className="flex-1 mt-4 min-h-0">
          <RoadmapBoard 
            features={features} 
            onStatusChange={handleUpdateStatus}
            onSelect={setSelectedFeature}
          />
        </TabsContent>
      </Tabs>

      <SubmitFeatureDialog 
        open={isSubmitOpen} 
        onOpenChange={setIsSubmitOpen} 
        onSubmit={handleSubmit} 
      />

      {selectedFeature && (
        <FeatureDetailDialog
          feature={selectedFeature}
          open={!!selectedFeature}
          onOpenChange={(open) => !open && setSelectedFeature(null)}
          onAddComment={handleAddComment}
          onVote={handleVote}
        />
      )}
    </div>
  );
}

