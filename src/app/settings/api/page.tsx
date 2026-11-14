// /settings/api (US-12, #18): create, list and revoke the user's API keys.
// Protected by the /settings rule in src/proxy.ts.
import { Suspense } from "react";
import ApiKeysSection from "@/components/ApiKeysSection";

export default function ApiKeysSettingsPage() {
  return (
    <main className="min-h-screen bg-paper px-4 py-6 text-ink sm:px-8 sm:py-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <header className="space-y-1">
          <h1 className="text-2xl font-bold">API keys</h1>
          <p className="text-sm text-ink-2">
            Keys let your own scripts read your tasks, plan and workload. Treat a key like a password.
          </p>
        </header>
        <Suspense
          fallback={
            <p role="status" className="text-sm text-ink-2">
              Loading your API keys...
            </p>
          }
        >
          <ApiKeysSection />
        </Suspense>
      </div>
    </main>
  );
}
