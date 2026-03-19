"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { ChevronLeft, Save, Plus, Image as ImageIcon, Search, CheckCircle2, Trash2, Calendar as CalendarIcon } from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { useLessonPlanStore, Rotation } from "@/store/lesson-plan-store"
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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Badge } from "@/components/ui/badge"

const MOCK_SKILLS = [
    { id: "s1", name: "Forward Roll", level: "Beginner", event: "Floor" },
    { id: "s2", name: "Cartwheel", level: "Beginner", event: "Floor" },
    { id: "s3", name: "Handstand", level: "Intermediate", event: "Floor" },
    { id: "s4", name: "Bridge", level: "Beginner", event: "Floor" },
    { id: "s5", name: "Pullover", level: "Beginner", event: "Bars" },
]

export default function NewPlanPage() {
  const router = useRouter()
  const { addPlan } = useLessonPlanStore()

  const [program, setProgram] = useState("")
  const [date, setDate] = useState("")
  const [theme, setTheme] = useState("")
  const [notes, setNotes] = useState("")
  
  const [rotations, setRotations] = useState<Rotation[]>([
    { id: 1, name: "Warmup", description: "", skills: [] },
    { id: 2, name: "Vault", description: "", skills: [] },
    { id: 3, name: "Bars", description: "", skills: [] },
    { id: 4, name: "Beam", description: "", skills: [] },
    { id: 5, name: "Floor", description: "", skills: [] },
    { id: 6, name: "Conditioning", description: "", skills: [] },
  ])

  const [activeTab, setActiveTab] = useState("Warmup")
  const [newRotationName, setNewRotationName] = useState("")
  const [isAddRotationOpen, setIsAddRotationOpen] = useState(false)
  const [isSkillSheetOpen, setIsSkillSheetOpen] = useState(false)

  const activeRotationIndex = rotations.findIndex(r => r.name === activeTab)
  const activeRotation = rotations[activeRotationIndex]

  const handleAddRotation = () => {
    if (newRotationName) {
      const newRotation: Rotation = { 
          id: Date.now(), 
          name: newRotationName, 
          description: "", 
          skills: [] 
      }
      setRotations([...rotations, newRotation])
      setNewRotationName("")
      setIsAddRotationOpen(false)
      setActiveTab(newRotationName)
      toast.success("Rotation added successfully")
    }
  }

  const updateRotation = (index: number, updates: Partial<Rotation>) => {
      const newRotations = [...rotations]
      newRotations[index] = { ...newRotations[index], ...updates }
      setRotations(newRotations)
  }

  const handleDescriptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      if (activeRotationIndex !== -1) {
          updateRotation(activeRotationIndex, { description: e.target.value })
      }
  }

  const toggleSkill = (skillName: string) => {
      if (activeRotationIndex === -1) return
      
      const currentSkills = activeRotation.skills || []
      const hasSkill = currentSkills.includes(skillName)
      
      let newSkills
      if (hasSkill) {
          newSkills = currentSkills.filter(s => s !== skillName)
      } else {
          newSkills = [...currentSkills, skillName]
      }
      
      updateRotation(activeRotationIndex, { skills: newSkills })
  }

  const handleSaveDraft = () => {
    // Logic to save draft could be similar to publish but with status 'Draft'
    toast.success("Draft saved successfully")
  }

  const handlePublish = () => {
    if (!program || !date) {
        toast.error("Please fill in Program and Week/Date")
        return
    }

    addPlan({
        id: Math.random().toString(36).substr(2, 9),
        name: `Week of ${date} - ${program}`, // Generate a name or add a name field
        program,
        date,
        author: "Current User", // Replace with actual user if available
        status: "Active",
        theme: theme || "General",
        notes,
        rotations
    })
    
    toast.success("Lesson plan published!")
    router.push("/dashboard/training/plans")
  }

  return (
    <div className="flex flex-col gap-6 p-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard/training/plans">
            <ChevronLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">Create Lesson Plan</h1>
        </div>
        <Button variant="outline" className="gap-2" onClick={handleSaveDraft}>
          Save Draft
        </Button>
        <Button className="gap-2" onClick={handlePublish}>
          <Save className="h-4 w-4" />
          Publish Plan
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-[300px_1fr]">
        {/* Left Sidebar: Plan Details */}
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Plan Details</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="program">Program</Label>
                <Select value={program} onValueChange={setProgram}>
                  <SelectTrigger id="program">
                    <SelectValue placeholder="Select program" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Recreational - Bronze">Recreational - Bronze</SelectItem>
                    <SelectItem value="Recreational - Silver">Recreational - Silver</SelectItem>
                    <SelectItem value="JO - Level 4">JO Level 4</SelectItem>
                    <SelectItem value="Preschool">Preschool</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="grid gap-2">
                <Label>Week / Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className={cn("w-full justify-start text-left font-normal", !date && "text-muted-foreground")}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {date ? format(new Date(date + "T12:00:00Z"), "PPP") : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={date ? new Date(date + "T12:00:00Z") : undefined}
                      onSelect={(d) => setDate(d ? format(d, "yyyy-MM-dd") : "")}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="theme">Theme (Optional)</Label>
                <Input 
                    id="theme" 
                    placeholder="e.g. Handstands, Safety" 
                    value={theme}
                    onChange={(e) => setTheme(e.target.value)}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="coach-notes">Coach Notes</Label>
                <Textarea 
                    id="coach-notes" 
                    placeholder="General focus points..." 
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Rotations</CardTitle>
              <CardDescription>Configure the stations.</CardDescription>
            </CardHeader>
            <CardContent>
               {/* List of rotations to jump to */}
               <div className="flex flex-col gap-1">
                 {rotations.map(r => (
                   <Button 
                    key={r.id} 
                    variant={activeTab === r.name ? "secondary" : "ghost"} 
                    className="justify-start w-full"
                    onClick={() => setActiveTab(r.name)}
                   >
                     {r.name}
                   </Button>
                 ))}
                 <Dialog open={isAddRotationOpen} onOpenChange={setIsAddRotationOpen}>
                    <DialogTrigger asChild>
                        <Button variant="ghost" className="justify-start text-muted-foreground w-full">
                            <Plus className="mr-2 h-4 w-4" /> Add Rotation
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Add New Rotation</DialogTitle>
                            <DialogDescription>
                                Create a new station or rotation block for this lesson plan.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="grid gap-2">
                                <Label htmlFor="rotation-name">Name</Label>
                                <Input 
                                    id="rotation-name" 
                                    placeholder="e.g. Trampoline, Dance" 
                                    value={newRotationName}
                                    onChange={(e) => setNewRotationName(e.target.value)}
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button onClick={handleAddRotation}>Add Rotation</Button>
                        </DialogFooter>
                    </DialogContent>
                 </Dialog>
               </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content: Rotation Editor */}
        <div className="space-y-6">
          {activeRotation ? (
          <Card className="h-full flex flex-col">
            <CardHeader className="border-b bg-muted/40">
              <div className="flex items-center justify-between">
                <CardTitle>{activeRotation.name} Plan</CardTitle>
                <Sheet open={isSkillSheetOpen} onOpenChange={setIsSkillSheetOpen}>
                    <SheetTrigger asChild>
                        <Button variant="outline" size="sm">
                            <Plus className="mr-2 h-4 w-4" />
                            Add Skill / Drill
                        </Button>
                    </SheetTrigger>
                    <SheetContent className="w-[400px] sm:w-[540px]">
                        <SheetHeader>
                            <SheetTitle>Add Skills to {activeRotation.name}</SheetTitle>
                            <SheetDescription>
                                Search and select skills to track in this rotation.
                            </SheetDescription>
                        </SheetHeader>
                        <div className="grid gap-4 py-4">
                            <div className="relative">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input type="search" placeholder="Search skills database..." className="pl-8" />
                            </div>
                            <div className="space-y-2">
                                {MOCK_SKILLS.map(skill => (
                                    <div 
                                        key={skill.id}
                                        className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/50 cursor-pointer"
                                        onClick={() => toggleSkill(skill.name)}
                                    >
                                        <div>
                                            <p className="font-medium text-sm">{skill.name}</p>
                                            <p className="text-xs text-muted-foreground">{skill.event} • {skill.level}</p>
                                        </div>
                                        {activeRotation.skills.includes(skill.name) ? (
                                            <CheckCircle2 className="h-4 w-4 text-primary" />
                                        ) : (
                                            <Plus className="h-4 w-4 text-muted-foreground" />
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                        <SheetFooter>
                            <Button onClick={() => setIsSkillSheetOpen(false)}>Done</Button>
                        </SheetFooter>
                    </SheetContent>
                </Sheet>
              </div>
            </CardHeader>
            <CardContent className="flex-1 p-6 space-y-4">
              <div className="grid gap-2">
                <Label>Description / Setup</Label>
                <Textarea 
                  className="min-h-[150px]" 
                  placeholder={`Describe the station setup and drills for ${activeRotation.name}...`} 
                  value={activeRotation.description}
                  onChange={handleDescriptionChange}
                />
              </div>

              <div className="grid gap-2">
                <Label>Specific Skills Tracked</Label>
                {activeRotation.skills.length === 0 ? (
                    <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
                    No skills selected yet. Click &quot;Add Skill / Drill&quot; to link specific skills from the database.
                    </div>
                ) : (
                    <div className="flex flex-wrap gap-2">
                        {activeRotation.skills.map(skill => (
                            <Badge key={skill} variant="secondary" className="pl-2 pr-1 py-1 flex items-center gap-1">
                                {skill}
                                <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-4 w-4 hover:bg-transparent text-muted-foreground hover:text-foreground"
                                    onClick={() => toggleSkill(skill)}
                                >
                                    <Trash2 className="h-3 w-3" />
                                </Button>
                            </Badge>
                        ))}
                    </div>
                )}
              </div>

              <div className="grid gap-2">
                <Label>Media / Resources</Label>
                <div className="flex gap-4 overflow-x-auto pb-2">
                    <Dialog>
                        <DialogTrigger asChild>
                            <div className="flex h-24 w-32 flex-col items-center justify-center rounded-md border bg-muted/50 hover:bg-muted cursor-pointer transition-colors">
                                <ImageIcon className="h-6 w-6 text-muted-foreground mb-1" />
                                <span className="text-xs text-muted-foreground">Upload Image</span>
                            </div>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Upload Media</DialogTitle>
                                <DialogDescription>
                                    Add photos or videos to this rotation card.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="grid gap-4 py-4">
                                <div className="grid w-full max-w-sm items-center gap-1.5">
                                    <Label htmlFor="picture">Picture/Video</Label>
                                    <Input id="picture" type="file" />
                                </div>
                            </div>
                            <DialogFooter>
                                <Button onClick={() => toast.success("Image uploaded!")}>Upload</Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>
              </div>
            </CardContent>
          </Card>
          ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                  Select a rotation to edit
              </div>
          )}
        </div>
      </div>
    </div>
  )
}
