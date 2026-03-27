import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireCurrentUser } from '@/lib/auth';

type Params = {
  params: Promise<{ id: string }>;
};

const PatchDraftSchema = z.union([
  z.object({
    action: z.enum(['archive', 'restore']),
  }),
  z.object({
    bilanganParcel: z.number().int().min(1),
  }),
]);

const ensureDataParcelDraftTable = async () => {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "DataParcelDraft" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "namaCustomer" TEXT NOT NULL,
      "alamat" TEXT NOT NULL DEFAULT '',
      "poskod" TEXT NOT NULL DEFAULT '',
      "kv" TEXT NOT NULL,
      "noPhone" TEXT NOT NULL,
      "noOrder" TEXT NOT NULL,
      "bilanganParcel" INTEGER NOT NULL,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "TempahanDraft" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "receiptDraftId" TEXT NOT NULL,
      "dataParcelDraftId" TEXT NOT NULL,
      "bilanganAlamat" INTEGER NOT NULL,
      "status" TEXT NOT NULL DEFAULT 'active',
      "archivedAt" DATETIME,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE("receiptDraftId")
    )
  `);

  const columns = (await prisma.$queryRawUnsafe(`PRAGMA table_info("DataParcelDraft")`)) as Array<{ name: string }>;
  const hasStatus = columns.some((column) => column.name === 'status');
  const hasArchivedAt = columns.some((column) => column.name === 'archivedAt');

  if (!hasStatus) {
    await prisma.$executeRawUnsafe(`ALTER TABLE "DataParcelDraft" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'active'`);
  }

  if (!hasArchivedAt) {
    await prisma.$executeRawUnsafe(`ALTER TABLE "DataParcelDraft" ADD COLUMN "archivedAt" DATETIME`);
  }
};

export async function PATCH(request: Request, { params }: Params) {
  const currentUser = await requireCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await ensureDataParcelDraftTable();
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
    if ('bilanganParcel' in parsed.data) {
      await prisma.$executeRawUnsafe(
        `
        UPDATE "DataParcelDraft"
        SET "bilanganParcel" = ?, "updatedAt" = CURRENT_TIMESTAMP
        WHERE "id" = ?
        `,
        parsed.data.bilanganParcel,
        id
      );
      return NextResponse.json({ success: true, action: 'update_bilanganParcel' });
    }

    if (parsed.data.action === 'archive') {
      await prisma.$executeRawUnsafe(
        `
        UPDATE "DataParcelDraft"
        SET "status" = 'archived', "archivedAt" = CURRENT_TIMESTAMP, "updatedAt" = CURRENT_TIMESTAMP
        WHERE "id" = ?
        `,
        id
      );
      return NextResponse.json({ success: true, action: 'archive' });
    }

    await prisma.$executeRawUnsafe(
      `
      UPDATE "DataParcelDraft"
      SET "status" = 'active', "archivedAt" = NULL, "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = ?
      `,
      id
    );
    return NextResponse.json({ success: true, action: 'restore' });
  } catch {
    return NextResponse.json({ error: 'Failed to update data parcel draft status' }, { status: 500 });
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

  await ensureDataParcelDraftTable();

  const { id } = await params;

  try {
    const links = (await prisma.$queryRawUnsafe(
      `
      SELECT "id", "receiptDraftId"
      FROM "TempahanDraft"
      WHERE "dataParcelDraftId" = ?
      `,
      id
    )) as Array<{ id: string; receiptDraftId: string }>;

    const receiptIds = links
      .map((item) => item.receiptDraftId)
      .filter((value): value is string => Boolean(value));

    if (links.length > 0) {
      await prisma.$executeRawUnsafe(
        `DELETE FROM "TempahanDraft" WHERE "dataParcelDraftId" = ?`,
        id
      );
    }

    if (receiptIds.length > 0) {
      await prisma.receiptDraft.deleteMany({
        where: {
          id: {
            in: receiptIds,
          },
        },
      });
    }

    await prisma.$executeRawUnsafe(
      `DELETE FROM "DataParcelDraft" WHERE "id" = ?`,
      id
    );
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Failed to delete data parcel draft' }, { status: 500 });
  }
}
