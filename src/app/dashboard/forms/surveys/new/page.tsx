import { SurveyBuilder } from "../survey-builder"

export default function NewSurveyPage() {
  return (
    <div className="p-4">
       <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Create New Survey</h1>
      </div>
      <SurveyBuilder />
    </div>
  )
}












