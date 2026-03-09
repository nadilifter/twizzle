import { WaiverBuilder } from "../waiver-builder"
import { DashboardPageHeader } from "@/components/dashboard-page-header"

export default function NewWaiverPage() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <DashboardPageHeader title="Create New Waiver" variant="small" />
      <WaiverBuilder />
    </div>
  )
}












