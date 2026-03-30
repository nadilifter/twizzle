import { FeedbackContent } from "./feedback-content";

// Force dynamic rendering to prevent static generation
export const dynamic = "force-dynamic";

export default function FeedbackPage() {
  return <FeedbackContent />;
}
