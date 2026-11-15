"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/plan", label: "Plan" },
  { href: "/settings/availability", label: "Settings" },
] as const;

function isCurrent(pathname: string, href: string): boolean {
  if (href.startsWith("/settings")) return pathname.startsWith("/settings");
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function NavLinks() {
  const pathname = usePathname();

  return (
    <nav aria-label="Main" className="flex flex-wrap gap-1">
      {LINKS.map((link) => {
        const current = isCurrent(pathname, link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={current ? "page" : undefined}
            className={`inline-flex min-h-6 items-center rounded px-2 py-1 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-edit ${
              current ? "bg-surface-2 text-ink" : "text-ink-2"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
