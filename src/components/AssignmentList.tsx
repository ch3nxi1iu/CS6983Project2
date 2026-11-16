"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

// The user's assignments on /plan with Edit and Delete (US-14, #20). Each save
// or delete rebuilds the plan on the server, then refreshes the page. The status
// and error messages sit outside the rows, so they stay when a row goes away.

export type AssignmentRow = {
  id: string;
  title: string;
  courseCode: string;
  /** YYYY-MM-DD; the edit form starts with it. */
  dueDate: string;
  /** The due date as text, like "Fri, Nov 20". */
  dueLabel: string;
  estimatedHours: number;
  /** Hours of sessions marked done. */
  doneHours: number;
};

type Changes = { title?: string; dueDate?: string; estimatedHours?: number };

const FIELD = "rounded border border-rule bg-surface px-2 py-1 text-ink";
const BUTTON =
  "inline-flex min-h-6 items-center rounded border px-3 py-1 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-edit disabled:opacity-60";

function formatHours(hours: number): string {
  return String(Number(hours.toFixed(2)));
}

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

function EditAssignmentForm({
  assignment,
  pending,
  onSave,
  onCancel,
}: {
  assignment: AssignmentRow;
  pending: boolean;
  onSave: (changes: Changes) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(assignment.title);
  const [dueDate, setDueDate] = useState(assignment.dueDate);
  const [estimatedHours, setEstimatedHours] = useState(String(assignment.estimatedHours));

  // Sends only what changed, so an untouched due date keeps its exact time.
  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const changes: Changes = {};
    if (title.trim() !== assignment.title) changes.title = title.trim();
    if (dueDate !== assignment.dueDate) changes.dueDate = dueDate;
    if (Number(estimatedHours) !== assignment.estimatedHours) {
      changes.estimatedHours = Number(estimatedHours);
    }
    if (Object.keys(changes).length === 0) {
      onCancel();
      return;
    }
    onSave(changes);
  }

  return (
    <form
      aria-label={`Edit ${assignment.title}`}
      onSubmit={save}
      className="flex flex-wrap items-end gap-3 rounded border border-edit bg-surface-2 p-3"
    >
      <label className="flex min-w-48 flex-1 flex-col text-sm">
        Title
        <input
          type="text"
          required
          maxLength={120}
          autoFocus
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
      <div className="flex gap-2">
        <button type="submit" disabled={pending} className={`${BUTTON} border-ink bg-ink text-paper`}>
          {pending ? "Saving..." : "Save"}
        </button>
        <button type="button" onClick={onCancel} className={`${BUTTON} border-rule text-ink`}>
          Cancel
        </button>
      </div>
    </form>
  );
}

export default function AssignmentList({ assignments }: { assignments: AssignmentRow[] }) {
  const router = useRouter();
  // Which row has its edit form or delete question open, if any.
  const [open, setOpen] = useState<{ action: "edit" | "delete"; id: string } | null>(null);
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  // After Cancel, focus goes back to the button that opened the form, not the page.
  const focusAfterRender = useRef<string | null>(null);

  useEffect(() => {
    if (focusAfterRender.current) {
      document.getElementById(focusAfterRender.current)?.focus();
      focusAfterRender.current = null;
    }
  });

  function openFor(action: "edit" | "delete", id: string) {
    setOpen({ action, id });
    setStatus("");
    setError("");
  }

  function close() {
    if (open) focusAfterRender.current = `${open.action}-${open.id}`;
    setOpen(null);
    setError("");
  }

  async function send(path: string, init: RequestInit, doneMessage: string) {
    setPending(true);
    setStatus("");
    setError("");
    try {
      const response = await fetch(path, init);
      if (!response.ok) {
        setError(await readError(response));
        return;
      }
      setOpen(null);
      setStatus(doneMessage);
      router.refresh();
    } catch {
      setError("Could not reach the server. Try again.");
    } finally {
      setPending(false);
    }
  }

  function saveEdit(assignment: AssignmentRow, changes: Changes) {
    return send(
      `/api/assignments/${encodeURIComponent(assignment.id)}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(changes),
      },
      `Saved ${changes.title ?? assignment.title}. The plan is rebuilt.`,
    );
  }

  function confirmDelete(assignment: AssignmentRow) {
    return send(
      `/api/assignments/${encodeURIComponent(assignment.id)}`,
      { method: "DELETE" },
      `Deleted ${assignment.title}.`,
    );
  }

  return (
    <div className="space-y-2">
      {assignments.length === 0 ? (
        <p className="text-sm text-ink-2">No assignments yet. Add one above.</p>
      ) : (
        <ul aria-label="Your assignments" className="divide-y divide-rule rounded-lg border border-rule">
          {assignments.map((assignment) => {
            const editing = open?.action === "edit" && open.id === assignment.id;
            const deleting = open?.action === "delete" && open.id === assignment.id;
            return (
              <li key={assignment.id} className="space-y-3 px-4 py-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <p className="font-medium">{assignment.title}</p>
                    <p className="text-sm text-ink-2">
                      <span>{assignment.courseCode}</span> ·{" "}
                      <span>{`Due ${assignment.dueLabel}`}</span>
                    </p>
                    <p className="text-sm tabular-nums">
                      {`${formatHours(assignment.doneHours)}h of ${formatHours(assignment.estimatedHours)}h done`}
                    </p>
                  </div>
                  {!editing && !deleting && (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        id={`edit-${assignment.id}`}
                        aria-label={`Edit: ${assignment.title}`}
                        onClick={() => openFor("edit", assignment.id)}
                        className={`${BUTTON} border-edit text-edit`}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        id={`delete-${assignment.id}`}
                        aria-label={`Delete: ${assignment.title}`}
                        onClick={() => openFor("delete", assignment.id)}
                        className={`${BUTTON} border-line text-line`}
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>
                {editing && (
                  <EditAssignmentForm
                    assignment={assignment}
                    pending={pending}
                    onSave={(changes) => saveEdit(assignment, changes)}
                    onCancel={close}
                  />
                )}
                {deleting && (
                  <div className="flex flex-wrap items-center gap-3 rounded border border-line bg-line-soft p-3">
                    <p className="text-sm font-medium">
                      {`Delete ${assignment.title}? Its planned sessions go too.`}
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => confirmDelete(assignment)}
                        disabled={pending}
                        className={`${BUTTON} border-line bg-line text-surface`}
                      >
                        {pending ? "Deleting..." : "Yes, delete"}
                      </button>
                      <button
                        type="button"
                        autoFocus
                        onClick={close}
                        className={`${BUTTON} border-rule text-ink`}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
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
