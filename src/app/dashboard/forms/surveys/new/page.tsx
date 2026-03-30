import { SurveyBuilder } from "../survey-builder";
import { DashboardPageHeader } from "@/components/dashboard-page-header";

export default function NewSurveyPage() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <DashboardPageHeader title="Create New Survey" variant="small" />
      <SurveyBuilder />
    </div>
  );
}
