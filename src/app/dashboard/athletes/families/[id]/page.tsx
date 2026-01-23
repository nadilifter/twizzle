"use client"

import * as React from "react"
import { useParams } from "next/navigation"
import { 
  ArrowLeft, 
  Mail, 
  Phone, 
  MapPin, 
  CreditCard, 
  Plus, 
  MoreHorizontal,
  Download,
  FileText,
  User
} from "lucide-react"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

import { families } from "@/mock-data/families"
import { athletes } from "@/mock-data/athletes"

// Mock Transactions
const TRANSACTIONS = [
  { id: "TX-101", date: "2023-11-01", description: "Monthly Tuition - November", amount: 185.00, status: "paid" },
  { id: "TX-102", date: "2023-10-01", description: "Monthly Tuition - October", amount: 185.00, status: "paid" },
  { id: "TX-103", date: "2023-09-15", description: "Team Leotard", amount: 85.00, status: "paid" },
]

export default function FamilyDetailPage() {
  const params = useParams()
  const family = families.find(f => f.id === params.id)
  
  // In a real app we'd query by familyId, here we filter
  const familyAthletes = athletes.filter(a => family?.athletes.includes(a.id) || a.familyId === family?.id)

  if (!family) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] gap-4">
        <h1 className="text-2xl font-bold">Family Not Found</h1>
        <Button asChild>
          <Link href="/dashboard/athletes/families">Go Back</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard/athletes/families">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight">{family.name}</h1>
          <div className="flex items-center gap-2 text-muted-foreground">
            <span className="flex items-center gap-1"><User className="h-4 w-4" /> {family.primaryContact}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
           <Button variant="outline">Statement</Button>
           <Button>Add Payment Method</Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Sidebar Info */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Contact Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-muted rounded-full">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="overflow-hidden">
                  <p className="text-sm font-medium">Email</p>
                  <p className="text-sm text-muted-foreground truncate" title={family.email}>{family.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-muted rounded-full">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium">Phone</p>
                  <p className="text-sm text-muted-foreground">{family.phone}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-muted rounded-full">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium">Address</p>
                  <p className="text-sm text-muted-foreground">{family.address}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
             <CardHeader>
              <CardTitle className="text-lg">Account Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
               <div>
                  <p className="text-sm font-medium text-muted-foreground">Current Balance</p>
                  <p className={`text-2xl font-bold ${family.balance > 0 ? "text-destructive" : "text-green-600"}`}>
                    ${Math.abs(family.balance).toFixed(2)} {family.balance < 0 ? "CR" : ""}
                  </p>
               </div>
               <div className="pt-2 border-t">
                 <p className="text-sm font-medium mb-2">Payment Methods</p>
                 {family.paymentMethods.length > 0 ? (
                   <div className="space-y-2">
                     {family.paymentMethods.map(pm => (
                       <div key={pm.id} className="flex items-center gap-2 text-sm border p-2 rounded">
                          <CreditCard className="h-4 w-4 text-muted-foreground" />
                          <span>{pm.brand} •••• {pm.last4}</span>
                          {pm.isDefault && <Badge variant="secondary" className="text-[10px] h-5">Default</Badge>}
                       </div>
                     ))}
                   </div>
                 ) : (
                   <p className="text-sm text-muted-foreground">No payment methods saved.</p>
                 )}
               </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <div className="md:col-span-2">
           <Tabs defaultValue="members" className="w-full">
            <TabsList className="w-full justify-start">
              <TabsTrigger value="members">Members</TabsTrigger>
              <TabsTrigger value="billing">Billing & Invoices</TabsTrigger>
              <TabsTrigger value="settings">Settings</TabsTrigger>
            </TabsList>

            <TabsContent value="members" className="mt-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium">Family Members</h3>
                <Button variant="outline" size="sm">
                  <Plus className="mr-2 h-4 w-4" /> Add Student
                </Button>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {familyAthletes.map(athlete => (
                  <Card key={athlete.id} className="overflow-hidden">
                    <CardContent className="p-0">
                      <div className="flex items-center gap-4 p-4">
                        <Avatar className="h-12 w-12">
                          <AvatarImage src={athlete.avatar} />
                          <AvatarFallback>{athlete.name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <Link href={`/dashboard/athletes/${athlete.id}`} className="hover:underline">
                            <h4 className="font-semibold truncate">{athlete.name}</h4>
                          </Link>
                          <p className="text-sm text-muted-foreground">{athlete.level}</p>
                        </div>
                        <Badge variant={athlete.status === "Active" ? "default" : "secondary"}>
                          {athlete.status}
                        </Badge>
                      </div>
                      <div className="bg-muted/50 px-4 py-3 flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{athlete.group}</span>
                        <Button variant="ghost" size="sm" className="h-auto p-0 text-primary">
                          Manage
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {familyAthletes.length === 0 && (
                   <div className="col-span-2 text-center p-8 border rounded-lg border-dashed text-muted-foreground">
                     No athletes linked to this family.
                   </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="billing" className="mt-6 space-y-6">
               <Card>
                 <CardHeader className="flex flex-row items-center justify-between">
                   <CardTitle>Transaction History</CardTitle>
                   <Button variant="outline" size="sm">
                     <Download className="mr-2 h-4 w-4" /> Export
                   </Button>
                 </CardHeader>
                 <CardContent>
                   <Table>
                     <TableHeader>
                       <TableRow>
                         <TableHead>Date</TableHead>
                         <TableHead>Description</TableHead>
                         <TableHead>Status</TableHead>
                         <TableHead className="text-right">Amount</TableHead>
                         <TableHead className="text-right"></TableHead>
                       </TableRow>
                     </TableHeader>
                     <TableBody>
                       {TRANSACTIONS.map(tx => (
                         <TableRow key={tx.id}>
                           <TableCell>{tx.date}</TableCell>
                           <TableCell>{tx.description}</TableCell>
                           <TableCell>
                             <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 capitalize">
                               {tx.status}
                             </Badge>
                           </TableCell>
                           <TableCell className="text-right">${tx.amount.toFixed(2)}</TableCell>
                           <TableCell className="text-right">
                             <Button variant="ghost" size="icon">
                               <FileText className="h-4 w-4 text-muted-foreground" />
                             </Button>
                           </TableCell>
                         </TableRow>
                       ))}
                     </TableBody>
                   </Table>
                 </CardContent>
               </Card>
            </TabsContent>

             <TabsContent value="settings" className="mt-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Account Settings</CardTitle>
                    <CardDescription>Manage family preferences and communication.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">Settings content would go here...</p>
                  </CardContent>
                </Card>
             </TabsContent>
           </Tabs>
        </div>
      </div>
    </div>
  )
}


