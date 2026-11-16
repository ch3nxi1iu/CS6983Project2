"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

// Adds one of the user's own assignments (US-14, #20), then refreshes the page
// so the rebuilt plan shows it.

const KINDS = [
  { value: "HOMEWORK", label: "Homework" },
  { value: "PROJECT", label: "Project" },
  { value: "EXAM", label: "Exam" },
  { value: "READING", label: "Reading" },
  { value: "OTHER", label: "Other" },
];

const FIELD = "rounded border border-rule bg-surface px-2 py-1 text-ink";

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

export default function AddAssignmentForm() {
  const router = useRouter();
  const [courseCode, setCourseCode] = useState("");
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [estimatedHours, setEstimatedHours] = useState("");
  const [kind, setKind] = useState("HOMEWORK");
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  async function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setStatus("");
    setError("");
    try {
      const response = await fetch("/api/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseCode,
          title,
          dueDate,
          estimatedHours: Number(estimatedHours),
          kind,
        }),
      });
      if (!response.ok) {
        setError(await readError(response));
        return;
      }
      setStatus(`Added ${title.trim()}. The plan includes it now.`);
      setTitle("");
      setDueDate("");
      setEstimatedHours("");
      router.refresh();
    } catch {
      setError("Could not reach the server. Try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={add} className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col text-sm">
          Course
          <input
            type="text"
            required
            maxLength={20}
            placeholder="CS 6983"
            value={courseCode}
            onChange={(event) => setCourseCode(event.target.value)}
            className={`${FIELD} w-28`}
          />
        </label>
        <label className="flex min-w-48 flex-1 flex-col text-sm">
          Title
          <input
            type="text"
            required
            maxLength={120}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className={FIELD}
          />
        </label>
        <label className="flex flex-col text-sm">
          Due date
          <input
            type="date"
            required
            value={dueDate}
            onChange={(event) => setDueDate(event.target.value)}
            className={FIELD}
          />
        </label>
        <label className="flex flex-col text-sm">
          Estimated hours
          <input
            type="number"
            required
            min={0.5}
            max={100}
            step={0.5}
            value={estimatedHours}
            onChange={(event) => setEstimatedHours(event.target.value)}
            className={`${FIELD} w-28`}
          />
        </label>
        <label className="flex flex-col text-sm">
          Kind
          <select
            value={kind}
            onChange={(event) => setKind(event.target.value)}
            className={FIELD}
          >
            {KINDS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-ink px-4 py-2 font-semibold text-paper focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-edit disabled:opacity-60"
        >
          {pending ? "Adding..." : "Add assignment"}
        </button>
      </div>
      <p role="status" className="text-sm text-ok">
        {status}
      </p>
      {error && (
        <p role="alert" className="text-sm text-line">
          {error}
        </p>
      )}
    </form>
  );
}
