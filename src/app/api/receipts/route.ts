import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireCurrentUser } from '@/lib/auth';
import { buildSebutHargaTitle, extractSemesterLabelFromPerkara } from '@/lib/module-text';

const RECEIPT_COUNTER_KEY = 'receipt_no_resit';
const SEBAT_HARGA_COUNTER_KEY = 'sebat_harga_no_seri';

const CreateReceiptDraftSchema = z.object({
  namaPenerima: z.string().min(1, 'Nama Penerima is required'),
  namaKolejVokasional: z.string().min(1, 'Nama Kolej Vokasional is required'),
  tajuk: z.string().optional(),
  perkara: z.string().min(1, 'Perkara is required'),
  kuantiti: z.number().int().positive(),
  hargaSeunit: z.number().min(0),
  hargaPostage: z.number().min(0),
  tarikh: z.string().min(1),
  semester: z.string().optional(),
});

const ResetCounterSchema = z.object({
  startNo: z.number().int().min(1).max(999999),
  resetType: z.enum(['resit', 'sebat_harga']).default('resit'),
});

const BulkStatusSchema = z.object({
  action: z.enum(['archive_all', 'restore_all']),
});

const StatusQuerySchema = z.enum(['active', 'archived']);

const formatNoResit = (value: number) => String(value).padStart(4, '0');
const formatSebatHargaNo = (value: number) => String(value).padStart(3, '0');

const ensureCounterTable = async () => {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "ReceiptSequence" (
      "key" TEXT NOT NULL PRIMARY KEY,
      "nextNo" INTEGER NOT NULL DEFAULT 1,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
};

const ensureReceiptStatusColumns = async () => {
  const columns = (await prisma.$queryRawUnsafe(`PRAGMA table_info("ReceiptDraft")`)) as Array<{ name: string }>;
  const hasStatus = columns.some((column) => column.name === 'status');
  const hasArchivedAt = columns.some((column) => column.name === 'archivedAt');

  if (!hasStatus) {
    await prisma.$executeRawUnsafe(`ALTER TABLE "ReceiptDraft" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'active'`);
  }

  if (!hasArchivedAt) {
    await prisma.$executeRawUnsafe(`ALTER TABLE "ReceiptDraft" ADD COLUMN "archivedAt" DATETIME`);
  }
};

const getOrCreateCounterNextNo = async () => {
  await ensureCounterTable();

  const existing = (await prisma.$queryRawUnsafe(
    `SELECT "nextNo" FROM "ReceiptSequence" WHERE "key" = ? LIMIT 1`,
    RECEIPT_COUNTER_KEY
  )) as Array<{ nextNo: number }>;

  if (existing.length > 0 && Number.isInteger(existing[0].nextNo) && existing[0].nextNo >= 1) {
    return existing[0].nextNo;
  }

  // Create counter row if missing (safe if another request creates it first).
  await prisma.$executeRawUnsafe(
    `INSERT OR IGNORE INTO "ReceiptSequence" ("key", "nextNo", "updatedAt") VALUES (?, 1, CURRENT_TIMESTAMP)`,
    RECEIPT_COUNTER_KEY
  );

  const refreshed = (await prisma.$queryRawUnsafe(
    `SELECT "nextNo" FROM "ReceiptSequence" WHERE "key" = ? LIMIT 1`,
    RECEIPT_COUNTER_KEY
  )) as Array<{ nextNo: number }>;

  const value = refreshed[0]?.nextNo;
  if (Number.isInteger(value) && (value as number) >= 1) {
    return value as number;
  }

  await prisma.$executeRawUnsafe(
    `UPDATE "ReceiptSequence" SET "nextNo" = 1, "updatedAt" = CURRENT_TIMESTAMP WHERE "key" = ?`,
    RECEIPT_COUNTER_KEY
  );
  return 1;
};

const setCounterNextNo = async (nextNo: number) => {
  await ensureCounterTable();

  await prisma.$executeRawUnsafe(
    `
    INSERT INTO "ReceiptSequence" ("key", "nextNo", "updatedAt")
    VALUES (?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT("key") DO UPDATE SET
      "nextNo" = excluded."nextNo",
      "updatedAt" = CURRENT_TIMESTAMP
  `,
    RECEIPT_COUNTER_KEY,
    nextNo
  );
};

const getOrCreateSebatHargaCounterNextNo = async () => {
  await ensureCounterTable();

  const existing = (await prisma.$queryRawUnsafe(
    `SELECT "nextNo" FROM "ReceiptSequence" WHERE "key" = ? LIMIT 1`,
    SEBAT_HARGA_COUNTER_KEY
  )) as Array<{ nextNo: number }>;

  if (existing.length > 0 && Number.isInteger(existing[0].nextNo) && existing[0].nextNo >= 1) {
    return existing[0].nextNo;
  }

  await prisma.$executeRawUnsafe(
    `INSERT OR IGNORE INTO "ReceiptSequence" ("key", "nextNo", "updatedAt") VALUES (?, 1, CURRENT_TIMESTAMP)`,
    SEBAT_HARGA_COUNTER_KEY
  );

  const refreshed = (await prisma.$queryRawUnsafe(
    `SELECT "nextNo" FROM "ReceiptSequence" WHERE "key" = ? LIMIT 1`,
    SEBAT_HARGA_COUNTER_KEY
  )) as Array<{ nextNo: number }>;

  const value = refreshed[0]?.nextNo;
  if (Number.isInteger(value) && (value as number) >= 1) {
    return value as number;
  }

  await prisma.$executeRawUnsafe(
    `UPDATE "ReceiptSequence" SET "nextNo" = 1, "updatedAt" = CURRENT_TIMESTAMP WHERE "key" = ?`,
    SEBAT_HARGA_COUNTER_KEY
  );
  return 1;
};

const setSebatHargaCounterNextNo = async (nextNo: number) => {
  await ensureCounterTable();

  await prisma.$executeRawUnsafe(
    `
    INSERT INTO "ReceiptSequence" ("key", "nextNo", "updatedAt")
    VALUES (?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT("key") DO UPDATE SET
      "nextNo" = excluded."nextNo",
      "updatedAt" = CURRENT_TIMESTAMP
  `,
    SEBAT_HARGA_COUNTER_KEY,
    nextNo
  );
};

export async function GET(request: Request) {
  const currentUser = await requireCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await ensureReceiptStatusColumns();

  const { searchParams } = new URL(request.url);
  const parsedStatus = StatusQuerySchema.safeParse(searchParams.get('status') ?? 'active');
  const status = parsedStatus.success ? parsedStatus.data : 'active';

  const receipts = (await prisma.$queryRawUnsafe(
    `
    SELECT
      "id",
      "noResit",
      "noSeriSebatHarga",
      "namaPenerima",
      "namaKolejVokasional",
      "tajuk",
      "perkara",
      "kuantiti",
      "hargaSeunit",
      "hargaPostage",
      "tarikh",
      "semester",
      "status",
      "archivedAt",
      "createdAt",
      "updatedAt"
    FROM "ReceiptDraft"
    WHERE "status" = ?
    ORDER BY "createdAt" DESC
    `,
    status
  )) as Array<Record<string, unknown>>;

  const nextNoResit = await getOrCreateCounterNextNo();
  const nextNoSebatHarga = await getOrCreateSebatHargaCounterNextNo();

  return NextResponse.json({
    receipts,
    nextNoResit: formatNoResit(nextNoResit),
    nextNoSeriSebatHarga: formatSebatHargaNo(nextNoSebatHarga),
  });
}

export async function POST(request: Request) {
  const currentUser = await requireCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await ensureReceiptStatusColumns();

  const json = await request.json().catch(() => null);
  const parsed = CreateReceiptDraftSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid data', details: parsed.error.errors },
      { status: 400 }
    );
  }

  const data = parsed.data;
  const autoTajuk = buildSebutHargaTitle(data.perkara);
  const autoSemester = extractSemesterLabelFromPerkara(data.perkara);

  try {
    const currentNextNoResit = await getOrCreateCounterNextNo();
    const currentNextNoSebatHarga = await getOrCreateSebatHargaCounterNextNo();

    if (currentNextNoResit > 999999) {
        throw new Error('No siri resit telah capai had maksimum 6 digit.');
    }

    if (currentNextNoSebatHarga > 999) {
        throw new Error('No siri sebut harga telah capai had maksimum 3 digit.');
    }

    const noResit = formatNoResit(currentNextNoResit);
    const noSeriSebatHarga = formatSebatHargaNo(currentNextNoSebatHarga);

    const receipt = await prisma.receiptDraft.create({
      data: {
        noResit,
        noSeriSebatHarga,
        namaPenerima: data.namaPenerima,
        namaKolejVokasional: data.namaKolejVokasional,
        tajuk: autoTajuk,
        perkara: data.perkara,
        kuantiti: data.kuantiti,
        hargaSeunit: data.hargaSeunit,
        hargaPostage: data.hargaPostage,
        tarikh: new Date(data.tarikh),
        semester: data.semester?.trim() || autoSemester,
      },
    });

    await setCounterNextNo(currentNextNoResit + 1);
    await setSebatHargaCounterNextNo(currentNextNoSebatHarga + 1);

    return NextResponse.json({ receipt }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message || 'Unable to save receipt draft.' },
      { status: 400 }
    );
  }
}

