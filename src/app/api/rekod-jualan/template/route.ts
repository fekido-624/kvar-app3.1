import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
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

  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  worksheet['!cols'] = [
    { wch: 72 },
    { wch: 10 },
    { wch: 10 },
    { wch: 14 },
    { wch: 14 },
    { wch: 14 },
    { wch: 10 },
    { wch: 8 },
    { wch: 26 },
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'RekodJualan');
  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="rekod-jualan-template.xlsx"',
      'Cache-Control': 'no-store',
    },
  });
}
