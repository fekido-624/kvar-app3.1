import 'dotenv/config';
import { SignJWT } from 'jose';
import { prisma } from '../../src/lib/db';
import assert from 'node:assert/strict';
const base='http://localhost:9002';
async function main(){
 const admin=await prisma.user.findFirstOrThrow({where:{role:'admin'}});
 const token=await new SignJWT({userId:admin.id}).setProtectedHeader({alg:'HS256'}).setExpirationTime('10m').sign(new TextEncoder().encode(process.env.AUTH_SECRET));
 const headers={cookie:`accesspilot_session=${token}`};
 for(const route of ['/api/kewangan/api/state','/api/kewangan/ui','/api/kewangan/app.js']){
  assert.equal((await fetch(base+route)).status,401);
  const r=await fetch(base+route,{headers});const t=await r.text();assert.equal(r.status,200,t.slice(0,200));
  if(route.endsWith('/state'))assert.equal(JSON.parse(t).expenses.length,0);
  console.log('PASS admin and anonymous access:',route);
 }
 assert.equal((await fetch(base+'/api/kewangan/api/writers',{method:'POST',headers:{...headers,'content-type':'application/json',origin:'https://elsewhere.invalid'},body:'{}'})).status,403);
 console.log('PASS cross-origin write blocked');
 await prisma.$disconnect();
}
main().catch(async error=>{console.error(error);await prisma.$disconnect();process.exitCode=1;});
