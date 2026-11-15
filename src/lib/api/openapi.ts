// The OpenAPI 3.1 description of the public API (US-12, #18). It is served as JSON
// at /openapi.json and shown by Swagger UI at /docs/api. Keep it in step with the
// route files: src/lib/api/openapi.test.ts fails when a public route is missing
// from the spec, or when the spec documents a method the route does not export.

type HttpMethod = "get" | "post" | "put" | "patch" | "delete";
type JsonSchema = Record<string, unknown>;

type OpenApiResponse = {
  description: string;
  headers?: Record<string, { description: string; schema: JsonSchema }>;
  content?: Record<string, { schema: JsonSchema }>;
};

type SecurityRequirement = Record<string, string[]>;

export type OpenApiOperation = {
  operationId: string;
  summary: string;
  description?: string;
  tags: string[];
  /** Alternatives: any one of these schemes is enough. */
  security: SecurityRequirement[];
  parameters?: {
    name: string;
    in: "path";
    required: true;
    description: string;
    schema: JsonSchema;
  }[];
  requestBody?: { required: true; content: Record<string, { schema: JsonSchema }> };
  responses: Record<string, OpenApiResponse>;
};

type PathItem = Partial<Record<HttpMethod, OpenApiOperation>>;

export type OpenApiDocument = {
  openapi: "3.1.0";
  info: { title: string; version: string; description: string };
  servers: { url: string; description: string }[];
  paths: Record<string, PathItem>;
  components: {
    securitySchemes: Record<string, JsonSchema>;
    schemas: Record<string, JsonSchema>;
  };
};

const ref = (name: string): JsonSchema => ({ $ref: `#/components/schemas/${name}` });
const json = (schema: JsonSchema) => ({ "application/json": { schema } });

const BEARER_OR_COOKIE: SecurityRequirement[] = [{ cookieAuth: [] }, { bearerAuth: [] }];
const COOKIE_ONLY: SecurityRequirement[] = [{ cookieAuth: [] }];

const UNAUTHORIZED: OpenApiResponse = {
  description: "Sign in with the session cookie or a valid, unrevoked API key.",
  content: json(ref("Error")),
};

const RATE_LIMITED: OpenApiResponse = {
  description: "More than 60 requests in a minute for this API key or user.",
  headers: {
    "Retry-After": {
      description: "Seconds until the next request is allowed.",
      schema: { type: "integer", minimum: 1 },
    },
  },
  content: json(ref("Error")),
};

const sessionIdParameter = {
  name: "id",
  in: "path" as const,
  required: true as const,
  description: "The work session's id, from GET /api/plan/today.",
  schema: { type: "string" },
};

const apiKeyIdParameter = {
  name: "id",
  in: "path" as const,
  required: true as const,
  description: "The API key's id, from GET /api/api-keys.",
  schema: { type: "string" },
};

