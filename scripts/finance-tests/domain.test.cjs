const { test } = require('node:test');
const assert = require('node:assert/strict');
const d = require('../../src/lib/finance/domain.cjs');
function fixture() {
  const s = d.fresh();
  const w = d.create(s, 'writers', { name: 'Penulis Contoh', bank: 'Bank Ujian', account: '1234' });
  const p = d.create(s, 'projects', { writerId: w.id, title: 'Buku Ujian', amount: '100.10', feeType: 'fi', scope: 'Manuskrip lengkap' });
  const c = d.create(s, 'claims', { projectId: p.id, date: '2026-11-16', amount: '100.10', description: 'Manuskrip diterima' });
  return { s,w,p,c };
}
test('currency is exact cents and invalid input is rejected', () => {
  assert.equal(d.money('100.10'), 10010);
  for (const input of ['0','-1','1.001','1e3','Infinity','','1,000.00']) assert.throws(() => d.money(input));
});
test('partial payments, overpayment, void reversal and permanent reference sequence', () => {
  const { s,c } = fixture();
  const first = d.create(s,'payments',{claimId:c.id,date:'2026-11-16',amount:'33.33',method:'bank',transactionRef:'BANK-001'});
  assert.equal(d.remaining(s,c.id),6677);
  assert.throws(()=>d.create(s,'payments',{claimId:c.id,date:'2026-11-16',amount:'66.78',method:'tunai'}),/melebihi/);
  const second = d.create(s,'payments',{claimId:c.id,date:'2026-11-16',amount:'66.77',method:'tunai'});
  assert.equal(d.remaining(s,c.id),0);
  assert.notEqual(first.reference,second.reference);
  assert.throws(()=>d.mutate(s,'payments',first.id,{action:'void',reason:''}));
  d.mutate(s,'payments',first.id,{action:'void',reason:'Transaksi tersalah rekod'});
  assert.equal(d.remaining(s,c.id),3333);
  assert.throws(()=>d.mutate(s,'payments',first.id,{action:'void',reason:'Lagi'}),/sudah/);
  d.validateBackup(s);
});
test('snapshots survive writer profile updates and archived sources cannot create new records', () => {
  const { s,w,p,c } = fixture();
  d.mutate(s,'writers',w.id,{action:'edit',name:'Nama Baharu',bank:'Bank Lain'});
  assert.equal(c.writer.name,'Penulis Contoh');assert.equal(c.writer.bank,'Bank Ujian');
  assert.equal(w.name,'Nama Baharu');
  d.mutate(s,'projects',p.id,{action:'archive'});
  assert.throws(()=>d.create(s,'claims',{projectId:p.id,date:'2026-11-16',amount:'1',description:'Ujian'}),/aktif/);
  d.mutate(s,'projects',p.id,{action:'restore'});
  d.mutate(s,'claims',c.id,{action:'archive'});
  assert.throws(()=>d.create(s,'payments',{claimId:c.id,date:'2026-11-16',amount:'1',method:'tunai'}),/Pulihkan/);
});
test('invalid dates, links and incomplete royalty basis are rejected',()=>{
  const { s,w,p }=fixture();
  assert.throws(()=>d.create(s,'claims',{projectId:p.id,date:'2026-02-31',amount:'10',description:'Ujian'}),/Tarikh/);
  assert.throws(()=>d.create(s,'projects',{writerId:w.id,title:'Ujian',amount:'10',feeType:'royalti',scope:'Ujian',royaltyTerms:''}));
  assert.throws(()=>d.create(s,'payments',{claimId:'missing',date:'2026-11-16',amount:'1',method:'tunai'}));
});
test('restored counters cannot duplicate a document reference',()=>{
  const { s,p,c }=fixture();s.sequences={};d.validateBackup(s);
  const next=d.create(s,'claims',{projectId:p.id,date:'2026-11-16',amount:'1',description:'Ujian'});
  assert.notEqual(next.reference,c.reference);
  const bad=structuredClone(s);bad.claims[1].reference=bad.claims[0].reference;
  assert.throws(()=>d.validateBackup(bad),/berulang/);
});
