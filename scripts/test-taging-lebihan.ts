import 'dotenv/config';
import assert from 'node:assert/strict';
import { inflateSync } from 'node:zlib';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { SignJWT } from 'jose';
import { PDFDocument, PDFArray, PDFName, PDFRawStream } from 'pdf-lib';

// Integration test against a running LOCAL development server. Only its own
// uniquely named fixture records are removed; source/customer data is compared.
const base = process.env.TEST_BASE_URL ?? 'http://127.0.0.1:9002';
if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname)) throw new Error('Local test server required.');
const prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: process.env.DATABASE_URL! }) });
const prefix = `TEST-TAG-${randomUUID()}`;
const createdTagIds: string[] = [];
const receiptIds: string[] = [];
const extraParcelIds: string[] = [];
const orderIds = [prefix + '-pickup', prefix + '-linked', prefix + '-duplicate'];
let customerId = '';
let cookie = '';

async function request(route: string, method = 'GET', body?: unknown, auth = true) {
  return fetch(base + route, {
    method, headers: { 'Content-Type': 'application/json', ...(auth ? { cookie } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
async function json(route: string, method = 'GET', body?: unknown, expected = 200) {
  const response = await request(route, method, body);
  const result = await response.json();
  assert.equal(response.status, expected, JSON.stringify(result));
  return result;
}

async function pdfText(bytes: Uint8Array) {
  const pdf = await PDFDocument.load(bytes);
  const text: string[] = [];
  for (const page of pdf.getPages()) {
    const size = page.getSize();
    assert.ok(Math.abs(size.width - 148 * 72 / 25.4) < 0.01);
    assert.ok(Math.abs(size.height - 105 * 72 / 25.4) < 0.01);
    const contents = page.node.lookup(PDFName.of('Contents'));
    const streams = contents instanceof PDFArray ? contents.asArray().map((ref) => pdf.context.lookup(ref)) : [contents];
    let operators = '';
    for (const stream of streams) {
      assert.ok(stream instanceof PDFRawStream);
      operators += inflateSync(stream.getContents()).toString('latin1');
    }
    text.push([...operators.matchAll(/<([0-9A-Fa-f]+)>\s*Tj/g)].map((match) => Buffer.from(match[1], 'hex').toString('latin1')).join('\n'));
  }
  return text;
}

async function main() {
  const user = await prisma.user.findFirstOrThrow({ where: { role: 'admin' } });
  const token = await new SignJWT({ userId: user.id }).setProtectedHeader({ alg: 'HS256' }).setExpirationTime('10m')
    .sign(new TextEncoder().encode(process.env.AUTH_SECRET!));
  cookie = `accesspilot_session=${token}`;
  const fixture = { noOrder: prefix, name: 'PENERIMA UJIAN', kv: 'KV UJIAN', address: 'No 10, Jalan Contoh, Taman Contoh', postcode: '01000', phone: `60${Date.now()}`, lebihan: 10, naskahGuru: 6, sourceType: 'manual', sourceId: '' };
  for (const [route, method, body] of [
    ['/api/taging-lebihan', 'GET', undefined],
    ['/api/taging-lebihan', 'POST', fixture],
    ['/api/taging-lebihan', 'PATCH', { ids: ['missing'], action: 'archive' }],
    ['/api/taging-lebihan', 'DELETE', { ids: ['missing'] }],
    ['/api/taging-lebihan/missing', 'PUT', fixture],
    ['/api/taging-lebihan/lookup?q=test', 'GET', undefined],
    ['/api/taging-lebihan/pdf', 'POST', { preview: fixture }],
  ] as const) assert.equal((await request(route, method, body, false)).status, 401);
  console.log('Authentication: all tag endpoints reject anonymous access.');

  const customer = await prisma.customer.create({ data: { name: `NAMEONLY-${prefix}`, address: fixture.address, postcode: fixture.postcode, phone: fixture.phone, kodKV: `KVONLY-${prefix}` } });
  customerId = customer.id;
  for (const name of ['PENERIMA SATU', 'PENERIMA DUA']) {
    await prisma.dataParcelDraft.create({ data: { noOrder: prefix, namaCustomer: name, alamat: fixture.address, poskod: fixture.postcode, noPhone: fixture.phone, kv: fixture.kv, bilanganParcel: 1 } });
  }
  const byOrder = await json(`/api/taging-lebihan/lookup?mode=order&q=${prefix}`);
  assert.equal(byOrder.matches.length, 0, 'Parcel numbers alone must not match a Tempahan search.');
  const byCustomer = await json(`/api/taging-lebihan/lookup?mode=customer&q=${prefix}`);
  assert.equal(byCustomer.matches.length, 1);
  assert.equal(byCustomer.matches[0].sourceId, customer.id);
  const byKv = await json(`/api/taging-lebihan/lookup?mode=customer&q=${prefix.slice(5)}`);
  assert.ok(byKv.matches.some((match: { sourceId: string }) => match.sourceId === customer.id));
  for (const term of [customer.name, customer.kodKV]) {
    for (const [endpoint, key] of [['/api/customers/search', 'customers'], ['/api/kv/search', 'kvList']]) {
      const found = await json(`${endpoint}?q=${encodeURIComponent(term)}`);
      assert.ok(found[key].some((match: { id: string }) => match.id === customer.id), `${endpoint} must search both name and KV.`);
      assert.deepEqual((await json(`${endpoint}?q=%20`))[key], []);
      assert.equal((await request(`${endpoint}?q=test`, 'GET', undefined, false)).status, 401);
    }
  }
  assert.equal((await json(`/api/taging-lebihan/lookup?q=${prefix}-missing`)).matches.length, 0);
  console.log('Lookup: parcel-only number ignored, name/KV fallback and no match passed.');

  // Tempahan displays full ReceiptDraft.noResit as No Siri, while the parcel
  // number may be its suffix or absent altogether for collection orders.
  await json('/api/tempahan/drafts');
  const linkedParcel = await prisma.dataParcelDraft.create({ data: { noOrder: '26', namaCustomer: prefix,
    alamat: fixture.address, poskod: fixture.postcode, noPhone: fixture.phone, kv: fixture.kv, bilanganParcel: 1 } });
  extraParcelIds.push(linkedParcel.id);
  const paddedParcel = await prisma.dataParcelDraft.create({ data: { noOrder: '0007', namaCustomer: prefix,
    alamat: fixture.address, poskod: fixture.postcode, noPhone: fixture.phone, kv: fixture.kv, bilanganParcel: 1 } });
  extraParcelIds.push(paddedParcel.id);
  for (const [index, noResit] of ['5025', '5026', '5025'].entries()) {
    const receipt = await prisma.receiptDraft.create({ data: { noResit, namaPenerima: prefix,
      namaKolejVokasional: fixture.kv, perkara: 'Ujian', kuantiti: 100, hargaSeunit: 1,
      hargaPostage: index ? 10 : 0, tarikh: new Date(), semester: prefix } });
    receiptIds.push(receipt.id);
    const parcelId = index === 1 ? linkedParcel.id : '';
    await prisma.$executeRaw`INSERT INTO "TempahanDraft" ("id", "receiptDraftId", "dataParcelDraftId", "bilanganAlamat", "alamat", "poskod", "noPhone", "createdAt", "updatedAt")
      VALUES (${orderIds[index]}, ${receipt.id}, ${parcelId}, 1, ${fixture.address}, ${fixture.postcode}, ${fixture.phone}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`;
  }
  const fullReference = await json('/api/taging-lebihan/lookup?mode=order&q=5025');
  const pickup = fullReference.matches.find((match: { sourceId: string }) => match.sourceId === orderIds[0]);
  assert.equal(fullReference.matches.filter((match: { sourceId: string }) => orderIds.includes(match.sourceId)).length, 2,
    'Duplicate full references must be presented as separate choices.');
  assert.ok(pickup, 'Full No Siri 5025 must find a collection order without parcel data.');
  assert.equal(pickup.noOrder, '5025');
  assert.equal(pickup.address, fixture.address);
  assert.equal(pickup.phone, fixture.phone);
  const savedPickup = await json('/api/taging-lebihan', 'POST', { ...fixture, ...pickup }, 201);
  createdTagIds.push(savedPickup.tag.id);
  await json('/api/taging-lebihan', 'DELETE', { ids: [savedPickup.tag.id] });
  createdTagIds.pop();
  const linkedFull = await json('/api/taging-lebihan/lookup?mode=order&q=5026');
  assert.ok(linkedFull.matches.some((match: { sourceId: string }) => match.sourceId === orderIds[1]));
  const shortReference = await json('/api/taging-lebihan/lookup?mode=order&q=026');
  assert.equal(shortReference.matches.filter((match: { sourceId: string }) =>
    [orderIds[1], linkedParcel.id].includes(match.sourceId)).length, 0, 'Parcel suffix must not match full Tempahan number.');
  const padded = await json('/api/taging-lebihan/lookup?mode=order&q=7');
  assert.ok(!padded.matches.some((match: { sourceId: string }) => match.sourceId === paddedParcel.id));
  const paddedOrder = await json('/api/taging-lebihan/lookup?mode=order&q=05025');
  assert.ok(paddedOrder.matches.some((match: { sourceId: string }) => match.sourceId === orderIds[0]));
  console.log('Lookup regression: full Tempahan 5025, duplicate choices, collection orders and leading zeros passed; parcel suffix excluded.');

  for (const counts of [{ lebihan: 0, naskahGuru: 0 }, { lebihan: -1 }, { naskahGuru: 1.5 }]) {
    await json('/api/taging-lebihan', 'POST', { ...fixture, ...counts }, 400);
  }
  const snapshots = [
    { ...fixture, sourceType: 'customer', sourceId: customer.id },
    { ...fixture, noOrder: prefix + '-guru', lebihan: 0 },
    { ...fixture, noOrder: prefix + '-lebihan', naskahGuru: 0 },
  ];
  for (const snapshot of snapshots) {
    const result = await json('/api/taging-lebihan', 'POST', snapshot, 201);
    createdTagIds.push(result.tag.id);
  }
  await json(`/api/taging-lebihan/${createdTagIds[0]}`, 'PUT', { ...snapshots[0], name: 'NAMA PADA TAG SAHAJA' });
  assert.deepEqual(await prisma.customer.findUnique({ where: { id: customer.id } }), customer);
  assert.equal((await prisma.dataParcelDraft.findMany({ where: { noOrder: prefix } })).length, 2);
  assert.equal((await json(`/api/taging-lebihan?q=${prefix}`)).tags.length, 3);
  console.log('Persistence/validation: invalid quantities rejected; editing tag leaves source intact.');

  const pdfResponse = await request('/api/taging-lebihan/pdf', 'POST', { ids: createdTagIds });
  assert.equal(pdfResponse.status, 200);
  const pages = await pdfText(new Uint8Array(await pdfResponse.arrayBuffer()));
  assert.equal(pages.length, 3);
  assert.ok(pages[0].includes('LEBIHAN: 10'));
  assert.ok(pages[0].includes('NASKHAH GURU: 6'));
  assert.ok(pages[0].includes('NAMA PADA TAG SAHAJA'));
  assert.ok(!pages[1].includes('LEBIHAN:'));
  assert.ok(pages[1].includes('NASKHAH GURU: 6'));
  assert.ok(pages[2].includes('LEBIHAN: 10'));
  assert.ok(!pages[2].includes('NASKHAH GURU:'));
  const previewResponse = await fetch(base + '/api/taging-lebihan/pdf', {
    method: 'POST', headers: { cookie, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ ids: createdTagIds }),
  });
  assert.equal(previewResponse.status, 200);
  const preview = await previewResponse.json();
  assert.equal(preview.pages.length, 3);
  const referenceLine = preview.pages[0].lines.find((line: { text: string }) => line.text.startsWith('NO. TEMPAHAN:'));
  const recipientLine = preview.pages[0].lines.find((line: { text: string }) => line.text === 'NAMA PADA TAG SAHAJA');
  assert.ok(referenceLine.bold && referenceLine.size > recipientLine.size, 'Order number is larger and bold.');
  assert.ok(!pages.some((text) => /: \d+ NASKAH/.test(text)), 'Quantities have no trailing unit.');
  assert.deepEqual(await pdfText(Buffer.from(preview.pdf, 'base64')), pages);
  assert.ok(preview.pages[1].lines.every((line: { y: number }) => line.y < preview.pages[1].height / 2));
  assert.ok(preview.pages[2].lines.every((line: { y: number }) => line.y > preview.pages[2].height / 2));
  assert.ok(preview.pages[0].frame.length > 8, 'Teacher label has a patterned frame.');
  assert.ok(preview.pages[1].frame.length > 8, 'Teacher-only label keeps its frame.');
  assert.equal(preview.pages[2].frame.length, 0, 'No teacher quantity means no frame in the blank slot.');
  assert.ok(preview.pages[0].frame.every((line: { y1: number; y2: number }) =>
    line.y1 < preview.pages[0].height / 2 && line.y2 < preview.pages[0].height / 2), 'Frame stays entirely in teacher half.');
  assert.equal((await request('/api/taging-lebihan/pdf', 'POST', { ids: ['missing'] })).status, 404);
  await json('/api/taging-lebihan/pdf', 'POST', { preview: { ...fixture, name: 'N'.repeat(160), kv: 'K'.repeat(160), address: 'A'.repeat(600) } }, 400);
  const longResponse = await request('/api/taging-lebihan/pdf', 'POST', { preview: { ...fixture, address: 'BLOK PENTADBIRAN, KOLEJ VOKASIONAL CONTOH, JALAN PENDIDIKAN, TAMAN ILMU, DAERAH CONTOH' } });
  assert.equal(longResponse.status, 200);
  assert.equal((await pdfText(new Uint8Array(await longResponse.arrayBuffer()))).length, 1);
  console.log('PDF: exact A6 landscape, 3 pages, correct quantities, zero labels omitted, long address and overflow checks passed.');

  await json('/api/taging-lebihan', 'PATCH', { ids: createdTagIds, action: 'archive' });
  assert.equal((await json(`/api/taging-lebihan?q=${prefix}`)).tags.length, 0);
  assert.equal((await json(`/api/taging-lebihan?status=archived&q=${prefix}`)).tags.length, 3);
  await json('/api/taging-lebihan', 'PATCH', { ids: createdTagIds, action: 'restore' });
  assert.equal((await json(`/api/taging-lebihan?q=${prefix}`)).tags.length, 3);
  await json('/api/taging-lebihan', 'DELETE', { ids: createdTagIds });
  assert.equal((await json(`/api/taging-lebihan?q=${prefix}`)).tags.length, 0);
  console.log('Lifecycle: archive, search archive, restore and permanent delete passed.');
}

main().finally(async () => {
  await prisma.lebihanTag.deleteMany({ where: { id: { in: createdTagIds } } });
  for (const id of orderIds) await prisma.$executeRaw`DELETE FROM "TempahanDraft" WHERE "id" = ${id}`;
  await prisma.receiptDraft.deleteMany({ where: { id: { in: receiptIds } } });
  await prisma.dataParcelDraft.deleteMany({ where: { id: { in: extraParcelIds } } });
  await prisma.dataParcelDraft.deleteMany({ where: { noOrder: prefix } });
  if (customerId) await prisma.customer.deleteMany({ where: { id: customerId } });
  await prisma.$disconnect();
}).catch((error) => { console.error(error); process.exitCode = 1; });
