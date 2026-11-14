// /docs/api (US-12, #18): the public API's interactive reference. Public, so it
// works without signing in.
import Link from "next/link";
import SwaggerUI from "@/components/SwaggerUI";

export default function ApiDocsPage() {
  return (
    <main className="min-h-screen bg-paper px-4 py-6 text-ink sm:px-8 sm:py-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="space-y-2">
          <h1 className="text-2xl font-bold">Public API</h1>
          <p className="max-w-3xl text-sm text-ink-2">
            Send a personal API key in the header <code className="font-mono">Authorization: Bearer ll_…</code>{" "}
            to read your tasks, today&apos;s plan and your workload. Create and revoke keys in{" "}
            <Link href="/settings/api" className="font-medium text-edit underline">
              API keys
            </Link>
            . Each key can make 60 requests a minute.
          </p>
          <p className="text-sm text-ink-2">
            The OpenAPI spec is at{" "}
            <a href="/openapi.json" className="font-medium text-edit underline">
              /openapi.json
            </a>
            .
          </p>
        </header>
        <SwaggerUI />
      </div>
    </main>
  );
}
