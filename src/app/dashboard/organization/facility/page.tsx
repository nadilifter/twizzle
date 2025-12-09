"use client"

import { useState } from "react"
import { 
  Plus, 
  Search, 
  MapPin, 
  Phone, 
  Mail, 
  Building, 
  Ruler, 
  Dumbbell,
  AlertTriangle,
  CheckCircle2,
  MoreHorizontal,
  Filter
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
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
import { Separator } from "@/components/ui/separator"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

// Mock data
const zones = [
  { id: 1, name: "Main Floor", capacity: 50, type: "Floor Exercise", status: "Open" },
  { id: 2, name: "Vault Runway", capacity: 15, type: "Vault", status: "Open" },
  { id: 3, name: "Uneven Bars", capacity: 20, type: "Bars", status: "Maintenance" },
  { id: 4, name: "Beam Area", capacity: 25, type: "Beam", status: "Open" },
  { id: 5, name: "Tumble Track", capacity: 10, type: "Trampoline", status: "Open" },
  { id: 6, name: "Preschool Area", capacity: 30, type: "Mixed", status: "Open" },
]

const equipment = [
  { id: 1, name: "Spring Floor A", type: "Floor", condition: "Good", lastInspection: "2023-10-15", assignedZone: "Main Floor" },
  { id: 2, name: "Vault Table (Tac/10)", type: "Vault", condition: "Excellent", lastInspection: "2023-11-01", assignedZone: "Vault Runway" },
  { id: 3, name: "Uneven Bars Set 1", type: "Bars", condition: "Fair", lastInspection: "2023-09-20", assignedZone: "Uneven Bars" },
  { id: 4, name: "High Beam 1", type: "Beam", condition: "Good", lastInspection: "2023-10-10", assignedZone: "Beam Area" },
  { id: 5, name: "High Beam 2", type: "Beam", condition: "Poor", lastInspection: "2023-08-05", assignedZone: "Beam Area" },
  { id: 6, name: "Tumble Track", type: "Trampoline", condition: "Good", lastInspection: "2023-10-25", assignedZone: "Tumble Track" },
  { id: 7, name: "Landing Mat (Blue)", type: "Mat", condition: "Fair", lastInspection: "2023-09-15", assignedZone: "Vault Runway" },
]

export default function FacilityPage() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Facility Management</h1>
          <p className="text-muted-foreground">
            Manage your gym's details, training zones, and equipment inventory.
          </p>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="zones">Training Zones</TabsTrigger>
          <TabsTrigger value="equipment">Equipment</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
            <Card className="col-span-4">
              <CardHeader>
                <CardTitle>General Information</CardTitle>
                <CardDescription>
                  Update your facility's public details and contact information.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="gym-name">Gym Name</Label>
                  <Input id="gym-name" defaultValue="Uplifter Gymnastics Academy" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="address">Address</Label>
                  <Textarea id="address" defaultValue="123 Flip Street, Cartwheel City, CA 90210" rows={3} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input id="phone" defaultValue="(555) 555-5555" />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" defaultValue="info@upliftergym.com" />
                  </div>
                </div>
              </CardContent>
              <CardFooter>
                <Button>Save Changes</Button>
              </CardFooter>
            </Card>
            
            <Card className="col-span-3">
              <CardHeader>
                <CardTitle>Facility Status</CardTitle>
                <CardDescription>
                  Current operational status and quick stats.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Overall Status</span>
                  <Badge className="bg-green-500">Operational</Badge>
                </div>
                <Separator />
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1">
                    <span className="text-2xl font-bold">12,500</span>
                    <span className="text-xs text-muted-foreground">Square Footage</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-2xl font-bold">240</span>
                    <span className="text-xs text-muted-foreground">Max Capacity</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-2xl font-bold">{zones.length}</span>
                    <span className="text-xs text-muted-foreground">Active Zones</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-2xl font-bold">{equipment.length}</span>
                    <span className="text-xs text-muted-foreground">Equipment Items</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="zones" className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search zones..." className="w-[150px] lg:w-[250px]" />
            </div>
            <Sheet>
              <SheetTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" /> Add Zone
                </Button>
              </SheetTrigger>
              <SheetContent>
                <SheetHeader>
                  <SheetTitle>Add New Zone</SheetTitle>
                  <SheetDescription>Define a new training area in your facility.</SheetDescription>
                </SheetHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="zone-name">Zone Name</Label>
                    <Input id="zone-name" placeholder="e.g. Balance Beam Area" />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="zone-type">Type</Label>
                    <Select>
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="floor">Floor</SelectItem>
                        <SelectItem value="vault">Vault</SelectItem>
                        <SelectItem value="bars">Bars</SelectItem>
                        <SelectItem value="beam">Beam</SelectItem>
                        <SelectItem value="trampoline">Trampoline</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="capacity">Max Capacity</Label>
                    <Input id="capacity" type="number" placeholder="20" />
                  </div>
                </div>
                <SheetFooter>
                  <SheetClose asChild>
                    <Button type="submit">Create Zone</Button>
                  </SheetClose>
                </SheetFooter>
              </SheetContent>
            </Sheet>
          </div>
          
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {zones.map((zone) => (
              <Card key={zone.id}>
                <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    {zone.name}
                  </CardTitle>
                  <Badge variant={zone.status === "Open" ? "outline" : "destructive"}>{zone.status}</Badge>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{zone.type}</div>
                  <p className="text-xs text-muted-foreground">
                    Max Capacity: {zone.capacity} students
                  </p>
                </CardContent>
                <CardFooter>
                  <Button variant="ghost" className="w-full justify-start p-0 text-sm text-muted-foreground">
                    View Details & Equipment
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="equipment" className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search equipment..." className="w-[150px] lg:w-[250px]" />
              <Button variant="outline" size="icon">
                <Filter className="h-4 w-4" />
              </Button>
            </div>
            <Sheet>
              <SheetTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" /> Add Equipment
                </Button>
              </SheetTrigger>
              <SheetContent>
                <SheetHeader>
                  <SheetTitle>Add Equipment</SheetTitle>
                  <SheetDescription>Register a new piece of equipment.</SheetDescription>
                </SheetHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="equip-name">Name/ID</Label>
                    <Input id="equip-name" placeholder="e.g. Beam #3" />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="equip-type">Type</Label>
                    <Select>
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="apparatus">Apparatus</SelectItem>
                        <SelectItem value="mat">Mat</SelectItem>
                        <SelectItem value="training-aid">Training Aid</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="equip-condition">Condition</Label>
                    <Select>
                      <SelectTrigger>
                        <SelectValue placeholder="Select condition" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="good">Good</SelectItem>
                        <SelectItem value="fair">Fair</SelectItem>
                        <SelectItem value="poor">Poor</SelectItem>
                        <SelectItem value="unsafe">Unsafe / Out of Order</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <SheetFooter>
                  <SheetClose asChild>
                    <Button type="submit">Add Equipment</Button>
                  </SheetClose>
                </SheetFooter>
              </SheetContent>
            </Sheet>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[250px]">Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Zone</TableHead>
                  <TableHead>Condition</TableHead>
                  <TableHead>Last Inspection</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {equipment.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell>{item.type}</TableCell>
                    <TableCell>{item.assignedZone}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {item.condition === "Good" || item.condition === "Excellent" ? (
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                        ) : item.condition === "Fair" ? (
                          <AlertTriangle className="h-4 w-4 text-yellow-500" />
                        ) : (
                          <AlertTriangle className="h-4 w-4 text-red-500" />
                        )}
                        <span>{item.condition}</span>
                      </div>
                    </TableCell>
                    <TableCell>{item.lastInspection}</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <span className="sr-only">Open menu</span>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>Log Inspection</DropdownMenuItem>
                          <DropdownMenuItem>Report Issue</DropdownMenuItem>
                          <DropdownMenuItem>Move Zone</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-red-600">Retire Equipment</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
