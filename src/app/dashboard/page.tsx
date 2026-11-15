import { Suspense } from "react";
import DashboardContent from "@/components/DashboardContent";

export default function DashboardPage() {
  return (
    <main className="min-h-screen bg-paper px-4 py-6 text-ink sm:px-8 sm:py-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="space-y-1">
          <h1 className="text-2xl font-bold">Today</h1>
          <p className="text-sm text-ink-2">
            Hours of work against your study hours, and the sessions planned for today.
          </p>
        </header>
        <Suspense
          fallback={
            <p role="status" className="text-sm text-ink-2">
              Loading your dashboard...
            </p>
          }
        >
          <DashboardContent />
        </Suspense>
      </div>
    </main>
  );
}
