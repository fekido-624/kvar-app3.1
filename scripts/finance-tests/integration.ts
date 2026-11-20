import 'dotenv/config';
import { SignJWT } from 'jose';
import { prisma } from '../../src/lib/db';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
const base=process.env.FINANCE_TEST_URL || 'http://localhost:9002';
async function main(){
 if(!['localhost','127.0.0.1'].includes(new URL(base).hostname))throw new Error('Integration tests are local-only.');
 const admin=await prisma.user.findFirstOrThrow({where:{role:'admin'}});
 async function cookie(id:string){return 'accesspilot_session='+await new SignJWT({userId:id}).setProtectedHeader({alg:'HS256'}).setExpirationTime('10m').sign(new TextEncoder().encode(process.env.AUTH_SECRET));}
 const headers={cookie:await cookie(admin.id),'content-type':'application/json',...(process.env.APP_ORIGIN?{origin:process.env.APP_ORIGIN}:{})};
 async function raw(path:string,method='GET',input?:unknown,custom:Record<string,string>=headers){return fetch(base+'/api/kewangan'+path,{method,headers:custom,...(input===undefined?{}:{body:JSON.stringify(input)})});}
 async function api(path:string,method='GET',input?:unknown){const r=await raw(path,method,input);const data=await r.json();assert.ok(r.ok,JSON.stringify(data));return data;}
 const baseline=await api('/api/backup');
 const before={customers:await prisma.customer.count(),receipts:await prisma.receiptDraft.count(),tags:await prisma.lebihanTag.count()};
 const temporaryUser=await prisma.user.create({data:{id:randomUUID(),firstName:'QA',lastName:'Temporary',email:randomUUID()+'@example.invalid',username:'qa-'+randomUUID(),passwordHash:'disabled-test-user',role:'user'}});
 try{
  const memberHeaders={...headers,cookie:await cookie(temporaryUser.id)};
  for(const route of ['/ui','/app.js','/api/state','/api/backup','/documents/expense/'+randomUUID(),'/api/evidence/'+randomUUID()])assert.equal((await raw(route,'GET',undefined,memberHeaders)).status,403);
  assert.equal((await raw('/api/writers','POST',{name:'blocked'},memberHeaders)).status,403);
  assert.equal((await raw('/api/state','GET',undefined,{'content-type':'application/json',cookie:''})).status,401);
  assert.equal((await raw('/api/writers','POST',{}, {...headers,origin:'https://untrusted.invalid'})).status,403);
  console.log('PASS admin-only API, UI, documents, evidence and cross-origin protection');
  const w=await api('/api/writers','POST',{name:'QA TEST ONLY'});
  const p=await api('/api/projects','POST',{writerId:w.id,title:'QA TEST BOOK',feeType:'fi',amount:'100.00',scope:'QA temporary scope'});
  const c=await api('/api/claims','POST',{projectId:p.id,date:'2026-11-16',amount:'100.00',description:'QA temporary claim'});
  const pay={claimId:c.id,date:'2026-11-16',amount:'40.00',method:'tunai'};
  const pv=await api('/api/payments','POST',pay);
  assert.equal((await raw('/api/payments','POST',{...pay,amount:'70.00'})).status,400);
  const concurrent=await Promise.all([raw('/api/payments','POST',pay),raw('/api/payments','POST',pay)]);
  assert.deepEqual(concurrent.map(r=>r.status).sort(),[201,400]);
  console.log('PASS writer workflow, partial payments and concurrent overpayment prevention');
  const common={date:'2026-11-16',payee:'QA TEST PAYEE',description:'QA TEMPORARY EXPENSE',amount:'100.00',businessPercent:'60',paidBy:'owner',method:'tunai',receiptStatus:'tiada',noReceiptReason:'QA temporary no receipt'};
  const e=await api('/api/expenses','POST',{...common,kind:'general',category:'Alat tulis'});
  await api('/api/expenses/'+e.id,'PATCH',{action:'reimburse',date:'2026-11-16',amount:'20.00',transactionRef:'QA temporary transfer'});
  assert.equal((await raw('/api/expenses/'+e.id,'PATCH',{action:'reimburse',date:'2026-11-16',amount:'40.01',transactionRef:'QA overpay'})).status,400);
  await api('/api/expenses','POST',{...common,kind:'asset',assetName:'QA TEST PRINTER',amount:'800.00',businessPercent:'100',paidBy:'business'});
  await api('/api/expenses','POST',{...common,kind:'travel',from:'QA A',to:'QA B',distance:'45.50',costBasis:'Actual toll QA',amount:'25.40',businessPercent:'100',paidBy:'business',purpose:'QA journey'});
  await api('/api/expenses','POST',{...common,kind:'helper',quantity:'1.5',rate:'33.33',unit:'jam',periodFrom:'2026-11-16',periodTo:'2026-11-16',task:'QA packing',amount:'50.00',businessPercent:'100',paidBy:'business'});
  const file=await api('/api/evidence','POST',{ownerType:'expenses',ownerId:e.id,name:'QA.pdf',data:Buffer.from('%PDF-1.4\nQA only').toString('base64')});
  const downloaded=await raw('/api/evidence/'+file.id);assert.equal(downloaded.status,200);assert.equal(await downloaded.text(),'%PDF-1.4\nQA only');
  const doc=await raw('/documents/expense/'+e.id);const html=await doc.text();assert.equal(doc.status,200);assert.ok(!html.includes('Pengesahan tambahan'));assert.ok(!html.includes('Bahagian perniagaan direkod:'));assert.ok(html.includes('/api/kewangan/print.css'));
  assert.equal((await raw('/documents/voucher/'+pv.id)).status,200);
  assert.equal((await raw('/documents/no-receipt/'+e.id)).status,200);
  assert.ok((await (await raw('/api/export-expenses.csv')).text()).includes('Bayaran balik — bukan belanja baharu'));
  await api('/api/expenses/'+e.id,'PATCH',{action:'archive'});
  const current=await api('/api/state');assert.equal(current.expenses.find((r:any)=>r.id===e.id).archived,true);
  await api('/api/expenses/'+e.id,'PATCH',{action:'restore'});
  const backup=await api('/api/backup');assert.ok(backup.evidence.some((r:any)=>r.id===file.id&&r.data));
  await api('/api/restore','POST',backup);assert.equal((await api('/api/state')).expenses.find((r:any)=>r.id===e.id).reimbursements.length,1);
  assert.equal(await prisma.financeAttachment.count({where:{id:file.id}}),1);
  assert.ok(await prisma.financeAudit.count({where:{actorId:admin.id}})>0);
  assert.deepEqual({customers:await prisma.customer.count(),receipts:await prisma.receiptDraft.count(),tags:await prisma.lebihanTag.count()},before);
  console.log('PASS four expense categories, owner refund, binary evidence, A4, CSV, archive, backup/restore and unchanged KVar data');
 }finally{
  await api('/api/restore','POST',baseline);
  await prisma.user.delete({where:{id:temporaryUser.id}});
  console.log('Restored original local finance records; temporary test user removed.');
  await prisma.$disconnect();
 }
}
main().catch(async error=>{console.error(error);await prisma.$disconnect();process.exitCode=1;});

