import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarDays, ClipboardCheck, Camera, Star } from "lucide-react";
import Link from "next/link";

export default function CoachDashboard() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold mb-2">Overview</h2>
        <div className="grid gap-4 grid-cols-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-4">
              <CardTitle className="text-sm font-medium">Classes</CardTitle>
              <CalendarDays className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="text-2xl font-bold">3</div>
              <p className="text-xs text-muted-foreground">Today</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-4">
              <CardTitle className="text-sm font-medium">Attendance</CardTitle>
              <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="text-2xl font-bold text-destructive">1</div>
              <p className="text-xs text-muted-foreground">Pending</p>
            </CardContent>
          </Card>
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-2">Quick Actions</h2>
        <div className="grid grid-cols-2 gap-4">
          <Link href="/coach/attendance">
            <Card className="h-24 flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-accent transition-colors">
              <ClipboardCheck className="h-8 w-8 text-primary" />
              <span className="text-sm font-medium">Attendance</span>
            </Card>
          </Link>
          <Link href="/coach/evaluations">
            <Card className="h-24 flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-accent transition-colors">
              <Star className="h-8 w-8 text-primary" />
              <span className="text-sm font-medium">Evaluations</span>
            </Card>
          </Link>
          <Link href="/coach/media">
            <Card className="h-24 flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-accent transition-colors">
              <Camera className="h-8 w-8 text-primary" />
              <span className="text-sm font-medium">Media</span>
            </Card>
          </Link>
          <Link href="/coach/schedule">
            <Card className="h-24 flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-accent transition-colors">
              <CalendarDays className="h-8 w-8 text-primary" />
              <span className="text-sm font-medium">Schedule</span>
            </Card>
          </Link>
        </div>
      </div>
      
      <div>
        <h2 className="text-lg font-semibold mb-2">Next Up</h2>
        <Card>
          <CardContent className="p-4">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-bold">Level 2 Girls</h3>
                <p className="text-sm text-muted-foreground">4:00 PM - 5:30 PM</p>
                <p className="text-sm text-muted-foreground">Gym B</p>
              </div>
              <div className="bg-primary/10 text-primary px-2 py-1 rounded text-xs font-bold">
                8 Students
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
