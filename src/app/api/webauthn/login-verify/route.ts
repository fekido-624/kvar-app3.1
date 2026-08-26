import { NextResponse } from 'next/server';
import { verifyAuthenticationResponse } from '@simplewebauthn/server';
import type { AuthenticationResponseJSON } from '@simplewebauthn/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { createSession, toSafeUser } from '@/lib/auth';
import {
  base64urlToUint8Array,
  ensureWebauthnTable,
  getAndClearChallengeCookie,
  getRpInfo,
  stringToTransports,
} from '@/lib/webauthn';

const VerifySchema = z.object({
  response: z.custom<AuthenticationResponseJSON>(),
});

export async function POST(request: Request) {
  await ensureWebauthnTable();

  const json = await request.json().catch(() => null);
  const parsed = VerifySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid data' }, { status: 400 });
  }

  const expectedChallenge = await getAndClearChallengeCookie();
  if (!expectedChallenge) {
    return NextResponse.json({ error: 'Sesi log masuk tamat tempoh. Cuba semula.' }, { status: 400 });
  }

  const credentialId = parsed.data.response.id;
  const stored = (await prisma.$queryRawUnsafe(
    `SELECT * FROM "WebauthnCredential" WHERE "credentialId" = ? LIMIT 1`,
    credentialId
  )) as Array<{
    id: string;
    userId: string;
    credentialId: string;
    publicKey: string;
    counter: number;
    transports: string;
  }>;

  if (stored.length === 0) {
    return NextResponse.json({ error: 'Fingerprint ini tidak didaftarkan.' }, { status: 401 });
  }

  const credentialRow = stored[0];
  const user = await prisma.user.findUnique({ where: { id: credentialRow.userId } });
  if (!user) {
    return NextResponse.json({ error: 'Akaun tidak dijumpai.' }, { status: 401 });
  }

  const { rpID, origin } = getRpInfo(request);

  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response: parsed.data.response,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential: {
        id: credentialRow.credentialId,
        publicKey: base64urlToUint8Array(credentialRow.publicKey),
        counter: credentialRow.counter,
        transports: stringToTransports(credentialRow.transports),
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message || 'Log masuk fingerprint gagal disahkan.' },
      { status: 400 }
    );
  }

  if (!verification.verified) {
    return NextResponse.json({ error: 'Log masuk fingerprint tidak sah.' }, { status: 401 });
  }

  await prisma.$executeRawUnsafe(
    `UPDATE "WebauthnCredential" SET "counter" = ?, "lastUsedAt" = CURRENT_TIMESTAMP WHERE "id" = ?`,
    verification.authenticationInfo.newCounter,
    credentialRow.id
  );

  await createSession(user.id);

  return NextResponse.json({ user: toSafeUser(user) });
}
