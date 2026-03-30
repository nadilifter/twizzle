import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="h-screen w-full flex flex-col items-center justify-center bg-background">
      <div className="container px-4 md:px-6 flex flex-col items-center text-center space-y-4">
        <div className="space-y-2">
          <h1 className="text-7xl font-bold tracking-tighter sm:text-8xl text-primary">404</h1>
          <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl">Page Not Found</h2>
          <p className="max-w-[600px] text-muted-foreground md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed mx-auto">
            Sorry, we couldn&apos;t find the page you&apos;re looking for. It might have been
            removed, renamed, or doesn&apos;t exist.
          </p>
        </div>
        <div className="flex flex-col gap-2 min-[400px]:flex-row">
          <Button asChild size="lg">
            <Link href="/">Go back home</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
