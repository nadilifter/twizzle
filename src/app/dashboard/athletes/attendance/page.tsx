"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Check, X, Clock } from "lucide-react"
import { useState } from "react"

const attendanceData = [
  { id: 1, name: "Sophia Miller", status: "Present", time: "03:55 PM", avatar: "/avatars/01.png" },
  { id: 2, name: "Olivia Chen", status: "Absent", time: "-", avatar: "/avatars/02.png" },
  { id: 3, name: "Isabella Jones", status: "Present", time: "04:05 PM", avatar: "/avatars/03.png" },
  { id: 4, name: "Mia Wilson", status: "Late", time: "04:15 PM", avatar: "/avatars/04.png" },
  { id: 5, name: "Ava Davis", status: "Present", time: "03:58 PM", avatar: "/avatars/06.png" },
]

export default function AttendancePage() {
  const [date, setDate] = useState<Date | undefined>(new Date())

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight">Attendance</h1>
        <p className="text-muted-foreground">
          Track daily attendance for training groups.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-[300px_1fr]">
        <div className="flex flex-col gap-6">
          <Card>
            <CardContent className="p-4">
              <Calendar
                mode="single"
                selected={date}
                onSelect={setDate}
                className="rounded-md border w-full flex justify-center"
              />
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Class Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground text-sm">Present</span>
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">3</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground text-sm">Absent</span>
                <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">1</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground text-sm">Late</span>
                <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">1</Badge>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <Select defaultValue="elite-squad">
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Select Group" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="elite-squad">Elite Squad</SelectItem>
                <SelectItem value="level-4">Level 4 Team</SelectItem>
                <SelectItem value="rec-1">Recreational 1</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline">Mark All Present</Button>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Athlete</TableHead>
                    <TableHead>Check-in Time</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {attendanceData.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={record.avatar} />
                            <AvatarFallback>{record.name.charAt(0)}</AvatarFallback>
                          </Avatar>
                          {record.name}
                        </div>
                      </TableCell>
                      <TableCell>{record.time}</TableCell>
                      <TableCell>
                        <Badge 
                          variant="outline" 
                          className={
                            record.status === "Present" ? "bg-green-50 text-green-700 border-green-200" :
                            record.status === "Absent" ? "bg-red-50 text-red-700 border-red-200" :
                            "bg-yellow-50 text-yellow-700 border-yellow-200"
                          }
                        >
                          {record.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50">
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-yellow-600 hover:text-yellow-700 hover:bg-yellow-50">
                            <Clock className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50">
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
