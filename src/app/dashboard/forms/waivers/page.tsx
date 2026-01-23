import { Waiver, WaiverTable } from "./waiver-table"

const data: Waiver[] = [
  {
    id: "1",
    title: "General Liability Waiver",
    status: "active",
    signedCount: 150,
    createdAt: "2023-01-01",
  },
  {
    id: "2",
    title: "Photo Release Form",
    status: "active",
    signedCount: 145,
    createdAt: "2023-01-01",
  },
  {
    id: "3",
    title: "Summer Camp Waiver 2024",
    status: "draft",
    signedCount: 0,
    createdAt: "2024-02-20",
  },
]

export default function WaiversPage() {
  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Waivers</h1>
      </div>
      <div className="flex-1 rounded-xl md:min-h-min">
        <WaiverTable data={data} />
      </div>
    </div>
  )
}
