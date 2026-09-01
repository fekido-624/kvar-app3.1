import { NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { prisma } from '@/lib/db';
import { requireCurrentUser } from '@/lib/auth';

export async function GET() {
  const currentUser = await requireCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const customers = await prisma.customer.findMany({
    orderBy: { createdAt: 'desc' },
  });

  const rows = customers.map((customer) => ({
    ID: customer.id,
    Name: customer.name,
    Address: customer.address,
    Postcode: customer.postcode,
    Phone: customer.phone,
    'Kod KV': customer.kodKV,
  }));

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Customers');

  worksheet.columns = [
    { header: 'ID', key: 'ID', width: 28 },
    { header: 'Name', key: 'Name', width: 28 },
    { header: 'Address', key: 'Address', width: 45 },
    { header: 'Postcode', key: 'Postcode', width: 12 },
    { header: 'Phone', key: 'Phone', width: 18 },
    { header: 'Kod KV', key: 'Kod KV', width: 14 },
  ];

  rows.forEach((row) => {
    const addedRow = worksheet.addRow(row);
    // Force Phone column (column 5) as text to prevent Excel from truncating
    addedRow.getCell(5).numFmt = '@';
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const fileName = `customers-export-${Date.now()}.xlsx`;

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Cache-Control': 'no-store',
    },
  });
}