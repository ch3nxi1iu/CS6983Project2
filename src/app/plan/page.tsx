import { Suspense } from "react";
import WorkPlanSection from "@/components/WorkPlanSection";

export default function PlanPage() {
  return (
    <main className="min-h-screen bg-paper px-4 py-6 text-ink sm:px-8 sm:py-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="space-y-1">
          <h1 className="text-2xl font-bold">Work plan</h1>
          <p className="text-sm text-ink-2">
            Scheduled backward from each due date, inside your study hours.
          </p>
        </header>
        <Suspense
          fallback={
            <p role="status" className="text-sm text-ink-2">
              Loading your plan...
            </p>
          }
        >
          <WorkPlanSection />
        </Suspense>
      </div>
    </main>
  );
}
