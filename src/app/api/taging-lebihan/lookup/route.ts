import { NextResponse } from 'next/server';
import { requireCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { normalizeOrderReference } from '@/lib/order-reference';

export async function GET(request: Request) {
  if (!await requireCurrentUser()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const params = new URL(request.url).searchParams;
  const q = (params.get('q') ?? '').trim().slice(0, 160);
  const mode = params.get('mode') ?? 'order';
  if (!['order', 'customer'].includes(mode)) return NextResponse.json({ error: 'Carian tidak sah.' }, { status: 400 });
  if (!q) return NextResponse.json({ matches: [] });
  if (mode === 'order') {
    const reference = normalizeOrderReference(q);
    // Tempahan is a legacy runtime table, so a fresh DB may not have it yet.
    // This lookup remains read-only and never creates or alters source tables.
    const tables = await prisma.$queryRaw<{ name: string }[]>`SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'TempahanDraft'`;
    type Order = { id: string; parcelId: string; noResit: string; noOrder: string | null;
      name: string; kv: string; address: string; postcode: string; phone: string; semester: string };
    const orders = tables.length ? await prisma.$queryRaw<Order[]>`
      SELECT t."id", t."dataParcelDraftId" AS "parcelId", r."noResit", p."noOrder",
        r."namaPenerima" AS "name", r."namaKolejVokasional" AS "kv", r."semester",
        COALESCE(NULLIF(TRIM(p."alamat"), ''), t."alamat", '') AS "address",
        COALESCE(NULLIF(TRIM(p."poskod"), ''), t."poskod", '') AS "postcode",
        COALESCE(NULLIF(TRIM(p."noPhone"), ''), t."noPhone", '') AS "phone"
      FROM "TempahanDraft" t
      INNER JOIN "ReceiptDraft" r ON r."id" = t."receiptDraftId"
      LEFT JOIN "DataParcelDraft" p ON p."id" = t."dataParcelDraftId"
      ORDER BY t."createdAt" DESC, t."id" ASC
    ` : [];
    const matches = orders.filter((order) => normalizeOrderReference(order.noResit) === reference)
      .map((order) => ({
        sourceType: 'tempahan', sourceId: order.id,
        // Keep the existing storage key for compatibility; its value is now
        // exclusively the full number displayed as No Siri in Tempahan.
        noOrder: order.noResit,
        name: order.name, kv: order.kv, address: order.address, postcode: order.postcode, phone: order.phone,
        noResit: order.noResit, semester: order.semester,
      }));
    return NextResponse.json({ matches: matches.slice(0, 50), truncated: matches.length > 50 });
  }
  const customers = await prisma.customer.findMany({
    where: { OR: [{ name: { contains: q } }, { kodKV: { contains: q } }] },
    orderBy: [{ name: 'asc' }, { id: 'asc' }],
    take: 51,
  });
  return NextResponse.json({
    matches: customers.slice(0, 50).map((c) => ({
      sourceType: 'customer', sourceId: c.id, noOrder: '',
      name: c.name, kv: c.kodKV, address: c.address, postcode: c.postcode, phone: c.phone,
    })),
    truncated: customers.length > 50,
  });
}
