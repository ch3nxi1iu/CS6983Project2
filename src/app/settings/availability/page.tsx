import { Suspense } from "react";
import AvailabilitySettings from "@/components/AvailabilitySettings";
import { getAvailabilitySettings } from "@/lib/availability";
import { requireUser } from "@/lib/auth";

// Settings → Availability (US-06, #12). The heading is static; the saved hours
// are per-user, so they load inside Suspense.

export default function AvailabilityPage() {
  return (
    <main className="min-h-screen bg-paper p-4 sm:p-8">
      <div className="mx-auto max-w-3xl space-y-8">
        <header className="space-y-2">
          <nav aria-label="Breadcrumb">
            <p className="text-sm text-ink-2">Settings → Availability</p>
          </nav>
          <h1 className="text-2xl font-bold text-ink">Your study hours</h1>
          <p className="text-ink-2">
            You decide how many hours you can study each day. Loadline plans your work inside them.
          </p>
        </header>

        <Suspense fallback={<p className="text-sm text-ink-2">Loading your study hours…</p>}>
          <StudyHours />
        </Suspense>
      </div>
    </main>
  );
}

async function StudyHours() {
  const user = await requireUser();
  const settings = await getAvailabilitySettings(user.id);
  return (
    <AvailabilitySettings
      initialWeeklyHours={settings.weeklyHours}
      initialUnavailableDates={settings.unavailableDates}
      isSet={settings.isSet}
    />
  );
}
