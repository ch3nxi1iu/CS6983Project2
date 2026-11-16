import AssignmentList from "@/components/AssignmentList";
import { listAssignmentsForUser } from "@/lib/assignments";
import { requireUser } from "@/lib/auth";
import { toDateKey } from "@/lib/planner/availability";

// The signed-in user's assignments on /plan (US-14, #20), with hours done
// (US-08, #14). Reads the database, so it must sit inside a <Suspense>
// boundary (AGENTS.md). A due date is 23:59 UTC on the day the user picked,
// so it formats in UTC to show that same day.
const dueFormat = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

export default async function AssignmentsSection() {
  const user = await requireUser();
  const assignments = await listAssignmentsForUser(user.id);

  return (
    <AssignmentList
      assignments={assignments.map((assignment) => ({
        id: assignment.id,
        title: assignment.title,
        courseCode: assignment.courseCode,
        dueDate: toDateKey(assignment.dueAt),
        dueLabel: dueFormat.format(assignment.dueAt),
        estimatedHours: assignment.estimatedHours,
        doneHours: assignment.doneHours,
      }))}
    />
  );
}
