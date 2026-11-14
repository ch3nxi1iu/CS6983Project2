"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export type ApiKeyRow = {
  id: string;
  name: string;
  prefix: string;
  created: string;
  lastUsed: string;
};

async function readErrorMessage(response: Response): Promise<string> {
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
 * The user's active keys, each with a Revoke button. The status message sits
 * outside the rows, so it stays when a revoked row is removed by the refresh.
 */
export default function ApiKeyList({ keys }: { keys: ApiKeyRow[] }) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function revoke(id: string) {
    setPendingId(id);
    setMessage("");
    setError("");
    try {
      const response = await fetch(`/api/api-keys/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        setError(await readErrorMessage(response));
        return;
      }
      setMessage("Key revoked.");
      router.refresh();
    } catch {
      setError("Could not reach the server. Try again.");
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="space-y-2">
      {keys.length === 0 ? (
        <p className="text-sm text-ink-2">You have no active API keys.</p>
      ) : (
        <ul
          aria-label="Your API keys"
          className="divide-y divide-rule rounded-lg border border-rule bg-surface"
        >
          {keys.map((key) => (
            <li
              key={key.id}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
            >
              <div className="min-w-0 space-y-1">
                <p className="font-medium">{key.name}</p>
                <p className="text-sm text-ink-2">
                  Key starts with <code className="font-mono text-ink">{key.prefix}</code>
                </p>
                <p className="text-xs text-ink-2">
                  Created {key.created} · Last used: {key.lastUsed}
                </p>
              </div>
              <button
                type="button"
                aria-label={`Revoke ${key.name}`}
                onClick={() => revoke(key.id)}
                disabled={pendingId === key.id}
                className="rounded border border-line px-3 py-1.5 text-sm font-semibold text-line hover:bg-line-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-edit disabled:opacity-60"
              >
                {pendingId === key.id ? "Revoking..." : "Revoke"}
              </button>
            </li>
          ))}
        </ul>
      )}
      <p aria-live="polite" className="text-sm text-ok">
        {message}
      </p>
      {error && (
        <p role="alert" className="text-sm text-line">
          {error}
        </p>
      )}
    </div>
  );
}
