import test from 'node:test';
import assert from 'node:assert/strict';
import {ACTORS,DOCUMENTS,authorize} from '../dist/server/policy.js';
const expected={ada:{read:[200,403,403,404],export:[403,403,403,404]},ece:{read:[200,200,403,404],export:[200,200,403,404]},deniz:{read:[200,200,200,404],export:[200,200,200,404]},mert:{read:[404,404,404,200],export:[404,404,404,200]}};
for(const actor of ACTORS)for(const action of ['read','export'])test(`${actor.id}: explicit ${action} permission matrix`,()=>{
 assert.deepEqual(DOCUMENTS.map(d=>authorize(actor,action,d).status),expected[actor.id][action]);
});
test('organization report is administrator-only',()=>assert.deepEqual(ACTORS.map(a=>authorize(a,'report').status),[403,403,200,403]));
test('anonymous users receive 401 for all protected actions',()=>{for(const action of ['read','export','report'])assert.equal(authorize(null,action,DOCUMENTS[0]).status,401);});
test('unknown roles and undefined actions deny by default',()=>{
 assert.equal(authorize({...ACTORS[0],role:'superuser'},'read',DOCUMENTS[0]).status,403);assert.equal(authorize(ACTORS[2],'destroy',DOCUMENTS[0]).status,403);
});
test('nonexistent and foreign organization records return identical denial',()=>assert.deepEqual(authorize(ACTORS[2],'read',undefined),authorize(ACTORS[2],'read',DOCUMENTS[3])));
