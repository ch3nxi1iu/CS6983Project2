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

/** Rebuilds the signed-in user's plan on the server, then refreshes the page. */
export default function RebuildPlanButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  async function rebuild() {
    setPending(true);
    setStatus("");
    setError("");
    try {
      const response = await fetch("/api/plan", { method: "POST" });
      if (!response.ok) {
        setError(await readError(response));
        return;
      }
      setStatus("Plan rebuilt.");
      router.refresh();
    } catch {
      setError("Could not reach the server. Try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={rebuild}
        disabled={pending}
        className="rounded bg-ink px-4 py-2 font-semibold text-paper focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-edit disabled:opacity-60"
      >
        {pending ? "Rebuilding..." : "Rebuild plan"}
      </button>
      <p role="status" className="text-sm text-ok">
        {status}
      </p>
      {error && (
        <p role="alert" className="text-sm text-line">
          {error}
        </p>
      )}
    </div>
  );
}
