import { prisma } from "@/lib/db";
import { getAvailabilitySettings } from "@/lib/availability";
import {
  DEFAULT_FORECAST_WEEKS,
  getForecast,
  type ForecastWeek,
} from "@/lib/planner/forecast";

// Loads a user's data and runs the forecast (US-05, #11). It's calculated on
// every request, so it always reflects the latest sync and availability.

export async function getForecastForUser(
  userId: string,
  { now, weeks = DEFAULT_FORECAST_WEEKS, timeZone = "UTC" }: {
    now: Date;
    weeks?: number;
    timeZone?: string;
  },
): Promise<ForecastWeek[]> {
  const [settings, assignments] = await Promise.all([
    getAvailabilitySettings(userId),
    prisma.assignment.findMany({
      where: { course: { userId }, submitted: false },
      include: { course: { select: { code: true } } },
      orderBy: { dueAt: "asc" },
    }),
  ]);

  return getForecast({
    now,
    weeks,
    timeZone,
    weeklyHours: settings.weeklyHours,
    unavailableDates: settings.unavailableDates.map((item) => item.date),
    assignments: assignments.map((item) => ({
      id: item.id,
      title: item.title,
      courseId: item.courseId,
      courseCode: item.course.code,
      dueAt: item.dueAt,
      estimatedHours: item.estimatedHours,
      submitted: item.submitted,
    })),
  });
}
