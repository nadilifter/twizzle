"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { ShineBorder } from "@/components/ui/shine-border"
import { useState, useEffect, useMemo, useRef } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { signIn, getCsrfToken } from "next-auth/react"
import { toast } from "sonner"
import { UplifterLogo } from "@/components/uplifter-logo"
import { getClientSubdomainUrl } from "@/lib/client-domains"

/**
 * Check if we're on a local subdomain (e.g., login.uplifterinc.localhost)
 * vs localhost:3000 directly
 */
function isLocalSubdomain(): boolean {
  if (typeof window === "undefined") return false;
  return window.location.hostname.endsWith(".localhost") && 
         window.location.hostname !== "localhost";
}

/**
 * KNOWN ISSUE: Google OAuth on local subdomains (e.g., login.uplifterinc.localhost:3000)
 * 
 * STATUS: Not fully working in local development. Works in production.
 * 
 * PROBLEM:
 * Google OAuth requires localhost:3000 as the callback URL (Google doesn't allow
 * localhost subdomains like login.uplifterinc.localhost). We tried several approaches:
 * 
 * 1. Cross-origin CSRF fetch: Fetch CSRF token from localhost:3000, submit form there.
 *    FAILED: SameSite=Lax cookies prevent the CSRF cookie from being set cross-origin.
 * 
 * 2. Redirect-then-auto-trigger: Redirect to localhost:3000/login?provider=google,
 *    auto-submit the OAuth form from there.
 *    PARTIALLY WORKS: Redirects correctly but OAuth flow may still have issues.
 * 
 * WORKAROUND FOR LOCAL DEV:
 * - Use credentials (email/password) login instead of Google OAuth
 * - Or navigate directly to localhost:3000/login and use Google OAuth from there
 * 
 * PRODUCTION:
 * This issue does NOT affect production. In production, OAuth goes through
 * the login subdomain directly with proper cookie handling.
 * 
 * TODO: Investigate further if Google OAuth on local subdomains becomes critical.
 * Possible solutions:
 * - Use a tunneling service (ngrok) for local development
 * - Set up a proper local domain with SSL (requires hosts file + mkcert)
 * - Accept the limitation and use credentials login for local dev
 */

/**
 * Get the default callback URL based on current domain.
 * Uses the client-domains utility to detect environment from hostname.
 */
function getDefaultCallbackUrl(): string {
  if (typeof window === "undefined") return "/";
  return `${getClientSubdomainUrl('admin')}/`;
}

/**
 * Get the signup URL based on current domain.
 * 
 * Individual users cannot self-register - they must be invited by an organization admin.
 * The signup link directs to the organization startup portal where new organizations
 * can register.
 */
function getSignupUrl(): string {
  if (typeof window === "undefined") return "/signup";
  return `${getClientSubdomainUrl('startup')}/`;
}

export function LoginForm() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const urlCallbackParam = searchParams.get("callbackUrl")
  const providerParam = searchParams.get("provider")
  const googleFormRef = useRef<HTMLFormElement>(null)
  const [autoGoogleTriggered, setAutoGoogleTriggered] = useState(false)
  
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

  useEffect(() => {
    // Get CSRF token for current domain
    // This works for both credentials login AND Google OAuth when on localhost:3000
    getCsrfToken().then((token) => {
      if (token) {
        setCsrfToken(token)
        // In local dev, use same token for Google OAuth since we redirect to localhost:3000 first
        // In production, same origin so this works directly
        setGoogleCsrfToken(token)
      }
    })
  }, [])
  
  // Auto-trigger Google OAuth if redirected here with provider=google
  // This happens when a local subdomain redirects to localhost:3000 for OAuth
  useEffect(() => {
    if (providerParam === "google" && googleCsrfToken && !autoGoogleTriggered && googleFormRef.current) {
      // Only auto-trigger on localhost:3000 (not on subdomains)
      // Subdomains redirect here, then we trigger OAuth from localhost:3000
      if (!isLocalSubdomain()) {
        setAutoGoogleTriggered(true)
        setIsLoading(true)
        googleFormRef.current.submit()
      }
    }
  }, [providerParam, googleCsrfToken, autoGoogleTriggered])
  
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
      
      // Detect if we're in local development
      // Local subdomains (*.uplifterinc.localhost) need special handling due to cookie domain issues
      const isLocalEnv = hostname.includes("localhost")
      const isLocalSubdomain = hostname.endsWith("uplifterinc.localhost") || 
                               (hostname.endsWith(".localhost") && hostname !== "localhost")
      
      // Use standard NextAuth signIn for all environments
      // This ensures consistent behavior and proper cookie setting
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      })

      // Check both result.error AND result.ok for proper validation
      // signIn returns { error, status, ok, url } when redirect: false
      if (result?.error || !result?.ok) {
        // Clear password on failed attempt
        setPassword("")
        // Show user-friendly error message
        const errorMessage = result?.error === "CredentialsSignin" 
          ? "Invalid email or password. Please try again."
          : result?.error || "Authentication failed. Please try again."
        setError(errorMessage)
        toast.error(errorMessage)
      } else {
        // Success! result.ok is true and no error
        
        // LOCAL DEVELOPMENT ONLY: Use credentials-bridge for cookie domain transfer
        // This is needed because NextAuth sets cookies on the exact hostname in local dev,
        // but we need them shared across all local subdomains
        if (isLocalEnv) {
          const destination = callbackUrl.startsWith("http") 
            ? callbackUrl 
            : `http://admin.uplifterinc.localhost:3000${callbackUrl}`
          window.location.href = `/api/auth/credentials-bridge?callbackUrl=${encodeURIComponent(destination)}`
        } else {
          // PRODUCTION/STAGING: Direct redirect - cookies are already shared via domain attribute
          // The cookie is set with domain=.upliftergymnastics.com so it works across all subdomains
          const destination = callbackUrl && callbackUrl !== "/" 
            ? callbackUrl 
            : getDefaultCallbackUrl()
          window.location.href = destination
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
    
    // LOCAL DEVELOPMENT FLOW:
    // When on a local subdomain (e.g., login.uplifterinc.localhost), we can't submit
    // the Google OAuth form directly because:
    // 1. Google only allows localhost:3000 as OAuth callback (not subdomains)
    // 2. CSRF tokens/cookies can't be shared cross-origin with SameSite=Lax
    //
    // Solution: Redirect to localhost:3000/login?provider=google first.
    // The login page on localhost:3000 will auto-trigger Google OAuth.
    if (isLocalSubdomain()) {
      const redirectUrl = new URL("http://localhost:3000/login")
      redirectUrl.searchParams.set("provider", "google")
      redirectUrl.searchParams.set("callbackUrl", callbackUrl)
      window.location.href = redirectUrl.toString()
      return
    }
    
    // On localhost:3000 or production: submit the form directly
    if (googleFormRef.current) {
      googleFormRef.current.submit()
    }
  }

  return (
    <>
        {/* Hidden form for Google OAuth
            - On localhost:3000: Posts directly to /api/auth/signin/google
            - On production: Posts directly to /api/auth/signin/google
            - On local subdomains: handleGoogleSignIn redirects to localhost:3000 first */}
        <form 
          ref={googleFormRef}
          id="google-signin-form"
          action="/api/auth/signin/google"
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
              <a href={getSignupUrl()} className="underline">
                Sign up
              </a>
            </div>
            </form>
          </CardContent>
        </Card>
    </>
  )
}



