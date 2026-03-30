import { Survey, SurveyTable } from "./survey-table";
import { DashboardPageHeader } from "@/components/dashboard-page-header";

const data: Survey[] = [
  {
    id: "1",
    title: "End of Season Feedback",
    status: "closed",
    responses: 45,
    createdAt: "2023-12-10",
  },
  {
    id: "2",
    title: "New Uniform Voting",
    status: "active",
    responses: 12,
    createdAt: "2024-01-15",
  },
  {
    id: "3",
    title: "Summer Camp Interest",
    status: "draft",
    responses: 0,
    createdAt: "2024-02-01",
  },
];

export default function SurveysPage() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <DashboardPageHeader title="Surveys" />
      <div className="flex-1 rounded-xl md:min-h-min">
        <SurveyTable data={data} />
      </div>
    </div>
  );
}
