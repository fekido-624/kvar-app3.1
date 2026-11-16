'use strict';
const fs=require('node:fs/promises');
const path=require('node:path');
const {randomUUID,createHash}=require('node:crypto');
const domain=require('./domain.cjs');
const expenses=require('./expenses.cjs');
const {documentHtml}=require('./documents.cjs');
const {expenseDocument}=require('./expense-documents.cjs');
const MAX=30*1024*1024,PORT=3000;
const ROOT=path.join(process.cwd(),'data','kewangan-backups');
module.exports=async function dispatch(initial,method,route,rawBody){
 let state=initial,dirty=false;
 async function save(next){state=next;dirty=true;}
 async function change(action){const next=structuredClone(state);const result=await action(next);await save(next);return result;}
 async function enqueue(action){await fs.mkdir(ROOT,{recursive:true});return action();}
 async function body(req) {
  if (!String(req.headers['content-type'] || '').startsWith('application/json')) domain.fail('Permintaan mesti JSON.');
  const parts = []; let size = 0;
  for await (const part of req) { size += part.length; if (size > MAX) { const error = new Error('Fail / permintaan terlalu besar.'); error.status = 413; throw error; } parts.push(part); }
  try { const parsed=JSON.parse(Buffer.concat(parts).toString('utf8')); if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))domain.fail('JSON mesti objek rekod.');return parsed; } catch { domain.fail('JSON tidak sah.'); }
}
function binary(input) {
  if (typeof input !== 'string' || input.length > 7 * 1024 * 1024 || !/^[A-Za-z0-9+/]*={0,2}$/.test(input)) domain.fail('Kandungan lampiran tidak sah.');
  const bytes = Buffer.from(input, 'base64');
  if (!bytes.length || bytes.length > 5 * 1024 * 1024) domain.fail('Lampiran mesti antara 1 bait dan 5 MB.');
  let mime;
  if (bytes.subarray(0, 5).toString() === '%PDF-') mime = 'application/pdf';
  else if (bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) mime = 'image/png';
  else if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) mime = 'image/jpeg';
  else domain.fail('Hanya PDF, PNG dan JPEG dibenarkan.');
  return { bytes, mime, sha256: createHash('sha256').update(bytes).digest('hex') };
}
function view() { return { ...state, expenseTotals: expenses.totals(state), evidence: state.evidence.map(({ data, ...meta }) => meta) }; }
function csvCell(value) { let s = String(value ?? ''); if (/^[=+@\-\t\r]/.test(s)) s = "'" + s; return '"' + s.replace(/"/g, '""') + '"'; }
function respond(res, status, value, type = 'application/json; charset=utf-8', extra = {}) {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...extra });
  res.end(type.startsWith('application/json') && !Buffer.isBuffer(value) ? JSON.stringify(value) : value);
}

 let output;
 const req={method,url:route,headers:{'content-type':'application/json'},async *[Symbol.asyncIterator](){if(rawBody)yield Buffer.from(rawBody);}};
 const res={headersSent:false,writeHead(status,headers){this.status=status;this.headers=headers;this.headersSent=true;},end(value){output={status:this.status,headers:this.headers,body:value};}};
 await (async()=>{
     try {
      const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
      const route = url.pathname;
      if (req.method === 'GET' && route === '/api/state') return respond(res, 200, view());
      if (req.method === 'GET' && route === '/api/backup') return respond(res, 200, state, undefined, { 'Content-Disposition': 'attachment; filename="kvar-kewangan-backup.json"' });
      if (req.method === 'POST' && route === '/api/restore') {
        const input = await body(req);
        const next = domain.validateBackup(input);
        for (const evidence of next.evidence) { const file = binary(evidence.data); if (file.sha256 !== evidence.sha256 || file.mime !== evidence.mime || file.bytes.length !== evidence.size) domain.fail('Lampiran sandaran rosak / tidak sepadan.'); }
        await enqueue(async () => {
          await fs.writeFile(path.join(ROOT, `before-restore-${Date.now()}-${randomUUID()}.json`), JSON.stringify(state));
          await save(next);
        }); return respond(res, 200, { restored: true });
      }
      if (req.method === 'PATCH' && route === '/api/business') {
        const input = await body(req);
        await change(next => { next.business = { name: domain.text(input.name, 'Nama perniagaan', 160), registration: domain.text(input.registration || '', 'Pendaftaran', 100, true), address: domain.text(input.address || '', 'Alamat', 600, true), phone: domain.text(input.phone || '', 'Telefon', 60, true) }; });
        return respond(res, 200, view().business);
      }
      let match = /^\/api\/(writers|projects|claims|payments|expenses)$/.exec(route);
      if (match && req.method === 'POST') { const input = await body(req); const row = await change(next => domain.create(next, match[1], input)); return respond(res, 201, row); }
      match = /^\/api\/(writers|projects|claims|payments|expenses)\/([a-f0-9-]{36})$/.exec(route);
      if (match && req.method === 'PATCH') { const input = await body(req); const row = await change(next => domain.mutate(next, match[1], match[2], input)); return respond(res, 200, row); }
      if (route === '/api/evidence' && req.method === 'POST') {
        const input = await body(req); const file = binary(input.data);
        const row = await change(next => {
          if (!['claims', 'payments','expenses'].includes(input.ownerType)) domain.fail('Pilih rekod untuk lampiran.');
          domain.find(next, input.ownerType, input.ownerId);
          const row = { id: randomUUID(), ownerType: input.ownerType, ownerId: input.ownerId,
            name: domain.text(input.name, 'Nama fail', 180), mime: file.mime, size: file.bytes.length, sha256: file.sha256, data: input.data, createdAt: new Date().toISOString() };
          next.evidence.push(row); const { data, ...meta } = row; return meta;
        }); return respond(res, 201, row);
      }
      match = /^\/api\/evidence\/([a-f0-9-]{36})$/.exec(route);
      if (match && req.method === 'GET') { const evidence = domain.find(state, 'evidence', match[1]); return respond(res, 200, Buffer.from(evidence.data, 'base64'), evidence.mime,
        { 'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(evidence.name)}` }); }
      if (route === '/api/export.csv' && req.method === 'GET') {
        const rows = [['Rujukan baucar', 'Tarikh', 'Penulis', 'Terbitan', 'Tuntutan', 'Amaun RM', 'Cara bayaran', 'Rujukan transaksi', 'Status', 'Sebab batal', 'Bil lampiran'],
          ...state.payments.map(p => [p.reference, p.date, p.claim.writer.name, p.claim.project.title, p.claim.reference,
            (p.amountCents / 100).toFixed(2), p.method, p.transactionRef, p.voidedAt ? 'Dibatalkan' : 'Direkod', p.voidReason, state.evidence.filter(e => e.ownerId === p.id).length])];
        return respond(res, 200, '\ufeff' + rows.map(r => r.map(csvCell).join(',')).join('\r\n'), 'text/csv; charset=utf-8', { 'Content-Disposition': 'attachment; filename="rekod-bayaran-penulis.csv"' });
      }
      if(route==='/api/export-expenses.csv'&&req.method==='GET'){
        const rows=[['Jenis baris','Rujukan','Tarikh','Jenis belanja','Penerima','Butiran','Amaun RM','Bahagian perniagaan RM (bukan potongan cukai)','Peratus bisnes','Dibayar oleh','Tunai akaun bisnes RM','Status','Rujukan invois','Resit','Sebab tiada resit','Baki pemilik RM','Semakan cukai']];
        for(const e of state.expenses){
          rows.push(['Belanja',e.reference,e.date,e.kind,e.payee,e.description,(e.amountCents/100).toFixed(2),(expenses.portion(e)/100).toFixed(2),(e.businessBps/100).toFixed(2),e.paidBy,((e.paidBy==='business'?e.amountCents:0)/100).toFixed(2),e.voidedAt?'Dibatalkan':'Direkod',e.invoiceRef,e.receiptStatus,e.noReceiptReason,(expenses.outstanding(e)/100).toFixed(2),e.taxReview]);
          for(const r of e.reimbursements)rows.push(['Bayaran balik — bukan belanja baharu',r.reference,r.date,e.kind,'Pemilik (bayaran balik)',`${e.reference} / ${r.transactionRef}`,(r.amountCents/100).toFixed(2),'0.00','', 'business',(r.amountCents/100).toFixed(2),r.voidedAt?'Dibatalkan':'Direkod','','','','','Bukan kos baharu']);
        }
        return respond(res,200,'\ufeff'+rows.map(r=>r.map(csvCell).join(',')).join('\r\n'),'text/csv; charset=utf-8',{'Content-Disposition':'attachment; filename="rekod-belanja-aset-perjalanan-upah.csv"'});
      }
      match=/^\/documents\/(expense|no-receipt)\/([a-f0-9-]{36})$/.exec(route);
      if(match&&req.method==='GET')return respond(res,200,expenseDocument(state,match[2],match[1]),'text/html; charset=utf-8');
      match = /^\/documents\/(claim|voucher|ack)\/([a-f0-9-]{36})$/.exec(route);
      if (match && req.method === 'GET') return respond(res, 200, documentHtml(state, match[2], match[1]), 'text/html; charset=utf-8');
      respond(res, 404, { error: 'Halaman tidak dijumpai.' });
    } catch (error) { if (!res.headersSent) respond(res, error.status || 500, { error: error.status ? error.message : 'Ralat pelayan. Cuba semula dan semak log.' }); if (!error.status) console.error(error); }
 })();
 return {...output,state,dirty};
};
