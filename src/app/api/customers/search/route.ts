import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireCurrentUser } from '@/lib/auth';

const scoreCustomer = (keyword: string, item: { name: string; kodKV: string }) => {
  const q = keyword.toLowerCase();
  const name = item.name.toLowerCase();
  const kod = item.kodKV.toLowerCase();

  if (name === q) return 0;
  if (name.startsWith(q)) return 1;
  if (name.includes(q)) return 2;
  if (kod.startsWith(q)) return 3;
  if (kod.includes(q)) return 4;
  return 5;
};

export async function GET(request: Request) {
  const currentUser = await requireCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q') || '';

  if (q.trim().length === 0) {
    return NextResponse.json({ customers: [] });
  }

  try {
    const keyword = q.trim();
    const customers = await prisma.customer.findMany({
      where: {
        name: {
          contains: keyword,
        },
      },
      select: {
        id: true,
        name: true,
        kodKV: true,
        address: true,
        postcode: true,
        phone: true,
      },
      orderBy: { name: 'asc' },
    });

    customers.sort((a, b) => {
      const scoreDiff = scoreCustomer(keyword, a) - scoreCustomer(keyword, b);
      if (scoreDiff !== 0) return scoreDiff;
      return a.name.localeCompare(b.name);
    });

    return NextResponse.json({ customers });
  } catch (error) {
    return NextResponse.json(
      { error: `Failed to search customers: ${(error as Error).message}` },
      { status: 500 }
    );
  }
}
