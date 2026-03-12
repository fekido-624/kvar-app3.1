# **App Name**: AccessPilot

## Project Handoff (Keep Updated)

- Latest stable commit: `3f63196`
- Main branch: `main`
- Production deploy host: TrueNAS SCALE
- Deploy path (NAS): `/mnt/fekidopool/Web-App/Apps/KVar`
- Important note: `dev.db` is local data file, do not commit.

### Current Delivered Scope

- Receipts page promoted from test flow to main `/receipts` flow.
- Receipt export supports PDF generation per draft and ZIP download.
- Customers page supports database export to Excel (`/api/customers/export`).
- Customer phone uniqueness enforced in create/update/import:
	- API returns `No Phone telah diguna` for duplicates.
- Session expiry currently set to 5 minutes:
	- `src/lib/auth.ts:7`
- Data Parcel drafts persist to SQLite DB (survive refresh):
	- API: `src/app/api/data-parcel/drafts/route.ts`
	- Schema model: `DataParcelDraft` in `prisma/schema.prisma`
	- Raw SQL pattern used (`$executeRawUnsafe`) — same as other runtime tables
- Password show/hide toggle on all password fields:
	- Reusable component: `src/components/ui/password-input.tsx`
	- Applied to: login, create user, edit user, profile pages

### Resume Prompt (Copy/Paste)

Use this in a new chat to continue safely:

```text
Sambung project KVar.
Latest commit: 3f63196.
Rujuk docs/blueprint.md (Project Handoff).
Fokus task: <isi task semasa>.
Jangan ubah flow sedia ada tanpa confirmation.
```

### Developer Commands

- Local dev: `npm run dev`
- Type check: `npm run typecheck`
- Build: `npm run build`
- Start: `npm run start`

### NAS Deploy Commands

```bash
cd /mnt/fekidopool/Web-App/Apps/KVar
git pull
docker compose up -d --build
```

### Latest Ops Troubleshooting (2026-03-12)

- Issue: Data Parcel export failed with:
	- `Template not found at public/templates/data-parcel-template.xlsx`
- Root cause:
	- Compose volume `./docker-data/public-templates:/app/public/templates` overrides container template folder.
	- Host folder `docker-data/public-templates` was empty.
- Fix applied:
	- Copied template file from repo path to mounted host path:
	- `cp ./public/templates/data-parcel-template.xlsx ./docker-data/public-templates/data-parcel-template.xlsx`
	- Restarted/recreated container after copy.
- Verification commands:
	- `ls -la ./docker-data/public-templates`
	- `docker compose exec kvar-app sh -c "ls -la /app/public/templates"`

### Resume Prompt (Ops)

```text
Sambung deployment KVar di TrueNAS.
Rujuk docs/blueprint.md > Latest Ops Troubleshooting (2026-03-12).
Semak mount template: ./docker-data/public-templates:/app/public/templates.
Jika Data Parcel export gagal, verify fail data-parcel-template.xlsx pada host dan dalam container.
```

## Core Features:

- Secure User Authentication: Users can log in with credentials created by an administrator, maintaining secure access, including initial admin login with default credentials.
- Admin Dashboard & User Listing: A protected administrative interface to view all existing user accounts with essential details.
- Admin User Account Creation: Administrators can create new user accounts, assigning initial credentials and roles (admin or standard user).
- Admin User Management (CRUD): Administrators have the capability to update user passwords, names, emails, delete user accounts, and assign or revoke admin roles for other users.
- Personal Profile Management: Authenticated users (including admins) can access and update their own name, email, and password.
- Role-Based Access Control: System to ensure 'admin' and 'standard user' roles have appropriate access levels to features and data.
- AI Password & Username Generator Tool: An administrative tool to suggest strong, secure passwords and standardized usernames during new user creation.

## Style Guidelines:

- Primary color: A professional and trustworthy medium blue (#2E5CB8). This hue represents reliability and security, fitting for an access management application.
- Background color: A very light, desaturated blue (#F0F2F4), visually connected to the primary color while providing a clean and open backdrop for content.
- Accent color: A soft aqua (#66BBCC) used sparingly for calls to action or interactive elements, offering a pleasant contrast while maintaining a professional feel.
- All text: 'Inter' (sans-serif) for its clean, neutral, and highly readable design suitable for both headlines and detailed content in a functional application.
- Utilize a consistent set of simple, line-based icons for common actions like login, add user, edit, delete, and profile, to ensure clarity and a modern aesthetic.
- Employ a clear, intuitive layout with a responsive design, prioritizing functional simplicity. A main navigation on the side for admins, and central content areas for forms and tables.
- Incorporate subtle, quick animations for form submissions, data loading indicators, and route transitions to provide a smooth and responsive user experience without being distracting.