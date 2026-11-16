'use strict';
const { randomUUID } = require('node:crypto');
const KINDS = ['general','asset','travel','helper'];
function services() { return require('./domain.cjs'); }
function scaled(value,label,max=1000000) {
  const raw=String(value??'').trim();
  if(!/^\d{1,7}(\.\d{1,2})?$/.test(raw))services().fail(`${label} mesti nombor dengan maksimum dua perpuluhan.`);
  const [whole,fraction='']=raw.split('.');const number=Number(whole)*100+Number(fraction.padEnd(2,'0'));
  if(number>max*100)services().fail(`${label} terlalu besar.`);return number;
}
const portion = e => Number((BigInt(e.amountCents)*BigInt(e.businessBps)+5000n)/10000n);
const reimbursed = e => e.reimbursements.filter(r=>!r.voidedAt).reduce((sum,r)=>sum+r.amountCents,0);
const outstanding = e => !e.voidedAt&&e.paidBy==='owner'?portion(e)-reimbursed(e):0;
function validate(input) {
  const {text,date,money,fail}=services();
  if(!KINDS.includes(input.kind))fail('Jenis belanja tidak sah.');
  const businessBps=scaled(input.businessPercent,'Peratus perniagaan',100);
  const paidBy=['business','owner'].includes(input.paidBy)?input.paidBy:fail('Pilih sumber bayaran.');
  const method=['bank','tunai','ewallet'].includes(input.method)?input.method:fail('Cara bayaran tidak sah.');
  const receiptStatus=['ada','tiada'].includes(input.receiptStatus)?input.receiptStatus:fail('Pilih status resit.');
  const fields={kind:input.kind,date:date(input.date,'Tarikh transaksi'),payee:text(input.payee,'Penerima / pembekal',160),
    description:text(input.description,'Butiran / tujuan',1500),amountCents:money(input.amount),businessBps,paidBy,method,
    transactionRef:text(input.transactionRef||'','Rujukan bayaran',150,method==='tunai'),
    category:text(input.category||'Lain-lain','Kategori',100),invoiceRef:text(input.invoiceRef||'','No. resit / invois',100,true),
    receiptStatus,noReceiptReason:text(input.noReceiptReason||'','Sebab tiada resit',700,receiptStatus!=='tiada'),
    notes:text(input.notes||'','Catatan',1500,true)};
  if(fields.category==='Peribadi pemilik'&&businessBps!==0)fail('Belanja peribadi pemilik perlu direkod 0% bahagian perniagaan.');
  if(input.kind==='asset')fields.asset={name:text(input.assetName,'Nama aset',200),model:text(input.model||'','Model',100,true),serial:text(input.serial||'','No. siri',100,true),inUseDate:date(input.inUseDate,'Tarikh mula guna',true),location:text(input.location||'','Lokasi aset',200,true)};
  if(input.kind==='travel'){
    const kmHundredths=scaled(input.distance,'Jarak perjalanan');if(kmHundredths<=0)fail('Jarak perjalanan mesti melebihi 0.');
    fields.travel={from:text(input.from,'Dari',200),to:text(input.to,'Ke',200),purpose:text(input.purpose,'Tujuan perjalanan',1000),kmHundredths,vehicle:text(input.vehicle||'','Kenderaan',100,true),costBasis:text(input.costBasis,'Asas amaun perjalanan',700)};
  }
  if(input.kind==='helper'){
    const quantityHundredths=scaled(input.quantity,'Kuantiti / jam / hari');if(quantityHundredths<=0)fail('Kuantiti kerja mesti melebihi 0.');
    const rateCents=money(input.rate);const expected=Number((BigInt(rateCents)*BigInt(quantityHundredths)+50n)/100n);
    if(expected!==fields.amountCents)fail('Jumlah upah tidak sepadan dengan kuantiti × kadar.');
    const start=date(input.periodFrom,'Tarikh mula kerja'),end=date(input.periodTo,'Tarikh akhir kerja');if(end<start)fail('Tarikh akhir kerja mesti selepas / sama tarikh mula.');
    fields.helper={quantityHundredths,rateCents,unit:text(input.unit,'Unit kerja',40),periodFrom:start,periodTo:end,task:text(input.task,'Kerja dilaksanakan',1000),workerStatus:['belum-disemak','pekerja','bebas'].includes(input.workerStatus)?input.workerStatus:'belum-disemak'};
  }
  return fields;
}
function create(state,input){
  const {reference,fail}=services();const fields=validate(input);
  if(fields.invoiceRef&&state.expenses.some(e=>!e.voidedAt&&e.invoiceRef===fields.invoiceRef&&e.payee.toLowerCase()===fields.payee.toLowerCase()&&e.date===fields.date&&e.kind===fields.kind&&e.amountCents===fields.amountCents&&e.description===fields.description))fail('Butiran invois / resit yang sama sudah direkod. Semak rekod asal supaya tidak berganda.');
  const row={...fields,id:randomUUID(),reference:reference(state,{general:'EX',asset:'AS',travel:'TR',helper:'UP'}[fields.kind],fields.date),createdAt:new Date().toISOString(),archived:false,voidedAt:null,voidReason:'',reimbursements:[],business:structuredClone(state.business),taxReview:'Belum disemak accountant'};
  state.expenses.push(row);return row;
}
function mutate(state,id,input){
  const {find,fail,date,money,text,reference}=services();const row=find(state,'expenses',id);const now=new Date().toISOString();
  if(['archive','restore'].includes(input.action)){row.archived=input.action==='archive';row.updatedAt=now;return row;}
  if(input.action==='void'){
    if(row.voidedAt)fail('Belanja sudah dibatalkan.');if(reimbursed(row)>0)fail('Batalkan transaksi bayaran balik dahulu sebelum membatalkan belanja asal.');
    row.voidReason=text(input.reason,'Sebab pembatalan',500);row.voidedAt=now;return row;
  }
  if(input.action==='reimburse'){
    if(row.voidedAt||row.archived||row.paidBy!=='owner')fail('Hanya belanja aktif yang didahulukan pemilik boleh dibayar balik.');
    const cents=money(input.amount);if(cents>outstanding(row))fail('Bayaran balik melebihi baki pendahuluan perniagaan.');
    const when=date(input.date,'Tarikh bayaran balik');if(when<row.date)fail('Tarikh bayaran balik tidak boleh sebelum transaksi asal.');
    const r={id:randomUUID(),reference:reference(state,'RB',when),date:when,amountCents:cents,transactionRef:text(input.transactionRef,'Rujukan bayaran balik',150),notes:text(input.notes||'','Catatan',700,true),createdAt:now,voidedAt:null,voidReason:''};
    row.reimbursements.push(r);return row;
  }
  if(input.action==='void-reimbursement'){
    const r=row.reimbursements.find(r=>r.id===input.reimbursementId);if(!r||r.voidedAt)fail('Transaksi bayaran balik tidak dijumpai atau sudah dibatalkan.');
    r.voidReason=text(input.reason,'Sebab pembatalan',500);r.voidedAt=now;return row;
  }
  fail('Tindakan belanja tidak sah.');
}
function totals(state){
  const valid=state.expenses.filter(e=>!e.voidedAt);
  return {operatingCents:valid.filter(e=>e.kind!=='asset').reduce((sum,e)=>sum+portion(e),0),assetCents:valid.filter(e=>e.kind==='asset').reduce((sum,e)=>sum+portion(e),0),
    ownerOutstandingCents:valid.reduce((sum,e)=>sum+outstanding(e),0),cashOutCents:valid.reduce((sum,e)=>sum+(e.paidBy==='business'?e.amountCents:reimbursed(e)),0)};
}
function validateStored(e){
  const normalized=validate({...e,amount:(e.amountCents/100).toFixed(2),businessPercent:(e.businessBps/100).toFixed(2),
    assetName:e.asset?.name,model:e.asset?.model,serial:e.asset?.serial,inUseDate:e.asset?.inUseDate,location:e.asset?.location,
    from:e.travel?.from,to:e.travel?.to,purpose:e.travel?.purpose,distance:e.travel? (e.travel.kmHundredths/100).toFixed(2):'',vehicle:e.travel?.vehicle,costBasis:e.travel?.costBasis,
    quantity:e.helper?(e.helper.quantityHundredths/100).toFixed(2):'',rate:e.helper?(e.helper.rateCents/100).toFixed(2):'',unit:e.helper?.unit,periodFrom:e.helper?.periodFrom,periodTo:e.helper?.periodTo,task:e.helper?.task,workerStatus:e.helper?.workerStatus});
  const {fail,text,date}=services();
  if(normalized.amountCents!==e.amountCents||normalized.businessBps!==e.businessBps||!e.business?.name||typeof e.archived!=='boolean'||!Array.isArray(e.reimbursements))fail('Rekod belanja sandaran rosak.');
  if(e.voidedAt)text(e.voidReason,'Sebab pembatalan',500);
  for(const r of e.reimbursements){date(r.date,'Tarikh bayaran balik');if(!Number.isSafeInteger(r.amountCents)||r.amountCents<=0||r.date<e.date)fail('Amaun / tarikh bayaran balik tidak sah.');text(r.transactionRef,'Rujukan bayaran balik',150);if(r.voidedAt)text(r.voidReason,'Sebab pembatalan',500);}
  if((e.paidBy!=='owner'&&e.reimbursements.length)||reimbursed(e)>portion(e)||(e.voidedAt&&reimbursed(e)>0))fail('Baki pendahuluan tidak sah.');
}
module.exports={KINDS,create,mutate,portion,reimbursed,outstanding,totals,validateStored};
