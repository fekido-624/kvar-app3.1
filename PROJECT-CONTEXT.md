# KVar 3.1

- Purpose: Internal Kolej Vokasional operations app for users, customers, receipts, orders, sales records, parcels, and PDF/Excel exports.
- Stack: Next.js 15 App Router, React 19, TypeScript, Tailwind/shadcn UI, Prisma 7, SQLite, and Docker Compose.
- Current phase: Feature development including Taging Lebihan and consistent explicit Cari/Enter search. An existing deployment runs on TrueNAS SCALE.
- Key constraints: Local development uses a separate SQLite database and authentication secret. Verified active TrueNAS deployment uses `docker-compose.yml`, container `kvar-app`, external port 3000, and `docker-data` volumes in the KVar3.1 folder. Active receipts use `/resit-1`; order linkage to `penerbitanId` supports sales records. Taging uses the full Tempahan No Siri (`noResit`), not the short parcel number.
- Setup done: Lockfile dependencies installed, Prisma client generated, migrations applied to the local database, local admin seeded, and the development server and login verified.

Existing technical references: `docs/project-synopsis.md` and `docs/handoff.md`.
