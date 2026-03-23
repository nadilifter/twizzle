import { redirect } from "next/navigation";
import { ChartAreaInteractive } from "@/components/chart-area-interactive";
import { SectionCards } from "@/components/section-cards";
import { ProgramCalendar } from "@/components/program-calendar";
import { getAuthSession } from "@/lib/auth";
import { getActionItems } from "@/lib/onboarding-actions";

export default async function Page() {
  const session = await getAuthSession();
  if (session?.user?.organizationId) {
    const { allComplete } = await getActionItems(session.user.organizationId);
    if (!allComplete) {
      redirect("/dashboard/action-items");
    }
  }

  return (
    <div className="@container/main flex flex-1 flex-col gap-2">
      <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
        <SectionCards />
        <div className="px-4 lg:px-6">
          <ChartAreaInteractive />
        </div>
        <div className="px-4 lg:px-6">
          <ProgramCalendar />
        </div>
      </div>
    </div>
  )
}
