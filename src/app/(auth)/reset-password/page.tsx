"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { ShineBorder } from "@/components/ui/shine-border"
import { ChevronLeft, Loader2, CheckCircle2, XCircle, Eye, EyeOff } from "lucide-react"
import { UplifterLogo } from "@/components/uplifter-logo"
import { toast } from "sonner"
import { Suspense } from "react"
import { validatePassword, PASSWORD_PLACEHOLDER } from "@/lib/password"

function ResetPasswordContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const token = searchParams.get("token")

  const [isValidating, setIsValidating] = useState(true)
  const [isValid, setIsValid] = useState(false)
  const [tokenError, setTokenError] = useState<string | null>(null)
  const [maskedEmail, setMaskedEmail] = useState<string | null>(null)

  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  // Validate token on mount
  useEffect(() => {
    async function validateToken() {
      if (!token) {
        setIsValidating(false)
        setTokenError("No reset token provided. Please request a new password reset link.")
        return
      }

      try {
        const response = await fetch(`/api/auth/reset-password/${token}`)
        const data = await response.json()

        if (!response.ok || !data.valid) {
          setTokenError(data.error || "Invalid or expired reset link.")
          setIsValid(false)
        } else {
          setIsValid(true)
          setMaskedEmail(data.email)
        }
      } catch {
        setTokenError("An error occurred validating your reset link. Please try again.")
        setIsValid(false)
      } finally {
        setIsValidating(false)
      }
    }

    validateToken()
  }, [token])

  const validateForm = (): boolean => {
    const pwError = validatePassword(password)
    if (pwError) {
      setFormError(pwError)
      return false
    }
    if (password !== confirmPassword) {
      setFormError("Passwords do not match")
      return false
    }
    return true
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)

    if (!validateForm()) {
      return
    }

    setIsSubmitting(true)

    try {
      const response = await fetch(`/api/auth/reset-password/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, confirmPassword }),
      })

      const data = await response.json()

      if (!response.ok) {
        setFormError(data.error || "Failed to reset password. Please try again.")
        toast.error(data.error || "Failed to reset password.")
        return
      }

      setIsSuccess(true)
      toast.success("Password reset successfully!")
    } catch {
      setFormError("An error occurred. Please try again.")
      toast.error("An error occurred. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  // Loading state
  if (isValidating) {
    return (
      <Card className="relative overflow-hidden w-full max-w-[400px]">
        <ShineBorder shineColor={["#5655ED", "#A07CFE"]} className="text-center" />
        <CardHeader className="items-center pb-2">
          <UplifterLogo width={180} height={36} className="h-9 mb-2" />
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground my-4" />
          <h1 className="text-2xl font-bold">Validating Link</h1>
          <p className="text-sm text-muted-foreground">
            Please wait while we verify your reset link...
          </p>
        </CardHeader>
      </Card>
    )
  }

  // Invalid token state
  if (!isValid) {
    return (
      <Card className="relative overflow-hidden w-full max-w-[400px]">
        <ShineBorder shineColor={["#5655ED", "#A07CFE"]} className="text-center" />
        <CardHeader className="items-center pb-2">
          <UplifterLogo width={180} height={36} className="h-9 mb-2" />
          <div className="flex items-center justify-center w-12 h-12 rounded-full bg-destructive/10 mb-4">
            <XCircle className="h-6 w-6 text-destructive" />
          </div>
          <h1 className="text-2xl font-bold">Invalid Reset Link</h1>
          <p className="text-sm text-muted-foreground">
            {tokenError}
          </p>
        </CardHeader>
        
        <CardContent className="grid gap-4">
          <Button asChild className="w-full">
            <Link href="/forgot-password">Request New Reset Link</Link>
          </Button>
          <div className="text-center text-sm">
            <Link href="/login" className="flex items-center justify-center gap-2 text-muted-foreground hover:text-primary">
              <ChevronLeft className="h-4 w-4" />
              Back to Login
            </Link>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Success state
  if (isSuccess) {
    return (
      <Card className="relative overflow-hidden w-full max-w-[400px]">
        <ShineBorder shineColor={["#5655ED", "#A07CFE"]} className="text-center" />
        <CardHeader className="items-center pb-2">
          <UplifterLogo width={180} height={36} className="h-9 mb-2" />
          <div className="flex items-center justify-center w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 mb-4">
            <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400" />
          </div>
          <h1 className="text-2xl font-bold">Password Reset!</h1>
          <p className="text-sm text-muted-foreground">
            Your password has been successfully changed.
          </p>
        </CardHeader>
        
        <CardContent className="grid gap-4">
          <Button 
            className="w-full" 
            onClick={() => router.push("/login")}
          >
            Continue to Login
          </Button>
        </CardContent>
      </Card>
    )
  }

  // Reset password form
  return (
    <Card className="relative overflow-hidden w-full max-w-[400px]">
      <ShineBorder shineColor={["#5655ED", "#A07CFE"]} className="text-center" />
      <CardHeader className="items-center pb-2">
        <UplifterLogo width={180} height={36} className="h-9 mb-2" />
        <h1 className="text-2xl font-bold">Reset Password</h1>
        <p className="text-sm text-muted-foreground">
          Enter your new password below
        </p>
        {maskedEmail && (
          <p className="text-xs text-muted-foreground mt-1">
            Resetting password for {maskedEmail}
          </p>
        )}
      </CardHeader>
      
      <CardContent className="grid gap-4">
        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-2 text-left">
            <Label htmlFor="password">New Password</Label>
            <div className="relative">
              <Input 
                id="password" 
                type={showPassword ? "text" : "password"}
                required 
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value)
                  if (formError) setFormError(null)
                }}
                disabled={isSubmitting}
                placeholder={PASSWORD_PLACEHOLDER}
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div className="grid gap-2 text-left">
            <Label htmlFor="confirm-password">Confirm Password</Label>
            <div className="relative">
              <Input 
                id="confirm-password" 
                type={showConfirmPassword ? "text" : "password"}
                required 
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value)
                  if (formError) setFormError(null)
                }}
                disabled={isSubmitting}
                placeholder="Confirm your new password"
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              >
                {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          {formError && (
            <div className="rounded-md bg-destructive/15 px-3 py-2 text-sm text-destructive">
              {formError}
            </div>
          )}
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Resetting...
              </>
            ) : (
              "Reset Password"
            )}
          </Button>
        </form>
        <div className="text-center text-sm">
          <Link href="/login" className="flex items-center justify-center gap-2 text-muted-foreground hover:text-primary">
            <ChevronLeft className="h-4 w-4" />
            Back to Login
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <Card className="relative overflow-hidden w-full max-w-[400px]">
        <CardHeader className="items-center pb-2">
          <div className="h-9 w-36 bg-muted animate-pulse mb-2" />
          <div className="h-8 w-48 bg-muted animate-pulse mb-2" />
          <div className="h-4 w-64 bg-muted animate-pulse" />
        </CardHeader>
      </Card>
    }>
      <ResetPasswordContent />
    </Suspense>
  )
}

