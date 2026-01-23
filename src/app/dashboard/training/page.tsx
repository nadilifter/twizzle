import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CalendarDays, Dumbbell, GraduationCap, LayoutList, Plus, Users } from "lucide-react"
import Link from "next/link"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"

export default function TrainingPage() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Training Overview</h1>
          <p className="text-muted-foreground">Manage your gymnastics programs, lesson plans, and skill progressions.</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/dashboard/training/programs">
              <Users className="mr-2 h-4 w-4" />
              Manage Programs
            </Link>
          </Button>
          <Button asChild>
            <Link href="/dashboard/training/plans">
              <Plus className="mr-2 h-4 w-4" />
              New Lesson Plan
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Programs</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">12</div>
            <p className="text-xs text-muted-foreground">+2 from last month</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Weekly Plans</CardTitle>
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">24</div>
            <p className="text-xs text-muted-foreground">Ready for this week</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Skills Database</CardTitle>
            <Dumbbell className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">450+</div>
            <p className="text-xs text-muted-foreground">Across 6 events</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Assessments</CardTitle>
            <GraduationCap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">85%</div>
            <p className="text-xs text-muted-foreground">Completion rate</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="recent" className="space-y-4">
        <TabsList>
          <TabsTrigger value="recent">Recent Plans</TabsTrigger>
          <TabsTrigger value="upcoming">Upcoming Classes</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
        </TabsList>
        <TabsContent value="recent" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recently Created Plans</CardTitle>
              <CardDescription>
                Lesson plans created or modified in the last 7 days.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {/* Placeholder items */}
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="flex items-center gap-4">
                  <div className="rounded-full bg-primary/10 p-2 text-primary">
                    <LayoutList className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="font-medium">Advanced Girls - Week 42</p>
                    <p className="text-sm text-muted-foreground">Bars & Vault Focus</p>
                  </div>
                </div>
                <Sheet>
                  <SheetTrigger asChild>
                    <Button variant="ghost" size="sm">View</Button>
                  </SheetTrigger>
                  <SheetContent>
                    <SheetHeader>
                      <SheetTitle>Advanced Girls - Week 42</SheetTitle>
                      <SheetDescription>
                        Bars & Vault Focus
                      </SheetDescription>
                    </SheetHeader>
                    <div className="mt-4 space-y-4">
                        <div>
                            <h3 className="text-sm font-medium">Program</h3>
                            <p className="text-sm text-muted-foreground">Junior Olympic (Girls)</p>
                        </div>
                        <div>
                            <h3 className="text-sm font-medium">Schedule</h3>
                            <p className="text-sm text-muted-foreground">Mon/Wed/Fri, 4:00 PM - 7:00 PM</p>
                        </div>
                        <div>
                            <h3 className="text-sm font-medium">Focus Areas</h3>
                            <ul className="list-disc list-inside text-sm text-muted-foreground">
                                <li>Uneven Bars: Kips and Clear Hips</li>
                                <li>Vault: Yurchenko Timers</li>
                                <li>Conditioning: Core and Upper Body</li>
                            </ul>
                        </div>
                        <Button className="w-full" asChild>
                            <Link href="/dashboard/training/plans/1">Edit Full Plan</Link>
                        </Button>
                    </div>
                  </SheetContent>
                </Sheet>
              </div>
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="flex items-center gap-4">
                  <div className="rounded-full bg-orange-500/10 p-2 text-orange-500">
                    <LayoutList className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="font-medium">Preschool - &quot;Under the Sea&quot;</p>
                    <p className="text-sm text-muted-foreground">Theme Week</p>
                  </div>
                </div>
                <Sheet>
                  <SheetTrigger asChild>
                    <Button variant="ghost" size="sm">View</Button>
                  </SheetTrigger>
                  <SheetContent>
                    <SheetHeader>
                      <SheetTitle>Preschool - &quot;Under the Sea&quot;</SheetTitle>
                      <SheetDescription>
                        Theme Week
                      </SheetDescription>
                    </SheetHeader>
                     <div className="mt-4 space-y-4">
                        <div>
                            <h3 className="text-sm font-medium">Program</h3>
                            <p className="text-sm text-muted-foreground">Preschool</p>
                        </div>
                        <div>
                            <h3 className="text-sm font-medium">Theme Details</h3>
                            <p className="text-sm text-muted-foreground">Focus on water-related movements and imagery. Use blue mats and aquatic plushies.</p>
                        </div>
                        <div>
                            <h3 className="text-sm font-medium">Stations</h3>
                            <ul className="list-disc list-inside text-sm text-muted-foreground">
                                <li>&quot;Swim&quot; across the beam (belly crawl)</li>
                                <li>&quot;Dive&quot; rolls (forward roll over mat)</li>
                                <li>&quot;Starfish&quot; jumps</li>
                            </ul>
                        </div>
                         <Button className="w-full" asChild>
                            <Link href="/dashboard/training/plans/2">Edit Full Plan</Link>
                        </Button>
                    </div>
                  </SheetContent>
                </Sheet>
              </div>
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="flex items-center gap-4">
                  <div className="rounded-full bg-blue-500/10 p-2 text-blue-500">
                    <LayoutList className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="font-medium">Boys Level 1-3</p>
                    <p className="text-sm text-muted-foreground">Strength & Conditioning</p>
                  </div>
                </div>
                <Sheet>
                  <SheetTrigger asChild>
                    <Button variant="ghost" size="sm">View</Button>
                  </SheetTrigger>
                  <SheetContent>
                    <SheetHeader>
                      <SheetTitle>Boys Level 1-3</SheetTitle>
                      <SheetDescription>
                        Strength & Conditioning Focus
                      </SheetDescription>
                    </SheetHeader>
                    <div className="mt-4 space-y-4">
                        <div>
                            <h3 className="text-sm font-medium">Program</h3>
                            <p className="text-sm text-muted-foreground">Boys Recreation & JO</p>
                        </div>
                        <div>
                            <h3 className="text-sm font-medium">Key Goals</h3>
                            <p className="text-sm text-muted-foreground">Improve rope climb times and L-hold duration.</p>
                        </div>
                         <Button className="w-full" asChild>
                            <Link href="/dashboard/training/plans/3">Edit Full Plan</Link>
                        </Button>
                    </div>
                  </SheetContent>
                </Sheet>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="upcoming">
          <Card>
             <CardHeader>
              <CardTitle>Upcoming Classes needing Plans</CardTitle>
              <CardDescription>
                Classes scheduled for tomorrow without assigned lesson plans.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">All classes for tomorrow have assigned plans.</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
