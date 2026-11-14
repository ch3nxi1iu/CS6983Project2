"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          name: name ? name.trim() : undefined,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data?.error?.message || "Registration failed. Please try again.");
        setSubmitting(false);
        return;
      }

      router.push("/dashboard");
    } catch {
      setError("An unexpected error occurred. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-paper flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-surface border border-rule rounded-lg p-6 sm:p-8 shadow-sm">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-ink">Create your account</h1>
          <p className="text-sm text-ink-2 mt-1">
            Turn your Canvas deadlines into a weekly plan
          </p>
        </div>

        {error && (
          <div
            role="alert"
            className="mb-4 p-3 bg-line-soft border border-line text-line rounded text-sm font-medium"
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-ink mb-1"
            >
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-rule rounded bg-surface text-ink text-sm focus:outline-none focus:ring-2 focus:ring-edit"
              placeholder="student@example.edu"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-ink mb-1"
            >
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-rule rounded bg-surface text-ink text-sm focus:outline-none focus:ring-2 focus:ring-edit"
              placeholder="At least 8 characters"
            />
            <p className="text-xs text-ink-3 mt-1">Must be at least 8 characters long</p>
          </div>

          <div>
            <label
              htmlFor="name"
              className="block text-sm font-medium text-ink mb-1"
            >
              Name <span className="text-ink-3 font-normal">(optional)</span>
            </label>
            <input
              id="name"
              name="name"
              type="text"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-rule rounded bg-surface text-ink text-sm focus:outline-none focus:ring-2 focus:ring-edit"
              placeholder="Alice Student"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 px-4 bg-ink text-paper rounded font-medium text-sm hover:opacity-90 transition disabled:opacity-50 cursor-pointer"
          >
            {submitting ? "Creating account..." : "Sign up"}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-ink-2">
          <span>Already have an account? </span>
          <Link
            href="/login"
            className="text-edit font-medium hover:underline focus:outline-none focus:ring-1 focus:ring-edit rounded"
          >
            Log in
          </Link>
        </div>
      </div>
    </main>
  );
}
