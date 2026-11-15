import Link from "next/link";
import TryDemoButton from "@/components/TryDemoButton";

// The landing page is the same for every visitor, so it stays static: no
// cookies, headers, or database reads.

const POINTS = [
  {
    title: "Forecast",
    text: "See each week's workload against your study hours, so a crunch week shows up early.",
  },
  {
    title: "Work plan",
    text: "A plan schedules work backward from each due date, and adjusts when you miss a session.",
  },
  {
    title: "Public API",
    text: "A documented API lets you use your plan outside the app.",
  },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-paper px-4 py-10 text-ink sm:px-8 sm:py-16">
      <div className="mx-auto flex max-w-3xl flex-col gap-8">
        <header className="space-y-3">
          <h1 className="text-3xl font-bold">Loadline</h1>
          <p className="text-lg text-ink-2">See crunch weeks coming and start in time</p>
        </header>

        <ul className="space-y-4">
          {POINTS.map((point) => (
            <li key={point.title} className="rounded-lg border border-rule bg-surface px-4 py-3">
              <p className="font-semibold">{point.title}</p>
              <p className="text-sm text-ink-2">{point.text}</p>
            </li>
          ))}
        </ul>

        <p className="text-sm text-ink-2">
          The demo uses sample data. You don&apos;t need a Canvas account.
        </p>

        <div className="flex flex-wrap items-center gap-4">
          <TryDemoButton />
          <Link
            href="/register"
            className="inline-flex min-h-6 items-center font-semibold text-edit underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-edit"
          >
            Sign up
          </Link>
          <Link
            href="/login"
            className="inline-flex min-h-6 items-center font-semibold text-edit underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-edit"
          >
            Log in
          </Link>
        </div>
      </div>
    </main>
  );
}
