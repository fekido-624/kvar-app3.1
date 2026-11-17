# KVar 3.1

- Purpose: Internal Kolej Vokasional operations app for users, customers, receipts, orders, sales records, parcels, and PDF/Excel exports.
- Stack: Next.js 15 App Router, React 19, TypeScript, Tailwind/shadcn UI, Prisma 7, SQLite, and Docker Compose.
- Current phase: Local development of Edit Draf Tempahan, with atomic receipt/parcel updates and stale-edit protection. Kewangan is already deployed on TrueNAS; Edit Draf Tempahan has not been deployed yet.
- Key constraints: Local development uses a separate SQLite database and authentication secret. Verified active TrueNAS deployment uses `docker-compose.yml`, container `kvar-app`, external port 3000, and `docker-data` volumes in the KVar3.1 folder. Active receipts use `/resit-1`; order linkage to `penerbitanId` supports sales records. Taging uses the full Tempahan No Siri (`noResit`), not the short parcel number.
- Setup done: Lockfile dependencies installed, Prisma client generated, migrations applied to the local database, local admin seeded, and the development server and login verified.

Existing technical references: `docs/project-synopsis.md` and `docs/handoff.md`.

Finance reference: `docs/kewangan.md`. Dedicated Prisma tables store finance records and binary attachments; existing TrueNAS data volume covers both. Protected finance UI reuses the tested lab forms inside a same-origin iframe. Finance starts empty; sample lab records are not imported.

Order draft edit reference: `docs/tempahan-edit.md`. Active drafts use an Edit modal; order/receipt IDs and full No Siri remain unchanged. Existing customer profiles and tagging snapshots remain independent.
