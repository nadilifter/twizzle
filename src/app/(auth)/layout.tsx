import { GradientBackground } from "@/components/ui/gradient-background";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen py-2 bg-background relative overflow-hidden">
      <GradientBackground className="z-0" />

      <main className="flex flex-col items-center justify-center w-full flex-1 px-4 text-center z-10">
        {children}
      </main>
    </div>
  );
}
