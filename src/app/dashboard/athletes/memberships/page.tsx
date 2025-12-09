"use client"

import * as React from "react"
import { Plus, MoreHorizontal, Pencil, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"

// Mock Data
type MembershipTier = {
  id: string
  name: string
  price: number
  interval: "monthly" | "yearly" | "session"
  description: string
  activeMembers: number
  features: string[]
}

const INITIAL_MEMBERSHIPS: MembershipTier[] = [
  {
    id: "1",
    name: "Recreational - Monthly",
    price: 85,
    interval: "monthly",
    description: "Standard membership for recreational classes (1x week).",
    activeMembers: 124,
    features: ["1 class per week", "Access to open gym", "10% off merchandise"]
  },
  {
    id: "2",
    name: "Competitive Team",
    price: 250,
    interval: "monthly",
    description: "Full access for team athletes including all training sessions.",
    activeMembers: 45,
    features: ["Unlimited training", "Competition entry fees included", "Team uniform kit"]
  },
  {
    id: "3",
    name: "Drop-in Pass",
    price: 25,
    interval: "session",
    description: "Single session access for open gym or trial class.",
    activeMembers: 12,
    features: ["Single entry", "Valid for 30 days"]
  }
]

export default function MembershipsPage() {
  const [memberships, setMemberships] = React.useState<MembershipTier[]>(INITIAL_MEMBERSHIPS)
  const [isDialogOpen, setIsDialogOpen] = React.useState(false)
  const [editingId, setEditingId] = React.useState<string | null>(null)

  // Form State
  const [formData, setFormData] = React.useState<Partial<MembershipTier>>({
    name: "",
    price: 0,
    interval: "monthly",
    description: "",
    features: []
  })

  const handleOpenDialog = (membership?: MembershipTier) => {
    if (membership) {
      setEditingId(membership.id)
      setFormData({ ...membership })
    } else {
      setEditingId(null)
      setFormData({
        name: "",
        price: 0,
        interval: "monthly",
        description: "",
        features: []
      })
    }
    setIsDialogOpen(true)
  }

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (editingId) {
      // Update
      setMemberships(prev => prev.map(m => m.id === editingId ? { ...m, ...formData } as MembershipTier : m))
    } else {
      // Create
      const newMembership: MembershipTier = {
        id: Math.random().toString(36).substr(2, 9),
        activeMembers: 0,
        ...formData as MembershipTier
      }
      setMemberships(prev => [...prev, newMembership])
    }
    setIsDialogOpen(false)
  }

  const handleDelete = (id: string) => {
    setMemberships(prev => prev.filter(m => m.id !== id))
  }

  const handleFeaturesChange = (text: string) => {
    setFormData({
      ...formData,
      features: text.split('\n').filter(line => line.trim() !== '')
    })
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold tracking-tight">Memberships</h1>
          <p className="text-muted-foreground">
            Manage membership tiers, pricing, and benefits.
          </p>
        </div>
        <Button onClick={() => handleOpenDialog()}>
          <Plus className="mr-2 h-4 w-4" />
          Create Membership
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {memberships.map((membership) => (
          <Card key={membership.id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-xl">{membership.name}</CardTitle>
                  <CardDescription className="mt-2 line-clamp-2">
                    {membership.description}
                  </CardDescription>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="h-8 w-8 p-0">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                    <DropdownMenuItem onClick={() => handleOpenDialog(membership)}>
                      <Pencil className="mr-2 h-4 w-4" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem 
                      className="text-destructive focus:text-destructive"
                      onClick={() => handleDelete(membership.id)}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </CardHeader>
            <CardContent>
              <div className="mb-4 flex items-baseline">
                <span className="text-3xl font-bold">${membership.price}</span>
                <span className="text-muted-foreground ml-1">
                  /{membership.interval === "session" ? "session" : membership.interval === "yearly" ? "yr" : "mo"}
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                <Badge variant="secondary">{membership.activeMembers} Active Members</Badge>
              </div>
              <ul className="space-y-2 text-sm">
                {membership.features.map((feature, i) => (
                  <li key={i} className="flex items-center">
                    <div className="mr-2 h-1.5 w-1.5 rounded-full bg-primary" />
                    {feature}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <form onSubmit={handleSave}>
            <DialogHeader>
              <DialogTitle>{editingId ? "Edit Membership" : "Create Membership"}</DialogTitle>
              <DialogDescription>
                Set up the pricing and details for this membership tier.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Name</Label>
                <Input 
                  id="name" 
                  value={formData.name} 
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  placeholder="e.g. Gold Tier" 
                  required 
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="price">Price ($)</Label>
                  <Input 
                    id="price" 
                    type="number" 
                    min="0"
                    step="0.01"
                    value={formData.price} 
                    onChange={e => setFormData({...formData, price: parseFloat(e.target.value)})}
                    required 
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="interval">Billing Interval</Label>
                  <Select 
                    value={formData.interval} 
                    onValueChange={(val: any) => setFormData({...formData, interval: val})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="yearly">Yearly</SelectItem>
                      <SelectItem value="session">Per Session</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="description">Description</Label>
                <Textarea 
                  id="description" 
                  value={formData.description}
                  onChange={e => setFormData({...formData, description: e.target.value})}
                  placeholder="Describe what's included..." 
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="features">Features (one per line)</Label>
                <Textarea 
                  id="features" 
                  value={formData.features?.join('\n')}
                  onChange={e => handleFeaturesChange(e.target.value)}
                  placeholder="Feature 1&#10;Feature 2&#10;Feature 3"
                  rows={4}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">
                {editingId ? "Save Changes" : "Create Membership"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}








