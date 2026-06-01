import { Suspense } from "react";
import { Card, CardHeader } from "@/components/ui/card";
import { LoginForm } from "@/components/auth/login-form";
import { VideoBackground } from "@/components/ui/video-background";

export default function LoginPage() {
  return (
    <>
      {/* Full-viewport looping video sits above the auth layout's gradient.
          fixed positioning so it covers the layout container regardless of
          scroll; pointer-events disabled so the form remains interactive. */}
      <VideoBackground
        src="/twizzle_login_background.mp4"
        className="fixed inset-0 z-0 pointer-events-none"
        fadeInMs={3000}
        loopFadeMs={6000}
      />
      <Suspense
        fallback={
          <Card className="relative overflow-hidden w-full max-w-[400px] bg-card/40 backdrop-blur-xl border-white/20 dark:border-white/10">
            <CardHeader className="items-center pb-2">
              <div className="h-9 w-36 bg-muted/40 animate-pulse mb-2" />
              <div className="h-8 w-48 bg-muted/40 animate-pulse mb-2" />
              <div className="h-4 w-64 bg-muted/40 animate-pulse" />
            </CardHeader>
          </Card>
        }
      >
        <LoginForm />
      </Suspense>
    </>
  );
}
