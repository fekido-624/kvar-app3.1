import { NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { prisma } from '@/lib/db';
import { requireCurrentUser } from '@/lib/auth';
import { validateSpreadsheetUpload } from '@/lib/upload-security';

function normalizeCell(value: unknown): string {
  return value?.toString().trim() || '';
}

function normalizeHeader(value: unknown): string {
  return normalizeCell(value).toLowerCase().replace(/\s+/g, ' ');
}

function findHeaderIndex(headers: string[], aliases: string[]): number {
  for (const alias of aliases) {
    const idx = headers.findIndex((header) => header === alias || header.includes(alias));
    if (idx !== -1) return idx;
  }
  return -1;
}

export async function POST(request: Request) {
  const currentUser = await requireCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (currentUser.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const validated = await validateSpreadsheetUpload(file);
    if (!validated.ok) {
      return NextResponse.json({ error: validated.error }, { status: validated.status });
    }

    const { buffer } = validated;

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as any);
    const worksheet = workbook.worksheets[0];

    if (!worksheet) {
      return NextResponse.json({ error: 'No worksheet found in file' }, { status: 400 });
    }

    const rawData: unknown[][] = [];
    worksheet.eachRow({ includeEmpty: true }, (row) => {
      rawData.push((row.values as unknown[]).slice(1));
    });

    if (rawData.length < 2) {
      return NextResponse.json(
        { error: 'File is empty or has no data rows' },
        { status: 400 }
      );
    }

    const headerRow = (rawData[0] || []).map((cell) => normalizeHeader(cell));

    const detectedIndexes = {
      name: findHeaderIndex(headerRow, ['name', 'nama']),
      address: findHeaderIndex(headerRow, ['address', 'alamat']),
      postcode: findHeaderIndex(headerRow, ['postcode', 'post code', 'poskod']),
      phone: findHeaderIndex(headerRow, ['no.phone', 'no phone', 'no. telefon', 'no telefon', 'telefon', 'phone']),
      kodKV: findHeaderIndex(headerRow, ['kod kv', 'kodkv']),
    };

    const hasHeaderMapping = Object.values(detectedIndexes).every((index) => index >= 0);

    // Skip header row (index 0), process data rows
    const dataRows = rawData.slice(1);

    const results = {
      total: dataRows.length,
      success: 0,
      created: 0,
      updated: 0,
      failed: 0,
      errors: [] as Array<{ row: number; kodKV: string; error: string }>,
    };

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      const rowNumber = i + 2; // +2 because: +1 for header, +1 for 1-based index

      // Support both formats:
      // 1) A=Name, B=Address, C=Postcode, D=Phone, E=KodKV
      // 2) A=No/Bil, B=Name, C=Address, D=Postcode, E=Phone, F=KodKV
      const rowHasLeadingNoColumn =
        normalizeHeader(rawData[0]?.[0]).includes('no') ||
        normalizeHeader(rawData[0]?.[0]).includes('bil');
      const fallbackOffset = rowHasLeadingNoColumn ? 1 : 0;

      const name = hasHeaderMapping
        ? normalizeCell(row[detectedIndexes.name])
        : normalizeCell(row[0 + fallbackOffset]);
      const address = hasHeaderMapping
        ? normalizeCell(row[detectedIndexes.address])
        : normalizeCell(row[1 + fallbackOffset]);
      const postcode = hasHeaderMapping
        ? normalizeCell(row[detectedIndexes.postcode])
        : normalizeCell(row[2 + fallbackOffset]);
      const phone = hasHeaderMapping
        ? normalizeCell(row[detectedIndexes.phone])
        : normalizeCell(row[3 + fallbackOffset]);
      const kodKV = hasHeaderMapping
        ? normalizeCell(row[detectedIndexes.kodKV])
        : normalizeCell(row[4 + fallbackOffset]);

      // Validate required fields
      if (!name || !address || !postcode || !phone || !kodKV) {
        results.failed++;
        results.errors.push({
          row: rowNumber,
          kodKV: kodKV || 'N/A',
          error: 'Missing required fields',
        });
        continue;
      }

      try {
        const existingPhone = await prisma.customer.findFirst({
          where: { phone },
          select: { id: true },
        });

        if (existingPhone) {
          // If phone exists, override customer details from imported row.
          await prisma.customer.update({
            where: { id: existingPhone.id },
            data: {
              name,
              address,
              postcode,
              kodKV,
            },
          });
          results.updated++;
        } else {
          await prisma.customer.create({
            data: {
              name,
              address,
              postcode,
              phone,
              kodKV,
            },
          });
          results.created++;
        }

        results.success++;
      } catch (error: any) {
        results.failed++;
        results.errors.push({
          row: rowNumber,
          kodKV,
          error: error.message || 'Database error',
        });
      }
    }

    return NextResponse.json({
      message: 'Import completed',
      results,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to process file' },
      { status: 500 }
    );
  }
}
