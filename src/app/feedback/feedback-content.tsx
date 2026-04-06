"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Loader2, Filter } from "lucide-react";
import { FeatureRequest, Status, Category, Comment } from "./types";
import { FeatureList } from "./feature-list";
import { RoadmapBoard } from "./roadmap-board";
import { SubmitFeatureDialog } from "./submit-feature-dialog";
import { FeatureDetailDialog } from "./feature-detail-dialog";
import { toast } from "sonner";

/**
 * Build the login URL with callback to return to feedback page
 */
function getLoginUrlWithCallback(): string {
  if (typeof window === "undefined") return "/login";

  const hostname = window.location.hostname;
  const protocol = window.location.protocol;
  const port = window.location.port;

  // Construct the current feedback page URL as the callback
  const feedbackUrl = `${protocol}//${hostname}${port ? `:${port}` : ""}${window.location.pathname}?action=submit`;

  // Determine the login subdomain URL
  const parts = hostname.split(".");
  let loginUrl: string;

  if (hostname.includes("localhost")) {
    // Local development
    const baseDomain = parts.slice(1).join(".") || "uplifter.localhost";
    loginUrl = `${protocol}//login.${baseDomain}${port ? `:${port}` : ""}`;
  } else {
    // Production/staging
    const baseDomain = parts.slice(1).join(".");
    loginUrl = `${protocol}//login.${baseDomain}`;
  }

  return `${loginUrl}?callbackUrl=${encodeURIComponent(feedbackUrl)}`;
}

