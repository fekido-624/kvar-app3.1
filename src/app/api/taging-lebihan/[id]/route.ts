import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { requireCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { lebihanTagSchema } from '@/lib/lebihan-tags';

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!await requireCurrentUser()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const parsed = lebihanTagSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  const { id } = await context.params;
  try {
    const tag = await prisma.lebihanTag.update({ where: { id }, data: parsed.data });
    return NextResponse.json({ tag });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return NextResponse.json({ error: 'Rekod tidak dijumpai.' }, { status: 404 });
    }
    throw error;
  }
}
