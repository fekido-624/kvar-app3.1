# KVar 3.1

- Purpose: Internal Kolej Vokasional operations app for users, customers, receipts, orders, sales records, parcels, and PDF/Excel exports.
- Stack: Next.js 15 App Router, React 19, TypeScript, Tailwind/shadcn UI, Prisma 7, SQLite, and Docker Compose.
- Current phase: Local development setup ahead of requested changes. An existing deployment runs on TrueNAS SCALE.
- Key constraints: Local development uses a separate SQLite database and authentication secret. Existing TrueNAS deployment uses `docker-compose.kvar31.yml`, container `kvar-app-31`, and external port 3001. Active receipts use `/resit-1`; order linkage to `penerbitanId` supports sales records.
- Setup done: Lockfile dependencies installed, Prisma client generated, migrations applied to the local database, local admin seeded, and the development server and login verified.

Existing technical references: `docs/project-synopsis.md` and `docs/handoff.md`.
