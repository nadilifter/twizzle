import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { ShineBorder } from "@/components/ui/shine-border"
import { ChevronLeft } from "lucide-react"

export default function ResetPasswordPage() {
  return (
    <>
        <Card className="relative overflow-hidden w-full max-w-[400px]">
          <ShineBorder shineColor={["#5655ED", "#A07CFE"]} className="text-center" />
          <CardHeader className="items-center pb-2">
            <Image
              src="/uplifter-logo.svg"
              alt="Uplifter"
              width={180}
              height={36}
              className="h-9 w-auto mb-2 dark:brightness-0 dark:invert"
            />
            <h1 className="text-2xl font-bold">Reset Password</h1>
            <p className="text-sm text-muted-foreground">
              Enter your new password below
            </p>
          </CardHeader>
          
          <CardContent className="grid gap-4">
            <div className="grid gap-2 text-left">
              <Label htmlFor="password">New Password</Label>
              <Input id="password" type="password" required />
            </div>
            <div className="grid gap-2 text-left">
              <Label htmlFor="confirm-password">Confirm Password</Label>
              <Input id="confirm-password" type="password" required />
            </div>
            <Button type="submit" className="w-full">
              Reset Password
            </Button>
            <div className="text-center text-sm">
              <Link href="/login" className="flex items-center justify-center gap-2 text-muted-foreground hover:text-primary">
                <ChevronLeft className="h-4 w-4" />
                Back to Login
              </Link>
            </div>
          </CardContent>
        </Card>
        <Link href="/dashboard" className="w-full max-w-[400px] mt-4">
            <Button variant="outline" className="w-full">
              Go to Dashboard (Demo)
            </Button>
        </Link>
    </>
  )
}

