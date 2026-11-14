import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { lebihanTagSchema, tagIdsSchema } from '@/lib/lebihan-tags';
import { createLebihanTagDocument } from '@/lib/lebihan-tag-pdf';

export const runtime = 'nodejs';

const schema = z.union([
  z.object({ ids: tagIdsSchema }),
  z.object({ preview: lebihanTagSchema }),
]);

export async function POST(request: Request) {
  if (!await requireCurrentUser()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Semak maklumat penerima dan kuantiti, atau pilih 1 hingga 200 rekod.' }, { status: 400 });
  let tags;
  if ('preview' in parsed.data) {
    tags = [parsed.data.preview];
  } else {
    const { ids } = parsed.data;
    const records = await prisma.lebihanTag.findMany({ where: { id: { in: ids } } });
    if (records.length !== ids.length) return NextResponse.json({ error: 'Ada rekod tidak dijumpai. Muat semula senarai.' }, { status: 404 });
    tags = ids.map((id) => records.find((record) => record.id === id)!);
  }
  try {
    const document = await createLebihanTagDocument(tags);
    if (request.headers.get('accept')?.includes('application/json')) {
      return NextResponse.json({ pdf: Buffer.from(document.bytes).toString('base64'), pages: document.pages },
        { headers: { 'Cache-Control': 'no-store' } });
    }
    return new NextResponse(new Uint8Array(document.bytes), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline; filename="taging-lebihan-a6.pdf"',
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'PDF gagal dijana.' }, { status: 400 });
  }
}
