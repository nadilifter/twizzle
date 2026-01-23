"use client"

import { useState } from "react"
import { Check, Copy, AlertCircle, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"

export function EmailSettings() {
  const [domain, setDomain] = useState("gymstar.com")
  const [isVerifying, setIsVerifying] = useState(false)
  const [verificationStatus, setVerificationStatus] = useState<"unverified" | "pending" | "verified">("unverified")
  const [senderName, setSenderName] = useState("Uplifter Gym")
  const [senderEmail, setSenderEmail] = useState("info@gymstar.com")
  const [isSaved, setIsSaved] = useState(false)

  const handleVerify = () => {
    if (!domain) return
    setIsVerifying(true)
    // Simulate API call
    setTimeout(() => {
      setIsVerifying(false)
      setVerificationStatus("pending")
    }, 1500)
  }

  const handleSaveSender = () => {
    setIsSaved(true)
    setTimeout(() => setIsSaved(false), 2000)
  }

  const dnsRecords = [
    {
      type: "CNAME",
      name: `34523452345._domainkey.${domain}`,
      value: "34523452345.dkim.amazonses.com",
    },
    {
      type: "CNAME",
      name: `45634563456._domainkey.${domain}`,
      value: "45634563456.dkim.amazonses.com",
    },
    {
      type: "CNAME",
      name: `56745674567._domainkey.${domain}`,
      value: "56745674567.dkim.amazonses.com",
    },
  ]

  return (
    <div className="grid gap-6">
      {/* Domain Authentication */}
      <Card>
        <CardHeader>
          <CardTitle>Domain Authentication</CardTitle>
          <CardDescription>
            Authenticate your domain to improve email deliverability and send on behalf of <strong>{domain || "your domain"}</strong>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-2">
            <Label htmlFor="domain">Sending Domain</Label>
            <div className="flex gap-2">
              <Input
                id="domain"
                placeholder="e.g. example.com"
                value={domain}
                onChange={(e) => {
                  setDomain(e.target.value)
                  setVerificationStatus("unverified")
                }}
                disabled={verificationStatus !== "unverified"}
              />
              {verificationStatus === "unverified" ? (
                <Button onClick={handleVerify} disabled={!domain || isVerifying}>
                  {isVerifying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Verify Domain
                </Button>
              ) : (
                <Button variant="outline" onClick={() => setVerificationStatus("unverified")}>
                  Change
                </Button>
              )}
            </div>
          </div>

          {verificationStatus === "pending" && (
            <div className="space-y-4">
              <Alert variant="default" className="bg-amber-50 text-amber-900 border-amber-200">
                <AlertCircle className="h-4 w-4 text-amber-900" />
                <AlertTitle>Verification Pending</AlertTitle>
                <AlertDescription>
                  Add the following CNAME records to your DNS provider to verify ownership. It may take up to 72 hours to propagate.
                </AlertDescription>
              </Alert>

              <div className="rounded-md border">
                <div className="grid grid-cols-[1fr_2fr_2fr_auto] gap-4 p-4 font-medium text-sm border-b bg-muted/50">
                  <div>Type</div>
                  <div>Name</div>
                  <div>Value</div>
                  <div></div>
                </div>
                {dnsRecords.map((record, i) => (
                  <div key={i} className="grid grid-cols-[1fr_2fr_2fr_auto] gap-4 p-4 text-sm items-center border-b last:border-0">
                    <Badge variant="outline">{record.type}</Badge>
                    <div className="font-mono text-xs truncate" title={record.name}>{record.name}</div>
                    <div className="font-mono text-xs truncate" title={record.value}>{record.value}</div>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {verificationStatus === "verified" && (
             <Alert className="bg-green-50 text-green-900 border-green-200">
              <Check className="h-4 w-4 text-green-900" />
              <AlertTitle>Domain Verified</AlertTitle>
              <AlertDescription>
                Your domain is authenticated. You can now send emails from @{domain}.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Sender Identity */}
      <Card>
        <CardHeader>
          <CardTitle>Default Sender</CardTitle>
          <CardDescription>
            Set the default name and email address that will appear in your recipients&apos; inbox.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="sender-name">From Name</Label>
            <Input 
              id="sender-name" 
              value={senderName} 
              onChange={(e) => setSenderName(e.target.value)} 
              placeholder="e.g. Uplifter Gym"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="sender-email">From Email</Label>
            <Input 
              id="sender-email" 
              value={senderEmail} 
              onChange={(e) => setSenderEmail(e.target.value)} 
              placeholder="e.g. info@gymstar.com"
            />
            <p className="text-[0.8rem] text-muted-foreground">
              This email must belong to a verified domain.
            </p>
          </div>
        </CardContent>
        <CardFooter className="border-t px-6 py-4">
          <Button onClick={handleSaveSender}>
            {isSaved ? (
              <>
                <Check className="mr-2 h-4 w-4" />
                Saved
              </>
            ) : (
              "Save Changes"
            )}
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}






