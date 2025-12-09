export type Status = "planned" | "in-progress" | "done" | "under-review";

export interface Comment {
  id: string;
  author: string;
  avatar: string;
  content: string;
  createdAt: string;
}

export interface FeatureRequest {
  id: string;
  title: string;
  description: string;
  status: Status;
  votes: number;
  comments: Comment[];
  author: string;
  createdAt: string;
  tags: string[];
}



