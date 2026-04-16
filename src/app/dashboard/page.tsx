import { getAuthSession } from "@/lib/auth";
import { getActionItems } from "@/lib/onboarding-actions";
import { ProgramCalendar } from "@/components/program-calendar";
import { DashboardGrid } from "@/components/dashboard/dashboard-grid";

export default async function Page() {
  const session = await getAuthSession();
  const actionItems = session?.user?.organizationId
    ? await getActionItems(session.user.organizationId)
    : null;

  return (
    <div className="@container/main flex flex-1 flex-col gap-2">
      <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6 px-4 lg:px-6">
        <DashboardGrid actionItems={actionItems}>
          <ProgramCalendar />
        </DashboardGrid>
      </div>
    </div>
  );
}
