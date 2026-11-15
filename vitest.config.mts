import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    // Resolve the "@/..." import alias from tsconfig.json.
    tsconfigPaths: true,
  },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
    // Database tests share one database, and the local `prisma dev` server
    // mixes up queries from parallel connections, so run files one at a time.
    fileParallelism: false,
    // `npm run test:coverage` measures app logic and route handlers (#47).
    coverage: {
      provider: "v8",
      include: ["src/lib/**", "src/app/api/**"],
      exclude: ["**/*.test.{ts,tsx}", "src/generated/**"],
      reporter: ["text", "text-summary", "json-summary"],
      reportsDirectory: "coverage",
      // AGENTS.md's coverage goal is 80%+; fail the run if lines drop below it.
      thresholds: { lines: 80 },
    },
  },
});
