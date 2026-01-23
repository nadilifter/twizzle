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
import { Badge } from "@/components/ui/badge"
import { Plus, Clock, ArrowRight, Trash2 } from "lucide-react"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

// Mock data for rotation templates
const templates = [
  {
    id: 1,
    name: "Standard 60min Rec",
    duration: 60,
    blocks: [
      { name: "Warmup", duration: 10, color: "bg-chart-2" },
      { name: "Rotation 1", duration: 15, color: "bg-chart-1" },
      { name: "Rotation 2", duration: 15, color: "bg-chart-1" },
      { name: "Rotation 3", duration: 15, color: "bg-chart-1" },
      { name: "Cool Down", duration: 5, color: "bg-chart-4" },
    ]
  },
  {
    id: 2,
    name: "Preschool 45min",
    duration: 45,
    blocks: [
      { name: "Circle Time", duration: 5, color: "bg-chart-2" },
      { name: "Warmup Game", duration: 5, color: "bg-chart-3" },
      { name: "Circuit 1", duration: 10, color: "bg-chart-1" },
      { name: "Circuit 2", duration: 10, color: "bg-chart-1" },
      { name: "Circuit 3", duration: 10, color: "bg-chart-1" },
      { name: "Stickers", duration: 5, color: "bg-chart-4" },
    ]
  },
  {
    id: 3,
    name: "Team 3-Hour",
    duration: 180,
    blocks: [
      { name: "Warmup & Stretch", duration: 30, color: "bg-chart-2" },
      { name: "Event 1", duration: 30, color: "bg-chart-1" },
      { name: "Event 2", duration: 30, color: "bg-chart-1" },
      { name: "Break", duration: 15, color: "bg-muted" },
      { name: "Event 3", duration: 30, color: "bg-chart-1" },
      { name: "Event 4", duration: 30, color: "bg-chart-1" },
      { name: "Conditioning", duration: 15, color: "bg-chart-3" },
    ]
  },
]

