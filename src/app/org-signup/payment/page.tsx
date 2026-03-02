import { ArrowLeft, CreditCard, Clock } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import Link from "next/link"

export default function PaymentPage() {
  return (
    <div className="w-full max-w-lg mx-auto">
      <Link 
        href="/org-signup" 
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="h-4 w-4 mr-1" />
        Back to signup
      </Link>

      <Card className="text-center">
        <CardHeader className="pb-4">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <CreditCard className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">Online Payments Coming Soon</CardTitle>
          <CardDescription className="text-base">
            We&apos;re putting the finishing touches on our secure payment system.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="rounded-lg border border-dashed p-4 space-y-2">
            <div className="flex items-center justify-center gap-2 text-sm font-medium">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span>Available very soon</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Online signup with payment processing will be available shortly.
              In the meantime, please reach out to us directly to get your organization set up.
            </p>
          </div>

          <div className="space-y-3">
            <Button asChild className="w-full">
              <a href="mailto:support@uplifterinc.com">
                Contact Us to Get Started
              </a>
            </Button>
            <Button asChild variant="outline" className="w-full">
              <Link href="/org-signup">
                Back to Signup
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
