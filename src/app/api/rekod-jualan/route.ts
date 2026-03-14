import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireCurrentUser } from '@/lib/auth';

const ensureTables = async () => {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "Penerbitan" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "perkara" TEXT NOT NULL,
      "tajuk" TEXT NOT NULL DEFAULT '',
      "semester" INTEGER NOT NULL,
      "tahun" INTEGER NOT NULL,
      "edisi" INTEGER NOT NULL DEFAULT 1,
      "hargaSeunit" REAL NOT NULL DEFAULT 0,
      "legacyJumlahUnit" REAL NOT NULL DEFAULT 0,
      "legacyJumlahHasil" REAL NOT NULL DEFAULT 0,
      "legacyJumlahKV" INTEGER NOT NULL DEFAULT 0,
      "catatan" TEXT NOT NULL DEFAULT '',
      "aktif" INTEGER NOT NULL DEFAULT 1,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const penerbitanColumns = (await prisma.$queryRawUnsafe(`PRAGMA table_info("Penerbitan")`)) as Array<{ name: string }>;
  if (!penerbitanColumns.some((c) => c.name === 'legacyJumlahUnit')) {
    await prisma.$executeRawUnsafe(`ALTER TABLE "Penerbitan" ADD COLUMN "legacyJumlahUnit" REAL NOT NULL DEFAULT 0`);
  }
  if (!penerbitanColumns.some((c) => c.name === 'legacyJumlahHasil')) {
    await prisma.$executeRawUnsafe(`ALTER TABLE "Penerbitan" ADD COLUMN "legacyJumlahHasil" REAL NOT NULL DEFAULT 0`);
  }
  if (!penerbitanColumns.some((c) => c.name === 'legacyJumlahKV')) {
    await prisma.$executeRawUnsafe(`ALTER TABLE "Penerbitan" ADD COLUMN "legacyJumlahKV" INTEGER NOT NULL DEFAULT 0`);
  }

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "TempahanDraft" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "receiptDraftId" TEXT NOT NULL,
      "dataParcelDraftId" TEXT NOT NULL,
      "bilanganAlamat" INTEGER NOT NULL,
      "penerbitanId" TEXT,
      "status" TEXT NOT NULL DEFAULT 'active',
      "archivedAt" DATETIME,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE("receiptDraftId")
    )
  `);

  const columns = (await prisma.$queryRawUnsafe(`PRAGMA table_info("TempahanDraft")`)) as Array<{ name: string }>;
  if (columns.length > 0 && !columns.some((c) => c.name === 'penerbitanId')) {
    await prisma.$executeRawUnsafe(`ALTER TABLE "TempahanDraft" ADD COLUMN "penerbitanId" TEXT`);
  }
};

export async function GET() {
  const currentUser = await requireCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await ensureTables();

  try {
    const rekod = (await prisma.$queryRawUnsafe(`
      SELECT
        p."id",
        p."perkara",
        p."tajuk",
        CAST(p."semester" AS INTEGER) AS "semester",
        CAST(p."tahun" AS INTEGER) AS "tahun",
        CAST(p."edisi" AS INTEGER) AS "edisi",
        CAST(p."hargaSeunit" AS REAL) AS "hargaSeunit",
        p."catatan",
        CAST(p."aktif" AS INTEGER) AS "aktif",
        p."createdAt",
        CAST(COUNT(DISTINCT t."id") AS INTEGER) AS "jumlahTempahan",
        CAST(COALESCE(p."legacyJumlahUnit", 0) + COALESCE(SUM(CAST(r."kuantiti" AS REAL)), 0) AS REAL) AS "jumlahUnit",
        CAST(COALESCE(p."legacyJumlahHasil", 0) + COALESCE(SUM(CAST(r."kuantiti" AS REAL) * CAST(r."hargaSeunit" AS REAL) + CAST(r."hargaPostage" AS REAL)), 0) AS REAL) AS "jumlahHasil",
        CAST(COALESCE(p."legacyJumlahKV", 0) + COUNT(DISTINCT r."namaKolejVokasional") AS INTEGER) AS "jumlahKV"
      FROM "Penerbitan" p
      LEFT JOIN "TempahanDraft" t ON t."penerbitanId" = p."id"
      LEFT JOIN "ReceiptDraft" r ON r."id" = t."receiptDraftId"
      GROUP BY p."id"
      ORDER BY p."tahun" DESC, p."semester" DESC, p."edisi" DESC
    `)) as Array<Record<string, unknown>>;

    return NextResponse.json({
      rekod: JSON.parse(JSON.stringify(rekod, (_, v) => (typeof v === 'bigint' ? Number(v) : v))),
    });
  } catch (err) {
    console.error('[rekod-jualan GET]', err);
    return NextResponse.json({ error: 'Gagal memuatkan rekod jualan.' }, { status: 500 });
  }
}
