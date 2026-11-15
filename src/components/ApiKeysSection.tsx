import Link from "next/link";
import ApiKeyList from "@/components/ApiKeyList";
import CreateApiKeyForm from "@/components/CreateApiKeyForm";
import { listApiKeys } from "@/lib/api-keys";
import { requireUser } from "@/lib/auth";

// Reads the database, so it must sit inside a <Suspense> boundary (AGENTS.md).
// Dates are shown in UTC so the server and the browser print the same text.
const dateFormat = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

export default async function ApiKeysSection() {
  const user = await requireUser();
  const keys = await listApiKeys(user.id);

  return (
    <div className="space-y-8">
      <section aria-labelledby="keys-heading" className="space-y-3">
        <h2 id="keys-heading" className="text-lg font-bold">
          Your API keys
        </h2>
        <ApiKeyList
          keys={keys.map((key) => ({
            id: key.id,
            name: key.name,
            prefix: key.prefix,
            created: dateFormat.format(key.createdAt),
            lastUsed: key.lastUsedAt ? dateFormat.format(key.lastUsedAt) : "Never",
          }))}
        />
      </section>

      <section aria-labelledby="create-heading" className="space-y-3">
        <h2 id="create-heading" className="text-lg font-bold">
          Create a key
        </h2>
        <CreateApiKeyForm />
      </section>

      <p className="text-sm text-ink-2">
        Learn what the keys can do in the{" "}
        <Link href="/docs/api" className="font-medium text-edit underline">
          API documentation
        </Link>
        .
      </p>
    </div>
  );
}
