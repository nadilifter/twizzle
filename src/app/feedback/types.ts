export type Status = "PLANNED" | "IN_PROGRESS" | "DONE" | "CLOSED";

export interface Author {
  id: string;
  name: string;
  avatar: string | null;
  isStaff?: boolean;
}

export interface Comment {
  id: string;
  content: string;
  createdAt: string;
  isStaffReply: boolean;
  author: Author;
}

export interface FeatureRequest {
  id: string;
  title: string;
  description: string;
  status: Status;
  categories: string[];
  targetDate: string | null;
  statusChangedAt: string | null;
  createdAt: string;
  author: Author | null;
  voteCount: number;
  commentCount: number;
  hasVoted: boolean;
  comments?: Comment[];
}

export interface Category {
  name: string;
  count: number;
}
