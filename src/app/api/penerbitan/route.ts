import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireCurrentUser } from '@/lib/auth';

const CreatePenerbitanSchema = z.object({
  perkara: z.string().min(1),
  tajuk: z.string().default(''),
  semester: z.number().int().min(1).max(3),
  tahun: z.number().int().min(2020).max(2099),
  edisi: z.number().int().min(1).max(9).default(1),
  hargaSeunit: z.number().min(0).default(0),
  catatan: z.string().default(''),
  aktif: z.boolean().default(true),
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

export async function GET() {
  const currentUser = await requireCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await ensurePenerbitanTable();

  const rows = (await prisma.$queryRawUnsafe(`
    SELECT * FROM "Penerbitan"
    ORDER BY "tahun" DESC, "semester" DESC, "edisi" DESC
  `)) as Array<Record<string, unknown>>;

  const penerbitan = JSON.parse(JSON.stringify(rows, (_, v) => (typeof v === 'bigint' ? Number(v) : v)));
  return NextResponse.json({ penerbitan });
}

export async function POST(request: Request) {
  const currentUser = await requireCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (currentUser.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  await ensurePenerbitanTable();

  const json = await request.json().catch(() => null);
  const parsed = CreatePenerbitanSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid data', details: parsed.error.errors },
      { status: 400 }
    );
  }

  const data = parsed.data;
  const id = randomUUID();

  await prisma.$executeRawUnsafe(
    `
    INSERT INTO "Penerbitan"
      ("id","perkara","tajuk","semester","tahun","edisi","hargaSeunit","catatan","aktif","createdAt","updatedAt")
    VALUES (?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
    `,
    id,
    data.perkara,
    data.tajuk,
    data.semester,
    data.tahun,
    data.edisi,
    data.hargaSeunit,
    data.catatan,
    data.aktif ? 1 : 0
  );

  await prisma.receiptPerkaraOption.upsert({
    where: { label: data.perkara },
    update: {},
    create: { label: data.perkara },
  });

  return NextResponse.json({ id }, { status: 201 });
}
