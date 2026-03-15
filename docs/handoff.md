# KVar 3.1 Handoff Notes

Last updated: 2026-03-16

Primary technical synopsis: `docs/project-synopsis.md`

## Current status

- KVar 3.1 deployed as separate container on NAS.
- Legacy instance still exists and runs separately.
- Main app functionality is currently stable after redeploy.

## Deployment layout (NAS)

- Project folder: `/mnt/fekidopool/Web-App/Apps/KVar3.1`
- New instance container: `kvar-app-31`
- New instance external port: `3001`
- Legacy container: `kvar-app` on port `3000`
- Compose file for new instance: `docker-compose.kvar31.yml`
- Persistent data dirs:
  - `docker-data-31/data`
  - `docker-data-31/templates`
  - `docker-data-31/public-templates`

## Important fixes already applied

1. Route migration
- Old Receipts route now redirects to `/resit-1`.
- Sidebar/dashboard/test links updated to use `/resit-1`.

2. Branding and theme
- UI branding updated from KVar3.0 to KVar3.1.
- Maroon-based theme applied, logo text kept white.

3. Rekod Jualan linkage bug
- Resit-1 now sends `penerbitanId` correctly so records appear in Rekod Jualan.

4. Tempahan archived bulk delete
- Added checkbox multi-select delete in archived/history section.

5. NAS auth/session issue (critical)
- Symptom: login seemed to succeed but pages returned 401, then auto logout and "Muat Data Gagal".
- Cause: secure cookie behavior in production while app accessed over HTTP (`http://IP:3001`).
- Fix implemented:
  - `COOKIE_SECURE: "false"` added in `docker-compose.kvar31.yml`
  - `src/lib/auth.ts` updated to respect `COOKIE_SECURE`

## Git and sync notes

- Repo remote: `https://github.com/fekido-624/kvar-app3.1.git`
- During troubleshooting, one issue was caused by NAS running older commit while local changes were not pushed yet.
- Rule: always push from laptop first, then pull and rebuild on NAS.

## Standard update flow (laptop -> NAS)

1. On laptop:

```powershell
git add .
git commit -m "your message"
git push origin main
```

2. On NAS:

```bash
git config --global --add safe.directory /mnt/fekidopool/Web-App/Apps/KVar3.1
git pull
docker compose -f docker-compose.kvar31.yml build --no-cache
docker compose -f docker-compose.kvar31.yml up -d
```

## Quick verification commands (NAS)

```bash
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
curl -s http://localhost:3001/login | grep -Eo "KVar3.1|KVar3.0" | head -n 1
docker logs --tail 100 kvar-app-31
```

Expected:
- `kvar-app-31` should map `0.0.0.0:3001->3000/tcp`
- login page check should return `KVar3.1`

## Login/bootstrap note

- If DB is fresh/empty and admin user is missing:

```bash
docker exec kvar-app-31 npm run db:seed
```

Default seed credentials:
- username: `admin`
- password: `Password123!`

## Future production hardening

When domain + HTTPS is fully configured:
- set cookie behavior back to secure mode (remove override or set `COOKIE_SECURE` for HTTPS only)
- keep AUTH_SECRET strong and private
- consider backup routine for `docker-data-31/data/dev.db`

## If problems reappear

1. Confirm browser URL is port 3001 (not 3000).
2. Confirm latest commit exists on NAS (`git log -n 3`).
3. Rebuild without cache and redeploy.
4. Check browser DevTools network status codes:
   - 401: session/cookie/auth issue
   - 500: server/runtime/db issue
5. Check container logs immediately after reproducing issue.
