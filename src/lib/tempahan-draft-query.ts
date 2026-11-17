import { createHash } from 'node:crypto';
import { prisma } from '@/lib/db';

export const tempahanDraftSelect = `
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
`;

export function draftRevision(row: Record<string, unknown>) {
  const keys = ['id','receiptDraftId','dataParcelDraftId','bilanganAlamat','penerbitanId','status','noResit','namaPenerima','namaKolejVokasional','tajuk','perkara','kuantiti','hargaSeunit','hargaPostage','tarikh','semester','alamat','poskod','noPhone','noOrder','bilanganParcel'];
  return createHash('sha256').update(JSON.stringify(keys.map(key => String(row[key] ?? '')))).digest('hex');
}

export const ensureTempahanTables = async () => {
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
