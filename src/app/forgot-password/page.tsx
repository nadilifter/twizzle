import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { BeamsUpstream } from "@/components/ui/beams-upstream"
import { AnimatedThemeToggler } from "@/components/ui/animated-theme-toggler"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { ShineBorder } from "@/components/ui/shine-border"
import { ChevronLeft } from "lucide-react"

export default function ForgotPasswordPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen py-2 bg-background relative overflow-hidden">
      <BeamsUpstream className="z-0" />
      <div className="absolute top-4 right-4 z-50">
        <AnimatedThemeToggler />
      </div>
      
      <main className="flex flex-col items-center justify-center w-full flex-1 px-4 text-center z-10">
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
            <h1 className="text-2xl font-bold">Forgot Password</h1>
            <p className="text-sm text-muted-foreground">
              Enter your email to reset your password
            </p>
          </CardHeader>
          
          <CardContent className="grid gap-4">
            <div className="grid gap-2 text-left">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="m@example.com"
                required
              />
            </div>
            <Button type="submit" className="w-full">
              Send Reset Link
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
      </main>
    </div>
  )
}