export default function RotationsPage() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Rotation Templates</h1>
          <p className="text-muted-foreground">
            Standardized time blocks for your classes to ensure consistent pacing.
          </p>
        </div>
        <Sheet>
            <SheetTrigger asChild>
                <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    New Template
                </Button>
            </SheetTrigger>
            <SheetContent className="sm:max-w-xl">
                <SheetHeader>
                    <SheetTitle>New Rotation Template</SheetTitle>
                    <SheetDescription>
                        Design the timeline for a class type.
                    </SheetDescription>
                </SheetHeader>
                 <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                        <Label htmlFor="name">Template Name</Label>
                        <Input id="name" placeholder="e.g. Advanced Rec 90min" />
                    </div>
                     <div className="grid gap-2">
                        <Label htmlFor="duration">Total Duration (min)</Label>
                        <Input id="duration" type="number" placeholder="90" />
                    </div>
                    <div className="border-t my-2"></div>
                    <Label>Timeline Blocks</Label>
                    <div className="space-y-3">
                        <div className="flex gap-2 items-end">
                            <div className="grid gap-1 flex-1">
                                <Label className="text-xs">Block Name</Label>
                                <Input placeholder="Warmup" />
                            </div>
                            <div className="grid gap-1 w-24">
                                <Label className="text-xs">Duration</Label>
                                <Input placeholder="15" type="number" />
                            </div>
                             <div className="grid gap-1 w-32">
                                <Label className="text-xs">Color</Label>
                                <Select defaultValue="cyan">
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
                            <Button variant="ghost" size="icon"><Trash2 className="h-4 w-4" /></Button>
                        </div>
                         <div className="flex gap-2 items-end">
                            <div className="grid gap-1 flex-1">
                                <Label className="text-xs">Block Name</Label>
                                <Input placeholder="Rotation 1" />
                            </div>
                            <div className="grid gap-1 w-24">
                                <Label className="text-xs">Duration</Label>
                                <Input placeholder="20" type="number" />
                            </div>
                             <div className="grid gap-1 w-32">
                                <Label className="text-xs">Color</Label>
                                <Select defaultValue="purple">
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
                             <Button variant="ghost" size="icon"><Trash2 className="h-4 w-4" /></Button>
                        </div>
                        <Button variant="outline" size="sm" className="w-full border-dashed">
                            <Plus className="mr-2 h-4 w-4" /> Add Block
                        </Button>
                    </div>
                </div>
                <SheetFooter>
                    <Button type="submit">Create Template</Button>
                </SheetFooter>
            </SheetContent>
        </Sheet>
      </div>

      <div className="grid gap-6">
        {templates.map((template) => (
          <Card key={template.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{template.name}</CardTitle>
                <Badge variant="outline" className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {template.duration} min
                </Badge>
              </div>
              <CardDescription>
                Breakdown of time allocation per class.
              </CardDescription>
            </CardHeader>
            <CardContent>
                {/* Visual Bar */}
                <div className="h-12 w-full flex rounded-md overflow-hidden mb-4 border">
                    {template.blocks.map((block, i) => {
                        const widthPercent = (block.duration / template.duration) * 100;
                        return (
                            <div 
                                key={i} 
                                style={{ width: `${widthPercent}%` }} 
                                className={`${block.color} flex items-center justify-center text-xs font-medium ${block.color === 'bg-muted' ? 'text-slate-700' : 'text-white'} border-r last:border-r-0 hover:opacity-90 transition-opacity`}
                                title={`${block.name}: ${block.duration}m`}
                            >
                                {widthPercent > 10 ? block.name : ''}
                            </div>
                        )
                    })}
                </div>

                {/* Legend / List */}
                <div className="flex flex-wrap gap-4 text-sm">
                    {template.blocks.map((block, i) => (
                        <div key={i} className="flex items-center gap-2">
                            <div className={`w-3 h-3 rounded-full ${block.color} border border-slate-300`} />
                            <span className="font-medium">{block.name}</span>
                            <span className="text-muted-foreground">({block.duration}m)</span>
                            {i < template.blocks.length - 1 && <ArrowRight className="h-3 w-3 text-muted-foreground" />}
                        </div>
                    ))}
                </div>
            </CardContent>
            <CardFooter className="justify-end border-t pt-4">
                <Sheet>
                    <SheetTrigger asChild>
                        <Button variant="outline" size="sm">Edit Template</Button>
                    </SheetTrigger>
                    <SheetContent className="sm:max-w-xl">
                        <SheetHeader>
                            <SheetTitle>Edit Template: {template.name}</SheetTitle>
                            <SheetDescription>
                                Modify the timeline for this class type.
                            </SheetDescription>
                        </SheetHeader>
                        <div className="grid gap-4 py-4">
                            <div className="grid gap-2">
                                <Label>Template Name</Label>
                                <Input defaultValue={template.name} />
                            </div>
                            <div className="grid gap-2">
                                <Label>Total Duration (min)</Label>
                                <Input defaultValue={template.duration} type="number" />
                            </div>
                            <div className="border-t my-2"></div>
                            <Label>Timeline Blocks</Label>
                            <div className="space-y-3">
                                {template.blocks.map((block, i) => (
                                     <div key={i} className="flex gap-2 items-end">
                                        <div className="grid gap-1 flex-1">
                                            <Label className="text-xs">Block Name</Label>
                                            <Input defaultValue={block.name} />
                                        </div>
                                        <div className="grid gap-1 w-24">
                                            <Label className="text-xs">Duration</Label>
                                            <Input defaultValue={block.duration} type="number" />
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
                                        <Button variant="ghost" size="icon"><Trash2 className="h-4 w-4" /></Button>
                                    </div>
                                ))}
                                <Button variant="outline" size="sm" className="w-full border-dashed">
                                    <Plus className="mr-2 h-4 w-4" /> Add Block
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
