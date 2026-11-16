import { describe, expect, test } from "vitest";
import { APP_TIME_ZONE, resolveTimeZone } from "@/lib/time-zone";

describe("resolveTimeZone", () => {
  test("uses Pacific time when no time zone is set", () => {
    expect(resolveTimeZone(undefined)).toBe("America/Los_Angeles");
    expect(resolveTimeZone("")).toBe("America/Los_Angeles");
  });

  test("accepts a valid IANA time zone", () => {
    expect(resolveTimeZone("America/New_York")).toBe("America/New_York");
  });

  test("falls back to Pacific time for a value that isn't a time zone", () => {
    expect(resolveTimeZone("Mars/Olympus_Mons")).toBe("America/Los_Angeles");
  });
});

test("the app's time zone comes from APP_TIME_ZONE, Pacific by default", () => {
  expect(APP_TIME_ZONE).toBe(resolveTimeZone(process.env.APP_TIME_ZONE));
});
