"use client";

import { useState } from "react";

// Shown on every screen of a demo account (US-04, #10).
export default function DemoBanner() {
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState("");

  async function reset() {
    setResetting(true);
    setError("");
    const response = await fetch("/api/demo/reset", { method: "POST" });
    if (response.ok) {
      window.location.reload();
      return;
    }
    setResetting(false);
    setError("We couldn't reset the demo data. Try again.");
  }

  return (
    <section
      aria-label="Demo mode"
      className="flex flex-wrap items-center justify-between gap-3 border-b border-rule bg-line-soft px-4 py-2 text-sm text-ink"
    >
      <p>
        <strong className="font-bold">Demo mode.</strong> You&apos;re looking at sample data:
        made-up courses and assignments, no Canvas account.
      </p>
      <div className="flex items-center gap-3">
        {error && (
          <p role="alert" className="text-line">
            {error}
          </p>
        )}
        <button
          type="button"
          onClick={reset}
          disabled={resetting}
          className="rounded border border-ink px-3 py-1 font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-edit disabled:opacity-60"
        >
          Reset demo data
        </button>
      </div>
    </section>
  );
}
