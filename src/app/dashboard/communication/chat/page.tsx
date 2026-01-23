import { cookies } from "next/headers";
import { ChatLayout } from "@/components/chat/chat-layout";

export default function ChatPage() {
  const layout = cookies().get("react-resizable-panels:layout");
  const collapsed = cookies().get("react-resizable-panels:collapsed");

  const defaultLayout = layout ? JSON.parse(layout.value) : undefined;
  const defaultCollapsed = collapsed ? JSON.parse(collapsed.value) : undefined;

  return (
    // Height calculation: 100vh - header height (3rem/48px)
    <div className="flex h-[calc(100vh-3rem)] flex-col p-4 md:p-6"> 
      <div className="flex-1 overflow-hidden rounded-lg border bg-background shadow">
        <ChatLayout
            defaultLayout={defaultLayout}
            defaultCollapsed={defaultCollapsed}
            navCollapsedSize={4}
        />
      </div>
    </div>
  );
}
