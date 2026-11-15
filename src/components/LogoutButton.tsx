"use client";

import { useState } from "react";

export default function LogoutButton() {
  const [failed, setFailed] = useState(false);

  async function logOut() {
    setFailed(false);
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) {
        setFailed(true);
        return;
      }
      window.location.assign("/login");
    } catch {
      setFailed(true);
    }
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={logOut}
        className="inline-flex min-h-6 items-center rounded border border-ink px-3 py-1 text-sm font-semibold text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-edit"
      >
        Log out
      </button>
      {failed && (
        <p role="alert" className="text-sm text-line">
          We couldn&apos;t log out. Try again.
        </p>
      )}
    </div>
  );
}
