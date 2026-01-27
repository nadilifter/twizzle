"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Plus, Trash2, Save, Loader2, DollarSign } from "lucide-react"
import { toast } from "sonner"
import { usePrograms } from "@/hooks/use-programs"

interface ProgramConfigProps {
  program: any 
  onClose: () => void
}

export function ProgramConfiguration({ program, onClose }: ProgramConfigProps) {
  const { updateProgram, fetchPrograms } = usePrograms()
  const [activeTab, setActiveTab] = useState("general")
  const [isSaving, setIsSaving] = useState(false)
  const [isAddingTier, setIsAddingTier] = useState(false)
  const [isDeletingTier, setIsDeletingTier] = useState<string | null>(null)
  
  // Local state for form fields
  const [formData, setFormData] = useState({
    name: program.name || "",
    description: program.description || "",
    level: program.level || "",
    status: program.status || "ACTIVE",
  })

  // State for membership tiers
  const [tiers, setTiers] = useState<any[]>(program.membershipTiers || [])
  const [newTier, setNewTier] = useState({
    name: "",
    price: "",
    interval: "MONTHLY",
  })

  const handleSaveGeneral = async () => {
    setIsSaving(true)
    try {
      await updateProgram(program.id, formData)
      toast.success("Program details updated")
    } catch (error) {
      toast.error("Failed to update program")
    } finally {
      setIsSaving(false)
    }
  }

  const handleAddTier = async () => {
    if (!newTier.name || !newTier.price) {
        toast.error("Name and Price are required")
        return
    }

    setIsAddingTier(true)
    try {
        const response = await fetch(`/api/programs/${program.id}/tiers`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(newTier)
        })

        if (!response.ok) throw new Error("Failed to add tier")
        
        const addedTier = await response.json()
        setTiers([...tiers, addedTier])
        setNewTier({ name: "", price: "", interval: "MONTHLY" })
        toast.success("Membership option added")
        
        // Refresh parent list silently to keep sync
        fetchPrograms()
    } catch (error) {
        console.error(error)
        toast.error("Failed to add membership option")
    } finally {
        setIsAddingTier(false)
    }
  }

  const handleRemoveTier = async (id: string) => {
    setIsDeletingTier(id)
    try {
        const response = await fetch(`/api/programs/${program.id}/tiers/${id}`, {
            method: "DELETE",
        })

        if (!response.ok) throw new Error("Failed to delete tier")
        
        setTiers(tiers.filter(t => t.id !== id))
        toast.success("Membership option removed")
        fetchPrograms()
    } catch (error) {
        console.error(error)
        toast.error("Failed to remove option")
    } finally {
        setIsDeletingTier(null)
    }
  }

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="p-6 pb-2 border-b">
        <h2 className="text-xl font-semibold">{formData.name || "Configure Program"}</h2>
        <p className="text-sm text-muted-foreground">Manage program details and options.</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
        <div className="px-6 py-2 border-b bg-muted/30">
            <TabsList className="w-full justify-start overflow-x-auto no-scrollbar">
                <TabsTrigger value="general">General</TabsTrigger>
                <TabsTrigger value="memberships">Memberships</TabsTrigger>
                <TabsTrigger value="requirements">Requirements</TabsTrigger>
                <TabsTrigger value="coaches">Coaches</TabsTrigger>
            </TabsList>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
            <TabsContent value="general" className="mt-0 space-y-6 max-w-2xl">
                <div className="space-y-4">
                    <div className="grid gap-2">
                        <Label htmlFor="config-name">Program Name</Label>
                        <Input 
                            id="config-name" 
                            value={formData.name} 
                            onChange={(e) => setFormData({...formData, name: e.target.value})}
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="config-desc">Description</Label>
                        <Textarea 
                            id="config-desc" 
                            value={formData.description} 
                            onChange={(e) => setFormData({...formData, description: e.target.value})}
                            className="min-h-[100px] resize-none"
                        />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label htmlFor="config-level">Level</Label>
                            <Input 
                                id="config-level" 
                                value={formData.level} 
                                onChange={(e) => setFormData({...formData, level: e.target.value})}
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="config-status">Status</Label>
                            <Select 
                                value={formData.status} 
                                onValueChange={(val) => setFormData({...formData, status: val})}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="ACTIVE">Active</SelectItem>
                                    <SelectItem value="INACTIVE">Inactive</SelectItem>
                                    <SelectItem value="ARCHIVED">Archived</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <div className="pt-4 flex justify-end">
                        <Button onClick={handleSaveGeneral} disabled={isSaving}>
                            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Save Changes
                        </Button>
                    </div>
                </div>
            </TabsContent>

            <TabsContent value="memberships" className="mt-0 space-y-6 max-w-3xl">
                <Card className="border-dashed shadow-none">
                    <CardHeader className="pb-4">
                        <CardTitle className="text-base">Add New Option</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                            <div className="md:col-span-5 grid gap-2">
                                <Label>Option Name</Label>
                                <Input 
                                    placeholder="e.g. Monthly Pass" 
                                    value={newTier.name}
                                    onChange={(e) => setNewTier({...newTier, name: e.target.value})}
                                />
                            </div>
                            <div className="md:col-span-3 grid gap-2">
                                <Label>Price</Label>
                                <div className="relative">
                                    <DollarSign className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input 
                                        type="number" 
                                        className="pl-8"
                                        placeholder="0.00" 
                                        value={newTier.price}
                                        onChange={(e) => setNewTier({...newTier, price: e.target.value})}
                                    />
                                </div>
                            </div>
                             <div className="md:col-span-3 grid gap-2">
                                <Label>Billing</Label>
                                <Select 
                                    value={newTier.interval} 
                                    onValueChange={(val) => setNewTier({...newTier, interval: val})}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="MONTHLY">Monthly</SelectItem>
                                        <SelectItem value="YEARLY">Yearly</SelectItem>
                                        <SelectItem value="SESSION">Per Session</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="md:col-span-1">
                                <Button onClick={handleAddTier} disabled={isAddingTier} size="icon" className="w-full">
                                    {isAddingTier ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <div className="space-y-4">
                    <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Active Options</h3>
                    <div className="grid gap-3">
                        {tiers.length === 0 ? (
                            <div className="p-8 text-center border rounded-md bg-muted/10">
                                <p className="text-sm text-muted-foreground">No membership options configured yet.</p>
                            </div>
                        ) : (
                            tiers.map((tier) => (
                                <div key={tier.id} className="flex items-center justify-between p-4 border rounded-lg bg-card hover:bg-accent/5 transition-colors">
                                    <div className="flex flex-col gap-1">
                                        <span className="font-medium">{tier.name}</span>
                                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                            <span className="capitalize">{tier.interval.toLowerCase()}</span>
                                            <span>•</span>
                                            <span>${Number(tier.price).toFixed(2)}</span>
                                        </div>
                                    </div>
                                    <Button 
                                        variant="ghost" 
                                        size="icon" 
                                        onClick={() => handleRemoveTier(tier.id)}
                                        disabled={isDeletingTier === tier.id}
                                        className="text-muted-foreground hover:text-destructive transition-colors"
                                    >
                                        {isDeletingTier === tier.id ? (
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                            <Trash2 className="h-4 w-4" />
                                        )}
                                    </Button>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </TabsContent>

            <TabsContent value="requirements" className="mt-0">
                <div className="p-12 text-center border rounded-md border-dashed bg-muted/10">
                    <p className="text-muted-foreground">Prerequisites and requirement settings coming soon.</p>
                </div>
            </TabsContent>

            <TabsContent value="coaches" className="mt-0">
                <div className="p-12 text-center border rounded-md border-dashed bg-muted/10">
                    <p className="text-muted-foreground">Coach assignment settings coming soon.</p>
                </div>
            </TabsContent>
        </div>
      </Tabs>
      <div className="p-4 border-t flex justify-end bg-background">
        <Button variant="outline" onClick={onClose}>Close</Button>
      </div>
    </div>
  )
}
