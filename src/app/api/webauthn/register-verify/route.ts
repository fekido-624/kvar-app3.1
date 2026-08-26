import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { verifyRegistrationResponse } from '@simplewebauthn/server';
import type { RegistrationResponseJSON } from '@simplewebauthn/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireCurrentUser } from '@/lib/auth';
import {
  ensureWebauthnTable,
  getAndClearChallengeCookie,
  getRpInfo,
  publicKeyToBase64url,
  transportsToString,
} from '@/lib/webauthn';

const VerifySchema = z.object({
  response: z.custom<RegistrationResponseJSON>(),
  name: z.string().trim().min(1).max(60).optional(),
});

export async function POST(request: Request) {
  const currentUser = await requireCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await ensureWebauthnTable();

  const json = await request.json().catch(() => null);
  const parsed = VerifySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid data' }, { status: 400 });
  }

  const expectedChallenge = await getAndClearChallengeCookie();
  if (!expectedChallenge) {
    return NextResponse.json({ error: 'Sesi pendaftaran tamat tempoh. Cuba semula.' }, { status: 400 });
  }

  const { rpID, origin } = getRpInfo(request);

  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response: parsed.data.response,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
    });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message || 'Pendaftaran fingerprint gagal disahkan.' },
      { status: 400 }
    );
  }

  if (!verification.verified || !verification.registrationInfo) {
    return NextResponse.json({ error: 'Pendaftaran fingerprint tidak sah.' }, { status: 400 });
  }

  const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;

  await prisma.$executeRawUnsafe(
    `
    INSERT INTO "WebauthnCredential"
      ("id","userId","credentialId","publicKey","counter","deviceType","backedUp","transports","name","createdAt")
    VALUES (?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP)
    `,
    randomUUID(),
    currentUser.id,
    credential.id,
    publicKeyToBase64url(credential.publicKey),
    credential.counter,
    credentialDeviceType,
    credentialBackedUp ? 1 : 0,
    transportsToString(credential.transports),
    parsed.data.name?.trim() || 'Peranti tanpa nama'
  );

  return NextResponse.json({ success: true });
}
