# Digital business card API

Read-only GraphQL API for one developer business card. It serves a single canonical profile with links, skills, experience, achievements, and projects. The HTTP server does not create or change that data. Content is loaded by an idempotent seed.

This repository is a backend assignment. The committed seed is an explicit placeholder, not a real biography.

## Stack

Versions below are the ones installed from the lockfile.

| Piece | Version |
| --- | --- |
| Node.js | 22 (`engines`: `>=22.22.3`; image `node:22-bookworm-slim`) |
| TypeScript | 6.0.3 |
| NestJS | 12.4.2 |
| Apollo Server | 5.5.1 |
| GraphQL | 16.15.0 |
| Prisma and `@prisma/client` | 7.10.1 |
| PostgreSQL | 17 (`postgres:17-alpine`) |
| Jest / ts-jest | 30.5.2 / 29.4.15 |

The Prisma 7 client is generated into `src/generated/prisma` and talks to PostgreSQL through `@prisma/adapter-pg`. `npm run build` runs `prisma generate` before `nest build`.

## Architecture

NestJS feature modules keep each part of the card in its own boundary.

- `profile`, `skills`, `experience`, and `projects` each own their GraphQL object types, resolvers, services, and mappers.
- Resolvers call services. They do not use Prisma.
- Services load and order data, then map Prisma rows to GraphQL models. Prisma models are not exposed as the API schema.
- `DatabaseModule` creates `PrismaService` and is imported by the feature modules.
- `GraphqlModule` configures Apollo. `HealthModule` reports process liveness.
- `ConfigModule` validates the environment at startup.

Feature modules fit this API because the card is a few related collections with different query entry points, not one controller. A module can change its mapping or ordering without the others taking a dependency on Prisma.

GraphQL is code-first. TypeScript classes in the feature modules are the source of the schema. Development and test write it to `src/schema.gql`. Production keeps the schema in memory, so the runtime image does not need a writable `src/` directory. Nullable fields are declared where the data can be absent: `profile`, `Experience.endDate`, and `Project.repositoryUrl`. Lists contain non-null items.

PostgreSQL holds the card because the data is relational: one profile, cascading children, unique display order, and a check that an end date is not before the start date. Prisma applies the committed SQL migration and gives the services a typed client. The schema does not store the database URL. `prisma.config.ts` reads `DATABASE_URL`.

## Directory structure

```text
src/
  main.ts                 listens on 0.0.0.0
  app.module.ts
  config/                 environment validation
  database/               PrismaService, canonical key, seed
  graphql/                Apollo setup and the Date scalar
  health/                 GET /health and the health query
  profile/                profile and links
  skills/
  experience/             experience and achievements
  projects/
  schema.gql              generated GraphQL schema
  generated/prisma/       generated client (gitignored)
prisma/
  schema.prisma
  migrations/             20261112065650_init
  seed-data/              example template; local profile is gitignored
test/
  profile.integration-spec.ts
  health.e2e-spec.ts
  support/                test database guard and Nest app setup
examples/profile.graphql
```

## Database

There is one profile row. Its `singletonKey` is `canonical`, and the migration rejects any other key. The application looks the card up by that key, not by a fixed UUID. Child rows use `ON DELETE CASCADE`.

```text
profile
  ├── professional_links
  ├── skills
  ├── experiences
  │     └── achievements
  └── projects
```

| Model | Stored fields used by the API |
| --- | --- |
| Profile | `name`, `description` |
| ProfessionalLink | `label`, `url`. Unique per profile. Ordered by label, then URL. |
| Skill | `name`, `category`, `sortOrder`. Both name and `sortOrder` are unique per profile. |
| Experience | `company`, `position`, `startDate`, `endDate`, `description`, `sortOrder`. `endDate` is null for a current role. |
| Achievement | `description`, `sortOrder`, belonging to one experience. |
| Project | `name`, `description`, `url`, `repositoryUrl`, `sortOrder`. `repositoryUrl` is optional. |

`sortOrder` is ascending display order for skills, experience, achievements, and projects. The GraphQL API does not expose ids or `sortOrder`. Dates are PostgreSQL `DATE` values. The GraphQL `Date` scalar is `YYYY-MM-DD`.

## GraphQL API

`POST /graphql` with `Content-Type: application/json`.

| Query | Result |
| --- | --- |
| `profile` | The canonical card, or `null` when it has not been created. |
| `skills` | Skills ordered for display. |
| `experience` | Roles ordered for display, including achievements. |
| `projects` | Projects ordered for display. |
| `health` | `{ status: "ok" }` when the process is running. |

`GET /health` returns the same liveness payload. It does not check PostgreSQL.

