"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Changes one work session's status (US-08, #14): mark it done or missed, or
// undo that. The server rebuilds the plan, then this refreshes the page.

type TargetStatus = "DONE" | "MISSED" | "SCHEDULED";

/** Visible text, and the start of the accessible name (which adds the assignment). */
const LABELS: Record<TargetStatus, { text: string; name: string }> = {
  DONE: { text: "Mark done", name: "Mark done" },
  MISSED: { text: "Missed", name: "Mark missed" },
  SCHEDULED: { text: "Undo", name: "Undo" },
};

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

export default function SessionStatusButton({
  sessionId,
  assignmentTitle,
  status,
}: {
  sessionId: string;
  assignmentTitle: string;
  status: TargetStatus;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const label = LABELS[status];

  async function save() {
    setPending(true);
    setError("");
    try {
      const response = await fetch(`/api/work-sessions/${encodeURIComponent(sessionId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
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
        onClick={save}
        disabled={pending}
        aria-label={`${label.name}: ${assignmentTitle}`}
        className="inline-flex min-h-6 items-center rounded border border-ink px-2 py-1 text-xs font-semibold text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-edit disabled:opacity-60"
      >
        {pending ? "Saving..." : label.text}
      </button>
      {error && (
        <p role="alert" className="text-xs text-line">
          {error}
        </p>
      )}
    </div>
  );
}
