"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { ShineBorder } from "@/components/ui/shine-border"
import { useState, useEffect, useMemo } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { signIn, getCsrfToken } from "next-auth/react"
import { toast } from "sonner"
import { UplifterLogo } from "@/components/uplifter-logo"

/**
 * Get the OAuth host URL based on environment.
 * 
 * LOCAL DEVELOPMENT:
 *   Google OAuth doesn't allow subdomains on localhost (e.g., login.uplifterinc.localhost).
 *   So we must use localhost:3000 for OAuth callbacks, then the session-bridge
 *   transfers the session to the uplifterinc.localhost subdomains.
 * 
 * PRODUCTION:
 *   OAuth goes directly through login.uplifterinc.com.
 */
function getOAuthHost(): string {
  if (typeof window === "undefined") return "http://localhost:3000";
  
  const hostname = window.location.hostname;
  const isLocal = hostname.includes("localhost");
  
  if (isLocal) {
    // Google OAuth must go through localhost:3000 (not subdomains)
    return "http://localhost:3000";
  } else {
    // Production: OAuth goes through the login subdomain
    return "https://login.uplifterinc.com";
  }
}

/**
 * Get the default callback URL based on current domain.
 * 
 * For uplifterinc.localhost subdomains, we need to return an absolute URL
 * so that after OAuth on localhost:3000, the redirect callback can detect
 * we need to go through the session bridge to set cookies on the correct domain.
 */
function getDefaultCallbackUrl(): string {
  if (typeof window === "undefined") return "/";
  
  const hostname = window.location.hostname;
  
  // If on uplifterinc.localhost subdomain, default to admin portal
  if (hostname.endsWith("uplifterinc.localhost")) {
    return "http://admin.uplifterinc.localhost:3000/";
  }
  
  // Production: return admin subdomain
  if (hostname.endsWith("uplifterinc.com")) {
    return "https://admin.uplifterinc.com/";
  }
  
  return "/";
}

