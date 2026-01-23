"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Plus, Trash2, Edit, Bell, Mail, MessageSquare } from "lucide-react"

type TriggerCategory = "membership_expire" | "payment_due" | "class_reminder" | "waitlist_opening" | "attendance_missed" | "birthday" | "new_skill" | "assessment_due" | "registration_opening" | "event_reminder" | "contract_renewal" | "makeup_class_expiring"
type TimingUnit = "days" | "weeks" | "months"
type ActionType = "email" | "sms" | "push"
type RecipientType = "member" | "participant"

interface NotificationRule {
  id: string
  name: string
  triggerCategory: TriggerCategory
  timingValue: number
  timingUnit: TimingUnit
  action: ActionType
  recipients: RecipientType[]
  active: boolean
}

const TRIGGER_CATEGORY_LABELS: Record<TriggerCategory, string> = {
  membership_expire: "Membership Expiring",
  payment_due: "Payment Due",
  class_reminder: "Class Reminder",
  waitlist_opening: "Waitlist Selection",
  attendance_missed: "Attendance Missed",
  birthday: "Birthday",
  new_skill: "New Skill Achieved",
  assessment_due: "Assessment Due",
  registration_opening: "Registration Opening",
  event_reminder: "Event Reminder",
  contract_renewal: "Contract Renewal",
  makeup_class_expiring: "Makeup Class Expiring"
}

const TIMING_UNIT_LABELS: Record<TimingUnit, string> = {
  days: "Days",
  weeks: "Weeks",
  months: "Months",
}

const ACTION_LABELS: Record<ActionType, string> = {
  email: "Send Email",
  sms: "Send SMS",
  push: "Push Notification",
}

const RECIPIENT_LABELS: Record<RecipientType, string> = {
  member: "Member",
  participant: "Participant",
}

const MOCK_RULES: NotificationRule[] = [
  {
    id: "1",
    name: "Membership Expiry Warning",
    triggerCategory: "membership_expire",
    timingValue: 1,
    timingUnit: "weeks",
    action: "email",
    recipients: ["member"],
    active: true,
  },
  {
    id: "2",
    name: "Membership Expiry Urgent",
    triggerCategory: "membership_expire",
    timingValue: 1,
    timingUnit: "days",
    action: "sms",
    recipients: ["member", "participant"],
    active: true,
  },
  {
    id: "3",
    name: "Payment Reminder",
    triggerCategory: "payment_due",
    timingValue: 3,
    timingUnit: "days",
    action: "email",
    recipients: ["member"],
    active: true,
  },
  {
    id: "4",
    name: "Happy Birthday",
    triggerCategory: "birthday",
    timingValue: 0,
    timingUnit: "days",
    action: "email",
    recipients: ["participant"],
    active: true,
  },
  {
    id: "5",
    name: "Skill Achievement Congratulation",
    triggerCategory: "new_skill",
    timingValue: 0,
    timingUnit: "days",
    action: "push",
    recipients: ["member", "participant"],
    active: true,
  },
  {
    id: "6",
    name: "Winter Competition Registration",
    triggerCategory: "registration_opening",
    timingValue: 2,
    timingUnit: "days",
    action: "email",
    recipients: ["member"],
    active: false,
  }
]

