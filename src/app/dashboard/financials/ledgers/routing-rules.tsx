"use client"

import * as React from "react"
import { Plus, Search, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
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
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"

// Shared types (in a real app these would be in a types file)
interface GLCode {
  id: string
  code: string
  description: string
  type: string
  status: "Active" | "Inactive"
}

interface RoutingRule {
  id: string
  name: string
  criteriaType: "SKU" | "Category" | "Product"
  criteriaValue: string
  glCodeId: string
  priority: number
}

interface RoutingRulesProps {
  glCodes: GLCode[]
}

const initialRules: RoutingRule[] = [
  { id: "1", name: "Membership Default", criteriaType: "Category", criteriaValue: "Membership", glCodeId: "1", priority: 1 },
  { id: "2", name: "T-Shirts", criteriaType: "Product", criteriaValue: "Club T-Shirt", glCodeId: "2", priority: 5 },
  { id: "3", name: "Event Tickets", criteriaType: "Category", criteriaValue: "Events", glCodeId: "3", priority: 1 },
]

export function RoutingRules({ glCodes }: RoutingRulesProps) {
  const [rules, setRules] = React.useState<RoutingRule[]>(initialRules)
  const [isDialogOpen, setIsDialogOpen] = React.useState(false)
  const [newRule, setNewRule] = React.useState<Partial<RoutingRule>>({
    name: "",
    criteriaType: "SKU",
    criteriaValue: "",
    glCodeId: "",
    priority: 10,
  })

  const handleCreateRule = () => {
    if (!newRule.name || !newRule.criteriaValue || !newRule.glCodeId) return

    const rule: RoutingRule = {
      id: Math.random().toString(36).substr(2, 9),
      name: newRule.name,
      criteriaType: newRule.criteriaType as any,
      criteriaValue: newRule.criteriaValue,
      glCodeId: newRule.glCodeId,
      priority: newRule.priority || 10,
    }

    setRules([...rules, rule])
    setNewRule({ name: "", criteriaType: "SKU", criteriaValue: "", glCodeId: "", priority: 10 })
    setIsDialogOpen(false)
  }

  const handleDeleteRule = (id: string) => {
    setRules(rules.filter(r => r.id !== id))
  }

  const getGLCodeDisplay = (id: string) => {
    const code = glCodes.find(c => c.id === id)
    return code ? `${code.code} - ${code.description}` : "Unknown"
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Routing Rules</CardTitle>
        <CardDescription>
          Configure how specific products, categories, or SKUs map to General Ledger codes.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between mb-4">
          <div className="flex w-full max-w-sm items-center space-x-2">
            <Input placeholder="Search rules..." className="h-8 w-[150px] lg:w-[250px]" />
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="mr-2 h-4 w-4" />
                New Rule
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Routing Rule</DialogTitle>
                <DialogDescription>
                  Define a new rule to automatically route transactions to a GL code.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="name" className="text-right">
                    Rule Name
                  </Label>
                  <Input
                    id="name"
                    value={newRule.name}
                    onChange={(e) => setNewRule({ ...newRule, name: e.target.value })}
                    className="col-span-3"
                    placeholder="e.g. T-Shirt Sales"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="criteriaType" className="text-right">
                    Match By
                  </Label>
                  <Select
                    value={newRule.criteriaType}
                    onValueChange={(value) => setNewRule({ ...newRule, criteriaType: value as any })}
                  >
                    <SelectTrigger className="col-span-3">
                      <SelectValue placeholder="Select criteria" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SKU">SKU</SelectItem>
                      <SelectItem value="Category">Category</SelectItem>
                      <SelectItem value="Product">Product Name</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="criteriaValue" className="text-right">
                    Value
                  </Label>
                  <Input
                    id="criteriaValue"
                    value={newRule.criteriaValue}
                    onChange={(e) => setNewRule({ ...newRule, criteriaValue: e.target.value })}
                    className="col-span-3"
                    placeholder={newRule.criteriaType === "Category" ? "e.g. Merchandise" : "e.g. TS-001"}
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="glCode" className="text-right">
                    Route To
                  </Label>
                  <Select
                    value={newRule.glCodeId}
                    onValueChange={(value) => setNewRule({ ...newRule, glCodeId: value })}
                  >
                    <SelectTrigger className="col-span-3">
                      <SelectValue placeholder="Select GL Code" />
                    </SelectTrigger>
                    <SelectContent>
                      {glCodes.filter(c => c.status === "Active").map(code => (
                        <SelectItem key={code.id} value={code.id}>
                          {code.code} - {code.description}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline">Cancel</Button>
                </DialogClose>
                <Button onClick={handleCreateRule}>Create Rule</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rule Name</TableHead>
                <TableHead>Criteria</TableHead>
                <TableHead>Value</TableHead>
                <TableHead>Routes To</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules.map((rule) => (
                <TableRow key={rule.id}>
                  <TableCell className="font-medium">{rule.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{rule.criteriaType}</Badge>
                  </TableCell>
                  <TableCell>{rule.criteriaValue}</TableCell>
                  <TableCell>{getGLCodeDisplay(rule.glCodeId)}</TableCell>
                  <TableCell className="text-right">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => handleDeleteRule(rule.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}


