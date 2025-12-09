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
import { 
  Plus, 
  Search, 
  Filter, 
  PlayCircle,
  CheckCircle2,
  Settings,
  Video
} from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"

// Mock data for skills
const skills = [
  { id: 1, name: "Forward Roll", event: "Floor", level: "Beginner", difficulty: "A" },
  { id: 2, name: "Cartwheel", event: "Floor", level: "Beginner", difficulty: "A" },
  { id: 3, name: "Handstand", event: "Floor", level: "Intermediate", difficulty: "A" },
  { id: 4, name: "Pullover", event: "Bars", level: "Beginner", difficulty: "A" },
  { id: 5, name: "Back Hip Circle", event: "Bars", level: "Intermediate", difficulty: "B" },
  { id: 6, name: "Cast Handstand", event: "Bars", level: "Advanced", difficulty: "C" },
  { id: 7, name: "Pivot Turn", event: "Beam", level: "Beginner", difficulty: "A" },
  { id: 8, name: "Split Jump", event: "Beam", level: "Intermediate", difficulty: "B" },
  { id: 9, name: "Back Handspring", event: "Floor", level: "Advanced", difficulty: "C" },
  { id: 10, name: "Handspring Vault", event: "Vault", level: "Intermediate", difficulty: "B" },
  { id: 11, name: "Tsukahara", event: "Vault", level: "Advanced", difficulty: "C" },
  { id: 12, name: "Seat Drop", event: "Trampoline", level: "Beginner", difficulty: "A" },
]

const events = ["All", "Floor", "Bars", "Beam", "Vault", "Trampoline", "Rings", "P-Bars", "High Bar"]