export default function NotificationsPage() {
  const [rules, setRules] = useState<NotificationRule[]>(MOCK_RULES)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingRule, setEditingRule] = useState<NotificationRule | null>(null)

  // Form state
  const [name, setName] = useState("")
  const [triggerCategory, setTriggerCategory] = useState<TriggerCategory>("membership_expire")
  const [timingValue, setTimingValue] = useState<number>(1)
  const [timingUnit, setTimingUnit] = useState<TimingUnit>("weeks")
  const [action, setAction] = useState<ActionType>("email")
  const [recipients, setRecipients] = useState<RecipientType[]>([])

  const resetForm = () => {
    setName("")
    setTriggerCategory("membership_expire")
    setTimingValue(1)
    setTimingUnit("weeks")
    setAction("email")
    setRecipients([])
    setEditingRule(null)
  }

  const handleOpenDialog = (rule?: NotificationRule) => {
    if (rule) {
      setEditingRule(rule)
      setName(rule.name)
      setTriggerCategory(rule.triggerCategory)
      setTimingValue(rule.timingValue)
      setTimingUnit(rule.timingUnit)
      setAction(rule.action)
      setRecipients(rule.recipients)
    } else {
      resetForm()
    }
    setIsDialogOpen(true)
  }

  const handleSaveRule = () => {
    if (!name || recipients.length === 0 || timingValue < 0) return

    const newRule: NotificationRule = {
      id: editingRule ? editingRule.id : Math.random().toString(36).substr(2, 9),
      name,
      triggerCategory,
      timingValue,
      timingUnit,
      action,
      recipients,
      active: editingRule ? editingRule.active : true,
    }

    if (editingRule) {
      setRules(rules.map((r) => (r.id === editingRule.id ? newRule : r)))
    } else {
      setRules([...rules, newRule])
    }

    setIsDialogOpen(false)
    resetForm()
  }

  const handleDeleteRule = (id: string) => {
    setRules(rules.filter((r) => r.id !== id))
  }

  const toggleRecipient = (recipient: RecipientType) => {
    setRecipients((prev) =>
      prev.includes(recipient)
        ? prev.filter((r) => r !== recipient)
        : [...prev, recipient]
    )
  }

  const getActionIcon = (action: ActionType) => {
    switch (action) {
      case "email":
        return <Mail className="h-4 w-4" />
      case "sms":
        return <MessageSquare className="h-4 w-4" />
      case "push":
        return <Bell className="h-4 w-4" />
    }
  }

  const formatTrigger = (rule: NotificationRule) => {
    const unitLabel = rule.timingValue === 1 ? rule.timingUnit.slice(0, -1) : rule.timingUnit;
    return `${rule.timingValue} ${unitLabel} before ${TRIGGER_CATEGORY_LABELS[rule.triggerCategory]}`;
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Notifications & Reminders</h1>
          <p className="text-muted-foreground">
            Configure automated messages based on system events.
          </p>
        </div>
        <Button onClick={() => handleOpenDialog()}>
          <Plus className="mr-2 h-4 w-4" />
          Add Notification Rule
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Active Rules</CardTitle>
          <CardDescription>Manage your automated communication workflows.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rule Name</TableHead>
                <TableHead>Trigger</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Recipients</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules.map((rule) => (
                <TableRow key={rule.id}>
                  <TableCell className="font-medium">{rule.name}</TableCell>
                  <TableCell>{formatTrigger(rule)}</TableCell>
                  <TableCell className="flex items-center gap-2">
                    {getActionIcon(rule.action)}
                    {ACTION_LABELS[rule.action]}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {rule.recipients.map((r) => (
                        <Badge key={r} variant="secondary">
                          {RECIPIENT_LABELS[r]}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={rule.active ? "default" : "outline"}>
                      {rule.active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(rule)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDeleteRule(rule.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {rules.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground h-24">
                    No notification rules configured.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{editingRule ? "Edit Notification Rule" : "Create Notification Rule"}</DialogTitle>
            <DialogDescription>
              Set up the trigger, action, and recipients for this automation.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Rule Name</Label>
              <Input
                id="name"
                placeholder="e.g. Membership Expiry Warning"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="trigger-category">Event</Label>
              <Select value={triggerCategory} onValueChange={(val) => setTriggerCategory(val as TriggerCategory)}>
                <SelectTrigger id="trigger-category">
                  <SelectValue placeholder="Select an event" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(TRIGGER_CATEGORY_LABELS)
                    .sort(([, a], [, b]) => a.localeCompare(b))
                    .map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="timing-value">Timing (Before Event)</Label>
              <div className="flex gap-2">
                <Input 
                  id="timing-value"
                  type="number"
                  min="0"
                  className="w-24"
                  value={timingValue}
                  onChange={(e) => setTimingValue(parseInt(e.target.value) || 0)}
                />
                <Select value={timingUnit} onValueChange={(val) => setTimingUnit(val as TimingUnit)}>
                  <SelectTrigger id="timing-unit" className="w-[180px]">
                    <SelectValue placeholder="Select unit" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(TIMING_UNIT_LABELS).map(([key, label]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="action">Action</Label>
              <Select value={action} onValueChange={(val) => setAction(val as ActionType)}>
                <SelectTrigger id="action">
                  <SelectValue placeholder="Select an action" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ACTION_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label>Recipients</Label>
              <div className="flex flex-col gap-2 border rounded-md p-4">
                {Object.entries(RECIPIENT_LABELS).map(([key, label]) => (
                  <div key={key} className="flex items-center space-x-2">
                    <Checkbox
                      id={`recipient-${key}`}
                      checked={recipients.includes(key as RecipientType)}
                      onCheckedChange={() => toggleRecipient(key as RecipientType)}
                    />
                    <Label htmlFor={`recipient-${key}`}>{label}</Label>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveRule} disabled={!name || recipients.length === 0}>
              Save Rule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
