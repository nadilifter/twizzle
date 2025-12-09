"use client"

import React from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { ArrowLeft, Calendar, DollarSign, Mail, MapPin, Phone, ShoppingBag, Trophy, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { sponsors } from "../data"

export default function SponsorshipDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string
  const sponsor = sponsors.find((s) => s.id === id)

  if (!sponsor) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8">
        <h1 className="text-2xl font-bold mb-4">Sponsor Not Found</h1>
        <Button onClick={() => router.push("/campaigns/sponsorship")}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Sponsorships
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 p-4 md:p-8">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" asChild>
          <Link href="/campaigns/sponsorship">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">{sponsor.company}</h1>
            <Badge variant={sponsor.status === "Active" ? "default" : sponsor.status === "Pending" ? "secondary" : "destructive"}>
              {sponsor.status}
            </Badge>
          </div>
          <p className="text-muted-foreground">{sponsor.description || "No description provided."}</p>
        </div>
        <div className="flex gap-2">
           <Button variant="outline">Edit</Button>
           <Button variant="destructive">Delete</Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle>Contact Information</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                <Trophy className="h-4 w-4" />
              </div>
              <div className="grid gap-1">
                <p className="text-sm font-medium leading-none">Primary Contact</p>
                <p className="text-sm text-muted-foreground">{sponsor.contact}</p>
              </div>
            </div>
            {sponsor.email && (
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                  <Mail className="h-4 w-4" />
                </div>
                <div className="grid gap-1">
                  <p className="text-sm font-medium leading-none">Email</p>
                  <a href={`mailto:${sponsor.email}`} className="text-sm text-muted-foreground hover:underline">
                    {sponsor.email}
                  </a>
                </div>
              </div>
            )}
             {sponsor.phone && (
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                  <Phone className="h-4 w-4" />
                </div>
                <div className="grid gap-1">
                  <p className="text-sm font-medium leading-none">Phone</p>
                  <a href={`tel:${sponsor.phone}`} className="text-sm text-muted-foreground hover:underline">
                    {sponsor.phone}
                  </a>
                </div>
              </div>
            )}
             {sponsor.website && (
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                  <ExternalLink className="h-4 w-4" />
                </div>
                <div className="grid gap-1">
                  <p className="text-sm font-medium leading-none">Website</p>
                  <a href={sponsor.website} target="_blank" rel="noopener noreferrer" className="text-sm text-muted-foreground hover:underline">
                    {sponsor.website}
                  </a>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle>Agreement Details</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
             <div className="flex justify-between items-center border-b pb-2">
                <span className="text-sm font-medium text-muted-foreground">Current Tier</span>
                <Badge variant={sponsor.tier === "Platinum" ? "default" : sponsor.tier === "Gold" ? "secondary" : "outline"}>
                    {sponsor.tier}
                </Badge>
             </div>
             <div className="flex justify-between items-center border-b pb-2">
                <span className="text-sm font-medium text-muted-foreground">Amount</span>
                <span className="font-bold">
                    {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(sponsor.amount)}
                </span>
             </div>
             <div className="flex justify-between items-center border-b pb-2">
                <span className="text-sm font-medium text-muted-foreground">Renewal Date</span>
                <span>{sponsor.renewalDate}</span>
             </div>
          </CardContent>
        </Card>
        
        <Card className="md:col-span-1 bg-muted/50 border-dashed">
            <CardHeader className="text-center">
                <CardTitle>Sponsorship Value</CardTitle>
                <CardDescription>Estimated total value of sponsorship</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center justify-center pt-0">
                <div className="text-4xl font-bold text-primary">
                     {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(sponsor.amount)}
                </div>
                <p className="text-xs text-muted-foreground mt-2">Includes monetary and in-kind contributions</p>
            </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="events" className="w-full">
        <TabsList className="grid w-full grid-cols-3 lg:w-[400px]">
          <TabsTrigger value="events">Events</TabsTrigger>
          <TabsTrigger value="merchandise">Merchandise</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>
        <TabsContent value="events" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Sponsored Events</CardTitle>
              <CardDescription>
                Events sponsored by {sponsor.company} in the current agreement period.
              </CardDescription>
            </CardHeader>
            <CardContent>
                {sponsor.sponsoredEvents && sponsor.sponsoredEvents.length > 0 ? (
                    <div className="space-y-4">
                        {sponsor.sponsoredEvents.map((event) => (
                            <div key={event.id} className="flex items-center justify-between rounded-lg border p-4">
                                <div className="flex items-center gap-4">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                                        <Calendar className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <h4 className="text-base font-semibold">{event.name}</h4>
                                        <p className="text-sm text-muted-foreground">{event.date}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="font-bold">{new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(event.contribution)}</p>
                                    <p className="text-xs text-muted-foreground">Contribution</p>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
                        <Calendar className="h-10 w-10 mb-2 opacity-20" />
                        <p>No sponsored events found.</p>
                    </div>
                )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="merchandise" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Sponsored Merchandise</CardTitle>
              <CardDescription>
                Branded merchandise and equipment provided by {sponsor.company}.
              </CardDescription>
            </CardHeader>
             <CardContent>
                {sponsor.sponsoredMerchandise && sponsor.sponsoredMerchandise.length > 0 ? (
                    <div className="space-y-4">
                        {sponsor.sponsoredMerchandise.map((item) => (
                            <div key={item.id} className="flex items-center justify-between rounded-lg border p-4">
                                <div className="flex items-center gap-4">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-100 text-orange-600">
                                        <ShoppingBag className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <h4 className="text-base font-semibold">{item.name}</h4>
                                        <p className="text-sm text-muted-foreground">Qty: {item.quantity}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="font-bold">{new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(item.cost)}</p>
                                    <p className="text-xs text-muted-foreground">Total Cost</p>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
                        <ShoppingBag className="h-10 w-10 mb-2 opacity-20" />
                        <p>No sponsored merchandise found.</p>
                    </div>
                )}
            </CardContent>
          </Card>
        </TabsContent>
         <TabsContent value="history" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Sponsorship History</CardTitle>
              <CardDescription>
                Past agreements and interactions.
              </CardDescription>
            </CardHeader>
            <CardContent>
                 <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
                    <p>History data is not available in this preview.</p>
                </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}


