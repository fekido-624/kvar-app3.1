import { NextResponse } from 'next/server';
import path from 'node:path';
import fs from 'node:fs/promises';
import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import { prisma } from '@/lib/db';
import { requireCurrentUser } from '@/lib/auth';

export const runtime = 'nodejs';

const formatDate = (isoDate: string) => {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return isoDate;
  return date.toLocaleDateString('ms-MY');
};

const sanitizeFileNamePart = (value: string) =>
  value
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '');

const buildReceiptFileBaseName = (noResit: string, namaKolejVokasional: string, fileType: 'Resit' | 'SebatHarga') => {
  const cleanNoResit = sanitizeFileNamePart(noResit) || '0000';
  const cleanNamaKv = sanitizeFileNamePart(namaKolejVokasional) || 'KV';
  return `${cleanNoResit}-${fileType}-${cleanNamaKv}`;
};

const fillDraftIntoTemplate = async (templateBuffer: Uint8Array, draft: {
  noResit: string;
  noSeriSebatHarga: string;
  namaPenerima: string;
  namaKolejVokasional: string;
  tajuk: string;
  perkara: string;
  kuantiti: number;
  hargaSeunit: number;
  hargaPostage: number;
  tarikh: Date;
}, fileType: 'Resit' | 'SebatHarga', b13Value: string) => {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(Buffer.from(templateBuffer) as any);

  // Always use the first worksheet in uploaded template.
  const sheet = workbook.worksheets[0];
  if (!sheet) {
    throw new Error('Template workbook has no worksheet.');
  }

  const total = draft.kuantiti * draft.hargaSeunit + draft.hargaPostage;

  // Fixed mapping agreed with user.
  // M9: noResit for Resit file, noSeriSebatHarga for Sebat Harga file
  const m9Value = fileType === 'Resit' ? draft.noResit : draft.noSeriSebatHarga;
  sheet.getCell('M9').value = m9Value;
  sheet.getCell('B9').value = draft.namaPenerima;
  sheet.getCell('B10').value = draft.namaKolejVokasional;
  sheet.getCell('B13').value = b13Value;
  sheet.getCell('B21').value = draft.perkara;
  sheet.getCell('H21').value = draft.kuantiti;
  sheet.getCell('J21').value = draft.hargaSeunit;
  sheet.getCell('M21').value = draft.kuantiti * draft.hargaSeunit;
  sheet.getCell('M26').value = draft.hargaPostage;
  sheet.getCell('M33').value = total;
  sheet.getCell('M10').value = formatDate(draft.tarikh.toISOString());

  return workbook.xlsx.writeBuffer();
};

export async function GET() {
  const currentUser = await requireCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const templatesDir = path.join(process.cwd(), 'templates');
  const defaultTemplatePath = path.join(templatesDir, 'resit-template.xlsx');
  let templatePath = defaultTemplatePath;

  try {
    await fs.access(defaultTemplatePath);
  } catch {
    const files = await fs.readdir(templatesDir).catch(() => []);
    const firstXlsx = files.find((file) => file.toLowerCase().endsWith('.xlsx'));
    if (!firstXlsx) {
      return NextResponse.json(
        { error: 'Template not found. Put your file in templates/ (example: resit-template.xlsx).' },
        { status: 404 }
      );
    }
    templatePath = path.join(templatesDir, firstXlsx);
  }

  const drafts = await prisma.receiptDraft.findMany({
    orderBy: { createdAt: 'asc' },
  });

  if (drafts.length === 0) {
    return NextResponse.json({ error: 'No receipt drafts to export.' }, { status: 400 });
  }

  const templateBuffer = await fs.readFile(templatePath);

  // Always generate 2 files per draft: Resit and Sebat Harga
  const zip = new JSZip();

  for (let i = 0; i < drafts.length; i++) {
    // Generate Resit file (B13 = perkara, M9 = noResit)
    const resitBuffer = await fillDraftIntoTemplate(templateBuffer, drafts[i], 'Resit', drafts[i].perkara);
    const resitName = `${buildReceiptFileBaseName(drafts[i].noResit, drafts[i].namaKolejVokasional, 'Resit')}.xlsx`;
    zip.file(resitName, resitBuffer as ArrayBuffer);

    // Generate Sebat Harga file (B13 = tajuk, M9 = noSeriSebatHarga)
    const sebatHargaBuffer = await fillDraftIntoTemplate(templateBuffer, drafts[i], 'SebatHarga', drafts[i].tajuk);
    const sebatHargaName = `${buildReceiptFileBaseName(drafts[i].noSeriSebatHarga, drafts[i].namaKolejVokasional, 'SebatHarga')}.xlsx`;
    zip.file(sebatHargaName, sebatHargaBuffer as ArrayBuffer);
  }

  const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
  const zipName = `resit-export-${Date.now()}.zip`;

  return new NextResponse(new Uint8Array(zipBuffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${zipName}"`,
      'Content-Length': zipBuffer.byteLength.toString(),
      'Cache-Control': 'no-store',
    },
  });
}
