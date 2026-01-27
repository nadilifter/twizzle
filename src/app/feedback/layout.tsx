export default function FeedbackLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <main className="container mx-auto max-w-5xl p-4">
        {children}
      </main>
    </div>
  )
}
