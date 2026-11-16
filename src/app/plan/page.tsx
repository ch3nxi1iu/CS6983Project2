import { Suspense } from "react";
import AddAssignmentForm from "@/components/AddAssignmentForm";
import AssignmentsSection from "@/components/AssignmentsSection";
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
        <section
          aria-labelledby="add-assignment-heading"
          className="space-y-3 rounded-lg border border-rule bg-surface p-4"
        >
          <div className="space-y-1">
            <h2 id="add-assignment-heading" className="text-lg font-bold">
              Add an assignment
            </h2>
            <p className="text-sm text-ink-2">
              Anything with a due date: homework, exam prep, a job application. The plan is rebuilt to
              include it.
            </p>
          </div>
          <AddAssignmentForm />
        </section>
        <section
          aria-labelledby="your-assignments-heading"
          className="space-y-3 rounded-lg border border-rule bg-surface p-4"
        >
          <div className="space-y-1">
            <h2 id="your-assignments-heading" className="text-lg font-bold">
              Your assignments
            </h2>
            <p className="text-sm text-ink-2">
              Work you haven&apos;t handed in, soonest due first. Hours done count the sessions you
              marked done.
            </p>
          </div>
          <Suspense
            fallback={
              <p role="status" className="text-sm text-ink-2">
                Loading your assignments...
              </p>
            }
          >
            <AssignmentsSection />
          </Suspense>
        </section>
      </div>
    </main>
  );
}
