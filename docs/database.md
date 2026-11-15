# Database schema

PostgreSQL on Neon, managed with Prisma. The source of truth is
[`prisma/schema.prisma`](../prisma/schema.prisma); change it only with
`npx prisma migrate dev`, and update this diagram in the same PR.

```mermaid
erDiagram
  User ||--o| Availability : "sets"
  User ||--o{ UnavailableDate : "marks"
  User ||--o{ Course : "takes"
  Course ||--o{ Assignment : "contains"
  Assignment ||--o{ WorkSession : "is planned as"
  User ||--o{ WorkSession : "owns"
  User ||--o{ ApiKey : "creates"

  User {
    string id PK
    string email UK
    string passwordHash
    string name "nullable"
    boolean isDemo
    datetime createdAt
    datetime updatedAt
  }
  Availability {
    string id PK
    string userId FK, UK
    float monday "default 3"
    float tuesday "default 3"
    float wednesday "default 3"
    float thursday "default 3"
    float friday "default 2"
    float saturday "default 4"
    float sunday "default 4"
    datetime createdAt
    datetime updatedAt
  }
  UnavailableDate {
    string id PK
    string userId FK
    date date
    string reason "nullable"
    datetime createdAt
  }
  Course {
    string id PK
    string userId FK
    string code
    string name
    datetime createdAt
  }
  Assignment {
    string id PK
    string courseId FK
    string title
    datetime dueAt
    float points "nullable"
    float estimatedHours
    AssignmentKind kind "HOMEWORK, PROJECT, EXAM, READING, OTHER; default OTHER"
    boolean submitted "default false"
    datetime createdAt
    datetime updatedAt
  }
  WorkSession {
    string id PK
    string userId FK
    string assignmentId FK
    datetime startAt
    float hours
    WorkSessionStatus status "SCHEDULED, DONE, MISSED"
    datetime createdAt
    datetime updatedAt
  }
  ApiKey {
    string id PK
    string userId FK
    string name
    string prefix "first 11 characters, shown in the UI"
    string keyHash UK "HMAC-SHA256 of the key"
    datetime createdAt
    datetime lastUsedAt "nullable"
    datetime revokedAt "nullable"
  }
```

Rules the diagram can't show:
- **Unique together:** one `UnavailableDate` per user per date, and one
  `Course` per user per course code.
- **Deletes cascade:** deleting a user deletes all their rows (including API
  keys); deleting a course deletes its assignments and their work sessions.
- **Indexes:** `Assignment(courseId, dueAt)` and `WorkSession(userId, startAt)`,
  for the forecast's and the work plan's main lookups; `ApiKey(userId)` for
  the keys page.
- **API keys are never stored in plain text:** only an HMAC-SHA256 of the key,
  keyed with `AUTH_SECRET`, plus a short display prefix. A revoked key keeps
  its row with `revokedAt` set. Changing `AUTH_SECRET` invalidates every key.
- **Assignment kind** sets the default estimate when `estimatedHours` isn't
  known (see `DEFAULT_HOURS_BY_KIND` in `src/lib/planner/work-plan.ts`).
- **Units:** all times are UTC; all durations are hours. `UnavailableDate.date`
  is a date with no time.
