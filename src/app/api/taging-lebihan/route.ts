import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { lebihanTagSchema, tagIdsSchema } from '@/lib/lebihan-tags';

export async function GET(request: Request) {
  if (!await requireCurrentUser()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const params = new URL(request.url).searchParams;
  const status = z.enum(['active', 'archived']).safeParse(params.get('status') ?? 'active');
  if (!status.success) return NextResponse.json({ error: 'Status tidak sah.' }, { status: 400 });
  const q = (params.get('q') ?? '').trim().slice(0, 160);
  const tags = await prisma.lebihanTag.findMany({
    where: { status: status.data, ...(q ? { OR: [
      { noOrder: { contains: q } }, { name: { contains: q } },
      { kv: { contains: q } }, { phone: { contains: q } },
    ] } : {}) },
    orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
  });
  return NextResponse.json({ tags }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: Request) {
  if (!await requireCurrentUser()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const parsed = lebihanTagSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  const tag = await prisma.lebihanTag.create({ data: parsed.data });
  return NextResponse.json({ tag }, { status: 201 });
}

export async function PATCH(request: Request) {
  if (!await requireCurrentUser()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const parsed = z.object({ ids: tagIdsSchema, action: z.enum(['archive', 'restore']) })
    .safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Pilih 1 hingga 200 rekod dan tindakan yang sah.' }, { status: 400 });
  const archived = parsed.data.action === 'archive';
  const result = await prisma.lebihanTag.updateMany({
    where: { id: { in: parsed.data.ids }, status: archived ? 'active' : 'archived' },
    data: { status: archived ? 'archived' : 'active', archivedAt: archived ? new Date() : null },
  });
  return NextResponse.json({ updated: result.count });
}

export async function DELETE(request: Request) {
  if (!await requireCurrentUser()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const parsed = z.object({ ids: tagIdsSchema }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Pilih 1 hingga 200 rekod untuk dipadam.' }, { status: 400 });
  const result = await prisma.lebihanTag.deleteMany({ where: { id: { in: parsed.data.ids } } });
  return NextResponse.json({ deleted: result.count });
}
