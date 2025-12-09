"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Loader2Icon, CreditCardIcon, LandmarkIcon, WalletIcon } from "lucide-react"
import { toast } from "sonner"

export function AddPaymentMethodDialog({ trigger }: { trigger?: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [methodType, setMethodType] = useState<"card" | "ach">("card")

  // Card State
  const [cardNumber, setCardNumber] = useState("")
  const [expiry, setExpiry] = useState("")
  const [cvc, setCvc] = useState("")
  const [nameOnCard, setNameOnCard] = useState("")

  // ACH State (reusing similar fields from AchSetupDialog but adapted for billing context)
  const [routingNumber, setRoutingNumber] = useState("")
  const [accountNumber, setAccountNumber] = useState("")
  const [accountType, setAccountType] = useState("checking")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500))

    console.log("Adding Payment Method:", {
        type: methodType,
        details: methodType === "card" 
            ? { cardNumber: cardNumber.slice(-4), expiry, nameOnCard } 
            : { routingNumber, accountNumber: accountNumber.slice(-4), accountType }
    })

    toast.success(`${methodType === "card" ? "Credit Card" : "Bank Account"} added successfully`)
    setIsLoading(false)
    setOpen(false)

    // Reset forms
    setCardNumber("")
    setExpiry("")
    setCvc("")
    setNameOnCard("")
    setRoutingNumber("")
    setAccountNumber("")
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || <Button variant="outline">Add Payment Method</Button>}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add Payment Method</DialogTitle>
          <DialogDescription>
            Add a new payment method for your subscription and usage billing.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-6 py-4">
          <RadioGroup 
            defaultValue="card" 
            value={methodType} 
            onValueChange={(val) => setMethodType(val as "card" | "ach")}
            className="grid grid-cols-2 gap-4"
          >
            <div>
              <RadioGroupItem value="card" id="card" className="peer sr-only" />
              <Label
                htmlFor="card"
                className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
              >
                <CreditCardIcon className="mb-3 h-6 w-6" />
                Credit/Debit Card
              </Label>
            </div>
            <div>
              <RadioGroupItem value="ach" id="ach" className="peer sr-only" />
              <Label
                htmlFor="ach"
                className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
              >
                <LandmarkIcon className="mb-3 h-6 w-6" />
                US Bank Account
              </Label>
            </div>
          </RadioGroup>

          {methodType === "card" ? (
            <div className="grid gap-4">
                <div className="grid gap-2">
                    <Label htmlFor="nameOnCard">Name on Card</Label>
                    <Input 
                        id="nameOnCard" 
                        placeholder="John Doe" 
                        value={nameOnCard}
                        onChange={(e) => setNameOnCard(e.target.value)}
                        required
                    />
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="cardNumber">Card Number</Label>
                    <Input 
                        id="cardNumber" 
                        placeholder="0000 0000 0000 0000" 
                        value={cardNumber}
                        onChange={(e) => setCardNumber(e.target.value.replace(/\D/g, '').slice(0, 16))}
                        required
                        inputMode="numeric"
                    />
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                        <Label htmlFor="expiry">Expiry Date</Label>
                        <Input 
                            id="expiry" 
                            placeholder="MM/YY" 
                            value={expiry}
                            onChange={(e) => setExpiry(e.target.value)}
                            required
                            maxLength={5}
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="cvc">CVC</Label>
                        <Input 
                            id="cvc" 
                            placeholder="123" 
                            value={cvc}
                            onChange={(e) => setCvc(e.target.value.replace(/\D/g, '').slice(0, 4))}
                            required
                            inputMode="numeric"
                            type="password"
                        />
                    </div>
                </div>
            </div>
          ) : (
            <div className="grid gap-4">
                 <div className="grid gap-2">
                    <Label htmlFor="routingNumber">Routing Number</Label>
                    <Input 
                        id="routingNumber" 
                        placeholder="9 digits" 
                        value={routingNumber}
                        onChange={(e) => setRoutingNumber(e.target.value.replace(/\D/g, '').slice(0, 9))}
                        required
                        pattern="\d{9}"
                    />
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="accountNumber">Account Number</Label>
                    <Input 
                        id="accountNumber" 
                        placeholder="Account Number" 
                        value={accountNumber}
                        onChange={(e) => setAccountNumber(e.target.value)}
                        required
                        type="password"
                    />
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="accountType">Account Type</Label>
                    <Select value={accountType} onValueChange={setAccountType}>
                        <SelectTrigger>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="checking">Checking</SelectItem>
                            <SelectItem value="savings">Savings</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>
          )}

          <DialogFooter>
             <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
             <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />}
                Add {methodType === "card" ? "Card" : "Account"}
             </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

