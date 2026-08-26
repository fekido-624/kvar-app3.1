import { cookies } from 'next/headers';
import { prisma } from '@/lib/db';

const CHALLENGE_COOKIE = 'webauthn_challenge';
const CHALLENGE_MAX_AGE_SECONDS = 5 * 60;

export const RP_NAME = 'KVar3.1';

export const ensureWebauthnTable = async () => {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "WebauthnCredential" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "userId" TEXT NOT NULL,
      "credentialId" TEXT NOT NULL UNIQUE,
      "publicKey" TEXT NOT NULL,
      "counter" INTEGER NOT NULL DEFAULT 0,
      "deviceType" TEXT NOT NULL DEFAULT 'singleDevice',
      "backedUp" INTEGER NOT NULL DEFAULT 0,
      "transports" TEXT NOT NULL DEFAULT '',
      "name" TEXT NOT NULL DEFAULT '',
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "lastUsedAt" DATETIME
    )
  `);
};

export const getRpInfo = (request: Request) => {
  const origin = request.headers.get('origin') ?? '';
  const hostHeader = request.headers.get('host') ?? '';
  let rpID = hostHeader.split(':')[0];

  if (origin) {
    try {
      rpID = new URL(origin).hostname;
    } catch {
      // fall back to host header
    }
  }

  return { rpID, origin };
};

export const setChallengeCookie = async (challenge: string) => {
  const cookieStore = await cookies();
  cookieStore.set(CHALLENGE_COOKIE, challenge, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: CHALLENGE_MAX_AGE_SECONDS,
  });
};

export const getAndClearChallengeCookie = async () => {
  const cookieStore = await cookies();
  const challenge = cookieStore.get(CHALLENGE_COOKIE)?.value ?? null;
  cookieStore.delete(CHALLENGE_COOKIE);
  return challenge;
};

export const publicKeyToBase64url = (publicKey: Uint8Array) =>
  Buffer.from(publicKey).toString('base64url');

export const base64urlToUint8Array = (value: string) => new Uint8Array(Buffer.from(value, 'base64url'));

export const transportsToString = (transports?: readonly string[]) =>
  transports && transports.length > 0 ? transports.join(',') : '';

export const stringToTransports = (value: string) =>
  value ? (value.split(',').filter(Boolean) as AuthenticatorTransportLite[]) : undefined;

export type AuthenticatorTransportLite = 'ble' | 'cable' | 'hybrid' | 'internal' | 'nfc' | 'smart-card' | 'usb';
