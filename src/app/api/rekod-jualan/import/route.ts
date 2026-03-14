import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { prisma } from '@/lib/db';
import { requireCurrentUser } from '@/lib/auth';
import { validateSpreadsheetUpload } from '@/lib/upload-security';
import { buildSebutHargaTitle } from '@/lib/module-text';

const parseNumber = (value: unknown, fallback = 0) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const parsed = Number(String(value ?? '').replace(/[^\d.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : fallback;
};

const parseInteger = (value: unknown, fallback = 0) => {
  const parsed = Math.trunc(parseNumber(value, fallback));
  return Number.isFinite(parsed) ? parsed : fallback;
};

const parseBooleanLike = (value: unknown) => {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (normalized === '0' || normalized === 'false' || normalized === 'tidak' || normalized === 'no') {
    return 0;
  }
  return 1;
};

const parseSemester = (value: unknown) => {
  const normalized = String(value ?? '').trim();
  const match = normalized.match(/(1|2|3)/);
  const parsed = match ? Number(match[1]) : parseInteger(value, 0);
  return parsed >= 1 && parsed <= 3 ? parsed : 0;
};

const ensurePenerbitanTable = async () => {
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

  const columns = (await prisma.$queryRawUnsafe(`PRAGMA table_info("Penerbitan")`)) as Array<{ name: string }>;
  if (!columns.some((c) => c.name === 'legacyJumlahUnit')) {
    await prisma.$executeRawUnsafe(`ALTER TABLE "Penerbitan" ADD COLUMN "legacyJumlahUnit" REAL NOT NULL DEFAULT 0`);
  }
  if (!columns.some((c) => c.name === 'legacyJumlahHasil')) {
    await prisma.$executeRawUnsafe(`ALTER TABLE "Penerbitan" ADD COLUMN "legacyJumlahHasil" REAL NOT NULL DEFAULT 0`);
  }
  if (!columns.some((c) => c.name === 'legacyJumlahKV')) {
    await prisma.$executeRawUnsafe(`ALTER TABLE "Penerbitan" ADD COLUMN "legacyJumlahKV" INTEGER NOT NULL DEFAULT 0`);
  }
};

export async function POST(request: Request) {
  const currentUser = await requireCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (currentUser.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  await ensurePenerbitanTable();

  const formData = await request.formData();
  const file = formData.get('file') as File | null;

  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }

  const validated = await validateSpreadsheetUpload(file);
  if (!validated.ok) {
    return NextResponse.json({ error: validated.error }, { status: validated.status });
  }

  const workbook = XLSX.read(validated.buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as unknown[][];

  if (rawData.length < 2) {
    return NextResponse.json({ error: 'File kosong atau tiada data.' }, { status: 400 });
  }

  const dataRows = rawData.slice(1);
  const seenPerkara = new Set<string>();
  const results = {
    total: dataRows.length,
    success: 0,
    updated: 0,
    failed: 0,
    errors: [] as Array<{ row: number; perkara: string; error: string }>,
  };

  for (let i = 0; i < dataRows.length; i += 1) {
    const row = dataRows[i];
    const rowNumber = i + 2;

    const perkara = String(row[0] ?? '').trim();
    const semester = parseSemester(row[1]);
    const tahun = parseInteger(row[2], 0);
    const hargaSeunit = parseNumber(row[3], 0);
    const unitTerjual = parseNumber(row[4], 0);
    const hasilJualan = parseNumber(row[5], 0);
    const bilKV = parseInteger(row[6], 0);
    const aktif = parseBooleanLike(row[7]);
    const catatan = String(row[8] ?? '').trim();

    if (!perkara) {
      results.failed += 1;
      results.errors.push({ row: rowNumber, perkara: '-', error: 'Perkara wajib diisi.' });
      continue;
    }

    if (seenPerkara.has(perkara)) {
      results.failed += 1;
      results.errors.push({ row: rowNumber, perkara, error: 'Perkara duplicate dalam fail import.' });
      continue;
    }
    seenPerkara.add(perkara);

    if (semester < 1 || semester > 3) {
      results.failed += 1;
      results.errors.push({ row: rowNumber, perkara, error: 'Semester mesti 1, 2, atau 3.' });
      continue;
    }

    if (tahun < 2020 || tahun > 2099) {
      results.failed += 1;
      results.errors.push({ row: rowNumber, perkara, error: 'Kohort/Tahun mesti antara 2020-2099.' });
      continue;
    }

    if (hargaSeunit < 0 || unitTerjual < 0 || hasilJualan < 0 || bilKV < 0) {
      results.failed += 1;
      results.errors.push({ row: rowNumber, perkara, error: 'Nilai nombor tidak boleh negatif.' });
      continue;
    }

    try {
      const existing = (await prisma.$queryRawUnsafe(
        `SELECT "id" FROM "Penerbitan" WHERE "perkara" = ? LIMIT 1`,
        perkara
      )) as Array<{ id: string }>;

      if (existing.length > 0) {
        await prisma.$executeRawUnsafe(
          `
          UPDATE "Penerbitan"
          SET
            "tajuk" = ?,
            "semester" = ?,
            "tahun" = ?,
            "hargaSeunit" = ?,
            "legacyJumlahUnit" = ?,
            "legacyJumlahHasil" = ?,
            "legacyJumlahKV" = ?,
            "catatan" = ?,
            "aktif" = ?,
            "updatedAt" = CURRENT_TIMESTAMP
          WHERE "id" = ?
          `,
          buildSebutHargaTitle(perkara),
          semester,
          tahun,
          hargaSeunit,
          unitTerjual,
          hasilJualan,
          bilKV,
          catatan,
          aktif,
          existing[0].id
        );

        results.updated += 1;
      } else {
        await prisma.$executeRawUnsafe(
          `
          INSERT INTO "Penerbitan"
            ("id", "perkara", "tajuk", "semester", "tahun", "edisi", "hargaSeunit", "legacyJumlahUnit", "legacyJumlahHasil", "legacyJumlahKV", "catatan", "aktif", "createdAt", "updatedAt")
          VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          `,
          randomUUID(),
          perkara,
          buildSebutHargaTitle(perkara),
          semester,
          tahun,
          hargaSeunit,
          unitTerjual,
          hasilJualan,
          bilKV,
          catatan,
          aktif
        );

        results.success += 1;
      }

      await prisma.receiptPerkaraOption.upsert({
        where: { label: perkara },
        update: {},
        create: { label: perkara },
      });
    } catch (error) {
      results.failed += 1;
      results.errors.push({
        row: rowNumber,
        perkara,
        error: (error as Error).message || 'Ralat simpan data.',
      });
    }
  }

  return NextResponse.json({
    message: 'Import selesai',
    results,
  });
}
