import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireCurrentUser } from '@/lib/auth';

const scoreKV = (keyword: string, item: { kodKV: string }) => {
  const q = keyword.toLowerCase();
  const kod = item.kodKV.toLowerCase();

  if (kod === q) return 0;
  if (kod.startsWith(q)) return 1;
  if (kod.includes(q)) return 2;
  return 3;
};

export async function GET(request: Request) {
  const currentUser = await requireCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q') || '';

  if (q.trim().length === 0) {
    return NextResponse.json({ kvList: [] });
  }

  try {
    const keyword = q.trim();
    const kvList = await prisma.customer.findMany({
      where: {
        kodKV: {
          contains: keyword,
        },
      },
      select: {
        id: true,
        name: true,
        address: true,
        postcode: true,
        phone: true,
        kodKV: true,
      },
      orderBy: { kodKV: 'asc' },
    });

    kvList.sort((a, b) => {
      const scoreDiff = scoreKV(keyword, a) - scoreKV(keyword, b);
      if (scoreDiff !== 0) return scoreDiff;
      return a.kodKV.localeCompare(b.kodKV);
    });

    return NextResponse.json({ kvList });
  } catch (error) {
    return NextResponse.json(
      { error: `Failed to search KV: ${(error as Error).message}` },
      { status: 500 }
    );
  }
}
