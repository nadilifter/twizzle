"use client"

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CheckCircle2Icon, AlertCircleIcon, Building2Icon, UniversityIcon, UserIcon, ShieldCheckIcon } from "lucide-react"
import { Separator } from "@/components/ui/separator"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

export default function OnboardingPage() {
  const isFullyVerified = true // Toggle this to simulate different states

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight">Account Onboarding</h1>
        <p className="text-muted-foreground">
          Verify your business details to start processing payments with Adyen.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-[2fr_1fr]">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Verification Status</CardTitle>
              <CardDescription>
                Your account capabilities based on provided information.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              {isFullyVerified ? (
                <Alert className="bg-green-50 border-green-200 text-green-800">
                  <CheckCircle2Icon className="h-4 w-4 text-green-600" />
                  <AlertTitle>Ready to process</AlertTitle>
                  <AlertDescription>
                    Your account is fully verified. You can now accept payments and receive payouts.
                  </AlertDescription>
                </Alert>
              ) : (
                <Alert variant="destructive">
                  <AlertCircleIcon className="h-4 w-4" />
                  <AlertTitle>Action Required</AlertTitle>
                  <AlertDescription>
                    Please complete the missing information below to enable payouts.
                  </AlertDescription>
                </Alert>
              )}

              <div className="grid gap-4 mt-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Building2Icon className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h4 className="font-semibold">Legal Entity</h4>
                      <p className="text-sm text-muted-foreground">Business details and address</p>
                    </div>
                  </div>
                  <CheckCircle2Icon className="h-5 w-5 text-green-600" />
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <UserIcon className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h4 className="font-semibold">Identity Verification</h4>
                      <p className="text-sm text-muted-foreground">Ultimate Beneficial Owners (UBOs)</p>
                    </div>
                  </div>
                  <CheckCircle2Icon className="h-5 w-5 text-green-600" />
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <UniversityIcon className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h4 className="font-semibold">Bank Account</h4>
                      <p className="text-sm text-muted-foreground">Payout destination details</p>
                    </div>
                  </div>
                  <CheckCircle2Icon className="h-5 w-5 text-green-600" />
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex justify-between border-t pt-6">
               <div className="text-sm text-muted-foreground">
                 Account ID: <span className="font-mono text-foreground">10000928374</span>
               </div>
               <Button variant="outline">Update Details</Button>
            </CardFooter>
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Processing Limits</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="text-muted-foreground">Daily Volume</span>
                    <span className="font-medium">$1,250 / $5,000</span>
                  </div>
                  <div className="h-2 bg-secondary rounded-full overflow-hidden">
                    <div className="h-full bg-primary w-[25%]"></div>
                  </div>
                </div>
                <Separator />
                <div className="flex items-start gap-2 text-sm text-muted-foreground">
                  <ShieldCheckIcon className="h-4 w-4 mt-0.5 shrink-0" />
                  <p>Your account has Tier 2 limits applied based on provided documentation.</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-muted/50">
             <CardHeader>
               <CardTitle className="text-sm font-medium">Need Help?</CardTitle>
             </CardHeader>
             <CardContent className="text-sm text-muted-foreground">
               <p>
                 If you're having trouble verifying your account, contact our support team or check the Adyen documentation.
               </p>
               <Button variant="link" className="px-0 mt-2">
                 Contact Support &rarr;
               </Button>
             </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}


