import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { prisma } from '@/lib/db';
import { requireCurrentUser } from '@/lib/auth';
import { validateSpreadsheetUpload } from '@/lib/upload-security';

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

    // Parse Excel file
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // Convert to JSON (skip header row)
    const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

    if (rawData.length < 2) {
      return NextResponse.json(
        { error: 'File is empty or has no data rows' },
        { status: 400 }
      );
    }

    // Skip header row (index 0), process data rows
    const dataRows = rawData.slice(1);

    const results = {
      total: dataRows.length,
      success: 0,
      failed: 0,
      errors: [] as Array<{ row: number; kodKV: string; error: string }>,
    };

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      const rowNumber = i + 2; // +2 because: +1 for header, +1 for 1-based index

      // Excel columns: A=Name, B=Address, C=Postcode, D=Phone, E=KodKV
      const name = row[0]?.toString().trim() || '';
      const address = row[1]?.toString().trim() || '';
      const postcode = row[2]?.toString().trim() || '';
      const phone = row[3]?.toString().trim() || '';
      const kodKV = row[4]?.toString().trim() || '';

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

      const existingPhone = await prisma.customer.findFirst({
        where: { phone },
        select: { id: true },
      });

      if (existingPhone) {
        results.failed++;
        results.errors.push({
          row: rowNumber,
          kodKV,
          error: 'No Phone telah diguna',
        });
        continue;
      }

      try {
        // Create customer
        await prisma.customer.create({
          data: {
            name,
            address,
            postcode,
            phone,
            kodKV,
          },
        });

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
