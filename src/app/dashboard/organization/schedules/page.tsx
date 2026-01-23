"use client"

import { useState } from "react"
import {
  Calendar as CalendarIcon,
  Clock,
  Plus,
  Search,
  Filter,
  MoreHorizontal,
  User,
  Building,
  Briefcase,
  Check,
  X,
  ArrowRight
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Checkbox } from "@/components/ui/checkbox"

// Mock Data
const employees = [
  { id: 1, name: "Sarah Miller", role: "Head Coach", avatar: "/avatars/01.png", initials: "SM" },
  { id: 2, name: "David Chen", role: "Coach", avatar: "/avatars/02.png", initials: "DC" },
  { id: 3, name: "Jessica Williams", role: "Admin", avatar: "/avatars/03.png", initials: "JW" },
  { id: 4, name: "Michael Brown", role: "Coach", avatar: "/avatars/04.png", initials: "MB" },
]

const facilities = [
  { 
    id: 1, 
    name: "Main Gym Floor",
    totalHours: 12,
    blocks: [
      { name: "Classes", time: "9am-12pm", duration: 3, color: "bg-chart-1" },
      { name: "Open Gym", time: "2pm-4pm", duration: 2, color: "bg-chart-2" },
      { name: "Team Practice", time: "5pm-8pm", duration: 3, color: "bg-chart-3" },
      { name: "Open", time: "8am-9am", duration: 1, color: "bg-muted" },
      { name: "Open", time: "12pm-2pm", duration: 2, color: "bg-muted" },
      { name: "Open", time: "4pm-5pm", duration: 1, color: "bg-muted" },
    ]
  },
  { 
    id: 2, 
    name: "Dance Studio",
    totalHours: 8,
    blocks: [
      { name: "Morning Classes", time: "9am-11am", duration: 2, color: "bg-chart-1" },
      { name: "Open", time: "11am-2pm", duration: 3, color: "bg-muted" },
      { name: "Afternoon Classes", time: "2pm-5pm", duration: 3, color: "bg-chart-2" },
    ]
  },
  { 
    id: 3, 
    name: "Party Room",
    totalHours: 6,
    blocks: [
      { name: "Birthday Party", time: "10am-12pm", duration: 2, color: "bg-chart-4" },
      { name: "Open", time: "12pm-3pm", duration: 3, color: "bg-muted" },
      { name: "Event", time: "3pm-5pm", duration: 2, color: "bg-chart-5" },
    ]
  },
]

const roles = [
  { id: 1, name: "Opening Manager", color: "bg-blue-100 text-blue-800" },
  { id: 2, name: "Closing Manager", color: "bg-indigo-100 text-indigo-800" },
  { id: 3, name: "Head Coach", color: "bg-green-100 text-green-800" },
  { id: 4, name: "Front Desk", color: "bg-yellow-100 text-yellow-800" },
]

const shifts = [
  { id: 1, day: "Monday", date: "2023-11-20", time: "08:00 AM - 04:00 PM", role: "Opening Manager", assignee: 3, location: "Front Desk" },
  { id: 2, day: "Monday", date: "2023-11-20", time: "04:00 PM - 09:00 PM", role: "Closing Manager", assignee: 1, location: "Main Gym Floor" },
  { id: 3, day: "Tuesday", date: "2023-11-21", time: "08:00 AM - 04:00 PM", role: "Opening Manager", assignee: 3, location: "Front Desk" },
]

