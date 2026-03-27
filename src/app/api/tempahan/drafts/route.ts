import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireCurrentUser } from '@/lib/auth';

const CreateTempahanDraftSchema = z.object({
  receiptDraftId: z.string().min(1),
  dataParcelDraftId: z.string().optional().default(''),
  bilanganAlamat: z.number().int().min(1),
  alamat: z.string().optional().default(''),
  poskod: z.string().optional().default(''),
  noPhone: z.string().optional().default(''),
  penerbitanId: z.string().optional(),
});

const TempahanStatusSchema = z.enum(['active', 'archived']);

const PatchTempahanDraftSchema = z.object({
  action: z.enum(['archive_all', 'restore_all']),
});

const ensureSupportTables = async () => {
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

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "TempahanDraft" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "receiptDraftId" TEXT NOT NULL,
      "dataParcelDraftId" TEXT NOT NULL,
      "bilanganAlamat" INTEGER NOT NULL,
      "alamat" TEXT NOT NULL DEFAULT '',
      "poskod" TEXT NOT NULL DEFAULT '',
      "noPhone" TEXT NOT NULL DEFAULT '',
      "status" TEXT NOT NULL DEFAULT 'active',
      "archivedAt" DATETIME,
      "penerbitanId" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE("receiptDraftId")
    )
  `);

  const columns = (await prisma.$queryRawUnsafe(`PRAGMA table_info("TempahanDraft")`)) as Array<{ name: string }>;
  const hasStatus = columns.some((column) => column.name === 'status');
  const hasArchivedAt = columns.some((column) => column.name === 'archivedAt');
  const hasPenerbitanId = columns.some((column) => column.name === 'penerbitanId');
  const hasAlamat = columns.some((column) => column.name === 'alamat');
  const hasPoskod = columns.some((column) => column.name === 'poskod');
  const hasNoPhone = columns.some((column) => column.name === 'noPhone');

  if (!hasStatus) {
    await prisma.$executeRawUnsafe(`ALTER TABLE "TempahanDraft" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'active'`);
  }

  if (!hasArchivedAt) {
    await prisma.$executeRawUnsafe(`ALTER TABLE "TempahanDraft" ADD COLUMN "archivedAt" DATETIME`);
  }

  if (!hasPenerbitanId) {
    await prisma.$executeRawUnsafe(`ALTER TABLE "TempahanDraft" ADD COLUMN "penerbitanId" TEXT`);
  }

  if (!hasAlamat) {
    await prisma.$executeRawUnsafe(`ALTER TABLE "TempahanDraft" ADD COLUMN "alamat" TEXT NOT NULL DEFAULT ''`);
  }

  if (!hasPoskod) {
    await prisma.$executeRawUnsafe(`ALTER TABLE "TempahanDraft" ADD COLUMN "poskod" TEXT NOT NULL DEFAULT ''`);
  }

  if (!hasNoPhone) {
    await prisma.$executeRawUnsafe(`ALTER TABLE "TempahanDraft" ADD COLUMN "noPhone" TEXT NOT NULL DEFAULT ''`);
  }
};

export async function GET(request: Request) {
  const currentUser = await requireCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await ensureSupportTables();

  const { searchParams } = new URL(request.url);
  const parsedStatus = TempahanStatusSchema.safeParse(searchParams.get('status') ?? 'active');
  const status = parsedStatus.success ? parsedStatus.data : 'active';

  const drafts = (await prisma.$queryRawUnsafe(`
    SELECT
      t."id",
      t."receiptDraftId",
      t."dataParcelDraftId",
      t."bilanganAlamat",
      t."alamat" AS "tempahanAlamat",
      t."poskod" AS "tempahanPoskod",
      t."noPhone" AS "tempahanNoPhone",
      t."penerbitanId",
      t."status",
      t."archivedAt",
      t."createdAt",
      r."noResit",
      r."noSeriSebatHarga",
      r."namaPenerima",
      r."namaKolejVokasional",
      r."tajuk",
      r."perkara",
      r."kuantiti",
      r."hargaSeunit",
      r."hargaPostage",
      r."tarikh",
      r."semester",
      COALESCE(p."alamat", t."alamat") AS "alamat",
      COALESCE(p."poskod", t."poskod") AS "poskod",
      COALESCE(p."noPhone", t."noPhone") AS "noPhone",
      p."noOrder",
      p."bilanganParcel"
    FROM "TempahanDraft" t
    INNER JOIN "ReceiptDraft" r ON r."id" = t."receiptDraftId"
    LEFT JOIN "DataParcelDraft" p ON p."id" = t."dataParcelDraftId"
    WHERE t."status" = ?
    ORDER BY t."createdAt" DESC
  `, status)) as Array<Record<string, unknown>>;

  return NextResponse.json({ drafts });
}

export async function POST(request: Request) {
  const currentUser = await requireCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await ensureSupportTables();

  const json = await request.json().catch(() => null);
  const parsed = CreateTempahanDraftSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid data', details: parsed.error.errors },
      { status: 400 }
    );
  }

  const data = parsed.data;
  const id = randomUUID();

  try {
    await prisma.$executeRawUnsafe(
      `
      INSERT INTO "TempahanDraft" (
        "id",
        "receiptDraftId",
        "dataParcelDraftId",
        "bilanganAlamat",
        "alamat",
        "poskod",
        "noPhone",
        "penerbitanId",
        "status",
        "archivedAt",
        "createdAt",
        "updatedAt"
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `,
      id,
      data.receiptDraftId,
      data.dataParcelDraftId,
      data.bilanganAlamat,
      data.alamat,
      data.poskod,
      data.noPhone,
      data.penerbitanId ?? null
    );

    return NextResponse.json({ id }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message || 'Unable to save tempahan draft.' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  const currentUser = await requireCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await ensureSupportTables();

  const json = await request.json().catch(() => null);
  const parsed = PatchTempahanDraftSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid data', details: parsed.error.errors },
      { status: 400 }
    );
  }

  const { action } = parsed.data;

  try {
    if (action === 'archive_all') {
      await prisma.$executeRawUnsafe(`
        UPDATE "TempahanDraft"
        SET "status" = 'archived', "archivedAt" = CURRENT_TIMESTAMP, "updatedAt" = CURRENT_TIMESTAMP
        WHERE "status" = 'active'
      `);
      return NextResponse.json({ success: true, action });
    }

    await prisma.$executeRawUnsafe(`
      UPDATE "TempahanDraft"
      SET "status" = 'active', "archivedAt" = NULL, "updatedAt" = CURRENT_TIMESTAMP
      WHERE "status" = 'archived'
    `);
    return NextResponse.json({ success: true, action });
  } catch {
    return NextResponse.json({ error: 'Unable to update tempahan draft status.' }, { status: 500 });
  }
}

export async function DELETE() {
  const currentUser = await requireCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await ensureSupportTables();

  const links = (await prisma.$queryRawUnsafe(`
    SELECT "receiptDraftId", "dataParcelDraftId"
    FROM "TempahanDraft"
  `)) as Array<{ receiptDraftId: string; dataParcelDraftId: string }>;

  const receiptIds = links.map((item) => item.receiptDraftId).filter(Boolean);
  const parcelIds = links.map((item) => item.dataParcelDraftId).filter(Boolean);

  try {
    await prisma.$executeRawUnsafe(`DELETE FROM "TempahanDraft"`);

    if (receiptIds.length > 0) {
      await prisma.receiptDraft.deleteMany({
        where: { id: { in: receiptIds } },
      });
    }

    for (const id of parcelIds) {
      await prisma.$executeRawUnsafe(`DELETE FROM "DataParcelDraft" WHERE "id" = ?`, id);
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Unable to clear tempahan drafts.' }, { status: 500 });
  }
}
