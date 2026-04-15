import { getAuthSession } from "@/lib/auth";
import { getActionItems } from "@/lib/onboarding-actions";
import { ProgramCalendar } from "@/components/program-calendar";
import { ActionItemsPanel } from "@/components/dashboard/action-items-panel";

export default async function Page() {
  const session = await getAuthSession();
  const actionItems = session?.user?.organizationId
    ? await getActionItems(session.user.organizationId)
    : null;

  return (
    <div className="@container/main flex flex-1 flex-col gap-2">
      <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6 px-4 lg:px-6">
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-4">
          <div className="min-w-0">
            <ProgramCalendar />
          </div>
          {actionItems && (
            <div className="xl:order-last order-first">
              <div className="sticky top-4">
                <ActionItemsPanel data={actionItems} />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