`Experience.description` and `Project.description` / `repositoryUrl` are queryable in addition to the fields in the assignment query. There are no mutations.

In `development` and `test`, Apollo Sandbox is embedded at `GET /graphql` and introspection is on. In `production`, both are off. A browser `GET /graphql` without Apollo's preflight headers returns a CSRF `400`. Send a JSON POST to run a query. Compose sets `NODE_ENV=production`, so a Compose deployment does not publish Sandbox. The API has no authentication; a public Sandbox would advertise and execute every query.

### Assignment query

`examples/profile.graphql` is this operation. Against the committed placeholder seed, the response is:

```graphql
query ProfileCard {
  profile {
    name
    description
    links { label url }
    skills { name category }
    experience {
      company
      position
      startDate
      endDate
      achievements { description }
    }
    projects { name url }
  }
}
```

```json
{
  "data": {
    "profile": {
      "name": "Example Person",
      "description": "Placeholder biography. Replace this text with the real profile description. This is not a biography of a real person.",
      "links": [
        { "label": "Example repository", "url": "https://example.com/replace-me/repository" },
        { "label": "Example site", "url": "https://example.com/replace-me/site" }
      ],
      "skills": [
        { "name": "Example skill", "category": "Example category" },
        { "name": "Another example skill", "category": "Example category" }
      ],
      "experience": [
        {
          "company": "Example Company",
          "position": "Example Role",
          "startDate": "2000-01-01",
          "endDate": "2001-12-31",
          "achievements": [
            { "description": "Placeholder achievement. Replace this with a real accomplishment." },
            { "description": "Second placeholder achievement. Replace this with a real accomplishment." }
          ]
        },
        {
          "company": "Second Example Company",
          "position": "Second Example Role",
          "startDate": "2002-01-01",
          "endDate": null,
          "achievements": [
            { "description": "Placeholder achievement for the current role. Replace this with a real accomplishment." }
          ]
        }
      ],
      "projects": [
        { "name": "Example project", "url": "https://example.com/replace-me/project" },
        { "name": "Second example project", "url": "https://example.com/replace-me/project-two" }
      ]
    }
  }
}
```

Links are ordered by label. The other lists follow array order in the seed file, stored as `sortOrder`.

```bash
curl -sS -H 'Content-Type: application/json' \
  --data '{"query":"query { profile { name } health { status } }"}' \
  http://localhost:3000/graphql
```

### Nested query loading

`profile` is one service call. `ProfileService.getProfile` uses `findUnique` with `include` for links, skills, experiences, achievements, and projects, each ordered in that query. The GraphQL types have no field resolvers. Apollo reads `experience` and `achievements` from the objects already returned.

That is the right strategy for a single card. The alternative of one resolver per nested field would query once per role and once per achievement. DataLoader would only pay off if those field resolvers existed. A selection-aware query would skip collections the client did not ask for, at the cost of a field-to-include map. A single SQL join across every to-many relation would multiply rows. The include keeps the SQL count fixed. The cost is overfetch: `profile { name }` still loads every collection.

Prisma's default relation strategy, which this code uses, issues one SQL statement for the profile and one statement per included collection. Achievements are loaded for every role in one statement, not one statement per role. For this include that is six statements, and the number does not grow with the number of skills, roles, or achievements. The integration test compares a card with one role and one achievement to a card with six roles and five achievements each and expects the same statement count.

The standalone `experience` query is a separate `findMany` that includes achievements the same way: one statement for roles and one for their achievements.

## Migrations and seed

`prisma/migrations/20261112065650_init` is the schema. Apply it with `prisma migrate deploy`. Do not use `db push`.

`npm run seed` compiles the project and runs `prisma db seed`, which executes `node dist/database/seed-cli.js`. The seed file is chosen in this order:

1. `SEED_DATA_PATH`, if set
2. `prisma/seed-data/profile.local.json`, if that file exists
3. `prisma/seed-data/profile.example.json`

`profile.local.json` is gitignored. The example file has `"kind": "example-template"` and placeholder names, dates, and `example.com` URLs. A real profile should set `"kind"` to `"supplied-profile"`. The example file is what a clean clone seeds.

The seed is the source of truth for the `canonical` profile. Inside one transaction it upserts that profile and replaces its links, skills, experience, achievements, and projects. Rows no longer in the file are deleted. Running it again does not add rows. The profile id stays stable. Child ids are recreated. If the seed or migration fails, the process exits with a nonzero status.

The Nest process does not seed on startup. The Compose command does, before it listens.

## Docker from a clean clone

Requires Docker. From the repository root:

