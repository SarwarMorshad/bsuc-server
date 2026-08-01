# bsuc-server

REST API for the **Bangladesh Student Union Chemnitz** website — auth, members,
events, and admin content for the `bsuc-client` frontend.

## Stack

- **Node.js + Express 5** + **TypeScript**
- **PostgreSQL** via **Prisma 7**
- Auth (JWT + bcrypt) and image uploads (Multer + Cloudinary) — added in later phases

## Getting started

```bash
npm install
cp .env.example .env        # then set DATABASE_URL
npm run prisma:generate     # generate the typed client
# npm run prisma:migrate    # once a database is connected
npm run dev
```

API runs on http://localhost:5000 — health check at `GET /api/health`.

## Scripts

| Script | Does |
| --- | --- |
| `npm run dev` | Start with hot reload (tsx watch) |
| `npm start` | Start the server |
| `npm run typecheck` | Type-check with tsc |
| `npm run prisma:generate` | Generate the Prisma client |
| `npm run prisma:migrate` | Run a dev migration |
| `npm run prisma:studio` | Open Prisma Studio |

## Structure

```
src/
  index.ts     server entry (loads env, starts listening)
  app.ts       Express app + routes
prisma/
  schema.prisma  data model (User, Event, Rsvp, Content)
```

> **Prisma 7 note:** the runtime client has no bundled query engine and needs a
> driver adapter — `@prisma/adapter-pg` wraps the `pg` driver in
> `src/lib/prisma.ts`.

## API

| Method | Endpoint             | Auth   | Purpose                     |
| ------ | -------------------- | ------ | --------------------------- |
| GET    | `/api/health`        | –      | Service health check        |
| POST   | `/api/auth/register` | –      | Create an account           |
| POST   | `/api/auth/login`    | –      | Sign in                     |
| POST   | `/api/auth/logout`   | –      | Clear the session cookie    |
| GET    | `/api/auth/me`       | member | Current user                |

Sessions use a JWT in an `httpOnly`, `sameSite=lax` cookie. Passwords are
hashed with bcrypt. Roles are `MEMBER` and `ADMIN` (`requireRole` middleware).

## Frontend

UI lives in a separate repo: **bsuc-client** (Next.js).
