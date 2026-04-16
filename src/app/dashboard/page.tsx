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
        <div className="grid w-full max-w-[2000px] grid-cols-1 gap-4 xl:grid-cols-[360px_minmax(0,1fr)] min-[1920px]:grid-cols-[minmax(360px,1fr)_1400px]">
          {actionItems && (
            <div className="flex">
              <ActionItemsPanel data={actionItems} />
            </div>
          )}
          <div className="min-w-0">
            <ProgramCalendar />
          </div>
        </div>
      </div>
    </div>
  );
}
