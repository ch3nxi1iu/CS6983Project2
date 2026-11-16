"use client";

import SessionStatusButton from "@/components/SessionStatusButton";

/**
 * Marks one planned work session done (US-08, #14). Kept as its own component
 * because the dashboard's Today list uses it.
 */
export default function MarkDoneButton({
  sessionId,
  assignmentTitle,
}: {
  sessionId: string;
  assignmentTitle: string;
}) {
  return <SessionStatusButton sessionId={sessionId} assignmentTitle={assignmentTitle} status="DONE" />;
}