export function FeedbackContent() {
  const { data: session, status: sessionStatus } = useSession();
  const searchParams = useSearchParams();
  const [features, setFeatures] = useState<FeatureRequest[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("votes");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitOpen, setIsSubmitOpen] = useState(false);
  const [selectedFeature, setSelectedFeature] = useState<FeatureRequest | null>(null);
  const [featureDetails, setFeatureDetails] = useState<FeatureRequest | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [hasCheckedAction, setHasCheckedAction] = useState(false);

  const isLoggedIn = sessionStatus === "authenticated" && !!session?.user;

  // Check for action=submit in URL after login redirect
  useEffect(() => {
    if (sessionStatus === "loading" || hasCheckedAction) return;

    const action = searchParams.get("action");
    if (action === "submit" && isLoggedIn) {
      setIsSubmitOpen(true);
      // Clear the action param from URL without page reload
      const url = new URL(window.location.href);
      url.searchParams.delete("action");
      window.history.replaceState({}, "", url.toString());
    }
    setHasCheckedAction(true);
  }, [sessionStatus, isLoggedIn, searchParams, hasCheckedAction]);

  // Handler for submit button click
  const handleSubmitClick = useCallback(() => {
    if (!isLoggedIn) {
      // Redirect to login with callback to return here
      window.location.href = getLoginUrlWithCallback();
      return;
    }
    setIsSubmitOpen(true);
  }, [isLoggedIn]);

  // Fetch features
  const fetchFeatures = async () => {
    try {
      const params = new URLSearchParams();
      if (selectedCategory && selectedCategory !== "all") {
        params.set("category", selectedCategory);
      }
      params.set("sortBy", sortBy);

      const response = await fetch(`/api/feedback?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setFeatures(data.data || []);
      }
    } catch (error) {
      console.error("Failed to fetch features:", error);
      toast.error("Failed to load features");
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch categories
  const fetchCategories = async () => {
    try {
      const response = await fetch("/api/feedback/categories");
      if (response.ok) {
        const data = await response.json();
        setCategories(data.data || []);
      }
    } catch (error) {
      console.error("Failed to fetch categories:", error);
    }
  };

  useEffect(() => {
    fetchFeatures();
    fetchCategories();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategory, sortBy]);

  // Fetch feature details when selected
  const handleSelectFeature = async (feature: FeatureRequest) => {
    setSelectedFeature(feature);
    setLoadingDetails(true);

    try {
      const response = await fetch(`/api/feedback/${feature.id}`);
      if (response.ok) {
        const data = await response.json();
        setFeatureDetails(data);
      }
    } catch (error) {
      console.error("Failed to fetch feature details:", error);
      toast.error("Failed to load feature details");
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleVote = async (id: string) => {
    if (!isLoggedIn) {
      toast.error("Sign in to vote - redirecting...");
      setTimeout(() => {
        window.location.href = getLoginUrlWithCallback();
      }, 1000);
      return;
    }

    try {
      const response = await fetch(`/api/feedback/${id}/vote`, {
        method: "POST",
      });

      if (response.ok) {
        const data = await response.json();
        // Update the feature in the list
        setFeatures((prev) =>
          prev.map((f) =>
            f.id === id ? { ...f, voteCount: data.voteCount, hasVoted: data.voted } : f
          )
        );
        // Update feature details if open
        if (featureDetails?.id === id) {
          setFeatureDetails((prev) =>
            prev ? { ...prev, voteCount: data.voteCount, hasVoted: data.voted } : null
          );
        }
        toast.success(data.voted ? "Vote added!" : "Vote removed");
      }
    } catch (error) {
      console.error("Failed to vote:", error);
      toast.error("Failed to process vote");
    }
  };

  const handleSubmit = async (data: {
    title: string;
    description: string;
    categories: string[];
  }) => {
    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (response.ok) {
        toast.success("Feedback submitted! It will be reviewed by our team.");
        setIsSubmitOpen(false);
        // Don't add to list since it needs approval
      } else {
        const error = await response.json();
        throw new Error(error.error || "Failed to submit feedback");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to submit feedback");
    }
  };

  const handleAddComment = async (featureId: string, content: string) => {
    if (!isLoggedIn) {
      toast.error("Sign in to comment - redirecting...");
      setTimeout(() => {
        window.location.href = getLoginUrlWithCallback();
      }, 1000);
      return;
    }

    try {
      const response = await fetch(`/api/feedback/${featureId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });

      if (response.ok) {
        const data = await response.json();
        // Update feature details with new comment
        if (featureDetails?.id === featureId) {
          setFeatureDetails((prev) =>
            prev
              ? {
                  ...prev,
                  comments: [...(prev.comments || []), data.data],
                }
              : null
          );
        }
        // Update comment count in list
        setFeatures((prev) =>
          prev.map((f) => (f.id === featureId ? { ...f, commentCount: f.commentCount + 1 } : f))
        );
        toast.success("Comment added!");
      }
    } catch (error) {
      console.error("Failed to add comment:", error);
      toast.error("Failed to add comment");
    }
  };

  const handleCloseDetails = () => {
    setSelectedFeature(null);
    setFeatureDetails(null);
  };

  return (
    <div className="space-y-8">
      {/* Hero */}
      <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">Product Feedback</h1>
          <p className="text-muted-foreground text-base">
            Vote on features you want, or suggest something new.
          </p>
        </div>
        <Button onClick={handleSubmitClick} size="lg" className="shrink-0">
          <Plus className="mr-2 h-4 w-4" />
          Submit Feedback
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <Tabs defaultValue="requests" className="w-full">
          {/* Toolbar */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b pb-4">
            <TabsList className="w-fit">
              <TabsTrigger value="requests">Feature Requests</TabsTrigger>
              <TabsTrigger value="roadmap">Roadmap</TabsTrigger>
            </TabsList>

            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="w-[160px] h-9 text-sm">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat.name} value={cat.name}>
                      {cat.name} ({cat.count})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-[140px] h-9 text-sm">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="votes">Most Voted</SelectItem>
                  <SelectItem value="newest">Newest</SelectItem>
                  <SelectItem value="targetDate">Target Date</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Content */}
          <TabsContent value="requests" className="mt-6">
            {features.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <p className="text-muted-foreground">No features found</p>
                {selectedCategory !== "all" && (
                  <Button
                    variant="link"
                    onClick={() => setSelectedCategory("all")}
                    className="mt-2"
                  >
                    Clear filter
                  </Button>
                )}
              </div>
            ) : (
              <FeatureList
                features={features}
                onVote={handleVote}
                onSelect={handleSelectFeature}
                isLoggedIn={isLoggedIn}
              />
            )}
          </TabsContent>
          <TabsContent value="roadmap" className="mt-6">
            <RoadmapBoard features={features} onSelect={handleSelectFeature} />
          </TabsContent>
        </Tabs>
      )}

      <SubmitFeatureDialog
        open={isSubmitOpen}
        onOpenChange={setIsSubmitOpen}
        onSubmit={handleSubmit}
      />

      {selectedFeature && (
        <FeatureDetailDialog
          feature={featureDetails || selectedFeature}
          loading={loadingDetails}
          open={!!selectedFeature}
          onOpenChange={(open) => !open && handleCloseDetails()}
          onAddComment={handleAddComment}
          onVote={handleVote}
          isLoggedIn={isLoggedIn}
        />
      )}
    </div>
  );
}
