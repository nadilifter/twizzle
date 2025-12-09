"use client"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Plus, Search, Users, Dumbbell, Settings } from "lucide-react"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

// Mock data for programs
const programs = [
  {
    id: "rec",
    name: "Recreational",
    description: "Fun and fitness for all ages. Focus on fundamentals.",
    levels: ["Bronze", "Silver", "Gold", "Platinum"],
    ageRange: "6-12 yrs",
    gender: "Co-ed",
    studentCount: 120,
  },
  {
    id: "preschool",
    name: "Preschool",
    description: "Movement exploration for toddlers and young children.",
    levels: ["Parent & Tot", "Kindergym 1", "Kindergym 2"],
    ageRange: "18mo - 5 yrs",
    gender: "Co-ed",
    studentCount: 85,
  },
  {
    id: "jo-girls",
    name: "Junior Olympic (Girls)",
    description: "Competitive program following USAG levels.",
    levels: ["Level 1", "Level 2", "Level 3", "Level 4", "Level 5-10"],
    ageRange: "6+ yrs",
    gender: "Girls",
    studentCount: 45,
  },
  {
    id: "xcel",
    name: "Xcel",
    description: "Flexible competitive program designed for retention.",
    levels: ["Bronze", "Silver", "Gold", "Platinum", "Diamond"],
    ageRange: "6+ yrs",
    gender: "Girls",
    studentCount: 60,
  },
  {
    id: "boys-rec",
    name: "Boys Recreation",
    description: "Strength and discipline focus on 6 men's events.",
    levels: ["Level 1", "Level 2", "Level 3"],
    ageRange: "6+ yrs",
    gender: "Boys",
    studentCount: 30,
  },
  {
    id: "adult",
    name: "Adult Gymnastics",
    description: "It's never too late to learn! Open gym style classes.",
    levels: ["Beginner", "Advanced"],
    ageRange: "18+ yrs",
    gender: "Co-ed",
    studentCount: 15,
  },
]

export default function ProgramsPage() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Programs</h1>
          <p className="text-muted-foreground">
            Manage your gym&apos;s training programs and curriculum levels.
          </p>
        </div>
        <Sheet>
            <SheetTrigger asChild>
                <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Program
                </Button>
            </SheetTrigger>
            <SheetContent>
                <SheetHeader>
                    <SheetTitle>Add New Program</SheetTitle>
                    <SheetDescription>
                        Create a new training program for your gym.
                    </SheetDescription>
                </SheetHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                        <Label htmlFor="name">Program Name</Label>
                        <Input id="name" placeholder="e.g. Tumbling Class" />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="description">Description</Label>
                        <Textarea id="description" placeholder="Describe the program goals..." />
                    </div>
                     <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label htmlFor="age-min">Min Age</Label>
                            <Input id="age-min" type="number" placeholder="e.g. 6" />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="age-max">Max Age</Label>
                            <Input id="age-max" type="number" placeholder="e.g. 18" />
                        </div>
                     </div>
                      <div className="grid gap-2">
                        <Label htmlFor="gender">Gender Focus</Label>
                        <Input id="gender" placeholder="Co-ed, Girls, Boys..." />
                    </div>
                </div>
                <SheetFooter>
                    <Button type="submit">Create Program</Button>
                </SheetFooter>
            </SheetContent>
        </Sheet>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 md:max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search programs..."
            className="pl-8"
          />
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {programs.map((program) => (
          <Card key={program.id} className="flex flex-col">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle>{program.name}</CardTitle>
                  <CardDescription className="mt-1">{program.gender} • {program.ageRange}</CardDescription>
                </div>
                <Badge variant="secondary" className="ml-2 shrink-0">
                  {program.studentCount} Athletes
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="flex-1">
              <p className="text-sm text-muted-foreground mb-4">
                {program.description}
              </p>
              <div className="space-y-2">
                <div className="text-sm font-medium flex items-center gap-2">
                  <Dumbbell className="h-4 w-4" />
                  Levels:
                </div>
                <div className="flex flex-wrap gap-1">
                  {program.levels.map((level) => (
                    <Badge key={level} variant="outline" className="text-xs">
                      {level}
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
            <CardFooter className="border-t pt-4 gap-2">
              <Sheet>
                  <SheetTrigger asChild>
                    <Button variant="outline" className="w-full">
                        <Settings className="mr-2 h-4 w-4" />
                        Configure
                    </Button>
                  </SheetTrigger>
                   <SheetContent>
                    <SheetHeader>
                        <SheetTitle>Configure {program.name}</SheetTitle>
                        <SheetDescription>
                            Update program details and levels.
                        </SheetDescription>
                    </SheetHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor={`name-${program.id}`}>Program Name</Label>
                            <Input id={`name-${program.id}`} defaultValue={program.name} />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor={`desc-${program.id}`}>Description</Label>
                            <Textarea id={`desc-${program.id}`} defaultValue={program.description} />
                        </div>
                        <div className="grid gap-2">
                            <Label>Levels</Label>
                            {program.levels.map((level, i) => (
                                <div key={i} className="flex gap-2">
                                    <Input defaultValue={level} />
                                    <Button variant="ghost" size="icon">
                                        <Settings className="h-4 w-4" />
                                    </Button>
                                </div>
                            ))}
                            <Button variant="outline" size="sm" className="mt-2">
                                <Plus className="mr-2 h-4 w-4" /> Add Level
                            </Button>
                        </div>
                    </div>
                    <SheetFooter>
                        <Button type="submit">Save Changes</Button>
                    </SheetFooter>
                </SheetContent>
              </Sheet>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  )
}
