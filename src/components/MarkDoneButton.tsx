"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

async function readError(response: Response): Promise<string> {
  try {
    const body: unknown = await response.json();
    if (typeof body === "object" && body !== null && "error" in body) {
      const { error } = body as { error: { message?: unknown } };
      if (typeof error?.message === "string") return error.message;
    }
  } catch {
    // Fall through to the generic message.
  }
  return "Something went wrong. Try again.";
}

/**
 * Marks one planned work session done (US-08, #14), then refreshes the page.
 * The accessible name includes the assignment, so screen reader users can tell
 * the buttons on a page apart.
 */
export default function MarkDoneButton({
  sessionId,
  assignmentTitle,
}: {
  sessionId: string;
  assignmentTitle: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function markDone() {
    setPending(true);
    setError("");
    try {
      const response = await fetch(
        `/api/work-sessions/${encodeURIComponent(sessionId)}/complete`,
        { method: "POST" },
      );
      if (!response.ok) {
        setError(await readError(response));
        return;
      }
      router.refresh();
    } catch {
      setError("Could not reach the server. Try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={markDone}
        disabled={pending}
        aria-label={`Mark done: ${assignmentTitle}`}
        className="inline-flex min-h-6 items-center rounded border border-ink px-2 py-1 text-xs font-semibold text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-edit disabled:opacity-60"
      >
        {pending ? "Saving..." : "Mark done"}
      </button>
      {error && (
        <p role="alert" className="text-xs text-line">
          {error}
        </p>
      )}
    </div>
  );
}
