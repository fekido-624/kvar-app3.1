import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireCurrentUser } from '@/lib/auth';

const DataParcelDraftSchema = z.object({
  namaCustomer: z.string().min(1, 'Nama Pelanggan is required'),
  alamat: z.string().optional().default(''),
  poskod: z.string().optional().default(''),
  kv: z.string().min(1, 'KV is required'),
  noPhone: z.string().min(1, 'No. Telefon is required'),
  noOrder: z.string().min(1, 'No Order is required'),
  bilanganParcel: z.number().int().min(1),
});

const StatusQuerySchema = z.enum(['active', 'archived']);

const BulkStatusSchema = z.object({
  action: z.enum(['archive_all', 'restore_all']),
});

const ensureDataParcelDraftTable = async () => {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "DataParcelDraft" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "namaCustomer" TEXT NOT NULL,
      "alamat" TEXT NOT NULL DEFAULT '',
      "poskod" TEXT NOT NULL DEFAULT '',
      "kv" TEXT NOT NULL,
      "noPhone" TEXT NOT NULL,
      "noOrder" TEXT NOT NULL,
      "bilanganParcel" INTEGER NOT NULL,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const columns = (await prisma.$queryRawUnsafe(`PRAGMA table_info("DataParcelDraft")`)) as Array<{ name: string }>;
  const hasStatus = columns.some((column) => column.name === 'status');
  const hasArchivedAt = columns.some((column) => column.name === 'archivedAt');

  if (!hasStatus) {
    await prisma.$executeRawUnsafe(`ALTER TABLE "DataParcelDraft" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'active'`);
  }

  if (!hasArchivedAt) {
    await prisma.$executeRawUnsafe(`ALTER TABLE "DataParcelDraft" ADD COLUMN "archivedAt" DATETIME`);
  }
};

export async function GET(request: Request) {
  const currentUser = await requireCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await ensureDataParcelDraftTable();

  const { searchParams } = new URL(request.url);
  const parsedStatus = StatusQuerySchema.safeParse(searchParams.get('status') ?? 'active');
  const status = parsedStatus.success ? parsedStatus.data : 'active';

  const drafts = (await prisma.$queryRawUnsafe(`
    SELECT
      "id",
      "namaCustomer",
      "alamat",
      "poskod",
      "kv",
      "noPhone",
      "noOrder",
      "bilanganParcel",
      "status",
      "archivedAt",
      "createdAt",
      "updatedAt"
    FROM "DataParcelDraft"
    WHERE "status" = ?
    ORDER BY "createdAt" DESC
  `, status)) as Array<{
    id: string;
    namaCustomer: string;
    alamat: string;
    poskod: string;
    kv: string;
    noPhone: string;
    noOrder: string;
    bilanganParcel: number;
    createdAt: string;
    updatedAt: string;
  }>;

  return NextResponse.json({ drafts });
}

export async function POST(request: Request) {
  const currentUser = await requireCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await ensureDataParcelDraftTable();

  const json = await request.json().catch(() => null);
  const parsed = DataParcelDraftSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid data', details: parsed.error.errors },
      { status: 400 }
    );
  }

  const data = parsed.data;

  try {
    const id = randomUUID();
    const nowIso = new Date().toISOString();

    await prisma.$executeRawUnsafe(
      `
      INSERT INTO "DataParcelDraft" (
        "id",
        "namaCustomer",
        "alamat",
        "poskod",
        "kv",
        "noPhone",
        "noOrder",
        "bilanganParcel",
        "status",
        "archivedAt",
        "createdAt",
        "updatedAt"
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', NULL, ?, ?)
      `,
      id,
      data.namaCustomer,
      data.alamat,
      data.poskod,
      data.kv,
      data.noPhone,
      data.noOrder,
      data.bilanganParcel,
      nowIso,
      nowIso
    );

    const draft = {
      id,
      namaCustomer: data.namaCustomer,
      alamat: data.alamat,
      poskod: data.poskod,
      kv: data.kv,
      noPhone: data.noPhone,
      noOrder: data.noOrder,
      bilanganParcel: data.bilanganParcel,
      status: 'active',
      archivedAt: null,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    return NextResponse.json({ draft }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          (error as Error)?.message?.trim() || 'Unable to save data parcel draft.',
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  const currentUser = await requireCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await ensureDataParcelDraftTable();

  const json = await request.json().catch(() => null);
  const parsed = BulkStatusSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid data', details: parsed.error.errors },
      { status: 400 }
    );
  }

  try {
    if (parsed.data.action === 'archive_all') {
      await prisma.$executeRawUnsafe(`
        UPDATE "DataParcelDraft"
        SET "status" = 'archived', "archivedAt" = CURRENT_TIMESTAMP, "updatedAt" = CURRENT_TIMESTAMP
        WHERE "status" = 'active'
      `);
      return NextResponse.json({ success: true, action: 'archive_all' });
    }

    await prisma.$executeRawUnsafe(`
      UPDATE "DataParcelDraft"
      SET "status" = 'active', "archivedAt" = NULL, "updatedAt" = CURRENT_TIMESTAMP
      WHERE "status" = 'archived'
    `);
    return NextResponse.json({ success: true, action: 'restore_all' });
  } catch {
    return NextResponse.json({ error: 'Unable to update data parcel draft status.' }, { status: 500 });
  }
}

export async function DELETE() {
  const currentUser = await requireCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (currentUser.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  await ensureDataParcelDraftTable();

  try {
    const deletedCount = await prisma.$executeRawUnsafe(`DELETE FROM "DataParcelDraft"`);
    return NextResponse.json({ deletedCount });
  } catch {
    return NextResponse.json(
      { error: 'Unable to clear data parcel drafts.' },
      { status: 500 }
    );
  }
}
