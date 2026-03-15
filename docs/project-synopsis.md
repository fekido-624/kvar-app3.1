# KVar WebApp Synopsis

Last updated: 2026-03-16
Purpose: quick technical understanding of the whole project (feature flow, key variables, key files, and change impact).

## 1) Project in one page

KVar is an internal operations webapp for KOLEJ VOKASIONAL workflow.
Main business flow:
- Manage users and authentication
- Manage customer records
- Generate and manage Resit (receipt drafts)
- Manage Tempahan (order drafts) linked to Resit and Data Parcel
- Manage Rekod Jualan / Penerbitan as module source-of-truth
- Export operational documents (PDF/Excel)

Current active receipt flow:
- Main route now uses Resit-1 workflow
- Legacy receipts route redirects to Resit-1

## 2) Stack and architecture

Framework and runtime:
- Next.js App Router (React 19)
- TypeScript
- Tailwind + shadcn/ui components

Data and ORM:
- SQLite
- Prisma Client with better-sqlite adapter
- Mixed data access:
  - Prisma models for core entities
  - Raw SQL support tables created at runtime for feature-specific tables

Deployment:
- Docker Compose on TrueNAS SCALE
- Two instances can run side-by-side:
  - legacy on port 3000
  - KVar 3.1 on port 3001

## 3) Main roles and access

Roles:
- admin
- user

Authorization pattern:
- Session-based auth cookie
- Protected APIs call requireCurrentUser()
- Admin-only actions validated in API routes (for example create/update/delete user or create penerbitan)

## 4) Core modules and routes

Authentication:
- Login page: src/app/login/page.tsx
- Login API: src/app/api/auth/login/route.ts
- Current session API: src/app/api/auth/me/route.ts
- Auth helpers: src/lib/auth.ts

Customers:
- Main API: src/app/api/customers/route.ts
- Search/check/import/export/template routes under: src/app/api/customers/

Resit:
- Active page: src/app/(authenticated)/resit-1/page.tsx
- Legacy redirect page: src/app/(authenticated)/receipts/page.tsx
- Core receipts API: src/app/api/receipts/route.ts
- Export PDF API: src/app/api/receipts/export-pdf/route.ts
- Counter reset API: src/app/api/receipts/reset-counter/route.ts

Tempahan:
- Page: src/app/(authenticated)/tempahan/page.tsx
- Draft API: src/app/api/tempahan/drafts/route.ts
- Draft by id API: src/app/api/tempahan/drafts/[id]/route.ts

Rekod Jualan and Penerbitan:
- Rekod Jualan API: src/app/api/rekod-jualan/route.ts
- Penerbitan API: src/app/api/penerbitan/route.ts
- Penerbitan by id API: src/app/api/penerbitan/[id]/route.ts

Data Parcel:
- Draft APIs: src/app/api/data-parcel/drafts/route.ts and src/app/api/data-parcel/drafts/[id]/route.ts

Navigation and shell:
- Sidebar: src/components/layout/app-sidebar.tsx
- App root layout: src/app/layout.tsx
- Theme tokens: src/app/globals.css

## 5) Data model summary

Prisma schema entities (static schema):
- User
- Customer
- ReceiptDraft
- ReceiptPerkaraOption
- ReceiptTajukOption
- ReceiptSequence
- DataParcelDraft

Runtime SQL support tables (created in APIs if missing):
- TempahanDraft
- Penerbitan

Important relation chain:
- TempahanDraft.receiptDraftId -> ReceiptDraft.id
- TempahanDraft.dataParcelDraftId -> DataParcelDraft.id
- TempahanDraft.penerbitanId -> Penerbitan.id (critical for Rekod Jualan aggregation)

## 6) Critical variables and state (high impact)

In Resit-1 page (src/app/(authenticated)/resit-1/page.tsx):
- selectedModuleId
  - must contain Penerbitan.id
  - used when posting tempahan draft as penerbitanId
  - if missing/wrong, Rekod Jualan totals will not update

- activeTab: 'active' | 'archived'
  - controls which status is fetched from receipts/tempahan APIs

- selectedIds
  - selected rows for bulk archive/delete actions

- noResit / noSeriSebatHarga
  - sequence values from receipts API

In auth helper (src/lib/auth.ts):
- SESSION_COOKIE = accesspilot_session
- SESSION_MAX_AGE_SECONDS
- cookie secure behavior:
  - production normally secure
  - deployment override via COOKIE_SECURE environment variable

In tempahan drafts API:
- status values: active, archived
- action values (PATCH): archive_all, restore_all

## 7) Environment variables and what they affect

Required:
- DATABASE_URL
  - used by Prisma adapter in src/lib/db.ts

- AUTH_SECRET
  - signs and verifies JWT session cookie

Deployment-sensitive:
- NODE_ENV
  - production affects cookie defaults and runtime mode

- COOKIE_SECURE
  - if false, allows session cookie on HTTP (useful for local/NAS HTTP access)
  - for real domain + HTTPS, secure cookie should be enabled

Optional:
- GEMINI_API_KEY
  - for AI credential helper flow

## 8) Known failure patterns and root causes

Issue: auto logout, Muat Data Gagal, many 401 API responses
- Typical cause: session cookie not sent (HTTP + secure cookie)
- Check: browser Network for /api/auth/me status 401
- Fix path: ensure deployment has correct COOKIE_SECURE for current protocol and redeploy

Issue: app looks old (branding/module mismatch)
- Typical cause: NAS running older commit/image
- Fix path: push latest -> git pull on NAS -> rebuild with no cache -> restart container

Issue: Rekod Jualan does not include new resit/tempahan
- Typical cause: penerbitanId not sent/stored in TempahanDraft
- Check payload + TempahanDraft row values

## 9) Operational commands (reference)

Laptop update flow:
- git add .
- git commit -m "message"
- git push origin main

NAS update flow:
- git config --global --add safe.directory /mnt/fekidopool/Web-App/Apps/KVar3.1
- git pull
- docker compose -f docker-compose.kvar31.yml build --no-cache
- docker compose -f docker-compose.kvar31.yml up -d

Quick verify:
- docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
- curl -s http://localhost:3001/login | grep -Eo "KVar3.1|KVar3.0" | head -n 1
- docker logs --tail 100 kvar-app-31

## 10) High-safety change checklist

Before editing feature logic:
- Check whether route is legacy redirect or active route
- Check whether API uses Prisma model or runtime raw SQL table
- Keep TempahanDraft.penerbitanId behavior intact
- Validate auth-protected routes still return 401 only when not logged in
- Re-test active and archived tabs after any drafts-related change

Before deployment:
- Confirm latest commit hash on laptop and NAS match
- Confirm correct compose file (kvar31)
- Confirm correct port (3001 for KVar3.1)

## 11) Fast resume prompt

Use this prompt in new session:

Sambung projek KVar. Rujuk docs/project-synopsis.md dan docs/handoff.md dulu. Guna flow semasa Resit-1, TempahanDraft linked to penerbitanId, dan deployment KVar3.1 on port 3001. Jangan ubah auth/session behavior tanpa semak COOKIE_SECURE, AUTH_SECRET, dan protocol HTTP/HTTPS.
