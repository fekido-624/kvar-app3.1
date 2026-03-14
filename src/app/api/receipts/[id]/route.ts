import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireCurrentUser } from '@/lib/auth';

type Params = {
  params: Promise<{ id: string }>;
};

const PatchDraftSchema = z.object({
  action: z.enum(['archive', 'restore']),
});

const ensureReceiptStatusColumns = async () => {
  const columns = (await prisma.$queryRawUnsafe(`PRAGMA table_info("ReceiptDraft")`)) as Array<{ name: string }>;
  const hasStatus = columns.some((column) => column.name === 'status');
  const hasArchivedAt = columns.some((column) => column.name === 'archivedAt');

  if (!hasStatus) {
    await prisma.$executeRawUnsafe(`ALTER TABLE "ReceiptDraft" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'active'`);
  }

  if (!hasArchivedAt) {
    await prisma.$executeRawUnsafe(`ALTER TABLE "ReceiptDraft" ADD COLUMN "archivedAt" DATETIME`);
  }
};

export async function PATCH(request: Request, { params }: Params) {
  const currentUser = await requireCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await ensureReceiptStatusColumns();
  const { id } = await params;

  const json = await request.json().catch(() => null);
  const parsed = PatchDraftSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid data', details: parsed.error.errors },
      { status: 400 }
    );
  }

  try {
    if (parsed.data.action === 'archive') {
      await prisma.$executeRawUnsafe(
        `
        UPDATE "ReceiptDraft"
        SET "status" = 'archived', "archivedAt" = CURRENT_TIMESTAMP, "updatedAt" = CURRENT_TIMESTAMP
        WHERE "id" = ?
        `,
        id
      );
      return NextResponse.json({ success: true, action: 'archive' });
    }

    await prisma.$executeRawUnsafe(
      `
      UPDATE "ReceiptDraft"
      SET "status" = 'active', "archivedAt" = NULL, "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = ?
      `,
      id
    );
    return NextResponse.json({ success: true, action: 'restore' });
  } catch {
    return NextResponse.json({ error: 'Failed to update receipt draft status' }, { status: 500 });
  }
}

export async function DELETE(_: Request, { params }: Params) {
  const currentUser = await requireCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (currentUser.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;

  try {
    await prisma.receiptDraft.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Failed to delete receipt draft' }, { status: 500 });
  }
}
