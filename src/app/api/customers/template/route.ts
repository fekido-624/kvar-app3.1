import { NextResponse } from 'next/server';
import ExcelJS from 'exceljs';

export async function GET() {
  // Create sample data
  const sampleData = [
    ['Name', 'Address', 'Postcode', 'No.phone', 'Kod KV'],
    ['Ahmad Bin Ali', 'No 123, Jalan Mawar, Taman Indah', '50000', '012-3456789', 'KV001'],
    ['Siti Fatimah', 'No 456, Jalan Kenanga, Taman Bahagia', '51000', '013-9876543', 'KV002'],
    ['Kumar A/L Raju', 'No 789, Jalan Melati, Taman Sejahtera', '52000', '014-1234567', 'KV003'],
  ];

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Customers');
  worksheet.addRows(sampleData);

  worksheet.columns = [
    { width: 20 }, // Name
    { width: 40 }, // Address
    { width: 10 }, // Postcode
    { width: 15 }, // Phone
    { width: 10 }, // Kod KV
  ];

  const buffer = await workbook.xlsx.writeBuffer();

  // Return as downloadable file
  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="customer_template.xlsx"',
    },
  });
}
