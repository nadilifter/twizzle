"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2Icon, LockIcon } from "lucide-react"
import { toast } from "sonner"

export function AchSetupDialog({ trigger }: { trigger?: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  
  // Form State
  const [holderName, setHolderName] = useState("")
  const [routingNumber, setRoutingNumber] = useState("")
  const [accountNumber, setAccountNumber] = useState("")
  const [confirmAccountNumber, setConfirmAccountNumber] = useState("")
  const [accountType, setAccountType] = useState<string>("checking")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    // Basic Validation
    if (accountNumber !== confirmAccountNumber) {
        toast.error("Account numbers do not match")
        setIsLoading(false)
        return
    }

    if (routingNumber.length !== 9) {
        toast.error("Routing number must be 9 digits")
        setIsLoading(false)
        return
    }

    // Simulate API call to Adyen / Backend
    await new Promise(resolve => setTimeout(resolve, 2000))

    console.log("Submitting ACH Details:", {
        holderName,
        routingNumber,
        accountNumber, // In production, this would be tokenized
        accountType
    })

    toast.success("Bank account added successfully")
    setIsLoading(false)
    setOpen(false)
    
    // Reset form
    setHolderName("")
    setRoutingNumber("")
    setAccountNumber("")
    setConfirmAccountNumber("")
    setAccountType("checking")
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || <Button variant="outline">Update Bank Details</Button>}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Bank Account Details</DialogTitle>
          <DialogDescription>
            Enter your bank account information to receive payouts. 
            Your data is securely encrypted and sent directly to Adyen.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-6 py-4">
          <div className="grid gap-2">
            <Label htmlFor="holderName">Account Holder Name</Label>
            <Input 
                id="holderName" 
                placeholder="e.g. Acme Corp" 
                value={holderName}
                onChange={(e) => setHolderName(e.target.value)}
                required
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="routingNumber">Routing Number (ABA)</Label>
            <Input 
                id="routingNumber" 
                placeholder="9 digits" 
                value={routingNumber}
                onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '').slice(0, 9)
                    setRoutingNumber(val)
                }}
                required
                pattern="\d{9}"
                inputMode="numeric"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
                <Label htmlFor="accountNumber">Account Number</Label>
                <Input 
                    id="accountNumber" 
                    type="password"
                    placeholder="••••••••••••" 
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)}
                    required
                />
            </div>
            <div className="grid gap-2">
                <Label htmlFor="confirmAccountNumber">Confirm Account Number</Label>
                <Input 
                    id="confirmAccountNumber" 
                    type="password"
                    placeholder="••••••••••••" 
                    value={confirmAccountNumber}
                    onChange={(e) => setConfirmAccountNumber(e.target.value)}
                    required
                />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="accountType">Account Type</Label>
            <Select value={accountType} onValueChange={setAccountType}>
              <SelectTrigger id="accountType">
                <SelectValue placeholder="Select account type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="checking">Checking</SelectItem>
                <SelectItem value="savings">Savings</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 p-3 rounded-md">
            <LockIcon className="h-3 w-3" />
            <span>Bank details are encrypted and stored securely.</span>
          </div>

          <DialogFooter>
             <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
             <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />}
                Save Bank Account
             </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

