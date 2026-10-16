import type {Actor,Document,Decision} from '../server/policy.js';
type Catalog={actors:Actor[];documents:Omit<Document,'body'>[]};
type Reply={demo?:boolean;ok?:boolean;actor?:Actor|null;requestId?:string;decision?:Decision;data?:unknown;message?:string;code?:string};
const get=<T extends HTMLElement>(id:string)=>document.getElementById(id) as T;
function node<K extends keyof HTMLElementTagNameMap>(tag:K,text?:string,cls?:string){const el=document.createElement(tag);if(text!==undefined)el.textContent=text;if(cls)el.className=cls;return el;}
const doc=get<HTMLSelectElement>('document'),action=get<HTMLSelectElement>('action'),spoof=get<HTMLInputElement>('spoof'),send=get<HTMLButtonElement>('send'),download=get<HTMLButtonElement>('download');
const roles={viewer:'Okuyucu',editor:'Editör',admin:'Yönetici'};
let catalog:Catalog={actors:[],documents:[]},actor:Actor|null=null,busy=false,last:Reply|null=null;
function message(id:string,text:string,error=false){get(id).textContent=text;get(id).classList.toggle('error',error);}
function setBusy(value:boolean){busy=value;for(const control of document.querySelectorAll<HTMLButtonElement|HTMLSelectElement|HTMLInputElement>('button,select,input'))control.disabled=value;doc.disabled=value||action.value==='report';download.disabled=value||!last?.ok||action.value!=='export';}
function endpoint(){return action.value==='report'?'/api/admin/report':`/api/documents/${doc.value}${action.value==='export'?'/export':''}`;}
function resetReply(){last=null;download.disabled=true;get('http-status').textContent='—';get('http-status').className='';get('verdict-title').textContent='İstek bekleniyor';get('reason').textContent='Seçili kimlikle isteği gönder.';get('response-json').textContent='{}';get('response-actor').textContent='Kimlik: —';get('decision-code').textContent='Karar: —';get('latency').textContent='—';message('request-status','');}
function selection(){resetReply();get('path').textContent=endpoint();doc.disabled=busy||action.value==='report';const d=catalog.documents.find(d=>d.id===doc.value);get('document-info').textContent=action.value==='report'?'Rapor, oturum kimliğinin organizasyonundan üretilir.':d?`${d.organization.toUpperCase()} · ${d.published?'Yayınlanmış':'Taslak'} · Sahibi: ${d.ownerId}`:'';}
function renderActor(){for(const b of document.querySelectorAll<HTMLButtonElement>('[data-actor]'))b.setAttribute('aria-pressed',String(b.dataset.actor===(actor?.id??'anonymous')));get('session-label').textContent=actor?`${actor.name} / ${roles[actor.role]} / ${actor.organization.toUpperCase()}`:'Anonim / oturum yok';}
async function request(path:string,init:RequestInit={}):Promise<{status:number;body:Reply;elapsed:number}>{
 const start=performance.now(),r=await fetch(path,{...init,credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(8000)});let body:Reply;
 try{body=await r.json() as Reply;}catch{throw Error('Sunucu beklenen JSON yanıtını vermedi. Sayfayı yenileyip tekrar dene.');}
 return {status:r.status,body,elapsed:Math.round(performance.now()-start)};
}
async function choose(id:string):Promise<boolean>{
 setBusy(true);resetReply();message('session-status','Demo oturumu güncelleniyor…');
 try{
  const r=await request('/api/session',id==='anonymous'?{method:'DELETE'}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({actorId:id})});
  if(r.status!==200)throw Error(r.body.message??'Demo oturumu açılamadı.');actor=r.body.actor??null;renderActor();message('session-status',actor?'Demo oturumu hazır. Gerçek kullanıcı doğrulaması yapılmadı.':'Demo oturumu kapatıldı.');return true;
 }catch(error){message('session-status',error instanceof Error?error.message:'Demo oturumu değiştirilemedi.',true);return false;}finally{setBusy(false);}
}
async function execute(){
 setBusy(true);resetReply();message('request-status','İstek sunucuya gönderiliyor…');
 try{
  const r=await request(endpoint(),{headers:spoof.checked?{'X-Role':'admin'}:{}});last=r.body;
  if('actor' in r.body){actor=r.body.actor??null;renderActor();}
  const allowed=r.body.decision?.allowed===true;get('http-status').textContent=String(r.status);get('http-status').className=allowed?'allow':'deny';
  get('verdict-title').textContent=allowed?'İzin verildi':r.body.decision?'İstek reddedildi':'İstek tamamlanamadı';get('reason').textContent=r.body.decision?.reason??r.body.message??'Beklenmeyen sunucu yanıtı.';
  get('latency').textContent=r.elapsed+' ms';get('response-actor').textContent='Kimlik: '+(r.body.actor?`${r.body.actor.name} / ${r.body.actor.organization}`:'Anonim');get('decision-code').textContent='Karar: '+(r.body.decision?.code??r.body.code??'—');get('response-json').textContent=JSON.stringify(r.body,null,2);
  message('request-status','Sunucunun gerçek HTTP yanıtı gösteriliyor.');
 }catch(error){message('request-status',error instanceof Error?error.message:'Sunucuya ulaşılamadı. Yeniden dene.',true);get('verdict-title').textContent='Bağlantı kurulamadı';get('reason').textContent='Bir izin kararı alınmadı. İsteği yeniden gönderebilirsin.';}finally{setBusy(false);}
}
const scenarios:Record<string,{actor:string;document:string;action:string}>={'viewer-export':{actor:'ada',document:'atlas-guide',action:'export'},'owner-draft':{actor:'ece',document:'atlas-draft',action:'read'},'foreign-org':{actor:'deniz',document:'nova-guide',action:'read'}};
for(const button of document.querySelectorAll<HTMLButtonElement>('[data-scenario]'))button.addEventListener('click',async()=>{if(busy)return;const s=scenarios[button.dataset.scenario!];if(!s)return;doc.value=s.document;action.value=s.action;spoof.checked=false;selection();if(await choose(s.actor))await execute();});
doc.addEventListener('change',selection);action.addEventListener('change',selection);spoof.addEventListener('change',resetReply);send.addEventListener('click',()=>void execute());
download.addEventListener('click',()=>{if(!last?.ok||action.value!=='export')return;const url=URL.createObjectURL(new Blob([JSON.stringify(last.data,null,2)+'\n'],{type:'application/json;charset=utf-8'})),a=node('a');a.href=url;a.download='accessmatrix-demo-document.json';document.body.append(a);a.click();a.remove();window.setTimeout(()=>URL.revokeObjectURL(url),1000);});
async function init(){
 setBusy(true);
 try{
  const c=await fetch('/api/catalog',{cache:'no-store',credentials:'same-origin',signal:AbortSignal.timeout(8000)});if(!c.ok)throw Error('Demo kataloğu yüklenemedi.');catalog=await c.json() as Catalog;
  const list=get('actors');list.replaceChildren();
  const identities=[{id:'anonymous',name:'Anonim',role:null,organization:null},...catalog.actors];
  for(const a of identities){const b=node('button',undefined,'actor');b.type='button';b.dataset.actor=a.id;b.append(node('strong',a.name),node('span',a.role?roles[a.role]:'Oturum yok'),node('span',a.organization?a.organization.toUpperCase():'401 senaryosu'));b.addEventListener('click',()=>{if(!busy)void choose(a.id);});list.append(b);}
  for(const d of catalog.documents){const option=node('option',d.title);option.value=d.id;doc.append(option);}selection();
  const session=await request('/api/session');if(session.status!==200)throw Error(session.body.message??'Oturum hizmeti kullanılamıyor.');actor=session.body.actor??null;renderActor();
  message('session-status','Kimlik seçimi bu demo içindir. Tüm kayıtlar kurmacadır.');setBusy(false);await execute();
 }catch(error){message('session-status',error instanceof Error?error.message:'Demo başlatılamadı. Sayfayı yenile.',true);get('session-label').textContent='Bağlantı hatası';setBusy(true);}
}
void init();
