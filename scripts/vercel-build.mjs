// Vercel runs `npm run vercel-build` instead of `npm run build` when it exists.
// Production deploys apply pending database migrations first, so the Neon
// database always matches prisma/schema.prisma. PR previews skip this step, so
// a migration in an unmerged PR can never change the production database.
import { execSync } from "node:child_process";

function run(command) {
  execSync(command, { stdio: "inherit" });
}

if (process.env.VERCEL_ENV === "production") {
  run("npx prisma migrate deploy");
}
run("npx next build");
