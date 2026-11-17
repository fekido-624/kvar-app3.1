import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { SignJWT } from 'jose';
import { prisma } from '../src/lib/db';
const base=process.env.TEST_BASE_URL || 'http://localhost:9002';
if(!['localhost','127.0.0.1'].includes(new URL(base).hostname))throw Error('Local test server required');
const marker='TEST-EDIT-'+randomUUID(), created:string[]=[], receipts:string[]=[], parcels:string[]=[], pubs:string[]=[], tags:string[]=[];
let trigger='', cookie='';
async function request(route:string,method='GET',input?:unknown,auth=true){return fetch(base+route,{method,headers:{'content-type':'application/json',...(auth?{cookie}:{})},...(input===undefined?{}:{body:JSON.stringify(input)})});}
async function json(route:string,method='GET',input?:unknown,status=200){const r=await request(route,method,input),data=await r.json();assert.equal(r.status,status,JSON.stringify(data));return data;}
async function draft(id:string){return (await json('/api/tempahan/drafts')).drafts.find((r:any)=>r.id===id);}
function input(row:any,changes:Record<string,unknown>={}){return{action:'edit',revision:row.revision,namaPenerima:row.namaPenerima,namaKolejVokasional:row.namaKolejVokasional,alamat:row.alamat,poskod:row.poskod,noPhone:row.noPhone,penerbitanId:row.penerbitanId||'',perkara:row.perkara,tajuk:row.tajuk,semester:row.semester,tarikh:'2026-11-17',kuantiti:row.kuantiti,hargaSeunit:row.hargaSeunit,hargaPostage:row.hargaPostage,bilanganAlamat:row.bilanganAlamat,bilanganParcel:row.bilanganParcel||1,...changes};}
async function main(){
 const admin=await prisma.user.findFirstOrThrow({where:{role:'admin'}});
 cookie='accesspilot_session='+await new SignJWT({userId:admin.id}).setProtectedHeader({alg:'HS256'}).setExpirationTime('15m').sign(new TextEncoder().encode(process.env.AUTH_SECRET));
 await json('/api/tempahan/drafts');await json('/api/data-parcel/drafts');
 const customerCount=await prisma.customer.count();
 assert.equal((await request('/api/tempahan/drafts/missing','PATCH',{action:'edit'},false)).status,401);
 const pub1=(await json('/api/penerbitan','POST',{perkara:marker+' A',semester:1,tahun:2026,hargaSeunit:10},201));
 const pub2=(await json('/api/penerbitan','POST',{perkara:marker+' B',semester:2,tahun:2026,hargaSeunit:12},201));
 // Track fixture publications and their automatically created option labels.
 const p1=pub1?.id,p2=pub2?.id;assert.ok(p1&&p2);pubs.push(p1,p2);
 const r=await prisma.receiptDraft.create({data:{noResit:marker,namaPenerima:marker,namaKolejVokasional:'KV TEST',tajuk:'TEST',perkara:marker+' A',kuantiti:10,hargaSeunit:10,hargaPostage:8,tarikh:new Date('2026-11-17'),semester:'1'}});receipts.push(r.id);
 const p=await prisma.dataParcelDraft.create({data:{namaCustomer:marker,alamat:'ALAMAT TEST',poskod:'43000',kv:'KV TEST',noPhone:'0100000000',noOrder:'LEGACY-25',bilanganParcel:1}});parcels.push(p.id);
 const d=await json('/api/tempahan/drafts','POST',{receiptDraftId:r.id,dataParcelDraftId:p.id,bilanganAlamat:1,alamat:p.alamat,poskod:p.poskod,noPhone:p.noPhone,penerbitanId:p1},201);created.push(d.id);
 const tag=await prisma.lebihanTag.create({data:{noOrder:marker,name:marker,kv:'KV TEST',address:p.alamat,postcode:p.poskod,phone:p.noPhone,lebihan:2,naskahGuru:1,sourceType:'tempahan',sourceId:d.id}});tags.push(tag.id);
 const tagBefore=JSON.stringify(tag);
 let row=await draft(d.id);assert.match(row.revision,/^[a-f0-9]{64}$/);
 await json('/api/tempahan/drafts/'+d.id,'PATCH',input(row,{namaPenerima:marker+' CORRECTED',namaKolejVokasional:'KV BETUL',alamat:'ALAMAT BARU',noPhone:'0111111111',poskod:'50000',kuantiti:20,hargaSeunit:12.50,hargaPostage:9,bilanganAlamat:2,bilanganParcel:3,penerbitanId:p2,perkara:marker+' B'}));
 const receipt=await prisma.receiptDraft.findUniqueOrThrow({where:{id:r.id}}),parcel=await prisma.dataParcelDraft.findUniqueOrThrow({where:{id:p.id}});
 assert.equal(receipt.noResit,marker);assert.equal(receipt.kuantiti,20);assert.equal(parcel.noOrder,'LEGACY-25');assert.equal(parcel.namaCustomer,receipt.namaPenerima);assert.equal(parcel.bilanganParcel,3);
 const sales=(await json('/api/rekod-jualan')).rekod;assert.equal(sales.find((x:any)=>x.id===p2).jumlahHasil,259);assert.equal(sales.find((x:any)=>x.id===p1).jumlahTempahan,0);
 assert.equal(await prisma.customer.count(),customerCount);
 assert.equal(JSON.stringify(await prisma.lebihanTag.findUniqueOrThrow({where:{id:tag.id}})),tagBefore);
 console.log('PASS linked receipt/parcel updates, stable IDs/references, publication sales and untouched customers');
 await json('/api/tempahan/drafts/'+d.id,'PATCH',input(row,{kuantiti:30}),409);
 row=await draft(d.id);
 for(const bad of [{kuantiti:0},{hargaSeunit:1.001},{hargaPostage:-1},{tarikh:'2026-02-30'},{namaPenerima:''},{penerbitanId:'missing'}, {noResit:'CHANGED'}, {revision:''}])await json('/api/tempahan/drafts/'+d.id,'PATCH',input(row,bad),400);
 assert.equal((await prisma.receiptDraft.findUniqueOrThrow({where:{id:r.id}})).kuantiti,20);
 await json('/api/tempahan/drafts/'+d.id,'PATCH',{action:'archive'});
 await json('/api/tempahan/drafts/'+d.id,'PATCH',input(row),409);
 await json('/api/tempahan/drafts/'+d.id,'PATCH',{action:'restore'});row=await draft(d.id);
 console.log('PASS stale edit, invalid values, immutable number and archived-edit rejection');
 // Inject a fixture-only failure after the receipt update and prove the transaction rolls back.
 trigger='qa_edit_'+randomUUID().replaceAll('-','');
 await prisma.$executeRawUnsafe(`CREATE TRIGGER "${trigger}" BEFORE UPDATE ON "DataParcelDraft" WHEN OLD."id" = '${p.id}' BEGIN SELECT RAISE(ABORT, 'QA rollback'); END`);
 await json('/api/tempahan/drafts/'+d.id,'PATCH',input(row,{kuantiti:99}),500);
 assert.equal((await prisma.receiptDraft.findUniqueOrThrow({where:{id:r.id}})).kuantiti,20);
 await prisma.$executeRawUnsafe(`DROP TRIGGER "${trigger}"`);trigger='';
 console.log('PASS atomic rollback when linked parcel update fails');
 await json('/api/tempahan/drafts/'+d.id,'PATCH',input(row,{hargaPostage:0}));
 row=await draft(d.id);assert.equal(row.dataParcelDraftId,'');assert.equal(row.alamat,'ALAMAT BARU');assert.equal(await prisma.dataParcelDraft.findUnique({where:{id:p.id}}),null);
 await json('/api/tempahan/drafts/'+d.id,'PATCH',input(row,{hargaPostage:6,bilanganParcel:2}));
 row=await draft(d.id);parcels.push(row.dataParcelDraftId);assert.ok(row.dataParcelDraftId);assert.equal(row.bilanganParcel,2);assert.equal(row.receiptDraftId,r.id);
 const stale=input(row),results=await Promise.all([request('/api/tempahan/drafts/'+d.id,'PATCH',{...stale,kuantiti:21}),request('/api/tempahan/drafts/'+d.id,'PATCH',{...stale,kuantiti:22})]);assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);
 console.log('PASS delivery/pickup transitions and concurrent stale-save protection');
}
main().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{
 if(trigger)await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS "${trigger}"`);
 await prisma.lebihanTag.deleteMany({where:{id:{in:tags}}});
 for(const id of created)await prisma.$executeRawUnsafe('DELETE FROM "TempahanDraft" WHERE "id" = ?',id);
 await prisma.receiptDraft.deleteMany({where:{id:{in:receipts}}});await prisma.dataParcelDraft.deleteMany({where:{id:{in:parcels}}});
 for(const id of pubs)await prisma.$executeRawUnsafe('DELETE FROM "Penerbitan" WHERE "id" = ?',id);
 await prisma.receiptPerkaraOption.deleteMany({where:{label:{in:[marker+' A',marker+' B']}}});
 await prisma.$disconnect();
});
