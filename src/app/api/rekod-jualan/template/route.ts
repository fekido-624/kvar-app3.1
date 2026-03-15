import { NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { requireCurrentUser } from '@/lib/auth';

export async function GET() {
  const currentUser = await requireCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const rows = [
    ['perkara', 'semester', 'kohort', 'hargaSeunit', 'unitTerjual', 'hasilJualan', 'bilKV', 'aktif', 'catatan'],
    [
      'MODUL PRAKTIS BAHASA MELAYU SEMESTER 2 (KOHORT 2024) KOLEJ VOKASIONAL',
      2,
      2024,
      9.0,
      250,
      2250,
      14,
      1,
      'Import rekod lama',
    ],
    [
      'MODUL PRAKTIS BAHASA INGGERIS SEMESTER 1 (KOHORT 2025) KOLEJ VOKASIONAL',
      1,
      2025,
      9.5,
      180,
      1710,
      10,
      1,
      '',
    ],
  ];

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('RekodJualan');
  worksheet.addRows(rows);

  worksheet.columns = [
    { width: 72 },
    { width: 10 },
    { width: 10 },
    { width: 14 },
    { width: 14 },
    { width: 14 },
    { width: 10 },
    { width: 8 },
    { width: 26 },
  ];

  const buffer = await workbook.xlsx.writeBuffer();

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="rekod-jualan-template.xlsx"',
      'Cache-Control': 'no-store',
    },
  });
}
