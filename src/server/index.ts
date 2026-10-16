import {ASSETS} from './assets.js';
import {ACTORS,DOCUMENTS,authorize,type Actor,type Action} from './policy.js';
import {cookieHeader,issueSession,sessionCookie,verifySession} from './session.js';
export type Env={DEMO_SESSION_SECRET?:string};
const SECURITY={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Frame-Options':'DENY','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'"};
function json(data:unknown,status=200,extra:Record<string,string>={}){return new Response(JSON.stringify(data),{status,headers:{...SECURITY,'Content-Type':'application/json;charset=utf-8',...extra}});}
function failure(status:number,code:string,message:string){return json({ok:false,code,message},status);}
function sameOrigin(request:Request){const origin=request.headers.get('origin'),url=new URL(request.url);return origin===url.origin&&request.headers.get('sec-fetch-site')!=='cross-site';}
async function smallJson(request:Request):Promise<unknown>{
 if(request.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase()!=='application/json')throw Error('TYPE');
 const reader=request.body?.getReader();if(!reader)throw Error('JSON');const chunks:Uint8Array[]=[];let size=0;
 try{while(true){const part=await reader.read();if(part.done)break;size+=part.value.length;if(size>1024){await reader.cancel();throw Error('SIZE');}chunks.push(part.value);}}finally{reader.releaseLock();}
 const all=new Uint8Array(size);let offset=0;for(const c of chunks){all.set(c,offset);offset+=c.length;}
 return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(all));
}
async function api(request:Request,env:Env):Promise<Response>{
 const url=new URL(request.url),path=url.pathname;
 if(path==='/api/catalog'&&request.method==='GET')return json({demo:true,actors:ACTORS,documents:DOCUMENTS.map(({body,...rest})=>rest)});
 const secret=env.DEMO_SESSION_SECRET;
 if(!secret||secret.length<43)return failure(503,'DEMO_UNAVAILABLE','Demo oturum hizmeti hazır değil. Daha sonra tekrar dene.');
 const raw=sessionCookie(request),actor=raw?await verifySession(raw,secret):null;
 const secure=url.protocol==='https:';
 if(path==='/api/session'){
  if(request.method==='GET')return json({demo:true,actor});
  if(request.method==='POST'){
   if(!sameOrigin(request))return failure(403,'ORIGIN_DENIED','Demo kimliği yalnızca aynı siteden seçilebilir.');
   let body:unknown;try{body=await smallJson(request);}catch(error){const kind=error instanceof Error?error.message:'';return failure(kind==='SIZE'?413:kind==='TYPE'?415:400,'INVALID_INPUT','Tek bir geçerli demo kimliği gönder.');}
   if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).join(',')!=='actorId'||typeof (body as {actorId?:unknown}).actorId!=='string')return failure(400,'INVALID_INPUT','Yalnızca actorId alanı kabul edilir. Rol ve organizasyonu sunucu belirler.');
   const chosen=ACTORS.find(a=>a.id===(body as {actorId:string}).actorId);if(!chosen)return failure(400,'UNKNOWN_ACTOR','Geçerli bir test kimliği seç.');
   const issued=await issueSession(chosen,secret);return json({demo:true,actor:chosen,expiresAt:issued.expiresAt},200,{'Set-Cookie':cookieHeader(issued.token,secure)});
  }
  if(request.method==='DELETE'){
   if(!sameOrigin(request))return failure(403,'ORIGIN_DENIED','Oturum yalnızca aynı siteden kapatılabilir.');
   return json({demo:true,actor:null},200,{'Set-Cookie':cookieHeader('',secure,0)});
  }
  return failure(405,'METHOD_NOT_ALLOWED','Bu yöntem desteklenmiyor.');
 }
 if(request.method!=='GET')return failure(405,'METHOD_NOT_ALLOWED','Bu demo yalnızca okuma ve dışa aktarma yapar.');
 let action:Action,documentId:string|undefined;
 const match=/^\/api\/documents\/([a-z0-9-]{1,48})(\/export)?$/.exec(path);
 if(path==='/api/admin/report')action='report';
 else if(match){documentId=match[1];action=match[2]?'export':'read';}
 else return failure(404,'ROUTE_NOT_FOUND','İstek yolu bulunamadı.');
 const document=DOCUMENTS.find(d=>d.id===documentId),decision=authorize(actor,action,document),requestId=crypto.randomUUID();
 const base={demo:true,requestId,actor,action,decision};
 if(!decision.allowed)return json({...base,ok:false},decision.status);
 if(action==='report'){
   const own=DOCUMENTS.filter(d=>d.organization===actor!.organization);
   return json({...base,ok:true,data:{organization:actor!.organization,totalDocuments:own.length,published:own.filter(d=>d.published).length,drafts:own.filter(d=>!d.published).length}});
 }
 return json({...base,ok:true,data:document},200,action==='export'?{'Content-Disposition':`attachment; filename="${document!.id}.json"`}:{});
}
export default {async fetch(request:Request,env:Env):Promise<Response>{
 const url=new URL(request.url);
 try{
  if(url.pathname.startsWith('/api/'))return await api(request,env);
  if(request.method!=='GET'&&request.method!=='HEAD')return failure(405,'METHOD_NOT_ALLOWED','Bu yöntem desteklenmiyor.');
  const asset=Object.hasOwn(ASSETS,url.pathname)?ASSETS[url.pathname]:undefined;
  if(!asset)return new Response('Bulunamadı',{status:404,headers:SECURITY});
  const bytes=Uint8Array.from(atob(asset.body),c=>c.charCodeAt(0));
  return new Response(request.method==='HEAD'?null:bytes,{headers:{...SECURITY,'Content-Type':asset.type}});
 }catch{return failure(500,'INTERNAL_ERROR','İstek tamamlanamadı. Yeniden dene.');}
}};