export function LoginForm() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const urlCallbackParam = searchParams.get("callbackUrl")
  
  // Use URL param if provided, otherwise compute default based on domain
  const callbackUrl = useMemo(() => {
    if (urlCallbackParam) return urlCallbackParam;
    return getDefaultCallbackUrl();
  }, [urlCallbackParam])
  const [email, setEmail] = useState(searchParams.get("email") || "")
  const [password, setPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [csrfToken, setCsrfToken] = useState<string>("")
  const [googleCsrfToken, setGoogleCsrfToken] = useState<string>("")
  
  // Determine OAuth host based on environment
  const oauthHost = useMemo(() => getOAuthHost(), [])

  useEffect(() => {
    // Get CSRF token for current domain (credentials login)
    getCsrfToken().then((token) => {
      if (token) setCsrfToken(token)
    })
    
    // Get CSRF token from the OAuth host for Google OAuth
    // In local dev, this is localhost:3000 (Google's restriction)
    // In production, this is login.uplifterinc.com
    fetch(`${oauthHost}/api/auth/csrf`, {
      credentials: "include",
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.csrfToken) setGoogleCsrfToken(data.csrfToken)
      })
      .catch((err) => {
        console.error("Failed to fetch Google CSRF token:", err)
        // Fallback to regular token (may work if same secret is used)
        getCsrfToken().then((token) => {
          if (token) setGoogleCsrfToken(token)
        })
      })
  }, [oauthHost])
  
  // Check for OAuth errors in URL params
  const urlError = searchParams.get("error")
  const getInitialError = () => {
    if (urlError === "NoAccount") {
      return "No account found with this email. Please contact your administrator to create an account."
    }
    if (urlError === "OAuthAccountNotLinked") {
      return "This email is already associated with a different sign-in method."
    }
    if (urlError === "google") {
      return "Google sign-in failed. Please check that the redirect URI is configured correctly in Google Cloud Console."
    }
    if (urlError === "OAuthCallback") {
      return "OAuth callback error. Please try again."
    }
    if (urlError === "BridgeTokenMissing" || urlError === "BridgeTokenExpired" || urlError === "BridgeTokenInvalid") {
      return "Session transfer failed. Please try signing in again."
    }
    if (urlError === "OAuthSessionMissing" || urlError === "OAuthBridgeError" || urlError === "BridgeError") {
      return "OAuth session error. Please try signing in again."
    }
    if (urlError) {
      return `Sign-in error: ${urlError}`
    }
    return null
  }
  const [error, setError] = useState<string | null>(getInitialError())

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      const hostname = window.location.hostname
      const isLocalSubdomain = hostname.endsWith("uplifterinc.localhost")
      
      // For local subdomains, we need to make a direct fetch to the current origin
      // because next-auth's signIn() uses NEXTAUTH_URL (localhost:3000) as the base URL,
      // which would set the cookie on the wrong domain.
      if (isLocalSubdomain) {
        // Make a direct POST to the current origin's callback endpoint
        const response = await fetch("/api/auth/callback/credentials", {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            csrfToken: csrfToken,
            email: email,
            password: password,
            json: "true",
          }),
          credentials: "include",
        })
        
        const data = await response.json()
        
        if (data.url && !data.url.includes("error=")) {
          // Success - now go through the credentials-bridge to set the shared domain cookie
          const destination = callbackUrl.startsWith("http") ? callbackUrl : `http://admin.uplifterinc.localhost:3000${callbackUrl}`
          window.location.href = `/api/auth/credentials-bridge?callbackUrl=${encodeURIComponent(destination)}`
        } else {
          // Error response
          setPassword("")
          const errorMessage = "Invalid email or password. Please try again."
          setError(errorMessage)
          toast.error(errorMessage)
        }
      } else {
        // For localhost:3000 or production, use the standard signIn function
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
          // Production or localhost:3000 - redirect normally
          const isLocal = hostname.includes("localhost")
          if (isLocal) {
            // On localhost:3000, use credentials-bridge for subdomain redirect
            const destination = callbackUrl.startsWith("http") ? callbackUrl : `http://admin.uplifterinc.localhost:3000${callbackUrl}`
            window.location.href = `/api/auth/credentials-bridge?callbackUrl=${encodeURIComponent(destination)}`
          } else {
            // Production - middleware will handle routing
            router.push("/")
            router.refresh()
          }
        }
      }
    } catch (err) {
      console.error("Login error:", err)
      setPassword("")
      const errorMessage = "An error occurred. Please try again."
      setError(errorMessage)
      toast.error(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  const handleGoogleSignIn = () => {
    setIsLoading(true)
    setError(null)
    // Submit the hidden Google form
    const form = document.getElementById('google-signin-form') as HTMLFormElement
    if (form) form.submit()
  }

  return (
    <>
        {/* Hidden form for Google OAuth
            - Local dev: Posts to localhost:3000 (Google doesn't allow localhost subdomains)
            - Production: Posts to login.uplifterinc.com */}
        <form 
          id="google-signin-form"
          action={`${oauthHost}/api/auth/signin/google`}
          method="POST"
          style={{ display: 'none' }}
        >
          <input type="hidden" name="csrfToken" value={googleCsrfToken} />
          {/* callbackUrl is the final destination - auth.ts redirect callback handles bridge routing */}
          <input type="hidden" name="callbackUrl" value={callbackUrl} />
        </form>

        <Card className="relative overflow-hidden w-full max-w-[400px]">
          <ShineBorder shineColor={["#5655ED", "#A07CFE"]} className="text-center" />
          <CardHeader className="items-center pb-2">
            <UplifterLogo width={180} height={36} className="h-9 mb-2" />
            <h1 className="text-2xl font-bold">Welcome back</h1>
            <p className="text-sm text-muted-foreground">
              Login to your account
            </p>
          </CardHeader>
          
          <CardContent className="grid gap-4">
            <form onSubmit={handleSubmit} className="grid gap-4">
            <Button type="button" variant="outline" className="w-full" onClick={handleGoogleSignIn} disabled={isLoading || !googleCsrfToken}>
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
              <span className="ml-2">Continue with Google</span>
            </Button>
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



