"use client"

import { Check, CreditCard, Download, Package } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { AddPaymentMethodDialog } from "@/components/financials/add-payment-method-dialog"

export default function BillingPage() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Billing & Plans</h1>
          <p className="text-muted-foreground">
            Manage your subscription plan, view usage, and download invoices.
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Current Plan Card */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
            <div className="grid gap-1">
              <CardTitle>Current Plan</CardTitle>
              <CardDescription>
                You are currently on the <span className="font-medium text-foreground">Gold</span> plan.
              </CardDescription>
            </div>
            <Badge variant="secondary" className="text-sm">
              Gold
            </Badge>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-bold">$49</span>
                <span className="text-muted-foreground">/month</span>
              </div>
              <div className="text-sm text-muted-foreground">
                Renews on Dec 1, 2025
              </div>
            </div>
            
            <div className="grid gap-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-primary" />
                <span>Transaction Fee: <strong>2.9% + $0.30</strong> per transaction</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-primary" />
                <span>Full Club Management Suite</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-primary" />
                <span>Advanced Website & Branding</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-primary" />
                <span>Enhanced Financial Reporting</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-primary" />
                <span>Priority Support (Email + Chat)</span>
              </div>
            </div>
          </CardContent>
          <CardFooter>
            <Button variant="outline" className="w-full sm:w-auto">Change Plan</Button>
          </CardFooter>
        </Card>

        {/* Current Month Costs Summary */}
        <Card>
          <CardHeader>
            <CardTitle>Current Period</CardTitle>
            <CardDescription>Estimated costs for this billing cycle</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-medium">Platform Subscription</span>
              <span>$49.00</span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-medium">Transaction Fees</span>
              <span>$124.50</span>
            </div>
             <div className="flex items-baseline justify-between">
              <span className="text-sm font-medium">Usage Fees (SMS/Email)</span>
              <span>$23.45</span>
            </div>
            <Separator />
            <div className="flex items-baseline justify-between font-bold">
              <span>Total Estimated</span>
              <span>$196.95</span>
            </div>
            <div className="rounded-lg bg-muted p-2 text-xs text-muted-foreground">
              Billing period: Nov 1 - Nov 30
            </div>
          </CardContent>
          <CardFooter>
            <Button className="w-full">Pay Now</Button>
          </CardFooter>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
         <Card>
          <CardHeader>
            <CardTitle>Payment Methods</CardTitle>
            <CardDescription>Manage your payment details</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="rounded-md border p-2">
                  <CreditCard className="h-6 w-6" />
                </div>
                <div>
                  <p className="font-medium">Visa ending in 4242</p>
                  <p className="text-sm text-muted-foreground">Expiry 12/28</p>
                </div>
              </div>
              <Badge variant="outline">Default</Badge>
            </div>
             <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="rounded-md border p-2">
                  <CreditCard className="h-6 w-6" />
                </div>
                <div>
                  <p className="font-medium">Mastercard ending in 8888</p>
                  <p className="text-sm text-muted-foreground">Expiry 10/26</p>
                </div>
              </div>
              <Badge variant="secondary">Backup</Badge>
            </div>
          </CardContent>
          <CardFooter>
             <AddPaymentMethodDialog 
                trigger={
                    <Button variant="ghost" className="w-full justify-start pl-0 text-muted-foreground hover:text-foreground">
                      Edit Payment Methods
                    </Button>
                }
             />
          </CardFooter>
        </Card>
         <Card>
          <CardHeader>
            <CardTitle>Billing History</CardTitle>
            <CardDescription>View your recent invoices</CardDescription>
          </CardHeader>
           <CardContent className="grid gap-4">
            <div className="flex items-center justify-between">
               <div className="flex items-center gap-4">
                 <div className="rounded-full bg-primary/10 p-2">
                   <Download className="h-4 w-4 text-primary" />
                 </div>
                 <div>
                   <p className="font-medium">Invoice #1024</p>
                   <p className="text-xs text-muted-foreground">Oct 1, 2025</p>
                 </div>
               </div>
               <span className="font-medium">$185.00</span>
             </div>
              <div className="flex items-center justify-between">
               <div className="flex items-center gap-4">
                 <div className="rounded-full bg-primary/10 p-2">
                   <Download className="h-4 w-4 text-primary" />
                 </div>
                 <div>
                   <p className="font-medium">Invoice #1023</p>
                   <p className="text-xs text-muted-foreground">Sep 1, 2025</p>
                 </div>
               </div>
               <span className="font-medium">$172.50</span>
             </div>
           </CardContent>
            <CardFooter>
             <Button variant="ghost" className="w-full justify-start pl-0 text-muted-foreground hover:text-foreground">
              View All Invoices
            </Button>
          </CardFooter>
        </Card>
      </div>

      {/* Detailed Usage Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Usage & Fees Breakdown</CardTitle>
          <CardDescription>
            Detailed view of your incurred charges for the current period.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead>Rate</TableHead>
                <TableHead>Quantity</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="font-medium">Transaction Processing</TableCell>
                <TableCell>2.9% + $0.30</TableCell>
                <TableCell>$3,827.59 (45 transactions)</TableCell>
                <TableCell className="text-right">$124.50</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">SMS Notifications</TableCell>
                <TableCell>$0.01 / msg</TableCell>
                <TableCell>1,500 msgs</TableCell>
                <TableCell className="text-right">$15.00</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">Email Campaigns</TableCell>
                <TableCell>$0.001 / email</TableCell>
                <TableCell>8,450 emails</TableCell>
                <TableCell className="text-right">$8.45</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