export async function PATCH(request: Request) {
  const currentUser = await requireCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await ensureReceiptStatusColumns();

  const json = await request.json().catch(() => null);

  const bulkParsed = BulkStatusSchema.safeParse(json);
  if (bulkParsed.success) {
    const { action } = bulkParsed.data;
    try {
      if (action === 'archive_all') {
        await prisma.$executeRawUnsafe(`
          UPDATE "ReceiptDraft"
          SET "status" = 'archived', "archivedAt" = CURRENT_TIMESTAMP, "updatedAt" = CURRENT_TIMESTAMP
          WHERE "status" = 'active'
        `);
      } else {
        await prisma.$executeRawUnsafe(`
          UPDATE "ReceiptDraft"
          SET "status" = 'active', "archivedAt" = NULL, "updatedAt" = CURRENT_TIMESTAMP
          WHERE "status" = 'archived'
        `);
      }

      return NextResponse.json({ success: true, action });
    } catch {
      return NextResponse.json({ error: 'Tidak dapat kemaskini status draft resit.' }, { status: 500 });
    }
  }

  const parsed = ResetCounterSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid data', details: parsed.error.errors },
      { status: 400 }
    );
  }

  try {
    const { startNo, resetType } = parsed.data;

    if (resetType === 'resit') {
      await setCounterNextNo(startNo);
      return NextResponse.json({
        message: 'No siri resit berjaya direset.',
        nextNoResit: formatNoResit(startNo),
      });
    } else if (resetType === 'sebat_harga') {
      await setSebatHargaCounterNextNo(startNo);
      return NextResponse.json({
        message: 'No siri sebut harga berjaya direset.',
        nextNoSeriSebatHarga: formatSebatHargaNo(startNo),
      });
    }

    throw new Error('Invalid resetType.');
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message || 'Tidak dapat reset no siri.' },
      { status: 500 }
    );
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

  try {
    const result = await prisma.receiptDraft.deleteMany();
    return NextResponse.json({ deletedCount: result.count });
  } catch {
    return NextResponse.json(
      { error: 'Unable to clear receipt drafts.' },
      { status: 500 }
    );
  }
}
