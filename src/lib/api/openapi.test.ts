// @vitest-environment node
// Checks that the OpenAPI document (US-12, #18) matches the public API routes on
// disk. A route is public when it authenticates with authenticateRequest or
// manages API keys. Every public route must be documented with each method it
// exports, and every documented operation must have a route.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { openApiSpec, type OpenApiOperation } from "@/lib/api/openapi";

const APP_DIR = fileURLToPath(new URL("../../app", import.meta.url));
const API_DIR = join(APP_DIR, "api");

type PublicRoute = { path: string; methods: string[]; usesBearer: boolean };

function findRouteFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return findRouteFiles(full);
    return name === "route.ts" ? [full] : [];
  });
}

/** "/api/work-sessions/[id]/complete" becomes "/api/work-sessions/{id}/complete". */
function routePathOf(file: string): string {
  const segments = relative(APP_DIR, dirname(file)).split(sep);
  return "/" + segments.map((segment) => segment.replace(/^\[(.+)\]$/, "{$1}")).join("/");
}

function publicRoutes(): PublicRoute[] {
  return findRouteFiles(API_DIR).flatMap((file) => {
    const source = readFileSync(file, "utf8");
    const usesBearer = source.includes('"@/lib/api/authenticate"');
    const isPublic = usesBearer || source.includes('"@/lib/api-keys"');
    if (!isPublic) return [];
    const methods = [
      ...source.matchAll(/export\s+async\s+function\s+(GET|POST|PUT|PATCH|DELETE)\b/g),
    ].map((match) => match[1]);
    return [{ path: routePathOf(file), methods, usesBearer }];
  });
}

const routes = publicRoutes();
const routeOperations = routes.flatMap((route) =>
  route.methods.map((method) => ({ ...route, method })),
);

function operationFor(path: string, method: string): OpenApiOperation | undefined {
  const item = openApiSpec.paths[path] as Partial<Record<string, OpenApiOperation>> | undefined;
  return item?.[method.toLowerCase()];
}

describe("OpenAPI document", () => {
  test("is OpenAPI 3.1 with cookie and Bearer security schemes", () => {
    expect(openApiSpec.openapi).toBe("3.1.0");
    expect(openApiSpec.components.securitySchemes).toMatchObject({
      cookieAuth: { type: "apiKey", in: "cookie", name: "session" },
      bearerAuth: { type: "http", scheme: "bearer" },
    });
  });

  test("defines the shared Error schema as { error: { code, message } }", () => {
    expect(openApiSpec.components.schemas.Error).toMatchObject({
      type: "object",
      required: ["error"],
      properties: {
        error: {
          type: "object",
          required: ["code", "message"],
          properties: { code: { type: "string" }, message: { type: "string" } },
        },
      },
    });
  });

  test("the route scan finds the public routes, so the checks below are not empty", () => {
    expect(routes.map((route) => route.path).sort()).toEqual([
      "/api/api-keys",
      "/api/api-keys/{id}",
      "/api/plan/today",
      "/api/tasks",
      "/api/work-sessions/{id}/complete",
      "/api/workload",
    ]);
  });

  test("documents every public route under src/app/api", () => {
    for (const route of routes) {
      expect(openApiSpec.paths, route.path).toHaveProperty([route.path]);
    }
  });

  test.each(routeOperations.map((op) => [op.path, op.method] as const))(
    "documents %s %s",
    (path, method) => {
      expect(operationFor(path, method), `${method} ${path}`).toBeDefined();
    },
  );

  test("every documented operation is exported by a public route file", () => {
    for (const [path, item] of Object.entries(openApiSpec.paths)) {
      const route = routes.find((candidate) => candidate.path === path);
      expect(route, path).toBeDefined();
      for (const method of Object.keys(item)) {
        expect(route?.methods, `${method.toUpperCase()} ${path}`).toContain(method.toUpperCase());
      }
    }
  });

  test.each(routeOperations.map((op) => [op.path, op.method, op.usesBearer] as const))(
    "%s %s lists its auth schemes and documents 401",
    (path, method, usesBearer) => {
      const operation = operationFor(path, method);
      expect(operation?.responses).toHaveProperty(["401"]);
      expect(operation?.responses["401"]).toMatchObject({
        content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
      });
      expect(operation?.security).toEqual(
        usesBearer ? [{ cookieAuth: [] }, { bearerAuth: [] }] : [{ cookieAuth: [] }],
      );
    },
  );

  test.each(routeOperations.filter((op) => op.usesBearer).map((op) => [op.path, op.method] as const))(
    "%s %s documents 429 with Retry-After",
    (path, method) => {
      expect(operationFor(path, method)?.responses["429"]).toMatchObject({
        headers: { "Retry-After": expect.any(Object) },
        content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
      });
    },
  );

  test("documents the session id as a path parameter on the complete endpoint", () => {
    expect(operationFor("/api/work-sessions/{id}/complete", "POST")?.parameters).toEqual([
      expect.objectContaining({ name: "id", in: "path", required: true }),
    ]);
  });
});
