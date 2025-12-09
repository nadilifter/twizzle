"use client"

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Check, Copy, ExternalLink, X } from "lucide-react"
import { useState } from "react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

export default function IntegrationsPage() {
  const [qboConnected, setQboConnected] = useState(false)
  
  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight">Integrations</h1>
        <p className="text-muted-foreground">
          Connect your financial data with external accounting software.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* QuickBooks Online Integration */}
        <Card className="border-primary/20 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4">
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Recommended</Badge>
            </div>
          <CardHeader>
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[#2CA01C] text-white font-bold text-xl">
                qb
              </div>
              <div>
                <CardTitle>QuickBooks Online</CardTitle>
                <CardDescription>Sync transactions and customers automatically</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid gap-6">
            {!qboConnected ? (
                <>
                <div className="text-sm text-muted-foreground">
                    To set up the theoretical connection, please provide your QuickBooks Online application credentials. 
                    You can find these in your Intuit Developer Portal.
                </div>
                
                <div className="grid gap-4">
                    <div className="grid gap-2">
                        <Label htmlFor="client-id">Client ID</Label>
                        <Input id="client-id" placeholder="AB123..." />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="client-secret">Client Secret</Label>
                        <Input id="client-secret" type="password" placeholder="••••••••••••••••" />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="company-id">Company ID (Realm ID)</Label>
                        <Input id="company-id" placeholder="462081..." />
                    </div>
                    
                    <div className="bg-muted/50 p-4 rounded-md space-y-2">
                         <div className="text-sm font-medium">Callback URL</div>
                         <div className="flex items-center gap-2">
                            <code className="relative rounded bg-muted px-[0.3rem] py-[0.2rem] font-mono text-sm border flex-1">
                                https://uplifter.app/api/auth/callback/qbo
                            </code>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                                <Copy className="h-4 w-4" />
                            </Button>
                         </div>
                         <p className="text-xs text-muted-foreground">Add this to your Redirect URIs in Intuit Developer Portal.</p>
                    </div>
                </div>
                </>
            ) : (
                <Alert className="bg-green-50 border-green-200">
                    <Check className="h-4 w-4 text-green-600" />
                    <AlertTitle className="text-green-800">Connected</AlertTitle>
                    <AlertDescription className="text-green-700">
                        Your QuickBooks Online account is successfully linked. Data sync runs every 24 hours.
                    </AlertDescription>
                </Alert>
            )}
          </CardContent>
          <CardFooter>
            {!qboConnected ? (
                <Button className="w-full bg-[#2CA01C] hover:bg-[#2CA01C]/90" onClick={() => setQboConnected(true)}>
                    Connect to QuickBooks
                </Button>
            ) : (
                <Button variant="outline" className="w-full text-red-600 hover:text-red-600 hover:bg-red-50" onClick={() => setQboConnected(false)}>
                    Disconnect
                </Button>
            )}
          </CardFooter>
        </Card>

        {/* Xero Integration (Disabled) */}
        <Card className="opacity-60 grayscale relative">
             <div className="absolute top-0 right-0 p-4">
                <Badge variant="secondary">Coming Soon</Badge>
            </div>
          <CardHeader>
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[#00B7E2] text-white font-bold text-xl">
                X
              </div>
              <div>
                <CardTitle>Xero</CardTitle>
                <CardDescription>Beautiful accounting software</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
                Integration with Xero is currently under development. Check back later for updates on syncing your financial data with Xero.
            </p>
          </CardContent>
          <CardFooter>
            <Button disabled variant="outline" className="w-full">
                Connect to Xero
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}

