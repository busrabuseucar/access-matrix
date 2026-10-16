import test from 'node:test';
import assert from 'node:assert/strict';
import app from '../dist/server/index.js';
import {createAppServer} from '../scripts/server.mjs';
const secret='SYNTHETIC_API_TEST_KEY_NOT_FOR_DEPLOYMENT_0000000',env={DEMO_SESSION_SECRET:secret},origin='https://demo.invalid';
const call=(path,init={})=>app.fetch(new Request(origin+path,init),env);
async function login(actorId){const r=await call('/api/session',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({actorId})});assert.equal(r.status,200);return r.headers.get('set-cookie').split(';')[0];}
test('public catalog returns synthetic metadata without document bodies',async()=>{
 const r=await call('/api/catalog');assert.equal(r.status,200);const body=await r.json();assert.equal(body.actors.length,4);assert.ok(body.documents.every(d=>!Object.hasOwn(d,'body')));
});
test('protected read without a session returns 401 and no data',async()=>{const r=await call('/api/documents/atlas-guide');assert.equal(r.status,401);assert.equal((await r.json()).data,undefined);});
test('viewer read succeeds but export is denied with no record content',async()=>{
 const cookie=await login('ada');assert.equal((await call('/api/documents/atlas-guide',{headers:{cookie}})).status,200);
 const denied=await call('/api/documents/atlas-guide/export',{headers:{cookie}});assert.equal(denied.status,403);const body=await denied.json();assert.equal(body.data,undefined);assert.ok(!JSON.stringify(body).includes('SENTETİK İÇERİK'));
});
test('editor ownership determines draft access and actual export',async()=>{
 const cookie=await login('ece');const own=await call('/api/documents/atlas-draft/export',{headers:{cookie}});assert.equal(own.status,200);assert.match(own.headers.get('content-disposition'),/attachment/);assert.equal((await own.json()).data.id,'atlas-draft');
 assert.equal((await call('/api/documents/atlas-plan',{headers:{cookie}})).status,403);
});
test('administrator cannot cross organization boundary and report stays scoped',async()=>{
 const cookie=await login('deniz');const foreign=await call('/api/documents/nova-guide',{headers:{cookie}});assert.equal(foreign.status,404);assert.equal((await foreign.json()).data,undefined);
 const r=await call('/api/admin/report',{headers:{cookie}});assert.equal(r.status,200);assert.deepEqual((await r.json()).data,{organization:'atlas',totalDocuments:3,published:1,drafts:2});
});
test('forged client role, user and organization headers are ignored',async()=>{
 const cookie=await login('ada');const r=await call('/api/admin/report?role=admin',{headers:{cookie,'X-Role':'admin','X-User-Id':'deniz','X-Organization':'nova'}});assert.equal(r.status,403);assert.equal((await r.json()).actor.id,'ada');
});
test('tampered cookie cannot reuse the administrator identity',async()=>{
 const cookie=await login('ada'),token=cookie.slice(cookie.indexOf('=')+1),[payload,sig]=token.split('.');const claims=JSON.parse(Buffer.from(payload,'base64url'));claims.sub='deniz';
 const forged='am_demo_session='+Buffer.from(JSON.stringify(claims)).toString('base64url')+'.'+sig;const r=await call('/api/admin/report',{headers:{cookie:forged}});assert.equal(r.status,401);
});
test('session selection rejects forged fields and unknown identities',async()=>{
 for(const body of [{actorId:'ada',role:'admin'},{actorId:'ada',organization:'nova'},{actorId:'unknown'},null,[]]){const r=await call('/api/session',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(body)});assert.equal(r.status,400);assert.equal(r.headers.get('set-cookie'),null);}
});
test('session changes require matching Origin and reject cross-site metadata',async()=>{
 for(const headers of [{},{Origin:'https://other.invalid'},{Origin:origin,'Sec-Fetch-Site':'cross-site'}]){
 const r=await call('/api/session',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:'{"actorId":"ada"}'});assert.equal(r.status,403);}
});
test('JSON limits and media type are enforced before issuing sessions',async()=>{
 const variants=[{headers:{'Content-Type':'text/plain'},body:'{"actorId":"ada"}',status:415},{headers:{'Content-Type':'application/json'},body:'{broken',status:400},{headers:{'Content-Type':'application/json'},body:' '.repeat(1025),status:413}];
 for(const v of variants){const r=await call('/api/session',{method:'POST',headers:{Origin:origin,...v.headers},body:v.body});assert.equal(r.status,v.status);}
});
test('logout clears cookie; current session returns no token material',async()=>{
 const cookie=await login('ece'),r=await call('/api/session',{headers:{cookie}}),body=await r.json();assert.equal(body.actor.id,'ece');assert.ok(!JSON.stringify(body).includes(cookie.split('=')[1]));
 const logout=await call('/api/session',{method:'DELETE',headers:{cookie,Origin:origin}});assert.equal(logout.status,200);assert.match(logout.headers.get('set-cookie'),/Max-Age=0/);
});
test('missing production key fails closed, unknown routes and methods are rejected',async()=>{
 const missing=await app.fetch(new Request(origin+'/api/session'),{});assert.equal(missing.status,503);assert.equal((await call('/api/unknown')).status,404);assert.equal((await call('/api/documents/atlas-guide',{method:'POST'})).status,405);
});
test('responses are not cacheable and do not enable cross-origin access',async()=>{
 const r=await call('/api/documents/atlas-guide');assert.equal(r.headers.get('cache-control'),'no-store');assert.equal(r.headers.get('access-control-allow-origin'),null);assert.match(r.headers.get('content-security-policy'),/frame-ancestors 'none'/);
});
test('compiled Worker serves actual HTML, client assets and ZIP but no server source route',async()=>{
 assert.equal(typeof app.fetch,'function');const page=await call('/');assert.equal(page.status,200);assert.match(await page.text(),/AccessMatrix/);
 for(const path of ['/app.js','/styles.css','/favicon.svg','/download/access-matrix-source.zip'])assert.equal((await call(path)).status,200);
 assert.equal((await call('/server/session.js')).status,404);assert.equal(await (await call('/',{method:'HEAD'})).text(),'');
});
test('real local HTTP flow carries session cookies and backend decisions',async()=>{
 const server=createAppServer(secret);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base=`http://127.0.0.1:${server.address().port}`;
 try{
  const started=await fetch(base+'/api/session',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:'{"actorId":"ada"}'});assert.equal(started.status,200);const cookie=started.headers.get('set-cookie').split(';')[0];await started.text();
  const denied=await fetch(base+'/api/documents/atlas-guide/export',{headers:{cookie,'X-Role':'admin'}});assert.equal(denied.status,403);assert.equal((await denied.json()).actor.role,'viewer');
  const read=await fetch(base+'/api/documents/atlas-guide',{headers:{cookie}});assert.equal(read.status,200);assert.equal((await read.json()).data.id,'atlas-guide');
 }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});
