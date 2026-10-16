export type Role='viewer'|'editor'|'admin';
export type Actor={id:string;name:string;role:Role;organization:string};
export type Document={id:string;title:string;organization:string;ownerId:string;published:boolean;body:string};
export type Action='read'|'export'|'report';
export const ACTORS:readonly Actor[]=[
 {id:'ada',name:'Ada',role:'viewer',organization:'atlas'},
 {id:'ece',name:'Ece',role:'editor',organization:'atlas'},
 {id:'deniz',name:'Deniz',role:'admin',organization:'atlas'},
 {id:'mert',name:'Mert',role:'editor',organization:'nova'},
];
export const DOCUMENTS:readonly Document[]=[
 {id:'atlas-guide',title:'Yayınlanmış rehber',organization:'atlas',ownerId:'ece',published:true,body:'SENTETİK İÇERİK: Atlas ekibinin yayınlanmış kullanım rehberi.'},
 {id:'atlas-draft',title:'Ece’nin taslağı',organization:'atlas',ownerId:'ece',published:false,body:'SENTETİK İÇERİK: Ece’nin yayınlanmamış proje taslağı.'},
 {id:'atlas-plan',title:'Deniz’in taslağı',organization:'atlas',ownerId:'deniz',published:false,body:'SENTETİK İÇERİK: Deniz’in yayınlanmamış ekip planı.'},
 {id:'nova-guide',title:'Nova organizasyonunun rehberi',organization:'nova',ownerId:'mert',published:true,body:'SENTETİK İÇERİK: Nova ekibine ait ayrı organizasyon kaydı.'},
];
export type Decision={allowed:boolean;status:200|401|403|404;code:string;reason:string};
const deny=(status:401|403|404,code:string,reason:string):Decision=>({allowed:false,status,code,reason});
const allow=(code:string,reason:string):Decision=>({allowed:true,status:200,code,reason});
export function authorize(actor:Actor|null,action:Action,document?:Document):Decision{
 if(!actor)return deny(401,'SESSION_REQUIRED','Demo oturumu gerekli. Önce bir test kimliği seç.');
 if(!['viewer','editor','admin'].includes(actor.role))return deny(403,'ROLE_DENIED','Rol bu işlem için yetkili değil.');
 if(action==='report')return actor.role==='admin'?allow('ADMIN_REPORT','Yönetici, yalnızca kendi organizasyonunun raporunu görebilir.'):deny(403,'ROLE_DENIED','Organizasyon raporu yalnızca yöneticiye açık.');
 if(action!=='read'&&action!=='export')return deny(403,'ACTION_DENIED','Bu işlem için izin tanımlanmamış.');
 if(!document||document.organization!==actor.organization)return deny(404,'NOT_FOUND','Kayıt bulunamadı veya bu organizasyonda erişilebilir değil.');
 if(action==='read'){
   if(document.published)return allow('PUBLISHED_IN_ORG','Yayınlanmış kayıt, aynı organizasyondaki oturumlara açık.');
   if(actor.role==='admin')return allow('ADMIN_IN_ORG','Yönetici kendi organizasyonundaki taslağı okuyabilir.');
   if(actor.role==='editor'&&document.ownerId===actor.id)return allow('OWN_DRAFT','Editör kendi taslağını okuyabilir.');
   return deny(403,'DRAFT_DENIED','Bu taslak için kayıt sahipliği veya yönetici yetkisi gerekiyor.');
 }
 if(actor.role==='admin')return allow('ADMIN_EXPORT','Yönetici kendi organizasyonunun kaydını dışa aktarabilir.');
 if(actor.role==='editor'&&document.ownerId===actor.id)return allow('OWNER_EXPORT','Editör kendi kaydını dışa aktarabilir.');
 return deny(403,'EXPORT_DENIED','Dışa aktarma, kayıt sahibi editöre veya organizasyon yöneticisine açık.');
}
