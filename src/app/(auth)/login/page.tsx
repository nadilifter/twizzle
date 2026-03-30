import { Suspense } from "react";
import { Card, CardHeader } from "@/components/ui/card";
import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <Card className="relative overflow-hidden w-full max-w-[400px]">
          <CardHeader className="items-center pb-2">
            <div className="h-9 w-36 bg-muted animate-pulse mb-2" />
            <div className="h-8 w-48 bg-muted animate-pulse mb-2" />
            <div className="h-4 w-64 bg-muted animate-pulse" />
          </CardHeader>
        </Card>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
