import Link from "next/link";
import DemoBanner from "@/components/DemoBanner";
import LogoutButton from "@/components/LogoutButton";
import NavLinks from "@/components/NavLinks";
import { getCurrentUser } from "@/lib/auth";

export default async function AppHeader() {
  const user = await getCurrentUser();
  if (!user) return null;

  return (
    <>
      <header className="border-b border-rule bg-surface text-ink">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
          <Link
            href="/dashboard"
            className="inline-flex min-h-6 items-center text-lg font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-edit"
          >
            Loadline
          </Link>
          <NavLinks />
          <div className="ml-auto">
            <LogoutButton />
          </div>
        </div>
      </header>
      {user.isDemo ? <DemoBanner /> : null}
    </>
  );
}
