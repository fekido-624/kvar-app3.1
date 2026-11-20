import { isAllowedFinanceOrigin } from '@/lib/finance/origin';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { NextRequest } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { financeRequest } from '@/lib/finance/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const MAX_BODY = 30 * 1024 * 1024;
async function handler(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: 'Sila log masuk.' }, { status: 401 });
  if (user.role !== 'admin') return Response.json({ error: 'Kewangan untuk admin sahaja.' }, { status: 403 });
  if (!['GET', 'POST', 'PATCH'].includes(request.method)) return new Response(null, { status: 405 });
  const changing = request.method !== 'GET';
  if (changing) {
    const origin = request.headers.get('origin');
    if (!isAllowedFinanceOrigin(origin, request.nextUrl.origin)) return Response.json({ error: 'Origin tidak dibenarkan.' }, { status: 403 });
    if (!request.headers.get('content-type')?.startsWith('application/json')) return Response.json({ error: 'Permintaan mesti JSON.' }, { status: 415 });
  }
  const { path: segments } = await context.params;
  const route = segments.length === 1 && segments[0] === 'ui' ? '/' : '/' + segments.join('/');
  try {
    // Static UI assets are protected too, but do not load financial records or evidence.
    const assets: Record<string, [string, string]> = { '/': ['index.html','text/html'], '/app.js': ['app.js','application/javascript'], '/expenses.js': ['expenses.js','application/javascript'], '/compact.js': ['compact.js','application/javascript'], '/styles.css': ['styles.css','text/css'], '/print.css': ['print.css','text/css'], '/print.js': ['print.js','application/javascript'] };
    if (request.method === 'GET' && assets[route]) {
      const [file, type] = assets[route];
      return new Response(Uint8Array.from(await readFile(path.join(process.cwd(),'src/lib/finance/ui',file))), { headers: {
        'Content-Type': type+'; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'SAMEORIGIN',
        'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; frame-ancestors 'self'; base-uri 'none'; form-action 'self'"
      } });
    }
    let body = '';
    if (changing && request.body) {
      const reader = request.body.getReader(), chunks: Uint8Array[] = [];
      let size = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > MAX_BODY) { await reader.cancel(); return Response.json({ error: 'Permintaan maksimum 30 MB.' }, { status: 413 }); }
        chunks.push(value);
      }
      body = Buffer.concat(chunks).toString('utf8');
    }
    const result = await financeRequest(user.id, request.method, route, body);
    return new Response(result.body, { status: result.status, headers: { ...result.headers, 'Cache-Control': 'no-store', 'X-Frame-Options': 'SAMEORIGIN', 'Referrer-Policy': 'same-origin' } });
  } catch (error) {
    console.error('[kewangan]', error);
    return Response.json({ error: 'Rekod gagal diproses. Cuba semula.' }, { status: 500 });
  }
}
export { handler as GET, handler as POST, handler as PATCH };
