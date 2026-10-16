import {ACTORS,type Actor} from './policy.js';
export const COOKIE='am_demo_session';
export const TTL_SECONDS=1800;
type Claims={v:1;sub:string;iat:number;exp:number;nonce:string};
function encode(bytes:Uint8Array):string{return btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');}
function decode(value:string):Uint8Array{
 if(!/^[A-Za-z0-9_-]+$/.test(value))throw Error('Invalid encoding');
 const bytes=Uint8Array.from(atob(value.replaceAll('-','+').replaceAll('_','/')+'='.repeat((4-value.length%4)%4)),c=>c.charCodeAt(0));
 if(encode(bytes)!==value)throw Error('Non-canonical encoding');return bytes;
}
async function key(secret:string){if(secret.length<43)throw Error('Missing demo signing key');return crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);}
export async function issueSession(actor:Actor,secret:string,now=Date.now()):Promise<{token:string;expiresAt:string}>{
 const iat=Math.floor(now/1000),payload:Claims={v:1,sub:actor.id,iat,exp:iat+TTL_SECONDS,nonce:crypto.randomUUID()};
 const encoded=encode(new TextEncoder().encode(JSON.stringify(payload))),signature=await crypto.subtle.sign('HMAC',await key(secret),new TextEncoder().encode(encoded));
 return {token:encoded+'.'+encode(new Uint8Array(signature)),expiresAt:new Date(payload.exp*1000).toISOString()};
}
export async function verifySession(token:string,secret:string,now=Date.now()):Promise<Actor|null>{
 try{
  if(token.length>1024)return null;const parts=token.split('.');if(parts.length!==2)return null;
  const encoded=parts[0]!,signature=decode(parts[1]!);if(signature.byteLength!==32)return null;
  const valid=await crypto.subtle.verify('HMAC',await key(secret),signature as BufferSource,new TextEncoder().encode(encoded));if(!valid)return null;
  const c=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(decode(encoded))) as Partial<Claims>;
  const seconds=Math.floor(now/1000);
  const issued=c.iat,expires=c.exp;
  if(c.v!==1||typeof c.sub!=='string'||typeof issued!=='number'||typeof expires!=='number'||!Number.isSafeInteger(issued)||!Number.isSafeInteger(expires)||typeof c.nonce!=='string'||c.nonce.length!==36||issued>seconds||expires<=seconds||expires-issued!==TTL_SECONDS)return null;
  return ACTORS.find(a=>a.id===c.sub)??null;
 }catch{return null;}
}
export function sessionCookie(request:Request):string|null{
 const cookies=(request.headers.get('cookie')??'').split(';').map(x=>x.trim()).filter(x=>x.startsWith(COOKIE+'='));
 if(cookies.length!==1)return null;return cookies[0]!.slice(COOKIE.length+1);
}
export function cookieHeader(token:string,secure:boolean,maxAge=TTL_SECONDS){return `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure?'; Secure':''}`;}