```bash
cp .env.example .env
docker compose up --build
```

Postgres becomes healthy first. The API image then runs `prisma migrate deploy`, `prisma db seed`, and `node dist/main.js`. The server listens on `0.0.0.0:3000`.

- GraphQL: `http://localhost:3000/graphql`
- Health: `http://localhost:3000/health`
- Postgres from the host: `localhost:5433`

The database password is not baked into the image. Compose builds `DATABASE_URL` from `.env`. The image only sets `NODE_ENV=production` and `PORT=3000`. A build-stage dummy URL is used so `prisma generate` can load `prisma.config.ts`. It is not copied into the runtime image.

If migration or seed fails, the API container exits and does not serve traffic.

## Local development

Requires Node.js `>=22.22.3`.

```bash
cp .env.example .env
docker compose up -d postgres
npm ci
npx prisma migrate deploy
npm run prisma:generate
npm run seed
npm run start:dev
```

`npm run start:dev` does not migrate or seed. `npm run start:prod` runs `node dist/main.js` and also does not migrate. Use the Docker command when startup should apply both.

`npm run seed` needs a built `dist/` because `prisma db seed` runs the compiled seed. The script builds first.

Other scripts: `npm run build`, `npm run lint`, `npm run lint:fix`, `npm run format`, `npm run format:check`, `npm run start:debug`.

## Environment variables

Copy `.env.example` to `.env`. The process refuses to start when validation fails.

| Variable | Required | Purpose |
| --- | --- | --- |
| `NODE_ENV` | No | `development` (default), `test`, or `production`. Compose sets `production` for the API. |
| `PORT` | No | Integer 1–65535. Default `3000`. The API container always uses `3000`. |
| `DATABASE_URL` | Yes for the API and Prisma | `postgresql://` or `postgres://`. Host Prisma uses `localhost:5433`. The API container uses host `postgres` and port `5432`. |
| `POSTGRES_USER` | Used by Compose | Default `business_card`. |
| `POSTGRES_PASSWORD` | Used by Compose | Default `business_card`. |
| `POSTGRES_DB` | Used by Compose | Default `business_card`. |
| `SEED_DATA_PATH` | No | Overrides the seed file. |
| `TEST_DATABASE_URL` | No | Integration tests only. The database name must end in `_test`. Default is `business_card_test` on `127.0.0.1:5434`. |

## Tests

```bash
npm run test:unit
npm run test:integration
npm run test:e2e
npm test
```

`npm test` runs all three, after `prisma generate`.

Unit tests cover environment validation, the date scalar, health, service mapping and ordering, seed validation, and the in-memory replace behavior. They also reject a `DATABASE_URL` whose database name does not end in `_test`.

Integration tests need PostgreSQL. They call `prisma migrate deploy` against that test database only. They do not reset or truncate any other database. Create it with:

```bash
docker run -d --name digital-business-card-test-postgres \
  -e POSTGRES_USER=business_card \
  -e POSTGRES_PASSWORD=business_card \
  -e POSTGRES_DB=business_card_test \
  -p 5434:5432 postgres:17-alpine
```

Those tests send real GraphQL requests through Nest. They check the profile service, the nested profile query, standalone collection queries, a null `endDate`, empty collections, display order, an unknown field, idempotent seeding, and a stable SQL count for a larger card.

End-to-end tests start the Nest application and call `GET /health` and the `health` GraphQL query. `NODE_ENV=test` is not production, so that test also expects the Sandbox HTML page.

## Deployment

The deployment path in this repository is the Compose stack above. The runtime image installs production dependencies, including the Prisma CLI, copies the compiled client and the migrations, then migrates, seeds, and starts Node as PID 1.

No public host is configured in this repository. After deployment, the API is:

```text
https://<public-host>/graphql
https://<public-host>/health
```

Git repository: <https://github.com/stackmesh/digital-business-card>

## Tradeoffs and omitted features

A read-only API is enough. The card is published content. Changes go through the seed file and a repeatable transaction, which keeps one source of truth and avoids a write API with no authorization model.

Authentication is omitted. Anyone who can reach the server can read the card. That is acceptable for a public profile and is why production turns Sandbox and introspection off.

S3 and other object storage are omitted. Projects and links store URLs. The API does not upload files.

Redis, CQRS, and extra services are omitted. One Nest process and one PostgreSQL instance cover the read path. Caching would not remove the fixed relation queries, and there is no session or queue to store.

The nested include can overfetch on a narrow selection. That cost is one small constant number of statements. Splitting the load into field resolvers, or mapping the GraphQL selection into Prisma `include`, would add code without reducing the worst-case query count for the assignment query.
