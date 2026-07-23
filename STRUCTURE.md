# Project structure — bsuc-server

REST API for the BSUC website. Layered so requests flow predictably:
**route → middleware → controller → service → Prisma**.

```
bsuc-server/
├── prisma/
│   └── schema.prisma      # data model (User, Event, Rsvp, Content)
├── generated/             # Prisma client output (gitignored)
├── src/
│   ├── index.ts           # entry: loads env, starts the server
│   ├── app.ts             # builds the Express app, mounts routers
│   ├── config/            # env parsing, constants, app config
│   ├── routes/            # route definitions (URL → controller)
│   ├── controllers/       # read request, call service, send response
│   ├── services/          # business logic + data access (uses Prisma)
│   ├── middleware/        # auth (JWT), role checks, error handler, validation
│   ├── lib/               # shared helpers (Prisma client, jwt, cloudinary)  (Phase 2)
│   └── types/             # shared TypeScript types
├── .env.example           # required env vars (copy to .env)
├── prisma.config.ts       # Prisma 7 config (DB url, migrations path)
└── STRUCTURE.md           # this file
```

## Layer responsibilities

- **routes/** — declare endpoints and attach middleware + a controller. No logic.
- **controllers/** — parse/validate input, call a service, shape the HTTP response.
  No direct database access.
- **services/** — the actual work: business rules and Prisma queries. Reusable,
  framework-agnostic, unit-testable.
- **middleware/** — cross-cutting concerns: `requireAuth`, `requireRole`, error
  handling, request validation.
- **lib/** — shared singletons/helpers (the Prisma client, JWT sign/verify,
  Cloudinary upload). Added in Phase 2 when the DB is connected.
- **config/** — read and validate environment variables in one place.

## Conventions

- One resource per file group: e.g. `routes/events.ts`, `controllers/events.ts`,
  `services/events.ts`.
- Never put DB queries in controllers — go through a service.
- All secrets come from `.env` via `config/` — never hardcode them.
