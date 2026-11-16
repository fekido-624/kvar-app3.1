const {test}=require('node:test');
const assert=require('node:assert/strict');
const d=require('../../src/lib/finance/domain.cjs');
const e=require('../../src/lib/finance/expenses.cjs');
const base={kind:'general',date:'2026-11-16',payee:'Kedai Ujian',description:'Ink printer',amount:'100.10',businessPercent:'60',paidBy:'owner',method:'bank',transactionRef:'BANK-001',receiptStatus:'tiada',noReceiptReason:'Penjual tidak mengeluarkan resit',category:'Ink'};
test('owner advance and partial reimbursements never create another expense',()=>{
 const s=d.fresh(),row=d.create(s,'expenses',base);
 assert.equal(e.portion(row),6006);assert.equal(e.outstanding(row),6006);
 const original=e.totals(s);assert.equal(original.operatingCents,6006);assert.equal(original.cashOutCents,0);
 d.mutate(s,'expenses',row.id,{action:'reimburse',date:'2026-11-16',amount:'20',transactionRef:'RB-001'});
 assert.equal(e.outstanding(row),4006);assert.equal(e.totals(s).operatingCents,6006);assert.equal(e.totals(s).cashOutCents,2000);assert.equal(s.expenses.length,1);
 assert.throws(()=>d.mutate(s,'expenses',row.id,{action:'reimburse',date:'2026-11-16',amount:'40.07',transactionRef:'RB-X'}),/melebihi/);
 assert.throws(()=>d.mutate(s,'expenses',row.id,{action:'void',reason:'Salah'}),/bayaran balik dahulu/);
 d.mutate(s,'expenses',row.id,{action:'void-reimbursement',reimbursementId:row.reimbursements[0].id,reason:'Bayaran balik tersalah rekod'});
 assert.equal(e.outstanding(row),6006);assert.equal(e.totals(s).cashOutCents,0);
 d.mutate(s,'expenses',row.id,{action:'void',reason:'Belanja tersalah rekod'});assert.equal(e.totals(s).operatingCents,0);d.validateBackup(s);
});
test('assets are separated from operating costs and archived records remain in totals',()=>{
 const s=d.fresh(),row=d.create(s,'expenses',{...base,kind:'asset',amount:'800',businessPercent:'100',paidBy:'business',assetName:'Printer',model:'Contoh',inUseDate:'2026-11-16'});
 assert.equal(e.totals(s).operatingCents,0);assert.equal(e.totals(s).assetCents,80000);assert.equal(e.totals(s).cashOutCents,80000);
 d.mutate(s,'expenses',row.id,{action:'archive'});assert.equal(e.totals(s).assetCents,80000);
 assert.throws(()=>d.mutate(s,'expenses',row.id,{action:'reimburse',amount:'1',date:'2026-11-16',transactionRef:'x'}));d.validateBackup(s);
});
test('helper decimal quantity times rate rounds exactly to cents',()=>{
 const s=d.fresh();const helper={...base,kind:'helper',amount:'50.00',quantity:'1.5',rate:'33.33',unit:'jam',periodFrom:'2026-11-16',periodTo:'2026-11-16',task:'Packing buku'};
 const row=d.create(s,'expenses',helper);assert.equal(row.amountCents,5000);assert.equal(row.helper.quantityHundredths,150);
 assert.throws(()=>d.create(s,'expenses',{...helper,amount:'49.99'}),/kuantiti/);
 assert.throws(()=>d.create(s,'expenses',{...helper,periodTo:'2026-11-15'}),/Tarikh akhir/);d.validateBackup(s);
});
test('travel purpose, distance, receipt reason, allocation and duplicate invoices are validated',()=>{
 const s=d.fresh(),travel={...base,kind:'travel',from:'Pejabat',to:'KV Contoh',purpose:'Hantar buku',distance:'45.50',costBasis:'Petrol dan parking sebenar'};
 const row=d.create(s,'expenses',travel);assert.equal(row.travel.kmHundredths,4550);d.validateBackup(s);
 assert.throws(()=>d.create(s,'expenses',{...travel,distance:'0'}),/Jarak/);
 assert.throws(()=>d.create(s,'expenses',{...base,noReceiptReason:''}),/Sebab/);
 assert.throws(()=>d.create(s,'expenses',{...base,businessPercent:'100.01'}),/Peratus/);
 const invoice={...base,receiptStatus:'ada',invoiceRef:'INV-001'};d.create(s,'expenses',invoice);
 assert.throws(()=>d.create(s,'expenses',invoice),/sudah direkod/);
  assert.doesNotThrow(()=>d.create(s,'expenses',{...invoice,description:'Baris invois berasingan: kertas',amount:'20'}));
  assert.throws(()=>d.create(s,'expenses',{...base,category:'Peribadi pemilik'}),/0%/);
 const personal=d.create(s,'expenses',{...base,businessPercent:'0'});assert.equal(e.portion(personal),0);assert.equal(e.outstanding(personal),0);
});
test('old schema backups preserve writer data and new backup counters reject over-reimbursement',()=>{
 const old=d.fresh();const writer=d.create(old,'writers',{name:'Penulis asal'});old.schema=1;delete old.expenses;
 const migrated=d.validateBackup(old);assert.equal(migrated.schema,2);assert.deepEqual(migrated.expenses,[]);assert.equal(migrated.writers[0].id,writer.id);
 const row=d.create(migrated,'expenses',base);d.mutate(migrated,'expenses',row.id,{action:'reimburse',date:'2026-11-16',amount:'10',transactionRef:'RB-1'});
 migrated.sequences={};d.validateBackup(migrated);const previous=row.reimbursements[0].reference;
 d.mutate(migrated,'expenses',row.id,{action:'reimburse',date:'2026-11-16',amount:'10',transactionRef:'RB-2'});assert.notEqual(previous,row.reimbursements[1].reference);
 const broken=structuredClone(migrated);broken.expenses[0].reimbursements[0].amountCents=100000;assert.throws(()=>d.validateBackup(broken),/Baki/);
});
