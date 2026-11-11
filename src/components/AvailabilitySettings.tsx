"use client";

import { useState } from "react";
import {
  HOURS_STEP,
  MAX_DAY_HOURS,
  MIN_DAY_HOURS,
  WEEKDAYS,
  getWeeklyTotal,
  type Weekday,
  type WeeklyHours,
} from "@/lib/planner/availability";
import type { UnavailableDateItem } from "@/lib/availability";

type Props = {
  initialWeeklyHours: WeeklyHours;
  initialUnavailableDates: UnavailableDateItem[];
  /** False when the hours shown are the prefilled defaults. */
  isSet: boolean;
};

const DAY_LABELS: Record<Weekday, string> = {
  monday: "Monday",
  tuesday: "Tuesday",
  wednesday: "Wednesday",
  thursday: "Thursday",
  friday: "Friday",
  saturday: "Saturday",
  sunday: "Sunday",
};

const dateFormat = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

function formatDate(dateKey: string) {
  return dateFormat.format(new Date(`${dateKey}T00:00:00Z`));
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

export default function AvailabilitySettings({
  initialWeeklyHours,
  initialUnavailableDates,
  isSet,
}: Props) {
  const [hours, setHours] = useState(initialWeeklyHours);
  const [dates, setDates] = useState(initialUnavailableDates);
  const [newDate, setNewDate] = useState("");
  const [newReason, setNewReason] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function changeDay(day: Weekday, delta: number) {
    setHours((current) => ({ ...current, [day]: current[day] + delta }));
    setStatus("");
  }

  async function saveHours() {
    setSaving(true);
    setError("");
    setStatus("");
    const response = await fetch("/api/availability", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(hours),
    });
    setSaving(false);
    if (response.ok) setStatus("Saved. Your plan and forecast use these hours.");
    else setError(await readError(response));
  }

  async function markUnavailable(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setStatus("");
    const response = await fetch("/api/unavailable-dates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: newDate, reason: newReason }),
    });
    if (!response.ok) {
      setError(await readError(response));
      return;
    }
    const added = (await response.json()) as UnavailableDateItem;
    setDates((current) => [...current, added].sort((a, b) => a.date.localeCompare(b.date)));
    setNewDate("");
    setNewReason("");
    setStatus(`${formatDate(added.date)} marked unavailable.`);
  }

  async function removeDate(item: UnavailableDateItem) {
    setError("");
    setStatus("");
    const response = await fetch(`/api/unavailable-dates/${item.id}`, { method: "DELETE" });
    if (!response.ok) {
      setError(await readError(response));
      return;
    }
    setDates((current) => current.filter((date) => date.id !== item.id));
    setStatus(`${formatDate(item.date)} is available again.`);
  }

  return (
    <div className="space-y-8 text-ink">
      <section aria-labelledby="study-hours-heading" className="space-y-4">
        <div>
          <h2 id="study-hours-heading" className="text-lg font-bold">
            Study hours per day
          </h2>
          {!isSet && (
            <p className="text-sm text-ink-2">
              These are prefilled defaults. Save them, or change them first, before your plan is
              generated.
            </p>
          )}
        </div>

        <ul className="divide-y divide-rule rounded-lg border border-rule bg-surface">
          {WEEKDAYS.map((day) => (
            <li key={day}>
              <div
                role="group"
                aria-label={DAY_LABELS[day]}
                className="flex items-center justify-between gap-4 px-4 py-2"
              >
                <span className="font-medium">{DAY_LABELS[day]}</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    aria-label={`Fewer ${DAY_LABELS[day]} hours`}
                    disabled={hours[day] <= MIN_DAY_HOURS}
                    onClick={() => changeDay(day, -HOURS_STEP)}
                    className="h-8 w-8 rounded border border-rule bg-surface-2 font-bold focus-visible:outline-2 focus-visible:outline-edit disabled:opacity-40"
                  >
                    −
                  </button>
                  <span className="w-12 text-center tabular-nums">{hours[day]}h</span>
                  <button
                    type="button"
                    aria-label={`More ${DAY_LABELS[day]} hours`}
                    disabled={hours[day] >= MAX_DAY_HOURS}
                    onClick={() => changeDay(day, HOURS_STEP)}
                    className="h-8 w-8 rounded border border-rule bg-surface-2 font-bold focus-visible:outline-2 focus-visible:outline-edit disabled:opacity-40"
                  >
                    +
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>

        <div className="flex items-center justify-between">
          <p className="font-semibold tabular-nums">{getWeeklyTotal(hours)}h a week</p>
          <button
            type="button"
            onClick={saveHours}
            disabled={saving}
            className="rounded bg-ink px-4 py-2 font-semibold text-paper focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-edit disabled:opacity-60"
          >
            Save hours
          </button>
        </div>
      </section>

      <section aria-labelledby="unavailable-heading" className="space-y-4">
        <div>
          <h2 id="unavailable-heading" className="text-lg font-bold">
            Unavailable dates
          </h2>
          <p className="text-sm text-ink-2">
            Days with no study time, like travel or interviews. These days count as 0 hours.
          </p>
        </div>

        <form onSubmit={markUnavailable} className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col text-sm">
            Date
            <input
              type="date"
              required
              value={newDate}
              onChange={(event) => setNewDate(event.target.value)}
              className="rounded border border-rule bg-surface px-2 py-1 text-ink"
            />
          </label>
          <label className="flex flex-col text-sm">
            Reason (optional)
            <input
              type="text"
              maxLength={120}
              value={newReason}
              onChange={(event) => setNewReason(event.target.value)}
              className="rounded border border-rule bg-surface px-2 py-1 text-ink"
            />
          </label>
          <button
            type="submit"
            className="rounded border border-ink px-4 py-2 font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-edit"
          >
            Mark unavailable
          </button>
        </form>

        {dates.length > 0 && (
          <ul aria-label="Unavailable dates" className="space-y-2">
            {dates.map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between rounded border border-rule bg-line-soft px-4 py-2"
              >
                <span>
                  <span className="font-medium">{formatDate(item.date)}</span>
                  {item.reason && <span className="text-ink-2"> · {item.reason}</span>}
                </span>
                <button
                  type="button"
                  aria-label={`Remove ${formatDate(item.date)}`}
                  onClick={() => removeDate(item)}
                  className="text-sm font-semibold text-edit underline focus-visible:outline-2 focus-visible:outline-edit"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

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