export default function SkillsPage() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Skills Database</h1>
          <p className="text-muted-foreground">
            Library of skills, drills, and progressions.
          </p>
        </div>
        <Sheet>
            <SheetTrigger asChild>
                <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    Add New Skill
                </Button>
            </SheetTrigger>
            <SheetContent>
                <SheetHeader>
                    <SheetTitle>Add New Skill</SheetTitle>
                    <SheetDescription>
                        Add a new skill to the training database.
                    </SheetDescription>
                </SheetHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                        <Label htmlFor="name">Skill Name</Label>
                        <Input id="name" placeholder="e.g. Double Back" />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="event">Event</Label>
                        <Select>
                            <SelectTrigger id="event">
                                <SelectValue placeholder="Select event" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="floor">Floor</SelectItem>
                                <SelectItem value="bars">Bars</SelectItem>
                                <SelectItem value="beam">Beam</SelectItem>
                                <SelectItem value="vault">Vault</SelectItem>
                                <SelectItem value="trampoline">Trampoline</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label htmlFor="level">Level</Label>
                            <Select>
                                <SelectTrigger id="level">
                                    <SelectValue placeholder="Level" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="beg">Beginner</SelectItem>
                                    <SelectItem value="int">Intermediate</SelectItem>
                                    <SelectItem value="adv">Advanced</SelectItem>
                                    <SelectItem value="elite">Elite</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                         <div className="grid gap-2">
                            <Label htmlFor="difficulty">Difficulty</Label>
                            <Select>
                                <SelectTrigger id="difficulty">
                                    <SelectValue placeholder="Value" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="A">A</SelectItem>
                                    <SelectItem value="B">B</SelectItem>
                                    <SelectItem value="C">C</SelectItem>
                                    <SelectItem value="D">D</SelectItem>
                                    <SelectItem value="E">E</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="description">Description / Technique</Label>
                        <Textarea id="description" placeholder="Key points..." />
                    </div>
                     <div className="grid gap-2">
                        <Label>Media</Label>
                        <div className="flex items-center justify-center border-2 border-dashed rounded-md h-32 text-muted-foreground text-sm">
                            Drag and drop video or image
                        </div>
                    </div>
                </div>
                <SheetFooter>
                    <Button type="submit">Create Skill</Button>
                </SheetFooter>
            </SheetContent>
        </Sheet>
      </div>

      <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
        <div className="relative flex-1 md:max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search skills..."
            className="pl-8"
          />
        </div>
        <Sheet>
            <SheetTrigger asChild>
                <Button variant="outline">
                    <Filter className="mr-2 h-4 w-4" /> Filters
                </Button>
            </SheetTrigger>
             <SheetContent side="right">
                <SheetHeader>
                    <SheetTitle>Filter Skills</SheetTitle>
                    <SheetDescription>
                        Refine your search.
                    </SheetDescription>
                </SheetHeader>
                <div className="grid gap-4 py-4">
                     <div className="grid gap-2">
                        <Label>Difficulty Range</Label>
                        <div className="flex gap-2">
                            <Button variant="outline" size="sm" className="flex-1">A</Button>
                            <Button variant="outline" size="sm" className="flex-1">B</Button>
                            <Button variant="outline" size="sm" className="flex-1">C+</Button>
                        </div>
                    </div>
                    <div className="grid gap-2">
                        <Label>Status</Label>
                        <div className="flex gap-2">
                             <Button variant="outline" size="sm" className="flex-1">Learned</Button>
                             <Button variant="outline" size="sm" className="flex-1">In Progress</Button>
                        </div>
                    </div>
                </div>
                 <SheetFooter>
                    <Button type="submit">Apply Filters</Button>
                </SheetFooter>
             </SheetContent>
        </Sheet>
      </div>

      <Tabs defaultValue="All" className="space-y-4">
        <div className="w-full overflow-x-auto pb-2">
            <TabsList>
            {events.map(event => (
                <TabsTrigger key={event} value={event}>{event}</TabsTrigger>
            ))}
            </TabsList>
        </div>

        {events.map((tabEvent) => (
            <TabsContent key={tabEvent} value={tabEvent} className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {skills
                        .filter(s => tabEvent === "All" || s.event === tabEvent)
                        .map((skill) => (
                        <Sheet key={skill.id}>
                            <SheetTrigger asChild>
                                <Card className="cursor-pointer hover:border-primary/50 transition-colors">
                                    <div className="aspect-video bg-muted relative flex items-center justify-center rounded-t-lg group">
                                        <PlayCircle className="h-12 w-12 text-muted-foreground/50 group-hover:text-primary transition-colors" />
                                        <Badge className="absolute top-2 right-2" variant="secondary">{skill.difficulty}</Badge>
                                    </div>
                                    <CardHeader className="pb-2">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <CardTitle className="text-lg">{skill.name}</CardTitle>
                                                <CardDescription>{skill.event}</CardDescription>
                                            </div>
                                        </div>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                                            <span>{skill.level}</span>
                                        </div>
                                    </CardContent>
                                </Card>
                            </SheetTrigger>
                            <SheetContent className="sm:max-w-xl">
                                <SheetHeader>
                                    <SheetTitle>{skill.name}</SheetTitle>
                                    <SheetDescription>
                                        {skill.event} • {skill.level} • Value: {skill.difficulty}
                                    </SheetDescription>
                                </SheetHeader>
                                <div className="mt-6 space-y-6">
                                    <div className="aspect-video bg-black rounded-lg flex items-center justify-center">
                                        <Video className="h-16 w-16 text-muted" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold mb-2">Technique Points</h3>
                                        <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                                            <li>Maintain body tension throughout</li>
                                            <li>Spot the landing early</li>
                                            <li>Keep arms by ears</li>
                                        </ul>
                                    </div>
                                    <div>
                                        <h3 className="font-semibold mb-2">Common Drills</h3>
                                        <div className="grid gap-2">
                                            <div className="p-3 border rounded-lg text-sm hover:bg-muted/50 cursor-pointer">
                                                Drill 1: Panel mat progressions
                                            </div>
                                            <div className="p-3 border rounded-lg text-sm hover:bg-muted/50 cursor-pointer">
                                                Drill 2: Spotting belt practice
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <Button className="flex-1">Mark as Mastered</Button>
                                        <Button variant="outline" className="flex-1">Add to Lesson Plan</Button>
                                    </div>
                                </div>
                            </SheetContent>
                        </Sheet>
                    ))}
                </div>
            </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}