export default function SchedulesPage() {
  const [activeTab, setActiveTab] = useState("assignments")
  const [currentDate, setCurrentDate] = useState(new Date())

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Schedules & Availability</h1>
          <p className="text-muted-foreground">
            Manage employee shifts, facility usage, and role assignments.
          </p>
        </div>
        <div className="flex items-center gap-2">
           <Button variant="outline">
            <CalendarIcon className="mr-2 h-4 w-4" />
            View Calendar
          </Button>
        </div>
      </div>

      <Tabs defaultValue="assignments" className="space-y-4" onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="assignments">Roles & Assignments</TabsTrigger>
          <TabsTrigger value="employee-availability">Employee Availability</TabsTrigger>
          <TabsTrigger value="facility-availability">Facility Availability</TabsTrigger>
        </TabsList>

        <TabsContent value="assignments" className="space-y-4">
          <div className="flex items-center justify-between">
             <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search assignments..." className="w-[250px]" />
              <Button variant="outline" size="icon">
                <Filter className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline">Manage Roles</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Manage Roles</DialogTitle>
                    <DialogDescription>
                      Create and edit roles for scheduling.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="grid gap-2">
                      <Label>Existing Roles</Label>
                      <div className="flex flex-wrap gap-2">
                        {roles.map((role) => (
                          <Badge key={role.id} variant="secondary" className="px-3 py-1 text-sm cursor-pointer hover:bg-secondary/80">
                            {role.name}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="new-role">Add New Role</Label>
                      <div className="flex items-center gap-2">
                        <Input id="new-role" placeholder="e.g. Shift Supervisor" />
                        <Button size="sm">Add</Button>
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="secondary">Close</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              <Sheet>
                <SheetTrigger asChild>
                  <Button>
                    <Plus className="mr-2 h-4 w-4" /> Assign Shift
                  </Button>
                </SheetTrigger>
              <SheetContent>
                <SheetHeader>
                  <SheetTitle>Create New Assignment</SheetTitle>
                  <SheetDescription>Assign an employee to a specific role and time.</SheetDescription>
                </SheetHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="role">Role</Label>
                    <Select>
                      <SelectTrigger>
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                      <SelectContent>
                        {roles.map((role) => (
                          <SelectItem key={role.id} value={role.name}>{role.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                   <div className="grid gap-2">
                    <Label htmlFor="employee">Employee</Label>
                    <Select>
                      <SelectTrigger>
                        <SelectValue placeholder="Select employee" />
                      </SelectTrigger>
                      <SelectContent>
                        {employees.map((emp) => (
                          <SelectItem key={emp.id} value={emp.id.toString()}>{emp.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="date">Date</Label>
                    <Input id="date" type="date" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="start-time">Start Time</Label>
                      <Input id="start-time" type="time" />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="end-time">End Time</Label>
                      <Input id="end-time" type="time" />
                    </div>
                  </div>
                   <div className="grid gap-2">
                    <Label htmlFor="location">Location (Optional)</Label>
                    <Select>
                      <SelectTrigger>
                        <SelectValue placeholder="Select facility" />
                      </SelectTrigger>
                      <SelectContent>
                        {facilities.map((fac) => (
                          <SelectItem key={fac.id} value={fac.id.toString()}>{fac.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <SheetFooter>
                  <SheetClose asChild>
                    <Button type="submit">Save Assignment</Button>
                  </SheetClose>
                </SheetFooter>
              </SheetContent>
            </Sheet>
          </div>
        </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Employee</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shifts.map((shift) => {
                  const assignee = employees.find(e => e.id === shift.assignee);
                  return (
                    <TableRow key={shift.id}>
                      <TableCell className="font-medium">
                        <div className="flex flex-col">
                          <span>{shift.day}</span>
                          <span className="text-xs text-muted-foreground">{shift.date}</span>
                        </div>
                      </TableCell>
                      <TableCell>{shift.time}</TableCell>
                      <TableCell>
                         <Badge variant="outline" className={roles.find(r => r.name === shift.role)?.color}>
                          {shift.role}
                         </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-6 w-6">
                            <AvatarImage src={assignee?.avatar} />
                            <AvatarFallback>{assignee?.initials}</AvatarFallback>
                          </Avatar>
                          <span>{assignee?.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>{shift.location}</TableCell>
                      <TableCell className="text-right">
                         <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <span className="sr-only">Open menu</span>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuItem>Edit Shift</DropdownMenuItem>
                            <DropdownMenuItem>Reassign</DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-red-600">Cancel Shift</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="employee-availability" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
             {employees.map((employee) => (
              <Card key={employee.id}>
                <CardHeader className="flex flex-row items-center gap-4 pb-2">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={employee.avatar} />
                    <AvatarFallback>{employee.initials}</AvatarFallback>
                  </Avatar>
                  <div>
                    <CardTitle className="text-base">{employee.name}</CardTitle>
                    <CardDescription>{employee.role}</CardDescription>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="text-sm font-medium">Weekly Availability</div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-green-500"></div>
                        <span>Mon: 9am-5pm</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-green-500"></div>
                        <span>Tue: 9am-5pm</span>
                      </div>
                       <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-green-500"></div>
                        <span>Wed: 9am-5pm</span>
                      </div>
                       <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-yellow-500"></div>
                        <span>Thu: 12pm-8pm</span>
                      </div>
                       <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-green-500"></div>
                        <span>Fri: 9am-5pm</span>
                      </div>
                       <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-red-500"></div>
                        <span>Sat: Unavailable</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
                <CardFooter>
                  <Sheet>
                    <SheetTrigger asChild>
                       <Button variant="outline" className="w-full">Edit Availability</Button>
                    </SheetTrigger>
                    <SheetContent>
                      <SheetHeader>
                        <SheetTitle>Edit Availability - {employee.name}</SheetTitle>
                         <SheetDescription>Set standard weekly availability.</SheetDescription>
                      </SheetHeader>
                      <div className="grid gap-4 py-4">
                         {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map((day) => (
                           <div key={day} className="flex items-center justify-between">
                             <div className="flex items-center gap-2">
                               <Checkbox id={`avail-${day}`} defaultChecked={day !== "Sunday" && day !== "Saturday"} />
                               <Label htmlFor={`avail-${day}`}>{day}</Label>
                             </div>
                             <div className="flex items-center gap-2">
                               <Input type="time" className="w-24 h-8" defaultValue="09:00" />
                               <span>-</span>
                               <Input type="time" className="w-24 h-8" defaultValue="17:00" />
                             </div>
                           </div>
                         ))}
                      </div>
                      <SheetFooter>
                        <SheetClose asChild>
                          <Button type="submit">Save Changes</Button>
                        </SheetClose>
                      </SheetFooter>
                    </SheetContent>
                  </Sheet>
                </CardFooter>
              </Card>
             ))}
          </div>
        </TabsContent>

        <TabsContent value="facility-availability" className="space-y-4">
          <div className="grid gap-6">
            {facilities.map((facility) => (
              <Card key={facility.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>{facility.name}</CardTitle>
                    <Badge variant="outline" className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {facility.totalHours} hrs
                    </Badge>
                  </div>
                  <CardDescription>
                    Scheduled usage and open blocks.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {/* Visual Bar */}
                  <div className="h-12 w-full flex rounded-md overflow-hidden mb-4 border">
                    {facility.blocks.map((block, i) => {
                      const widthPercent = (block.duration / facility.totalHours) * 100;
                      return (
                        <div 
                          key={i} 
                          style={{ width: `${widthPercent}%` }} 
                          className={`${block.color} flex items-center justify-center text-xs font-medium ${block.color === 'bg-muted' ? 'text-slate-700' : 'text-white'} border-r last:border-r-0 hover:opacity-90 transition-opacity`}
                          title={`${block.name}: ${block.time} (${block.duration}h)`}
                        >
                          {widthPercent > 10 ? block.name : ''}
                        </div>
                      )
                    })}
                  </div>

                  {/* Legend / List */}
                  <div className="flex flex-wrap gap-4 text-sm">
                    {facility.blocks.map((block, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${block.color} border border-slate-300`} />
                        <span className="font-medium">{block.name}</span>
                        <span className="text-muted-foreground">({block.time})</span>
                        {i < facility.blocks.length - 1 && <ArrowRight className="h-3 w-3 text-muted-foreground" />}
                      </div>
                    ))}
                  </div>
                </CardContent>
                <CardFooter className="justify-end border-t pt-4">
                  <Sheet>
                    <SheetTrigger asChild>
                      <Button variant="outline" size="sm">Manage Schedule</Button>
                    </SheetTrigger>
                    <SheetContent>
                      <SheetHeader>
                        <SheetTitle>Manage Schedule - {facility.name}</SheetTitle>
                        <SheetDescription>
                          Configure scheduled usage and availability blocks.
                        </SheetDescription>
                      </SheetHeader>
                      <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                          <Label>Schedule Blocks</Label>
                          <div className="space-y-3">
                            {facility.blocks.map((block, i) => (
                              <div key={i} className="flex gap-2 items-end">
                                <div className="grid gap-1 flex-1">
                                  <Label className="text-xs">Block Name</Label>
                                  <Input defaultValue={block.name} />
                                </div>
                                <div className="grid gap-1 w-24">
                                  <Label className="text-xs">Start Time</Label>
                                  <Input type="time" />
                                </div>
                                <div className="grid gap-1 w-24">
                                  <Label className="text-xs">End Time</Label>
                                  <Input type="time" />
                                </div>
                                <div className="grid gap-1 w-32">
                                  <Label className="text-xs">Color</Label>
                                  <Select defaultValue={
                                    block.color.includes("chart-1") ? "purple" :
                                    block.color.includes("chart-2") ? "cyan" :
                                    block.color.includes("chart-3") ? "pink" :
                                    block.color.includes("chart-4") ? "teal" :
                                    block.color.includes("chart-5") ? "indigo" : "gray"
                                  }>
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="purple">Purple</SelectItem>
                                      <SelectItem value="cyan">Cyan</SelectItem>
                                      <SelectItem value="pink">Pink</SelectItem>
                                      <SelectItem value="teal">Teal</SelectItem>
                                      <SelectItem value="indigo">Indigo</SelectItem>
                                      <SelectItem value="gray">Gray</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                <Button variant="ghost" size="icon"><X className="h-4 w-4" /></Button>
                              </div>
                            ))}
                            <Button variant="outline" size="sm" className="w-full border-dashed">
                              <Plus className="mr-2 h-4 w-4" /> Add Block
                            </Button>
                          </div>
                        </div>
                      </div>
                      <SheetFooter>
                        <SheetClose asChild>
                          <Button type="submit">Save Changes</Button>
                        </SheetClose>
                      </SheetFooter>
                    </SheetContent>
                  </Sheet>
                </CardFooter>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

