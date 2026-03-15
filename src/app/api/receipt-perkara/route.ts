import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireCurrentUser } from '@/lib/auth';

const CreatePerkaraSchema = z.object({
  label: z.string().min(1, 'Label is required'),
});

export async function GET() {
  const currentUser = await requireCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
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

    const [manualOptions, penerbitanRows] = await Promise.all([
      prisma.receiptPerkaraOption.findMany({ orderBy: { label: 'asc' } }),
      prisma.$queryRawUnsafe(`
        SELECT "id", "perkara", "createdAt"
        FROM "Penerbitan"
        WHERE "aktif" = 1
        ORDER BY "perkara" ASC
      `) as Promise<Array<{ id: string; perkara: string; createdAt: string }>>,
    ]);

    const map = new Map<string, { id: string; label: string; createdAt: string }>();
    for (const option of manualOptions) {
      map.set(option.label, {
        id: option.id,
        label: option.label,
        createdAt: option.createdAt.toISOString(),
      });
    }
    for (const row of penerbitanRows) {
      if (!map.has(row.perkara)) {
        map.set(row.perkara, {
          id: `penerbitan-${row.id}`,
          label: row.perkara,
          createdAt: row.createdAt,
        });
      }
    }

    const options = Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
    return NextResponse.json({ options });
  } catch (error) {
    return NextResponse.json(
      { error: `Failed to load perkara options: ${(error as Error).message}` },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const currentUser = await requireCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const json = await request.json().catch(() => null);
  const parsed = CreatePerkaraSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid data' }, { status: 400 });
  }

  const label = parsed.data.label.trim();
  if (!label) {
    return NextResponse.json({ error: 'Perkara tidak boleh kosong.' }, { status: 400 });
  }

  try {
    const exists = await prisma.receiptPerkaraOption.findUnique({ where: { label } });
    if (exists) {
      return NextResponse.json({ error: 'Perkara sudah ada dalam menu.', option: exists }, { status: 409 });
    }

    const option = await prisma.receiptPerkaraOption.create({
      data: { label },
    });

    return NextResponse.json({ option }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: `Gagal simpan perkara: ${(error as Error).message}` },
      { status: 500 }
    );
  }
}
