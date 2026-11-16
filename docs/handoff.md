# KVar 3.1 Handoff Notes

Last updated: 2026-11-16

Primary references: `PROJECT-CONTEXT.md`, `docs/project-synopsis.md`,
`docs/kewangan.md`.

## Current status

- Modul Kewangan telah digabung dan diuji dalam KVar local.
- Akses admin sahaja: halaman, API, lampiran, dokumen, CSV dan sandaran.
- Tiga pilihan: Ringkasan, Penulis & Terbitan, Rekod Belanja.
- Tambah Rekod menggunakan dropdown kategori: Bayaran Penulis, Belanja Umum,
  Pembelian Aset, Perjalanan dan Upah Pembantu. Input kategori dikekalkan ketika
  bertukar pilihan dalam halaman yang sama.
- Rekod baharu bermula kosong. Data contoh daripada lab tidak diimport.
- Simpanan menggunakan jadual Prisma khusus dan binari lampiran dalam SQLite KVar.
  Transaksi database melindungi baki bayaran dan nombor rujukan daripada pendua.
- Bayaran separa, pendahuluan pemilik, bayaran balik, pembatalan, arkib/pulih,
  carian, cetakan A4, CSV dan sandaran/pemulihan tersedia.
- Cetakan belanja tidak lagi memaparkan perenggan pecahan perniagaan/peribadi,
  nota susut nilai aset atau ruang Pengesahan tambahan. Pengesahan penerima upah
  masih tersedia pada borang Upah Pembantu.
- Deployment modul Kewangan ke NAS belum dilakukan dalam sesi ini.

## Verified active NAS deployment

- Project folder: `/mnt/fekidopool/Web-App/Apps/KVar3.1`
- Git remote: `https://github.com/fekido-624/kvar-app3.1.git`
- Container: `kvar-app`
- Host port: `3000`
- Compose file: `docker-compose.yml`
- Persistent mounts:
  - `docker-data/data` → `/app/data`
  - `docker-data/templates` → `/app/templates`
  - `docker-data/public-templates` → `/app/public/templates`

Earlier instructions involving `kvar-app-31`, port 3001/3002 or
`docker-compose.kvar31.yml` do not describe the verified active deployment.

## Update on NAS

Before updating, stop application writes and take a snapshot/backup of the full
`docker-data/data` volume, including SQLite WAL files if present. Retain the
previous application image for rollback.

```bash
cd /mnt/fekidopool/Web-App/Apps/KVar3.1
git pull origin main
docker compose -f docker-compose.yml up -d --build
docker logs --tail 100 kvar-app
```

Startup runs `prisma migrate deploy`. The finance migration adds four new tables;
existing order/customer tables are not changed. No new port or volume is needed.
Open the existing KVar URL and select **Kewangan** using an admin account.

The financial backup button covers finance records and evidence only. Restoring
it does not replace orders/customers. Automatic pre-restore finance snapshots
are stored under `data/kewangan-backups/` inside the existing data volume.
For full-system rollback, restore the matching volume snapshot and old image.
Do not run database reset or seed commands against the active NAS database.

## Validation completed locally

- `npm run typecheck` passed.
- `npm run test:finance`: 10 domain tests passed.
- `npm run test:finance:integration` passed against development and production
  local servers: admin/non-admin/anonymous access, cross-origin writes, concurrent
  overpayment prevention, writer workflow, four expense categories, owner refunds,
  binary evidence, A4, CSV, archive and backup/restore.
- Temporary integration records and test users were removed; original local
  financial records were restored. Customer, receipt and tagging counts unchanged.
- `npm run test:tags` passed, including A6 printing and lifecycle checks.
- `npm run build` passed. Existing Genkit/OpenTelemetry optional Jaeger exporter
  warning remains; it does not prevent the build.
- Browser checks passed for saving through KVar, category switching with drafts
  retained, and phone layout at 390 px without horizontal page overflow.

## Local access

- KVar: `http://localhost:9002/kewangan`
- Standalone lab remains a separate project; KVar has no runtime dependency on it.
