import { PDFDocument, PDFFont, StandardFonts, rgb } from 'pdf-lib';
import type { LebihanTagInput, TagPreviewPage } from '@/lib/lebihan-tags';

const mm = (value: number) => value * 72 / 25.4;
const width = mm(148);
const height = mm(105);
const margin = mm(5);

function printable(text: string): string {
  return text.replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim();
}

// Split even a single long word, so it cannot run outside the label.
function wrap(text: string, font: PDFFont, size: number, available: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of printable(text).split(' ')) {
    if (!word) continue;
    if (font.widthOfTextAtSize(line ? `${line} ${word}` : word, size) <= available) {
      line = line ? `${line} ${word}` : word;
      continue;
    }
    if (line) lines.push(line);
    line = '';
    for (const character of word) {
      if (line && font.widthOfTextAtSize(line + character, size) > available) {
        lines.push(line);
        line = '';
      }
      line += character;
    }
  }
  if (line) lines.push(line);
  return lines;
}

export async function createLebihanTagDocument(tags: Omit<LebihanTagInput, 'sourceType' | 'sourceId'>[]) {
  const pdf = await PDFDocument.create();
  const pages: TagPreviewPage[] = [];
  pdf.setTitle('Taging Lebihan');
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  for (const tag of tags) {
    const page = pdf.addPage([width, height]);
    const preview: TagPreviewPage = { width, height, margin, lines: [] };
    pages.push(preview);
    page.drawLine({
      start: { x: margin, y: height / 2 }, end: { x: width - margin, y: height / 2 },
      color: rgb(0.6, 0.6, 0.6), thickness: 0.5, dashArray: [3, 3],
    });
    const slots = [
      { quantity: tag.lebihan, title: 'LEBIHAN', bottom: height / 2 },
      { quantity: tag.naskahGuru, title: 'NASKAH GURU', bottom: 0 },
    ];
    for (const slot of slots) {
      if (slot.quantity === 0) continue;
      const available = width - margin * 2;
      const content = [
        { text: `NO. TEMPAHAN: ${tag.noOrder}`, font: regular },
        { text: tag.name, font: bold },
        { text: tag.kv, font: bold },
        { text: `${tag.address}, ${tag.postcode}`, font: regular },
        { text: `TEL: ${tag.phone}`, font: regular },
      ];
      let size = 12;
      let lines: { text: string; font: PDFFont }[] = [];
      try {
        for (; size >= 9; size -= 0.5) {
          lines = content.flatMap((item) => wrap(item.text, item.font, size, available)
            .map((text) => ({ text, font: item.font })));
          if (lines.length * size * 1.18 <= height / 2 - margin * 2 - 23) break;
        }
      } catch {
        throw new Error(`No Order ${tag.noOrder}: terdapat aksara yang tidak disokong dalam PDF. Semak teks penerima.`);
      }
      if (size < 9) {
        throw new Error(`No Order ${tag.noOrder}: teks terlalu panjang untuk separuh A6. Ringkaskan maklumat tag sebelum cetak.`);
      }
      let y = slot.bottom + height / 2 - margin - size;
      for (const line of lines) {
        page.drawText(line.text, { x: margin, y, size, font: line.font });
        preview.lines.push({ text: line.text, x: margin, y, size, bold: line.font === bold });
        y -= size * 1.18;
      }
      const title = `${slot.title}: ${slot.quantity} NASKAH`;
      const titleSize = 16;
      page.drawText(title, {
        x: (width - bold.widthOfTextAtSize(title, titleSize)) / 2,
        y: slot.bottom + margin, size: titleSize, font: bold,
      });
      preview.lines.push({ text: title, x: (width - bold.widthOfTextAtSize(title, titleSize)) / 2,
        y: slot.bottom + margin, size: titleSize, bold: true });
    }
  }
  return { bytes: await pdf.save(), pages };
}
