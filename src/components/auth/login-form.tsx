"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { ShineBorder } from "@/components/ui/shine-border"
import { useState, useEffect, useMemo, useRef, useCallback } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { signIn, getCsrfToken } from "next-auth/react"
import { toast } from "sonner"
import { UplifterLogo } from "@/components/uplifter-logo"
import { getClientSubdomainUrl } from "@/lib/client-domains"
import { Mail } from "lucide-react"

function isLocalSubdomain(): boolean {
  if (typeof window === "undefined") return false;
  return window.location.hostname.endsWith(".localhost") && 
         window.location.hostname !== "localhost";
}

/**
 * KNOWN ISSUE: Google OAuth on local subdomains (e.g., login.uplifterinc.localhost:3000)
 * 
 * STATUS: Not fully working in local development. Works in production.
 * See git history for full context on this limitation.
 */

function getDefaultCallbackUrl(): string {
  if (typeof window === "undefined") return "/";
  return `${getClientSubdomainUrl('admin')}/`;
}

function getSignupUrl(): string {
  if (typeof window === "undefined") return "/signup";
  return `${getClientSubdomainUrl('startup')}/`;
}

type LoginMode = "credentials" | "mfa-verify" | "email-code"

export function LoginForm() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const urlCallbackParam = searchParams.get("callbackUrl")
  const providerParam = searchParams.get("provider")
  const emailLoginTokenParam = searchParams.get("emailLoginToken")
  const mfaVerifiedParam = searchParams.get("mfaVerified")
  const googleFormRef = useRef<HTMLFormElement>(null)
  const [autoGoogleTriggered, setAutoGoogleTriggered] = useState(false)
  
  const callbackUrl = useMemo(() => {
    if (urlCallbackParam) return urlCallbackParam;
    return getDefaultCallbackUrl();
  }, [urlCallbackParam])

  const [email, setEmail] = useState(searchParams.get("email") || "")
  const [password, setPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [csrfToken, setCsrfToken] = useState<string>("")
  const [googleCsrfToken, setGoogleCsrfToken] = useState<string>("")

  // MFA + email code state
  const [loginMode, setLoginMode] = useState<LoginMode>("credentials")
  const [verificationCode, setVerificationCode] = useState("")
  const [emailCodeSent, setEmailCodeSent] = useState(false)
  // Stores the signed proof token from a magic link click (for MFA bypass)
  const [mfaVerifiedToken, setMfaVerifiedToken] = useState<string | null>(null)

  useEffect(() => {
    getCsrfToken().then((token) => {
      if (token) {
        setCsrfToken(token)
        setGoogleCsrfToken(token)
      }
    })
  }, [])
  
  useEffect(() => {
    if (providerParam === "google" && googleCsrfToken && !autoGoogleTriggered && googleFormRef.current) {
      if (!isLocalSubdomain()) {
        setAutoGoogleTriggered(true)
        setIsLoading(true)
        googleFormRef.current.submit()
      }
    }
  }, [providerParam, googleCsrfToken, autoGoogleTriggered])

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
    if (urlError === "VerificationExpired") {
      return "That verification link has expired. Please request a new code."
    }
    if (urlError) {
      return `Sign-in error: ${urlError}`
    }
    return null
  }
  const [error, setError] = useState<string | null>(getInitialError())

  const handlePostLoginRedirect = useCallback(() => {
    const hostname = window.location.hostname
    const isLocalEnv = hostname.includes("localhost")

    if (isLocalEnv) {
      const destination = callbackUrl.startsWith("http") 
        ? callbackUrl 
        : `http://admin.uplifterinc.localhost:3000${callbackUrl}`
      window.location.href = `/api/auth/credentials-bridge?callbackUrl=${encodeURIComponent(destination)}`
    } else {
      const destination = callbackUrl && callbackUrl !== "/" 
        ? callbackUrl 
        : getDefaultCallbackUrl()
      window.location.href = destination
    }
  }, [callbackUrl])

  // Handle magic link auto-sign-in for email-code login
  useEffect(() => {
    if (!emailLoginTokenParam) return
    setIsLoading(true)
    setError(null)

    // The token is a signed proof from /api/auth/verify/[token] that the
    // EMAIL_LOGIN verification succeeded. Decode it to get the email, then
    // sign in via the email-code provider using the token as the code.
    try {
      const payload = JSON.parse(atob(emailLoginTokenParam.replace(/-/g, "+").replace(/_/g, "/")))
      if (!payload.email) throw new Error("Invalid token")

      signIn("email-code", {
        email: payload.email,
        // Pass the raw magic-link token; the provider tries it against the DB.
        // The verify route already marked the DB row as used, so we re-use the
        // signed token as a short-lived proof of verification instead.
        code: emailLoginTokenParam,
        redirect: false,
      }).then((result) => {
        if (result?.ok && !result?.error) {
          handlePostLoginRedirect()
        } else {
          setError("Email sign-in link has expired. Please request a new code.")
          setIsLoading(false)
        }
      }).catch(() => {
        setError("Something went wrong. Please try again.")
        setIsLoading(false)
      })
    } catch {
      setError("Invalid sign-in link.")
      setIsLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emailLoginTokenParam])

  // Handle magic link auto-complete for MFA verification.
  // The signed token proves MFA was completed, but the user still needs to
  // enter their password. We store the token so handleSubmit can pass it
  // directly instead of requiring a second MFA challenge.
  useEffect(() => {
    if (!mfaVerifiedParam) return

    try {
      const payload = JSON.parse(atob(mfaVerifiedParam.replace(/-/g, "+").replace(/_/g, "/")))
      if (payload.email) {
        setEmail(payload.email)
        setMfaVerifiedToken(mfaVerifiedParam)
        toast.success("Verification successful! Enter your password to continue.")
      }
    } catch {
      // Invalid token, ignore
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mfaVerifiedParam])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      // If we already have a verified MFA proof (from magic link), skip the
      // challenge API and sign in directly with the proof token.
      if (mfaVerifiedToken) {
        const result = await signIn("credentials", {
          email,
          password,
          mfaCode: mfaVerifiedToken,
          redirect: false,
        })

        if (result?.ok && !result?.error) {
          handlePostLoginRedirect()
          return
        }

        // If it failed, the proof may have expired — clear it and fall through
        setMfaVerifiedToken(null)
        if (result?.error) {
          setPassword("")
          const errorMessage = result.error === "CredentialsSignin"
            ? "Invalid email or password. Please try again."
            : result.error
          setError(errorMessage)
          toast.error(errorMessage)
          setIsLoading(false)
          return
        }
      }

      // Step 1: Check if MFA is required
      const challengeRes = await fetch("/api/auth/mfa/challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      })

      if (challengeRes.status === 429) {
        const data = await challengeRes.json()
        setError(data.message || "Too many attempts. Please wait and try again.")
        toast.error("Too many attempts")
        setIsLoading(false)
        return
      }

      if (challengeRes.status === 401) {
        setPassword("")
        setError("Invalid email or password. Please try again.")
        toast.error("Invalid email or password")
        setIsLoading(false)
        return
      }

      if (!challengeRes.ok) {
        setError("An error occurred. Please try again.")
        setIsLoading(false)
        return
      }

      const challengeData = await challengeRes.json()

      if (challengeData.mfaRequired) {
        setLoginMode("mfa-verify")
        setVerificationCode("")
        toast.info("A verification code has been sent to your email.")
        setIsLoading(false)
        return
      }

      // Step 2: No MFA required — proceed with sign-in
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      })

      if (result?.error || !result?.ok) {
        setPassword("")
        const errorMessage = result?.error === "CredentialsSignin" 
          ? "Invalid email or password. Please try again."
          : result?.error || "Authentication failed. Please try again."
        setError(errorMessage)
        toast.error(errorMessage)
      } else {
        handlePostLoginRedirect()
      }
    } catch (err) {
      console.error("Login error:", err)
      setPassword("")
      setError("An error occurred. Please try again.")
      toast.error("An error occurred. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleMfaSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      const result = await signIn("credentials", {
        email,
        password,
        mfaCode: verificationCode,
        redirect: false,
      })

      if (result?.error || !result?.ok) {
        const errorMessage = result?.error === "CredentialsSignin"
          ? "Invalid or expired verification code."
          : result?.error || "Verification failed. Please try again."
        setError(errorMessage)
        toast.error(errorMessage)
      } else {
        handlePostLoginRedirect()
      }
    } catch (err) {
      console.error("MFA verify error:", err)
      setError("An error occurred. Please try again.")
      toast.error("An error occurred. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleResendMfaCode = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const res = await fetch("/api/auth/mfa/challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      })

      if (res.ok) {
        setVerificationCode("")
        toast.success("A new verification code has been sent to your email.")
      } else if (res.status === 429) {
        const data = await res.json()
        setError(data.message || "Too many attempts. Please wait and try again.")
      } else {
        setError("Failed to resend code. Please try again.")
      }
    } catch {
      setError("An error occurred. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleSendEmailCode = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      const res = await fetch("/api/auth/email-login/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })

      if (res.status === 429) {
        const data = await res.json()
        setError(data.message || "Too many attempts. Please wait and try again.")
        toast.error("Too many attempts")
      } else if (res.ok) {
        setEmailCodeSent(true)
        setVerificationCode("")
        toast.success("If an account exists, a sign-in code has been sent to your email.")
      } else {
        setError("An error occurred. Please try again.")
      }
    } catch {
      setError("An error occurred. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleEmailCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      const result = await signIn("email-code", {
        email,
        code: verificationCode,
        redirect: false,
      })

      if (result?.error || !result?.ok) {
        const errorMessage = result?.error === "CredentialsSignin"
          ? "Invalid or expired code. Please try again."
          : result?.error || "Sign-in failed. Please try again."
        setError(errorMessage)
        toast.error(errorMessage)
      } else {
        handlePostLoginRedirect()
      }
    } catch (err) {
      console.error("Email code login error:", err)
      setError("An error occurred. Please try again.")
      toast.error("An error occurred. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleResendEmailCode = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const res = await fetch("/api/auth/email-login/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })

      if (res.ok) {
        setVerificationCode("")
        toast.success("A new sign-in code has been sent to your email.")
      } else if (res.status === 429) {
        const data = await res.json()
        setError(data.message || "Too many attempts. Please wait and try again.")
      } else {
        setError("Failed to resend code. Please try again.")
      }
    } catch {
      setError("An error occurred. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleGoogleSignIn = () => {
    setIsLoading(true)
    setError(null)
    
    if (isLocalSubdomain()) {
      const redirectUrl = new URL("http://localhost:3000/login")
      redirectUrl.searchParams.set("provider", "google")
      redirectUrl.searchParams.set("callbackUrl", callbackUrl)
      window.location.href = redirectUrl.toString()
      return
    }
    
    if (googleFormRef.current) {
      googleFormRef.current.submit()
    }
  }

  const resetToCredentials = () => {
    setLoginMode("credentials")
    setVerificationCode("")
    setEmailCodeSent(false)
    setError(null)
  }

  // ── MFA Verification Screen ──────────────────────────────────────────
  if (loginMode === "mfa-verify") {
    return (
      <Card className="relative overflow-hidden w-full max-w-[400px]">
        <ShineBorder shineColor={["#5655ED", "#A07CFE"]} className="text-center" />
        <CardHeader className="items-center pb-2">
          <UplifterLogo width={180} height={36} className="h-9 mb-2" />
          <h1 className="text-2xl font-bold">Verify your identity</h1>
          <p className="text-sm text-muted-foreground">
            We sent a verification code to your email. Enter it below or click the link in the email.
          </p>
        </CardHeader>
        <CardContent className="grid gap-4">
          <form onSubmit={handleMfaSubmit} className="grid gap-4">
            <div className="grid gap-2 text-left">
              <Label htmlFor="mfa-code">Verification Code</Label>
              <Input
                id="mfa-code"
                type="text"
                placeholder="e.g. A3K9X2"
                required
                autoFocus
                maxLength={6}
                className="text-center text-lg tracking-widest font-mono uppercase"
                value={verificationCode}
                onChange={(e) => {
                  setVerificationCode(e.target.value.toUpperCase())
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
            <Button type="submit" className="w-full" disabled={isLoading || verificationCode.length < 6}>
              {isLoading ? "Verifying..." : "Verify"}
            </Button>
            <div className="flex items-center justify-between text-sm">
              <button
                type="button"
                className="text-muted-foreground underline underline-offset-4 hover:text-foreground"
                onClick={handleResendMfaCode}
                disabled={isLoading}
              >
                Resend code
              </button>
              <button
                type="button"
                className="text-muted-foreground underline underline-offset-4 hover:text-foreground"
                onClick={resetToCredentials}
                disabled={isLoading}
              >
                Back to login
              </button>
            </div>
          </form>
        </CardContent>
      </Card>
    )
  }

  // ── Email Code Login Screen ──────────────────────────────────────────
  if (loginMode === "email-code") {
    return (
      <Card className="relative overflow-hidden w-full max-w-[400px]">
        <ShineBorder shineColor={["#5655ED", "#A07CFE"]} className="text-center" />
        <CardHeader className="items-center pb-2">
          <UplifterLogo width={180} height={36} className="h-9 mb-2" />
          <h1 className="text-2xl font-bold">
            {emailCodeSent ? "Check your email" : "Sign in with email"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {emailCodeSent
              ? "Enter the code from your email or click the link we sent you."
              : "We'll send you a code to sign in without a password."}
          </p>
        </CardHeader>
        <CardContent className="grid gap-4">
          {!emailCodeSent ? (
            <form onSubmit={handleSendEmailCode} className="grid gap-4">
              <div className="grid gap-2 text-left">
                <Label htmlFor="email-code-email">Email</Label>
                <Input
                  id="email-code-email"
                  type="email"
                  placeholder="m@example.com"
                  required
                  autoFocus
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value)
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
              <Button type="submit" className="w-full" disabled={isLoading || !email}>
                {isLoading ? "Sending..." : "Send sign-in code"}
              </Button>
              <div className="text-center text-sm">
                <button
                  type="button"
                  className="text-muted-foreground underline underline-offset-4 hover:text-foreground"
                  onClick={resetToCredentials}
                  disabled={isLoading}
                >
                  Back to password login
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleEmailCodeSubmit} className="grid gap-4">
              <div className="grid gap-2 text-left">
                <Label htmlFor="email-login-code">Sign-in Code</Label>
                <Input
                  id="email-login-code"
                  type="text"
                  placeholder="e.g. A3K9X2"
                  required
                  autoFocus
                  maxLength={6}
                  className="text-center text-lg tracking-widest font-mono uppercase"
                  value={verificationCode}
                  onChange={(e) => {
                    setVerificationCode(e.target.value.toUpperCase())
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
              <Button type="submit" className="w-full" disabled={isLoading || verificationCode.length < 6}>
                {isLoading ? "Signing in..." : "Sign in"}
              </Button>
              <div className="flex items-center justify-between text-sm">
                <button
                  type="button"
                  className="text-muted-foreground underline underline-offset-4 hover:text-foreground"
                  onClick={handleResendEmailCode}
                  disabled={isLoading}
                >
                  Resend code
                </button>
                <button
                  type="button"
                  className="text-muted-foreground underline underline-offset-4 hover:text-foreground"
                  onClick={resetToCredentials}
                  disabled={isLoading}
                >
                  Back to login
                </button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    )
  }

  // ── Default Credentials Login Screen ─────────────────────────────────
  return (
    <>
      <form 
        ref={googleFormRef}
        id="google-signin-form"
        action="/api/auth/signin/google"
        method="POST"
        style={{ display: 'none' }}
      >
        <input type="hidden" name="csrfToken" value={googleCsrfToken} />
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
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => { setLoginMode("email-code"); setError(null) }}
            disabled={isLoading}
          >
            <Mail className="h-5 w-5" />
            <span className="ml-2">Continue with Email Code</span>
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
