"use client";

import { useState } from "react";

export default function TryDemoButton() {
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  async function openDemo() {
    setPending(true);
    setFailed(false);
    try {
      const response = await fetch("/api/auth/demo", { method: "POST" });
      if (!response.ok) {
        setFailed(true);
        setPending(false);
        return;
      }
      window.location.assign("/dashboard");
    } catch {
      setFailed(true);
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <button
        type="button"
        onClick={openDemo}
        disabled={pending}
        className="inline-flex min-h-6 items-center rounded bg-ink px-4 py-2 font-semibold text-paper focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-edit disabled:opacity-60"
      >
        {pending ? "Opening the demo…" : "Try the demo"}
      </button>
      {failed && (
        <p role="alert" className="text-sm text-line">
          We couldn&apos;t open the demo. Try again.
        </p>
      )}
    </div>
  );
}
