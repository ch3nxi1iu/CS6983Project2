// The time zone the app counts days in. "Today", "this week" and the 7-day plan
// depend on where the user is, but pages render on the server before the
// browser could say, and API clients have no browser at all. So the app uses
// one time zone: Pacific by default, or APP_TIME_ZONE (an IANA name such as
// "America/New_York") if it's set.
//
// Only real instants (now, due dates) are converted. Date-only values stored
// as midnight UTC (work session days, unavailable dates) stay as they are.

export const DEFAULT_APP_TIME_ZONE = "America/Los_Angeles";

/** The given IANA time zone if it's valid, otherwise the default. */
export function resolveTimeZone(value: string | undefined): string {
  if (!value) return DEFAULT_APP_TIME_ZONE;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return value;
  } catch {
    return DEFAULT_APP_TIME_ZONE;
  }
}

export const APP_TIME_ZONE = resolveTimeZone(process.env.APP_TIME_ZONE);