test('all demo actors enforce the documented read/export matrix through the API',async()=>{
 const expected={ada:[[200,403],[403,403],[403,403],[404,404]],ece:[[200,200],[200,200],[403,403],[404,404]],deniz:[[200,200],[200,200],[200,200],[404,404]],mert:[[404,404],[404,404],[404,404],[200,200]]};
 const ids=['atlas-guide','atlas-draft','atlas-plan','nova-guide'];
 for(const [id,rows] of Object.entries(expected)){
  const cookie=await login(id);
  for(let i=0;i<ids.length;i++)for(let action=0;action<2;action++){
   const response=await call('/api/documents/'+ids[i]+(action?'/export':''),{headers:{cookie,'X-Role':'admin'}});
   assert.equal(response.status,rows[i][action],`${id}/${ids[i]}/${action}`);
   const body=await response.json();assert.equal(body.decision.allowed,response.status===200);
   if(response.status!==200)assert.equal(body.data,undefined);
  }
 }
});
test('logout rejects foreign origin and duplicate session cookies cannot grant access',async()=>{
 const cookie=await login('deniz');
 const logout=await call('/api/session',{method:'DELETE',headers:{cookie,Origin:'https://other.invalid'}});
 assert.equal(logout.status,403);assert.equal(logout.headers.get('set-cookie'),null);
 const response=await call('/api/admin/report',{headers:{cookie:cookie+'; '+cookie}});
 assert.equal(response.status,401);assert.equal((await response.json()).data,undefined);
});
