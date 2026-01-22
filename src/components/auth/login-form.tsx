"use client"

import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { ShineBorder } from "@/components/ui/shine-border"
import { useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { signIn } from "next-auth/react"
import { toast } from "sonner"

export function LoginForm() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [email, setEmail] = useState(searchParams.get("email") || "")
  const [password, setPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  
  // Check for OAuth errors in URL params
  const urlError = searchParams.get("error")
  const getInitialError = () => {
    if (urlError === "NoAccount") {
      return "No account found with this email. Please contact your administrator to create an account."
    }
    if (urlError === "OAuthAccountNotLinked") {
      return "This email is already associated with a different sign-in method."
    }
    return null
  }
  const [error, setError] = useState<string | null>(getInitialError())

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      })

      if (result?.error) {
        // Clear password on failed attempt
        setPassword("")
        // Show user-friendly error message
        const errorMessage = result.error === "CredentialsSignin" 
          ? "Invalid email or password. Please try again."
          : result.error
        setError(errorMessage)
        toast.error(errorMessage)
      } else {
        router.push("/dashboard")
        router.refresh()
      }
    } catch {
      setPassword("")
      const errorMessage = "An error occurred. Please try again."
      setError(errorMessage)
      toast.error(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  const handleOAuthSignIn = (provider: string) => {
    signIn(provider, { callbackUrl: "/dashboard" })
  }

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
            <h1 className="text-2xl font-bold">Welcome back</h1>
            <p className="text-sm text-muted-foreground">
              Login to your account
            </p>
          </CardHeader>
          
          <CardContent className="grid gap-4">
            <form onSubmit={handleSubmit} className="grid gap-4">
            <div className="grid grid-cols-3 gap-3">
              <Button type="button" variant="outline" className="w-full" onClick={() => handleOAuthSignIn("google")} disabled={isLoading}>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  className="h-5 w-5"
                >
                  <path
                    d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"
                    fill="currentColor"
                  />
                </svg>
                <span className="sr-only">Login with Google</span>
              </Button>
              <Button type="button" variant="outline" className="w-full" disabled={isLoading}>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  className="h-5 w-5"
                >
                  <path
                    fill="currentColor"
                    d="M11.4 24H0V12.6h11.4V24zM24 24H12.6V12.6H24V24zM11.4 11.4H0V0h11.4v11.4zM24 11.4H12.6V0H24v11.4z"
                  />
                </svg>
                <span className="sr-only">Login with Microsoft</span>
              </Button>
              <Button type="button" variant="outline" className="w-full" disabled={isLoading}>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  className="h-5 w-5"
                  fill="currentColor"
                >
                  <path d="M9.94475 22.0001V11.9327H7.31171V8.65751H9.94475V6.15112C9.94475 3.39088 11.5202 1.7915 13.8824 1.7915C15.0142 1.7915 16.1983 2.01235 16.1983 2.01235V4.72314H14.8943C13.6288 4.72314 13.2335 5.5681 13.2335 6.43572V8.65751H16.1158L15.6548 11.9327H13.2335V22.0001H9.94475Z" />
                </svg>
                <span className="sr-only">Login with Facebook</span>
              </Button>
            </div>
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  Or continue with
                </span>
              </div>
            </div>
            <div className="grid gap-2 text-left">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="m@example.com"
                required
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  if (error) setError(null)
                }}
                disabled={isLoading}
              />
            </div>
            <div className="grid gap-2 text-left">
              <div className="flex items-center">
                <Label htmlFor="password">Password</Label>
              </div>
              <Input 
                id="password" 
                type="password" 
                required 
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value)
                  if (error) setError(null)
                }}
                disabled={isLoading}
              />
            </div>
            {error && (
              <div className="rounded-md bg-destructive/15 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Logging in..." : "Login"}
            </Button>
            <div className="text-center text-sm">
                <Link
                    href={`/forgot-password?email=${encodeURIComponent(email)}`}
                    className="text-muted-foreground underline underline-offset-4"
                >
                    Forgot your password?
                </Link>
            </div>
            <div className="text-center text-sm">
              Don&apos;t have an account?{" "}
              <Link href={`/signup?email=${encodeURIComponent(email)}`} className="underline">
                Sign up
              </Link>
            </div>
            </form>
          </CardContent>
        </Card>
    </>
  )
}



