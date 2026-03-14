import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireCurrentUser } from '@/lib/auth';

type Params = { params: Promise<{ id: string }> };

const UpdatePenerbitanSchema = z.object({
  perkara: z.string().min(1).optional(),
  tajuk: z.string().optional(),
  semester: z.number().int().min(1).max(3).optional(),
  tahun: z.number().int().min(2020).max(2099).optional(),
  edisi: z.number().int().min(1).max(9).optional(),
  hargaSeunit: z.number().min(0).optional(),
  catatan: z.string().optional(),
  aktif: z.boolean().optional(),
});

const ensurePenerbitanTable = async () => {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "Penerbitan" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "perkara" TEXT NOT NULL,
      "tajuk" TEXT NOT NULL DEFAULT '',
      "semester" INTEGER NOT NULL,
      "tahun" INTEGER NOT NULL,
      "edisi" INTEGER NOT NULL DEFAULT 1,
      "hargaSeunit" REAL NOT NULL DEFAULT 0,
      "catatan" TEXT NOT NULL DEFAULT '',
      "aktif" INTEGER NOT NULL DEFAULT 1,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
};

export async function PATCH(request: Request, { params }: Params) {
  const currentUser = await requireCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (currentUser.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  await ensurePenerbitanTable();
  const { id } = await params;

  const json = await request.json().catch(() => null);
  const parsed = UpdatePenerbitanSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid data', details: parsed.error.errors },
      { status: 400 }
    );
  }

  const data = parsed.data;
  const setClauses: string[] = [];
  const values: unknown[] = [];

  if (data.perkara !== undefined) { setClauses.push('"perkara" = ?'); values.push(data.perkara); }
  if (data.tajuk !== undefined) { setClauses.push('"tajuk" = ?'); values.push(data.tajuk); }
  if (data.semester !== undefined) { setClauses.push('"semester" = ?'); values.push(data.semester); }
  if (data.tahun !== undefined) { setClauses.push('"tahun" = ?'); values.push(data.tahun); }
  if (data.edisi !== undefined) { setClauses.push('"edisi" = ?'); values.push(data.edisi); }
  if (data.hargaSeunit !== undefined) { setClauses.push('"hargaSeunit" = ?'); values.push(data.hargaSeunit); }
  if (data.catatan !== undefined) { setClauses.push('"catatan" = ?'); values.push(data.catatan); }
  if (data.aktif !== undefined) { setClauses.push('"aktif" = ?'); values.push(data.aktif ? 1 : 0); }

  if (setClauses.length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  setClauses.push('"updatedAt" = CURRENT_TIMESTAMP');
  values.push(id);

  await prisma.$executeRawUnsafe(
    `UPDATE "Penerbitan" SET ${setClauses.join(', ')} WHERE "id" = ?`,
    ...values
  );

  if (data.perkara !== undefined) {
    await prisma.receiptPerkaraOption.upsert({
      where: { label: data.perkara },
      update: {},
      create: { label: data.perkara },
    });
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(_: Request, { params }: Params) {
  const currentUser = await requireCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (currentUser.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  await ensurePenerbitanTable();
  const { id } = await params;

  await prisma.$executeRawUnsafe(`DELETE FROM "Penerbitan" WHERE "id" = ?`, id);

  return NextResponse.json({ success: true });
}
