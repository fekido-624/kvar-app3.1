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
    Name: customer.name,
    Address: customer.address,
    Postcode: customer.postcode,
    Phone: customer.phone,
    'Kod KV': customer.kodKV,
  }));

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Customers');

  worksheet.columns = [
    { header: 'Name', key: 'Name', width: 28 },
    { header: 'Address', key: 'Address', width: 45 },
    { header: 'Postcode', key: 'Postcode', width: 12 },
    { header: 'Phone', key: 'Phone', width: 18 },
    { header: 'Kod KV', key: 'Kod KV', width: 14 },
  ];

  rows.forEach((row) => {
    worksheet.addRow(row);
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