export const openApiSpec: OpenApiDocument = {
  openapi: "3.1.0",
  info: {
    title: "Loadline API",
    version: "1.0.0",
    description:
      "Read your open tasks, today's plan and your weekly workload, and mark work sessions done. " +
      "Authenticate with a personal API key in the Authorization header (Bearer ll_...), " +
      "or with the session cookie used by the web app. Keys are created in Settings > API keys. " +
      "Every error has the shape { error: { code, message } }.",
  },
  servers: [{ url: "/", description: "This Loadline deployment" }],
  paths: {
    "/api/tasks": {
      get: {
        operationId: "listTasks",
        summary: "List open tasks",
        tags: ["Tasks"],
        security: BEARER_OR_COOKIE,
        responses: {
          "200": {
            description: "The user's unsubmitted assignments, soonest due first.",
            content: json({
              type: "object",
              required: ["tasks"],
              properties: { tasks: { type: "array", items: ref("Task") } },
            }),
          },
          "401": UNAUTHORIZED,
          "429": RATE_LIMITED,
        },
      },
    },
    "/api/plan/today": {
      get: {
        operationId: "getTodayPlan",
        summary: "Get today's work sessions",
        tags: ["Plan"],
        security: BEARER_OR_COOKIE,
        responses: {
          "200": {
            description: "Sessions scheduled for today (UTC date) in the stored plan.",
            content: json({
              type: "object",
              required: ["date", "sessions"],
              properties: {
                date: { type: "string", format: "date", description: "Today, YYYY-MM-DD." },
                sessions: { type: "array", items: ref("PlanSession") },
              },
            }),
          },
          "401": UNAUTHORIZED,
          "409": {
            description: "Study hours are not set yet, so there is no plan.",
            content: json(ref("Error")),
          },
          "429": RATE_LIMITED,
        },
      },
    },
    "/api/workload": {
      get: {
        operationId: "getWorkload",
        summary: "Get the weekly workload forecast",
        description:
          "Hours of open work due each week, compared with the study hours available that week.",
        tags: ["Workload"],
        security: BEARER_OR_COOKIE,
        responses: {
          "200": {
            description: "The forecast for the next four weeks.",
            content: json({
              type: "object",
              required: ["weeks"],
              properties: { weeks: { type: "array", items: ref("ForecastWeek") } },
            }),
          },
          "401": UNAUTHORIZED,
          "429": RATE_LIMITED,
        },
      },
    },
    "/api/work-sessions/{id}/complete": {
      post: {
        operationId: "completeWorkSession",
        summary: "Mark a work session done",
        tags: ["Plan"],
        security: BEARER_OR_COOKIE,
        parameters: [sessionIdParameter],
        responses: {
          "200": {
            description: "The session, now DONE.",
            content: json({
              type: "object",
              required: ["session"],
              properties: { session: ref("PlanSession") },
            }),
          },
          "401": UNAUTHORIZED,
          "404": {
            description: "No work session with this id belongs to the user.",
            content: json(ref("Error")),
          },
          "429": RATE_LIMITED,
        },
      },
    },
    "/api/api-keys": {
      get: {
        operationId: "listApiKeys",
        summary: "List your API keys",
        description:
          "Active keys only. The key itself is never returned. Works with the session cookie only, not with an API key.",
        tags: ["API keys"],
        security: COOKIE_ONLY,
        responses: {
          "200": {
            description: "The user's active keys, newest first.",
            content: json({
              type: "object",
              required: ["apiKeys"],
              properties: { apiKeys: { type: "array", items: ref("ApiKey") } },
            }),
          },
          "401": UNAUTHORIZED,
        },
      },
      post: {
        operationId: "createApiKey",
        summary: "Create an API key",
        description:
          "Returns the plaintext key once. It is stored only as a hash, so it cannot be shown again. Works with the session cookie only.",
        tags: ["API keys"],
        security: COOKIE_ONLY,
        requestBody: {
          required: true,
          content: json({
            type: "object",
            required: ["name"],
            properties: {
              name: { type: "string", minLength: 1, maxLength: 60, examples: ["Grade script"] },
            },
          }),
        },
        responses: {
          "201": {
            description: "The new key. Store it now.",
            content: json({
              type: "object",
              required: ["key", "apiKey"],
              properties: {
                key: { type: "string", pattern: "^ll_", description: "Shown once." },
                apiKey: ref("ApiKey"),
              },
            }),
          },
          "400": {
            description: "The name is missing, blank or longer than 60 characters.",
            content: json(ref("Error")),
          },
          "401": UNAUTHORIZED,
        },
      },
    },
    "/api/api-keys/{id}": {
      delete: {
        operationId: "revokeApiKey",
        summary: "Revoke an API key",
        description:
          "The key stops working at once. Works with the session cookie only, not with an API key.",
        tags: ["API keys"],
        security: COOKIE_ONLY,
        parameters: [apiKeyIdParameter],
        responses: {
          "200": {
            description: "The revoked key.",
            content: json({
              type: "object",
              required: ["apiKey"],
              properties: { apiKey: ref("ApiKey") },
            }),
          },
          "401": UNAUTHORIZED,
          "404": {
            description: "No active key with this id belongs to the user.",
            content: json(ref("Error")),
          },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      cookieAuth: {
        type: "apiKey",
        in: "cookie",
        name: "session",
        description: "The httpOnly session cookie set when you sign in to the web app.",
      },
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "ll_ API key",
        description: "A personal API key from Settings > API keys, sent as Authorization: Bearer ll_...",
      },
    },
    schemas: {
      Error: {
        type: "object",
        required: ["error"],
        properties: {
          error: {
            type: "object",
            required: ["code", "message"],
            properties: {
              code: {
                type: "string",
                examples: ["UNAUTHORIZED", "NOT_FOUND", "VALIDATION_ERROR", "RATE_LIMITED", "AVAILABILITY_NOT_SET"],
              },
              message: { type: "string" },
            },
          },
        },
      },
      Task: {
        type: "object",
        required: ["id", "title", "courseCode", "dueAt", "estimatedHours", "kind"],
        properties: {
          id: { type: "string" },
          title: { type: "string" },
          courseCode: { type: "string", examples: ["CS 6120"] },
          dueAt: { type: "string", format: "date-time" },
          estimatedHours: { type: "number", minimum: 0 },
          kind: { type: "string", enum: ["HOMEWORK", "PROJECT", "EXAM", "READING", "OTHER"] },
        },
      },
      PlanSession: {
        type: "object",
        required: ["id", "assignmentId", "assignmentTitle", "courseCode", "date", "hours", "status"],
        properties: {
          id: { type: "string" },
          assignmentId: { type: "string" },
          assignmentTitle: { type: "string" },
          courseCode: { type: "string" },
          date: { type: "string", format: "date", description: "YYYY-MM-DD" },
          hours: { type: "number", minimum: 0 },
          status: { type: "string", enum: ["SCHEDULED", "DONE", "MISSED"] },
        },
      },
      ForecastWeek: {
        type: "object",
        required: ["weekStart", "workHours", "availableHours", "isCrunch", "byCourse", "assignments", "days"],
        properties: {
          weekStart: { type: "string", format: "date", description: "The Monday of the week, YYYY-MM-DD." },
          workHours: { type: "number" },
          availableHours: { type: "number" },
          isCrunch: {
            type: "boolean",
            description:
              "True when the work due that week needs more hours than the user's study time. The app shows this as an \"overloaded week\".",
          },
          byCourse: {
            type: "array",
            items: {
              type: "object",
              properties: {
                courseId: { type: "string" },
                courseCode: { type: "string" },
                hours: { type: "number" },
              },
            },
          },
          assignments: { type: "array", items: { type: "object" } },
          days: { type: "array", items: { type: "object" } },
        },
      },
      ApiKey: {
        type: "object",
        required: ["id", "name", "prefix", "createdAt", "lastUsedAt", "revokedAt"],
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          prefix: { type: "string", description: "The first characters of the key, for telling keys apart." },
          createdAt: { type: "string", format: "date-time" },
          lastUsedAt: { type: ["string", "null"], format: "date-time" },
          revokedAt: { type: ["string", "null"], format: "date-time" },
        },
      },
    },
  },
};
