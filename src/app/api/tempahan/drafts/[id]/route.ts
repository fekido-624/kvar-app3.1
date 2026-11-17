import { ensureTempahanTables as ensureSupportTables } from '@/lib/tempahan-draft-query';
import { EditTempahanSchema, editTempahanDraft, DraftEditError } from '@/lib/tempahan-edit';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireCurrentUser } from '@/lib/auth';

type Params = {
  params: Promise<{ id: string }>;
};

const PatchDraftSchema = z.union([
  EditTempahanSchema,
  z.object({
    action: z.enum(['archive', 'restore']),
  }).strict(),
  z.object({
    bilanganParcel: z.number().int().min(1),
  }).strict(),
]);

export async function PATCH(request: Request, { params }: Params) {
  const currentUser = await requireCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await ensureSupportTables();
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
    if ('action' in parsed.data && parsed.data.action === 'edit') return NextResponse.json(await editTempahanDraft(id, parsed.data));
    if ('bilanganParcel' in parsed.data) {
      const rows = (await prisma.$queryRawUnsafe(
        `
        SELECT "dataParcelDraftId"
        FROM "TempahanDraft"
        WHERE "id" = ?
        LIMIT 1
        `,
        id
      )) as Array<{ dataParcelDraftId: string }>;

      if (rows.length === 0) {
        return NextResponse.json({ error: 'Draft not found.' }, { status: 404 });
      }

      if (!rows[0].dataParcelDraftId) {
        return NextResponse.json(
          { error: 'Draft ini tiada rekod Data Parcel kerana harga penghantaran ialah 0.' },
          { status: 400 }
        );
      }

      await prisma.$executeRawUnsafe(
        `
        UPDATE "DataParcelDraft"
        SET "bilanganParcel" = ?, "updatedAt" = CURRENT_TIMESTAMP
        WHERE "id" = ?
        `,
        parsed.data.bilanganParcel,
        rows[0].dataParcelDraftId
      );

      return NextResponse.json({ success: true, action: 'update_bilanganParcel' });
    }

    const { action } = parsed.data;

    if (action === 'archive') {
      await prisma.$executeRawUnsafe(
        `
        UPDATE "TempahanDraft"
        SET "status" = 'archived', "archivedAt" = CURRENT_TIMESTAMP, "updatedAt" = CURRENT_TIMESTAMP
        WHERE "id" = ?
        `,
        id
      );
      await prisma.$executeRawUnsafe(
        `
        UPDATE "ReceiptDraft"
        SET "status" = 'archived', "archivedAt" = CURRENT_TIMESTAMP, "updatedAt" = CURRENT_TIMESTAMP
        WHERE "id" = (SELECT "receiptDraftId" FROM "TempahanDraft" WHERE "id" = ?)
        `,
        id
      );
      return NextResponse.json({ success: true, action });
    }

    await prisma.$executeRawUnsafe(
      `
      UPDATE "TempahanDraft"
      SET "status" = 'active', "archivedAt" = NULL, "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = ?
      `,
      id
    );
    await prisma.$executeRawUnsafe(
      `
      UPDATE "ReceiptDraft"
      SET "status" = 'active', "archivedAt" = NULL, "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = (SELECT "receiptDraftId" FROM "TempahanDraft" WHERE "id" = ?)
      `,
      id
    );
    return NextResponse.json({ success: true, action });
  } catch (error) {
    if (error instanceof DraftEditError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: 'action' in parsed.data && parsed.data.action === 'edit' ? 'Gagal menyimpan suntingan tempahan. Tiada perubahan disimpan.' : 'Failed to update tempahan draft status.' }, { status: 500 });
  }
}

export async function DELETE(_: Request, { params }: Params) {
  const currentUser = await requireCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await ensureSupportTables();
  const { id } = await params;

  const rows = (await prisma.$queryRawUnsafe(
    `
    SELECT "receiptDraftId", "dataParcelDraftId"
    FROM "TempahanDraft"
    WHERE "id" = ?
    LIMIT 1
    `,
    id
  )) as Array<{ receiptDraftId: string; dataParcelDraftId: string }>;

  if (rows.length === 0) {
    return NextResponse.json({ error: 'Draft not found.' }, { status: 404 });
  }

  const link = rows[0];

  try {
    await prisma.$executeRawUnsafe(`DELETE FROM "TempahanDraft" WHERE "id" = ?`, id);
    await prisma.receiptDraft.deleteMany({ where: { id: link.receiptDraftId } });
    if (link.dataParcelDraftId) {
      await prisma.$executeRawUnsafe(`DELETE FROM "DataParcelDraft" WHERE "id" = ?`, link.dataParcelDraftId);
    }
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Failed to delete tempahan draft.' }, { status: 500 });
  }
}
