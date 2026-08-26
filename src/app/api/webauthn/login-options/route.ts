import { NextResponse } from 'next/server';
import { generateAuthenticationOptions } from '@simplewebauthn/server';
import { ensureWebauthnTable, getRpInfo, setChallengeCookie } from '@/lib/webauthn';

export async function POST(request: Request) {
  await ensureWebauthnTable();
  const { rpID } = getRpInfo(request);

  const options = await generateAuthenticationOptions({
    rpID,
    userVerification: 'required',
  });

  await setChallengeCookie(options.challenge);

  return NextResponse.json(options);
}
