import { tempahanDraftSelect, draftRevision, ensureTempahanTables as ensureSupportTables } from '@/lib/tempahan-draft-query';
import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireCurrentUser } from '@/lib/auth';

const CreateTempahanDraftSchema = z.object({
  receiptDraftId: z.string().min(1),
  dataParcelDraftId: z.string().optional().default(''),
  bilanganAlamat: z.number().int().min(1),
  alamat: z.string().optional().default(''),
  poskod: z.string().optional().default(''),
  noPhone: z.string().optional().default(''),
  penerbitanId: z.string().optional(),
});

const TempahanStatusSchema = z.enum(['active', 'archived']);

const PatchTempahanDraftSchema = z.object({
  action: z.enum(['archive_all', 'restore_all']),
});

export async function GET(request: Request) {
  const currentUser = await requireCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await ensureSupportTables();

  const { searchParams } = new URL(request.url);
  const parsedStatus = TempahanStatusSchema.safeParse(searchParams.get('status') ?? 'active');
  const status = parsedStatus.success ? parsedStatus.data : 'active';

  const drafts = (await prisma.$queryRawUnsafe(`
    ${tempahanDraftSelect}
    WHERE t."status" = ?
    ORDER BY t."createdAt" DESC
  `, status)) as Array<Record<string, unknown>>;

  return NextResponse.json({ drafts: drafts.map(row => ({ ...row, revision: draftRevision(row) })) });
}

export async function POST(request: Request) {
  const currentUser = await requireCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await ensureSupportTables();

  const json = await request.json().catch(() => null);
  const parsed = CreateTempahanDraftSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid data', details: parsed.error.errors },
      { status: 400 }
    );
  }

  const data = parsed.data;
  const id = randomUUID();

  try {
    await prisma.$executeRawUnsafe(
      `
      INSERT INTO "TempahanDraft" (
        "id",
        "receiptDraftId",
        "dataParcelDraftId",
        "bilanganAlamat",
        "alamat",
        "poskod",
        "noPhone",
        "penerbitanId",
        "status",
        "archivedAt",
        "createdAt",
        "updatedAt"
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `,
      id,
      data.receiptDraftId,
      data.dataParcelDraftId,
      data.bilanganAlamat,
      data.alamat,
      data.poskod,
      data.noPhone,
      data.penerbitanId ?? null
    );

    return NextResponse.json({ id }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message || 'Unable to save tempahan draft.' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  const currentUser = await requireCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await ensureSupportTables();

  const json = await request.json().catch(() => null);
  const parsed = PatchTempahanDraftSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid data', details: parsed.error.errors },
      { status: 400 }
    );
  }

  const { action } = parsed.data;

  try {
    if (action === 'archive_all') {
      await prisma.$executeRawUnsafe(`
        UPDATE "TempahanDraft"
        SET "status" = 'archived', "archivedAt" = CURRENT_TIMESTAMP, "updatedAt" = CURRENT_TIMESTAMP
        WHERE "status" = 'active'
      `);
      return NextResponse.json({ success: true, action });
    }

    await prisma.$executeRawUnsafe(`
      UPDATE "TempahanDraft"
      SET "status" = 'active', "archivedAt" = NULL, "updatedAt" = CURRENT_TIMESTAMP
      WHERE "status" = 'archived'
    `);
    return NextResponse.json({ success: true, action });
  } catch {
    return NextResponse.json({ error: 'Unable to update tempahan draft status.' }, { status: 500 });
  }
}

export async function DELETE() {
  const currentUser = await requireCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await ensureSupportTables();

  const links = (await prisma.$queryRawUnsafe(`
    SELECT "receiptDraftId", "dataParcelDraftId"
    FROM "TempahanDraft"
  `)) as Array<{ receiptDraftId: string; dataParcelDraftId: string }>;

  const receiptIds = links.map((item) => item.receiptDraftId).filter(Boolean);
  const parcelIds = links.map((item) => item.dataParcelDraftId).filter(Boolean);

  try {
    await prisma.$executeRawUnsafe(`DELETE FROM "TempahanDraft"`);

    if (receiptIds.length > 0) {
      await prisma.receiptDraft.deleteMany({
        where: { id: { in: receiptIds } },
      });
    }

    for (const id of parcelIds) {
      await prisma.$executeRawUnsafe(`DELETE FROM "DataParcelDraft" WHERE "id" = ?`, id);
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Unable to clear tempahan drafts.' }, { status: 500 });
  }
}
