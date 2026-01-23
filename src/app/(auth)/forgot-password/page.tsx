import { Suspense } from "react"
import { Card, CardHeader } from "@/components/ui/card"
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form"

export default function ForgotPasswordPage() {
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
      <ForgotPasswordForm />
    </Suspense>
  )
}
