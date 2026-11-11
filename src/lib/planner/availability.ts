// Pure availability math for US-06 (#12): no database, no Date.now().
// Dates are calendar days as "YYYY-MM-DD" strings, read in UTC.

export const WEEKDAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

export type Weekday = (typeof WEEKDAYS)[number];
export type WeeklyHours = Record<Weekday, number>;

export const MIN_DAY_HOURS = 0;
export const MAX_DAY_HOURS = 12;
export const HOURS_STEP = 0.5;
export const MAX_REASON_LENGTH = 120;

export const DEFAULT_WEEKLY_HOURS: WeeklyHours = {
  monday: 3,
  tuesday: 3,
  wednesday: 3,
  thursday: 3,
  friday: 2,
  saturday: 4,
  sunday: 4,
};

export type ApiErrorCode = "VALIDATION_ERROR" | "CONFLICT" | "NOT_FOUND";

export type Result<T> =
  | { ok: true; value: T }
  | { ok: false; error: { code: ApiErrorCode; message: string } };

function invalid(message: string): Result<never> {
  return { ok: false, error: { code: "VALIDATION_ERROR", message } };
}

export function isValidDayHours(hours: unknown): hours is number {
  return (
    typeof hours === "number" &&
    Number.isFinite(hours) &&
    hours >= MIN_DAY_HOURS &&
    hours <= MAX_DAY_HOURS &&
    Number.isInteger(hours / HOURS_STEP)
  );
}

export function parseWeeklyHours(input: unknown): Result<WeeklyHours> {
  if (typeof input !== "object" || input === null) {
    return invalid("Send hours for each day of the week.");
  }
  const record = input as Record<string, unknown>;
  const hours = {} as WeeklyHours;
  for (const day of WEEKDAYS) {
    const value = record[day];
    if (!isValidDayHours(value)) {
      return invalid(
        `Hours for ${day} must be ${MIN_DAY_HOURS}–${MAX_DAY_HOURS} in ${HOURS_STEP}-hour steps.`,
      );
    }
    hours[day] = value;
  }
  return { ok: true, value: hours };
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function isValidDateKey(value: unknown): value is string {
  if (typeof value !== "string" || !DATE_PATTERN.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && toDateKey(date) === value;
}

export function parseUnavailableDateInput(
  input: unknown,
): Result<{ date: string; reason: string | null }> {
  if (typeof input !== "object" || input === null) {
    return invalid("Send a date as YYYY-MM-DD.");
  }
  const { date, reason } = input as Record<string, unknown>;
  if (!isValidDateKey(date)) return invalid("Send a real date as YYYY-MM-DD.");
  if (reason !== undefined && reason !== null && typeof reason !== "string") {
    return invalid("The reason must be text.");
  }
  const trimmed = typeof reason === "string" ? reason.trim() : "";
  if (trimmed.length > MAX_REASON_LENGTH) {
    return invalid(`Keep the reason under ${MAX_REASON_LENGTH} characters.`);
  }
  return { ok: true, value: { date, reason: trimmed || null } };
}

export function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function dateKeyToDate(dateKey: string): Date {
  return new Date(`${dateKey}T00:00:00Z`);
}

export function addDays(dateKey: string, days: number): string {
  const date = dateKeyToDate(dateKey);
  date.setUTCDate(date.getUTCDate() + days);
  return toDateKey(date);
}

export function weekdayOf(dateKey: string): Weekday {
  // getUTCDay: 0 = Sunday … 6 = Saturday.
  return WEEKDAYS[(dateKeyToDate(dateKey).getUTCDay() + 6) % 7];
}

export function getWeeklyTotal(hours: WeeklyHours): number {
  return WEEKDAYS.reduce((total, day) => total + hours[day], 0);
}

export function getAvailableHoursForDate(
  hours: WeeklyHours,
  unavailableDates: readonly string[],
  dateKey: string,
): number {
  return unavailableDates.includes(dateKey) ? 0 : hours[weekdayOf(dateKey)];
}

export function getWeekAvailableHours(
  hours: WeeklyHours,
  unavailableDates: readonly string[],
  weekStart: string,
): number {
  let total = 0;
  for (let offset = 0; offset < 7; offset++) {
    total += getAvailableHoursForDate(hours, unavailableDates, addDays(weekStart, offset));
  }
  return total;
}
