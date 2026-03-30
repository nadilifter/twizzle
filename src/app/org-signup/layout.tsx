import { headers } from "next/headers";
import { GradientBackground } from "@/components/ui/gradient-background";
import { AnimatedThemeToggler } from "@/components/ui/animated-theme-toggler";
import { UplifterLogo } from "@/components/uplifter-logo";
import Link from "next/link";
import { getLoginUrlForHost } from "@/lib/env-domains";
import { getAuthSession } from "@/lib/auth";

export const metadata = {
  title: "Sign Up - Uplifter",
  description:
    "Create your organization on Uplifter - The complete platform for sports clubs and organizations",
  icons: {
    icon: "/favicon.ico",
  },
};

export default async function SignupsLayout({ children }: { children: React.ReactNode }) {
  const [headersList, session] = await Promise.all([headers(), getAuthSession()]);
  const host = headersList.get("host");
  const loginBase = getLoginUrlForHost(host);
  const protocol = host?.includes("localhost") ? "http" : "https";
  const callbackUrl = `${protocol}://${host}/org-signup`;
  const loginUrl = `${loginBase}?callbackUrl=${encodeURIComponent(callbackUrl)}`;

  return (
    <div className="flex flex-col min-h-screen bg-background relative overflow-hidden">
      <GradientBackground className="z-0" />

      {/* Header */}
      <header className="relative z-10 border-b bg-background/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <UplifterLogo width={90} height={24} className="h-6" />
          </Link>
          <div className="flex items-center gap-4">
            {!session?.user && (
              <Link
                href={loginUrl}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Already have an account? Sign in
              </Link>
            )}
            <AnimatedThemeToggler />
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 flex flex-col items-center justify-center w-full px-4 py-8 z-10">
        {children}
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t bg-background/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 text-center text-sm text-muted-foreground">
          <p>
            &copy; {new Date().getFullYear()} Uplifter Inc. All rights reserved.
            {" · "}
            <Link
              href="/why"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Why Uplifter?
            </Link>
          </p>
        </div>
      </footer>
    </div>
  );
}
