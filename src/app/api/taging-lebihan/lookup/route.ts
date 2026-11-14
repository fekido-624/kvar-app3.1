import { NextResponse } from 'next/server';
import { requireCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET(request: Request) {
  if (!await requireCurrentUser()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const params = new URL(request.url).searchParams;
  const q = (params.get('q') ?? '').trim().slice(0, 160);
  const mode = params.get('mode') ?? 'order';
  if (!['order', 'customer'].includes(mode)) return NextResponse.json({ error: 'Carian tidak sah.' }, { status: 400 });
  if (!q) return NextResponse.json({ matches: [] });
  if (mode === 'order') {
    // No Order belongs to Data Parcel. Read it directly without changing order data.
    const parcels = await prisma.dataParcelDraft.findMany({
      where: { noOrder: { equals: q } },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      take: 51,
    });
    return NextResponse.json({
      matches: parcels.slice(0, 50).map((p) => ({
        sourceType: 'parcel', sourceId: p.id, noOrder: p.noOrder,
        name: p.namaCustomer, kv: p.kv, address: p.alamat,
        postcode: p.poskod, phone: p.noPhone,
      })),
      truncated: parcels.length > 50,
    });
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
