"use client"

import * as React from "react"
import { CalendarIcon, Plus, Trash2 } from "lucide-react"
import { format } from "date-fns"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { cn } from "@/lib/utils"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"

interface LineItem {
  id: string
  description: string
  quantity: number
  price: number
}

export function CreateInvoiceSheet() {
  const [open, setOpen] = React.useState(false)
  const [date, setDate] = React.useState<Date>()
  const [items, setItems] = React.useState<LineItem[]>([
    { id: "1", description: "", quantity: 1, price: 0 },
  ])

  // Form State
  const [recipientName, setRecipientName] = React.useState("")
  const [recipientEmail, setRecipientEmail] = React.useState("")
  const [reference, setReference] = React.useState("")
  const [notes, setNotes] = React.useState("")

  const addItem = () => {
    setItems([
      ...items,
      { id: Math.random().toString(36).substr(2, 9), description: "", quantity: 1, price: 0 },
    ])
  }

  const removeItem = (id: string) => {
    if (items.length === 1) return
    setItems(items.filter((item) => item.id !== id))
  }

  const updateItem = (id: string, field: keyof LineItem, value: string | number) => {
    setItems(
      items.map((item) =>
        item.id === id ? { ...item, [field]: value } : item
      )
    )
  }

  const subtotal = items.reduce((acc, item) => acc + item.quantity * item.price, 0)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // Here we would typically send data to backend / Adyen
    const invoiceData = {
        reference: reference || `INV-${Date.now()}`,
        shopperName: recipientName,
        shopperEmail: recipientEmail,
        dueDate: date,
        items,
        total: subtotal,
        currency: "USD",
        notes
    }
    console.log("Creating Invoice:", invoiceData)
    // Simulate API call
    setTimeout(() => {
        setOpen(false)
        // Reset form
        setRecipientName("")
        setRecipientEmail("")
        setReference("")
        setNotes("")
        setItems([{ id: "1", description: "", quantity: 1, price: 0 }])
        setDate(undefined)
    }, 500)
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Create Invoice
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Create New Invoice</SheetTitle>
          <SheetDescription>
            Create an invoice and generate a payment link for your customer.
          </SheetDescription>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-6 py-6">
            {/* Shopper Details */}
            <div className="grid gap-4">
                <h3 className="text-sm font-medium leading-none">Recipient Details</h3>
                <div className="grid gap-2">
                    <Label htmlFor="name">Name</Label>
                    <Input
                        id="name"
                        placeholder="e.g. Jane Doe"
                        value={recipientName}
                        onChange={(e) => setRecipientName(e.target.value)}
                        required
                    />
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                        id="email"
                        type="email"
                        placeholder="jane@example.com"
                        value={recipientEmail}
                        onChange={(e) => setRecipientEmail(e.target.value)}
                        required
                    />
                </div>
            </div>

            <Separator />

            {/* Invoice Details */}
            <div className="grid gap-4">
                <h3 className="text-sm font-medium leading-none">Invoice Details</h3>
                <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                        <Label htmlFor="reference">Reference (Optional)</Label>
                        <Input
                            id="reference"
                            placeholder="INV-..."
                            value={reference}
                            onChange={(e) => setReference(e.target.value)}
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label>Due Date</Label>
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button
                                    variant={"outline"}
                                    className={cn(
                                        "w-full justify-start text-left font-normal",
                                        !date && "text-muted-foreground"
                                    )}
                                >
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {date ? format(date, "PPP") : <span>Pick a date</span>}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                    mode="single"
                                    selected={date}
                                    onSelect={setDate}
                                    initialFocus
                                />
                            </PopoverContent>
                        </Popover>
                    </div>
                </div>
            </div>

            <Separator />

            {/* Line Items */}
            <div className="grid gap-4">
                <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium leading-none">Line Items</h3>
                    <Button type="button" variant="outline" size="sm" onClick={addItem}>
                        <Plus className="mr-2 h-3 w-3" />
                        Add Item
                    </Button>
                </div>

                <div className="grid gap-4">
                    {items.map((item, index) => (
                        <div key={item.id} className="grid grid-cols-[1fr_80px_100px_40px] gap-2 items-start">
                             <div className="grid gap-1">
                                {index === 0 && <Label className="text-xs">Description</Label>}
                                <Input
                                    placeholder="Item description"
                                    value={item.description}
                                    onChange={(e) => updateItem(item.id, "description", e.target.value)}
                                    required
                                />
                             </div>
                             <div className="grid gap-1">
                                {index === 0 && <Label className="text-xs">Qty</Label>}
                                <Input
                                    type="number"
                                    min="1"
                                    value={item.quantity}
                                    onChange={(e) => updateItem(item.id, "quantity", parseInt(e.target.value) || 0)}
                                    required
                                />
                             </div>
                             <div className="grid gap-1">
                                {index === 0 && <Label className="text-xs">Price</Label>}
                                <Input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={item.price}
                                    onChange={(e) => updateItem(item.id, "price", parseFloat(e.target.value) || 0)}
                                    required
                                />
                             </div>
                             <div className="pt-1">
                                {index === 0 && <div className="h-4 mb-1" />} {/* Spacer for label alignment */}
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="text-destructive hover:text-destructive/90"
                                    onClick={() => removeItem(item.id)}
                                    disabled={items.length === 1}
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                             </div>
                        </div>
                    ))}
                </div>

                <div className="flex justify-end gap-2 text-sm">
                    <span className="font-medium">Total:</span>
                    <span>${subtotal.toFixed(2)}</span>
                </div>
            </div>

             <div className="grid gap-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                    id="notes"
                    placeholder="Additional notes for the customer..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                />
            </div>

            <SheetFooter>
                <SheetClose asChild>
                    <Button type="button" variant="outline">Cancel</Button>
                </SheetClose>
                <Button type="submit">Create Invoice</Button>
            </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}



