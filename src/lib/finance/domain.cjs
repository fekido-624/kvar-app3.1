'use strict';
const { randomUUID } = require('node:crypto');

function fail(message) { const error = new Error(message); error.status = 400; throw error; }
function text(value, label, max = 300, optional = false) {
  if (typeof value !== 'string') fail(`${label} tidak sah.`);
  const result = value.trim();
  if ((!optional && !result) || result.length > max) fail(`${label}: ${optional ? 'maksimum' : 'isi 1 hingga'} ${max} aksara.`);
  return result;
}
function date(value, label, optional = false) {
  if (optional && !value) return '';
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) fail(`${label} tidak sah.`);
  return value;
}
function money(value) {
  const raw = String(value ?? '').trim();
  if (!/^\d{1,8}(\.\d{1,2})?$/.test(raw)) fail('Amaun mesti nombor positif dengan maksimum dua tempat perpuluhan.');
  const [whole, fraction = ''] = raw.split('.');
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  if (!Number.isSafeInteger(cents) || cents <= 0) fail('Amaun mesti melebihi RM0.00.');
  return cents;
}
function find(state, kind, id) {
  const row = state[kind].find(item => item.id === id);
  if (!row) fail('Rekod rujukan tidak dijumpai.');
  return row;
}
function timestamp() { return new Date().toISOString(); }
function fresh() { return { schema: 2, business: { name: 'Izotech Enterprise', registration: '', address: '', phone: '' }, sequences: {}, writers: [], projects: [], claims: [], payments: [], expenses: [], evidence: [] }; }
function reference(state, prefix, when) {
  const key = `${prefix}-${when.slice(0, 4)}`;
  state.sequences[key] = (state.sequences[key] || 0) + 1;
  return `${key}-${String(state.sequences[key]).padStart(4, '0')}`;
}
function remaining(state, claimId) {
  const claim = find(state, 'claims', claimId);
  return claim.amountCents - state.payments.filter(p => p.claimId === claimId && !p.voidedAt).reduce((sum, p) => sum + p.amountCents, 0);
}
function create(state, kind, input) {
  if (kind === 'expenses') return require('./expenses.cjs').create(state,input);
  const common = { id: randomUUID(), createdAt: timestamp(), archived: false };
  let row;
  if (kind === 'writers') {
    row = { ...common, name: text(input.name, 'Nama penulis', 160), phone: text(input.phone || '', 'Telefon', 60, true), email: text(input.email || '', 'E-mel', 160, true), address: text(input.address || '', 'Alamat', 600, true), bank: text(input.bank || '', 'Bank', 100, true), account: text(input.account || '', 'Akaun', 60, true), notes: text(input.notes || '', 'Catatan', 1000, true) };
  } else if (kind === 'projects') {
    const writer = find(state, 'writers', input.writerId);
    if (writer.archived) fail('Pilih penulis aktif.');
    const feeType = ['fi', 'royalti'].includes(input.feeType) ? input.feeType : fail('Jenis bayaran tidak sah.');
    row = { ...common, writerId: writer.id, title: text(input.title, 'Judul buku', 200), edition: text(input.edition || '', 'Edisi', 100, true), feeType, agreedCents: money(input.amount), scope: text(input.scope, 'Skop penulisan', 1500), royaltyTerms: text(input.royaltyTerms || '', 'Asas royalti', 1500, feeType !== 'royalti'), dueDate: date(input.dueDate, 'Tarikh sasaran', true), acceptedDate: date(input.acceptedDate, 'Tarikh penerimaan manuskrip', true), rightsNotes: text(input.rightsNotes || '', 'Nota hak karya', 1500, true) };
  } else if (kind === 'claims') {
    const project = find(state, 'projects', input.projectId);
    const writer = find(state, 'writers', project.writerId);
    if (project.archived || writer.archived) fail('Pilih penulis dan terbitan aktif.');
    const when = date(input.date, 'Tarikh tuntutan');
    row = { ...common, reference: reference(state, 'CL', when), date: when, projectId: project.id, writerId: writer.id,
      amountCents: money(input.amount), description: text(input.description, 'Butiran tuntutan', 1500),
      period: text(input.period || '', 'Peringkat kerja', 200, true), authorReference: text(input.authorReference || '', 'Rujukan penulis', 100, true),
      writer: structuredClone(writer), project: structuredClone(project), business: structuredClone(state.business) };
  } else if (kind === 'payments') {
    const claim = find(state, 'claims', input.claimId);
    if (claim.archived) fail('Pulihkan tuntutan sebelum merekod bayaran baharu.');
    const cents = money(input.amount);
    if (cents > remaining(state, claim.id)) fail('Bayaran melebihi baki tuntutan.');
    const when = date(input.date, 'Tarikh bayaran');
    const method = ['bank', 'tunai', 'ewallet'].includes(input.method) ? input.method : fail('Cara bayaran tidak sah.');
    row = { ...common, reference: reference(state, 'PV', when), date: when, claimId: claim.id, amountCents: cents, method,
      transactionRef: text(input.transactionRef || '', 'Rujukan transaksi', 150, method === 'tunai'),
      notes: text(input.notes || '', 'Catatan bayaran', 1000, true), claim: structuredClone(claim), voidedAt: null, voidReason: '' };
  } else fail('Jenis rekod tidak sah.');
  state[kind].push(row);
  return row;
}
function mutate(state, kind, id, input) {
  if (kind === 'expenses') return require('./expenses.cjs').mutate(state,id,input);
  if (!['writers', 'projects', 'claims', 'payments'].includes(kind)) fail('Jenis rekod tidak sah.');
  const row = find(state, kind, id);
  if (input.action === 'archive' || input.action === 'restore') {
    row.archived = input.action === 'archive'; row.updatedAt = timestamp(); return row;
  }
  if (kind === 'payments' && input.action === 'void') {
    if (row.voidedAt) fail('Bayaran sudah dibatalkan.');
    row.voidReason = text(input.reason, 'Sebab pembatalan', 500); row.voidedAt = timestamp(); return row;
  }
  if (kind === 'writers' && input.action === 'edit') {
    const temporary = fresh(); const updated = create(temporary, 'writers', input);
    Object.assign(row, updated, { id: row.id, createdAt: row.createdAt, archived: row.archived, updatedAt: timestamp() }); return row;
  }
  fail('Tindakan tidak sah.');
}
function validateBackup(state) {
  if (!state || ![1,2].includes(state.schema) || !state.business || typeof state.business!=='object' || Array.isArray(state.business) || !state.sequences || typeof state.sequences!=='object' || Array.isArray(state.sequences)) fail('Format sandaran tidak disokong.');
  if (state.schema === 1) { state.expenses = []; state.schema = 2; }
  text(state.business.name, 'Nama perniagaan', 160);
  const allIds = new Set();
  const references = new Set();
  for (const kind of ['writers', 'projects', 'claims', 'payments', 'expenses', 'evidence']) {
    if (!Array.isArray(state[kind]) || state[kind].length > 10000) fail('Senarai sandaran tidak sah.');
    for (const row of state[kind]) {
      if (!row || !/^[a-f0-9-]{36}$/.test(row.id) || allIds.has(row.id)) fail('ID sandaran tidak sah atau berulang.');
      allIds.add(row.id);
      if (kind === 'expenses') {
        require('./expenses.cjs').validateStored(row);
        for (const r of row.reimbursements) {
          if (!/^[a-f0-9-]{36}$/.test(r.id) || allIds.has(r.id) || !/^RB-\d{4}-\d+$/.test(r.reference) || references.has(r.reference)) fail('Rujukan / ID bayaran balik berulang atau tidak sah.');
          allIds.add(r.id);references.add(r.reference);
        }
      }
      if (typeof row.archived !== 'boolean' && kind !== 'evidence') fail('Status arkib tidak sah.');
      if (kind === 'writers') {
        text(row.name, 'Nama penulis', 160);
        for (const [key,max] of [['phone',60],['email',160],['address',600],['bank',100],['account',60],['notes',1000]]) text(row[key],key,max,true);
      }
      if (kind === 'projects') {
        text(row.title,'Judul',200);text(row.scope,'Skop',1500);
        if (!['fi','royalti'].includes(row.feeType)) fail('Jenis fi tidak sah.');
        text(row.royaltyTerms,'Asas royalti',1500,row.feeType!=='royalti');date(row.dueDate,'Tarikh sasaran',true);date(row.acceptedDate,'Tarikh terima',true);
      }
      if (kind === 'claims') { date(row.date,'Tarikh tuntutan');text(row.description,'Butiran tuntutan',1500); }
      if (kind === 'payments') {
        date(row.date,'Tarikh bayaran');
        if (!['bank','tunai','ewallet'].includes(row.method)) fail('Cara bayaran tidak sah.');
        text(row.transactionRef,'Rujukan transaksi',150,row.method==='tunai');
        if (row.voidedAt) text(row.voidReason,'Sebab pembatalan',500);
      }
      if (kind === 'evidence') { text(row.name,'Nama bukti',180);if(!Number.isSafeInteger(row.size)||row.size<1||row.size>5*1024*1024)fail('Saiz bukti tidak sah.'); }
      if (['projects', 'claims', 'payments'].includes(kind) && (!Number.isSafeInteger(row.amountCents ?? row.agreedCents) || (row.amountCents ?? row.agreedCents) <= 0)) fail('Amaun sandaran tidak sah.');
      if (row.reference) { if (references.has(row.reference)) fail('Rujukan dokumen berulang.'); references.add(row.reference); }
    }
  }
  for (const p of state.projects) find(state, 'writers', p.writerId);
  for (const c of state.claims) { find(state, 'projects', c.projectId); find(state, 'writers', c.writerId); if (!c.writer?.name || !c.project?.title || !c.business?.name) fail('Salinan tuntutan tidak lengkap.'); if (remaining(state, c.id) < 0) fail('Bayaran sandaran melebihi tuntutan.'); }
  for (const p of state.payments) { find(state, 'claims', p.claimId); if (!p.claim?.writer?.name || !p.claim?.business?.name) fail('Salinan baucar tidak lengkap.'); }
  for (const e of state.evidence) { if (!['claims', 'payments','expenses'].includes(e.ownerType)) fail('Rujukan bukti tidak sah.'); find(state, e.ownerType, e.ownerId); }
  for (const [key, value] of Object.entries(state.sequences)) if (!/^(CL|PV|EX|AS|TR|UP|RB)-\d{4}$/.test(key) || !Number.isSafeInteger(value) || value < 0) fail('Turutan sandaran tidak sah.');
  // A restored counter can never reuse an existing document number.
  for (const row of [...state.claims, ...state.payments,...state.expenses,...state.expenses.flatMap(e=>e.reimbursements)]) {
    const match = /^(CL|PV|EX|AS|TR|UP|RB)-(\d{4})-(\d+)$/.exec(row.reference);
    if (!match) fail('Format rujukan dokumen tidak sah.');
    const key = `${match[1]}-${match[2]}`;
    state.sequences[key] = Math.max(state.sequences[key] || 0, Number(match[3]));
  }
  return state;
}
module.exports = { fresh, create, mutate, money, remaining, validateBackup, fail, text, date, find,reference };
