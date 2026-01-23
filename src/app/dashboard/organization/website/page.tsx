"use client";

import dynamic from "next/dynamic";

const WebsiteEditor = dynamic(
  () => import("@/components/website-editor").then((mod) => mod.WebsiteEditor),
  { ssr: false }
);

export default function WebsitePage() {
  return (
    <div className="h-[calc(100vh-4rem)] p-4">
      <WebsiteEditor />
    </div>
  );
}
