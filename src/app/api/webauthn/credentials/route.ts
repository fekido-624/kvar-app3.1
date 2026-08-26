import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireCurrentUser } from '@/lib/auth';
import { ensureWebauthnTable } from '@/lib/webauthn';

export async function GET() {
  const currentUser = await requireCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await ensureWebauthnTable();

  const credentials = (await prisma.$queryRawUnsafe(
    `SELECT "id", "name", "deviceType", "createdAt", "lastUsedAt" FROM "WebauthnCredential" WHERE "userId" = ? ORDER BY "createdAt" DESC`,
    currentUser.id
  )) as Array<Record<string, unknown>>;

  return NextResponse.json({ credentials });
}
