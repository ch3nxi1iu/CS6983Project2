"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

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

function readKey(body: unknown): string | null {
  if (typeof body === "object" && body !== null && "key" in body) {
    const { key } = body;
    if (typeof key === "string") return key;
  }
  return null;
}

/** Creates a key and shows the plaintext once, with a Copy button. */
export default function CreateApiKeyForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [pending, setPending] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function createKey(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage("");
    setError("");
    setNewKey(null);
    try {
      const response = await fetch("/api/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!response.ok) {
        setError(await readErrorMessage(response));
        return;
      }
      const key = readKey(await response.json().catch(() => null));
      if (!key) {
        setError("Something went wrong. Try again.");
        return;
      }
      setNewKey(key);
      setName("");
      setMessage("API key created.");
      router.refresh();
    } catch {
      setError("Could not reach the server. Try again.");
    } finally {
      setPending(false);
    }
  }

  async function copyKey() {
    if (!newKey) return;
    try {
      await navigator.clipboard.writeText(newKey);
      setMessage("Copied to the clipboard.");
    } catch {
      setError("Could not copy. Select the key and copy it by hand.");
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={createKey} className="flex flex-wrap items-end gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          <label htmlFor="api-key-name" className="block text-sm font-medium text-ink">
            Key name
          </label>
          <input
            id="api-key-name"
            name="name"
            type="text"
            required
            maxLength={60}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Grade script"
            className="w-full rounded border border-rule bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-edit"
          />
        </div>
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-ink px-4 py-2 font-semibold text-paper focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-edit disabled:opacity-60"
        >
          {pending ? "Creating..." : "Create key"}
        </button>
      </form>

      {newKey && (
        <div className="space-y-3 rounded-lg border border-ok bg-surface-2 p-4">
          <p className="font-semibold">Copy your new key now</p>
          <p className="text-sm text-ink-2">
            For your security, this key will not be shown again. Store it somewhere safe.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <code className="break-all rounded bg-surface px-2 py-1 font-mono text-sm text-ink">
              {newKey}
            </code>
            <button
              type="button"
              onClick={copyKey}
              className="rounded border border-rule px-3 py-1.5 text-sm font-semibold text-ink hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-edit"
            >
              Copy
            </button>
          </div>
          <button
            type="button"
            onClick={() => setNewKey(null)}
            className="text-sm font-medium text-edit underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-edit"
          >
            I have saved it, hide the key
          </button>
        </div>
      )}

      <p role="status" className="text-sm text-ok">
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
