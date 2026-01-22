import { WaiverBuilder } from "../waiver-builder"

export default function NewWaiverPage() {
  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Create New Waiver</h1>
      </div>
      <WaiverBuilder />
    </div>
  )
}












