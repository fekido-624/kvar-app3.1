import { NextResponse } from 'next/server';
import { generateRegistrationOptions } from '@simplewebauthn/server';
import { prisma } from '@/lib/db';
import { requireCurrentUser } from '@/lib/auth';
import {
  RP_NAME,
  ensureWebauthnTable,
  getRpInfo,
  setChallengeCookie,
  stringToTransports,
} from '@/lib/webauthn';

export async function POST(request: Request) {
  const currentUser = await requireCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await ensureWebauthnTable();
  const { rpID } = getRpInfo(request);

  const existing = (await prisma.$queryRawUnsafe(
    `SELECT "credentialId", "transports" FROM "WebauthnCredential" WHERE "userId" = ?`,
    currentUser.id
  )) as Array<{ credentialId: string; transports: string }>;

  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID,
    userName: currentUser.username,
    userDisplayName: `${currentUser.firstName} ${currentUser.lastName}`,
    attestationType: 'none',
    excludeCredentials: existing.map((cred) => ({
      id: cred.credentialId,
      transports: stringToTransports(cred.transports),
    })),
    authenticatorSelection: {
      residentKey: 'required',
      userVerification: 'required',
      authenticatorAttachment: 'platform',
    },
  });

  await setChallengeCookie(options.challenge);

  return NextResponse.json(options);
}
