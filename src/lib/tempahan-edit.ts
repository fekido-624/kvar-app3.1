import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { tempahanDraftSelect, draftRevision } from './tempahan-draft-query';

const currency = z.number().finite().min(0).max(99999999).refine(n => Math.abs(n * 100 - Math.round(n * 100)) < 0.00001, 'Amaun maksimum dua tempat perpuluhan.');
export const EditTempahanSchema = z.object({
  action: z.literal('edit'), revision: z.string().regex(/^[a-f0-9]{64}$/),
  namaPenerima: z.string().trim().min(1).max(160),
  namaKolejVokasional: z.string().trim().min(1).max(200),
  alamat: z.string().trim().max(1500), poskod: z.string().trim().max(20), noPhone: z.string().trim().max(60),
  penerbitanId: z.string().max(100), perkara: z.string().trim().min(1).max(1000),
  tajuk: z.string().trim().max(300), semester: z.string().trim().max(100),
  tarikh: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(s => !Number.isNaN(Date.parse(s)) && new Date(s).toISOString().slice(0,10) === s),
  kuantiti: z.number().int().min(1).max(1000000), hargaSeunit: currency, hargaPostage: currency,
  bilanganAlamat: z.number().int().min(1).max(10000), bilanganParcel: z.number().int().min(1).max(10000),
}).strict().superRefine((data, ctx) => {
  if (data.hargaPostage > 0) for (const key of ['alamat','poskod','noPhone'] as const) {
    if (!data[key]) ctx.addIssue({ code: 'custom', path: [key], message: 'Maklumat penghantaran diperlukan untuk postage berbayar.' });
  }
});
export class DraftEditError extends Error {
  constructor(message: string, public status: number) { super(message); }
}
export async function editTempahanDraft(id: string, input: z.infer<typeof EditTempahanSchema>) {
  return prisma.$transaction(async tx => {
    const rows = await tx.$queryRawUnsafe<Array<Record<string,unknown>>>(`${tempahanDraftSelect} WHERE t."id" = ? LIMIT 1`, id);
    const row = rows[0];
    if (!row) throw new DraftEditError('Draf tempahan tidak dijumpai.', 404);
    if (row.status !== 'active') throw new DraftEditError('Pulihkan draf arkib sebelum membuat suntingan.', 409);
    if (draftRevision(row) !== input.revision) throw new DraftEditError('Draf telah berubah. Tutup popup dan muat semula senarai sebelum cuba lagi.', 409);
    if (input.penerbitanId !== String(row.penerbitanId ?? '')) {
      if (!input.penerbitanId) throw new DraftEditError('Pilih penerbitan pengganti untuk tempahan ini.', 400);
      const publication = await tx.$queryRawUnsafe<Array<{ id:string; aktif:number }>>('SELECT "id", "aktif" FROM "Penerbitan" WHERE "id" = ?', input.penerbitanId);
      if (!publication[0]?.aktif) throw new DraftEditError('Penerbitan tidak dijumpai atau tidak aktif.', 400);
    }
    await tx.receiptDraft.update({ where: { id: String(row.receiptDraftId) }, data: {
      namaPenerima: input.namaPenerima, namaKolejVokasional: input.namaKolejVokasional,
      perkara: input.perkara, tajuk: input.tajuk, semester: input.semester, tarikh: new Date(input.tarikh),
      kuantiti: input.kuantiti, hargaSeunit: input.hargaSeunit, hargaPostage: input.hargaPostage,
    } });
    let parcelId = String(row.dataParcelDraftId || '');
    if (input.hargaPostage > 0) {
      const data = { namaCustomer: input.namaPenerima, kv: input.namaKolejVokasional, alamat: input.alamat, poskod: input.poskod, noPhone: input.noPhone, bilanganParcel: input.bilanganParcel };
      if (parcelId) {
        await tx.dataParcelDraft.update({ where: { id: parcelId }, data });
      } else {
        parcelId = randomUUID();
        const numeric = Number.parseInt(String(row.noResit).replace(/\D/g, ''), 10);
        const suffix = numeric % 1000;
        const noOrder = Number.isNaN(numeric) ? String(row.noResit).slice(-2).padStart(2,'0') : String(suffix).padStart(suffix >= 100 ? 3 : 2,'0');
        await tx.dataParcelDraft.create({ data: { id: parcelId, ...data, noOrder } });
      }
    } else if (parcelId) {
      // Delivery details remain on TempahanDraft for pickup orders; remove its shipping-only draft.
      await tx.dataParcelDraft.delete({ where: { id: parcelId } });
      parcelId = '';
    }
    await tx.$executeRawUnsafe(`UPDATE "TempahanDraft" SET "dataParcelDraftId" = ?, "bilanganAlamat" = ?, "alamat" = ?, "poskod" = ?, "noPhone" = ?, "penerbitanId" = ?, "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = ?`, parcelId, input.bilanganAlamat, input.alamat, input.poskod, input.noPhone, input.penerbitanId || null, id);
    return { success: true, action: 'edit', noResit: row.noResit };
  });
}
