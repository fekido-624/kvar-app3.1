import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import domain from './domain.cjs';
import dispatch from './engine.cjs';

const collections = ['writers', 'projects', 'claims', 'payments', 'expenses'] as const;
// Versioned payloads retain immutable writer/project/business snapshots from the tested domain.
type State = { schema: number; business: Record<string,string>; sequences: Record<string,number>; writers: any[]; projects: any[]; claims: any[]; payments: any[]; expenses: any[]; evidence: any[] };
async function readState(tx: Prisma.TransactionClient): Promise<State> {
  const state: State = domain.fresh();
  const config = await tx.financeConfig.findUnique({ where: { id: 'main' } });
  if (config) Object.assign(state, JSON.parse(config.payload));
  for (const row of await tx.financeRecord.findMany({ orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] })) {
    if (collections.includes(row.kind as typeof collections[number])) (state[row.kind as typeof collections[number]] as unknown[]).push(JSON.parse(row.payload));
  }
  state.evidence = (await tx.financeAttachment.findMany({ orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] })).map(file => ({ ...JSON.parse(file.metadata), data: Buffer.from(file.data).toString('base64') }));
  return state;
}
async function writeState(tx: Prisma.TransactionClient, state: State, previous: State) {
  await tx.financeConfig.upsert({ where: { id: 'main' }, create: { id: 'main', payload: JSON.stringify({ schema: state.schema, business: state.business, sequences: state.sequences }) }, update: { payload: JSON.stringify({ schema: state.schema, business: state.business, sequences: state.sequences }) } });
  const ids: string[] = [];
  const oldRows = new Map(collections.flatMap(kind => previous[kind].map(row => [row.id, JSON.stringify(row)] as const)));
  for (const kind of collections) for (const value of state[kind] as Array<{id: string; createdAt: string}>) {
    ids.push(value.id);
    if (oldRows.get(value.id) === JSON.stringify(value)) continue;
    await tx.financeRecord.upsert({ where: { id: value.id }, create: { id: value.id, kind, payload: JSON.stringify(value), createdAt: new Date(value.createdAt) }, update: { kind, payload: JSON.stringify(value) } });
  }
  const removed = [...oldRows.keys()].filter(id => !ids.includes(id));
  if (removed.length) await tx.financeRecord.deleteMany({ where: { id: { in: removed } } });
  const attachments: string[] = [];
  for (const file of state.evidence as Array<{id: string; data: string; createdAt: string}>) {
    const { data, ...metadata } = file;
    attachments.push(file.id);
    if (previous.evidence.some(old => old.id === file.id && JSON.stringify(old) === JSON.stringify(file))) continue;
    await tx.financeAttachment.upsert({ where: { id: file.id }, create: { id: file.id, metadata: JSON.stringify(metadata), data: Buffer.from(data, 'base64'), createdAt: new Date(file.createdAt) }, update: { metadata: JSON.stringify(metadata), data: Buffer.from(data, 'base64') } });
  }
  const removedFiles = previous.evidence.filter(file => !attachments.includes(file.id)).map(file => file.id);
  if (removedFiles.length) await tx.financeAttachment.deleteMany({ where: { id: { in: removedFiles } } });
}

// One SQLite transaction covers balance validation, reference allocation and persistence.
// Requests always reload committed state; there is no process-local financial cache.
export async function financeRequest(actorId: string, method: string, route: string, body: string) {
  return prisma.$transaction(async tx => {
    const state = await readState(tx);
    const result = await dispatch(state, method, route, body);
    if (result.dirty && result.status < 400) {
      await writeState(tx, result.state, state);
      await tx.financeAudit.create({ data: { actorId, operation: `${method} ${route}` } });
    }
    return { status: result.status, headers: result.headers, body: result.body };
  }, { maxWait: 15000, timeout: 30000 });
}
