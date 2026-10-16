import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {issueSession,verifySession,sessionCookie,cookieHeader,TTL_SECONDS} from '../dist/server/session.js';
import {ACTORS} from '../dist/server/policy.js';
const secret='SYNTHETIC_TEST_KEY_NOT_FOR_DEPLOYMENT_00000000000',now=1800000000000;
const signed=claims=>{const text=Buffer.from(JSON.stringify(claims)).toString('base64url');return text+'.'+createHmac('sha256',secret).update(text).digest('base64url');};
test('issued session resolves identity from trusted server catalog',async()=>{
 const {token}=await issueSession(ACTORS[0],secret,now);assert.deepEqual(await verifySession(token,secret,now),ACTORS[0]);
 const payload=JSON.parse(Buffer.from(token.split('.')[0],'base64url'));assert.equal(payload.role,undefined);assert.equal(payload.organization,undefined);
});
test('expired and not-yet-issued sessions are rejected at time boundaries',async()=>{
 const {token}=await issueSession(ACTORS[0],secret,now);assert.ok(await verifySession(token,secret,now+(TTL_SECONDS-1)*1000));assert.equal(await verifySession(token,secret,now+TTL_SECONDS*1000),null);assert.equal(await verifySession(token,secret,now-1000),null);
});
test('changed payload, signature and wrong signing key cannot authorize',async()=>{
 const {token}=await issueSession(ACTORS[0],secret,now);const [payload,sig]=token.split('.');
 const claims=JSON.parse(Buffer.from(payload,'base64url'));claims.sub='deniz';const changed=Buffer.from(JSON.stringify(claims)).toString('base64url')+'.'+sig;
 assert.equal(await verifySession(changed,secret,now),null);assert.equal(await verifySession(payload+'.'+(sig[0]==='A'?'B':'A')+sig.slice(1),secret,now),null);assert.equal(await verifySession(token,secret+'x',now),null);
});
test('malformed, oversized and unknown-identity sessions are rejected',async()=>{
 for(const token of ['', 'a.b.c', 'x'.repeat(1025), '###.###'])assert.equal(await verifySession(token,secret,now),null);
 assert.equal(await verifySession(signed({v:1,sub:'unknown',iat:now/1000,exp:now/1000+TTL_SECONDS,nonce:'0'.repeat(36)}),secret,now),null);
});
test('invalid lifetime or version claims are rejected even with a valid signature',async()=>{
 const base={v:1,sub:'ada',iat:now/1000,exp:now/1000+TTL_SECONDS,nonce:'0'.repeat(36)};
 for(const patch of [{v:2},{exp:base.exp+100},{iat:'bad'},{nonce:'short'}])assert.equal(await verifySession(signed({...base,...patch}),secret,now),null);
});
test('untrusted role and organization claim fields cannot override catalog identity',async()=>{
 const token=signed({v:1,sub:'ada',iat:now/1000,exp:now/1000+TTL_SECONDS,nonce:'0'.repeat(36),role:'admin',organization:'nova'});assert.deepEqual(await verifySession(token,secret,now),ACTORS[0]);
});
test('ambiguous cookies fail closed; cookie protection flags match HTTPS',()=>{
 const request=value=>new Request('https://demo.invalid',{headers:{cookie:value}});
 assert.equal(sessionCookie(request('other=x; am_demo_session=token')),'token');assert.equal(sessionCookie(request('am_demo_session=a; am_demo_session=b')),null);
 const header=cookieHeader('demo',true);for(const flag of ['HttpOnly','Secure','SameSite=Strict','Max-Age=1800','Path=/'])assert.ok(header.includes(flag));assert.ok(!cookieHeader('demo',false).includes('Secure'));assert.ok(cookieHeader('',true,0).includes('Max-Age=0'));
});
