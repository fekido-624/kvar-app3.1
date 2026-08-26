import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireCurrentUser } from '@/lib/auth';
import { ensureWebauthnTable } from '@/lib/webauthn';

type Params = { params: Promise<{ id: string }> };

export async function DELETE(_: Request, { params }: Params) {
  const currentUser = await requireCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await ensureWebauthnTable();
  const { id } = await params;

  await prisma.$executeRawUnsafe(
    `DELETE FROM "WebauthnCredential" WHERE "id" = ? AND "userId" = ?`,
    id,
    currentUser.id
  );

  return NextResponse.json({ success: true });
}
