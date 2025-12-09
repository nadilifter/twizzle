import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import Link from "next/link"
import Image from "next/image"
import { AnimatedThemeToggler } from "@/components/ui/animated-theme-toggler"
import { ShineBorder } from "@/components/ui/shine-border"
import { BeamsUpstream } from "@/components/ui/beams-upstream"

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen py-2 bg-background relative overflow-hidden">
      <BeamsUpstream className="z-0" />
      <div className="absolute top-4 right-4 z-50">
        <AnimatedThemeToggler />
      </div>
      <main className="flex flex-col items-center justify-center w-full flex-1 px-20 text-center z-10">
        <div className="flex flex-col gap-6 w-[350px]">
          <Card className="relative overflow-hidden">
            <ShineBorder shineColor={["#5655ED", "#A07CFE"]} className="text-center" />
            <CardHeader className="items-center">
              <Image
                src="/uplifter-logo.svg"
                alt="Uplifter"
                width={200}
                height={40}
                priority
                className="h-12 w-auto mb-4 dark:brightness-0 dark:invert"
              />
              <CardTitle>We&apos;re launching soon!</CardTitle>
              <CardDescription>Enter your email to join the waitlist.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid w-full items-center gap-4">
                <div className="flex flex-col space-y-1.5">
                  <Input id="email" placeholder="gymnast@uplifter.com" />
                </div>
                <Button className="w-full">Join Waitlist</Button>
              </div>
            </CardContent>
          </Card>

          <Link href="/dashboard" className="w-full">
            <Button variant="outline" className="w-full">
              Go to Dashboard (Demo)
            </Button>
          </Link>
        </div>
      </main>
    </div>
  );
}
