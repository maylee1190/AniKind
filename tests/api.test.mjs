import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { createApp } from '../server/app.mjs';
let app,directory,base,A,B,pet,otherPet,asset,memory;
const password='Testing-only-password-24';
async function request(path,{cookie,method='GET',data,headers={},raw}={}){
  const r=await fetch(base+path,{method,headers:{'X-AniKind':'1',...(cookie?{Cookie:cookie}:{}),...(data?{'Content-Type':'application/json'}:{}),...headers},body:raw|| (data?JSON.stringify(data):undefined)});
  const type=r.headers.get('content-type')||'';return {status:r.status,headers:r.headers,data:type.includes('json')?await r.json():Buffer.from(await r.arrayBuffer())};
}
const asA=(path,options={})=>request(path,{...options,cookie:A});
async function register(email){const r=await request('/api/auth/register',{method:'POST',data:{name:'测试主人',email,password,adult:true}});assert.equal(r.status,200);return r.headers.get('set-cookie').split(';')[0];}
const petData={name:'团团🐾',species:'cat',birthDate:'2020-03-01',traits:'温柔'};
async function awaitJob(id){for(let i=0;i<60;i++){const r=await asA(`/api/jobs/${id}`);if(['ready','failed'].includes(r.data.status))return r.data;await new Promise(r=>setTimeout(r,30));}assert.fail('job timed out');}
before(async()=>{
  directory=await mkdtemp(join(tmpdir(),'anikind-test-'));app=createApp({dataDir:directory,aiMode:'demo',demo:true,demoDelay:10,tickMs:10});
  await new Promise(r=>app.server.listen(0,'127.0.0.1',r));base=`http://127.0.0.1:${app.server.address().port}`;
  A=await register('a@example.test');B=await register('b@example.test');
});
after(async()=>{await app?.close();if(directory)await rm(directory,{recursive:true,force:true});});
test('public species are browseable and consistently filtered without login',async()=>{
  const r=await request('/api/species?collection=figma');assert.equal(r.status,200);assert.equal(r.data.total,r.data.items.length);assert.equal(r.data.demo,true);assert.equal(r.data.total,40);assert.equal(r.data.mapped,33);
  const q=await request('/api/species?collection=figma&category=VU&region='+encodeURIComponent('亚洲'));assert.equal(q.data.total,1);assert.equal(q.data.items[0].scientificName,'Panthera uncia');assert.equal(q.data.items[0].assessedAt,null);
  const redPanda=await request('/api/species?collection=figma&q='+encodeURIComponent('小熊猫'));assert.equal(redPanda.data.items[0].design.nodeId,'1:8310');assert.deepEqual(redPanda.data.items[0].point,[90,27]);
  const detail=await request('/api/species/'+redPanda.data.items[0].id);assert.equal(detail.data.scientificName,'Ailurus fulgens');
  const icon=await request(detail.data.iconAsset);assert.equal(icon.status,200);assert.ok(icon.headers.get('content-type').includes('image/png'));
  const americas=await request('/api/species?collection=figma&region='+encodeURIComponent('美洲'));assert.equal(americas.data.total,9);assert.ok(americas.data.items.every(s=>['北美洲','南美洲'].includes(s.region)));
  const absent=await request('/api/species?q=not-in-this-dataset');assert.equal(absent.data.total,0);
});
test('private resources require authentication and CSRF verification',async()=>{
  assert.equal((await request('/api/pets')).status,401);
  assert.equal((await fetch(base+'/api/pets',{method:'POST',headers:{Cookie:A,'Content-Type':'application/json'},body:JSON.stringify(petData)})).status,403);
  assert.equal((await asA('/api/pets',{method:'POST',data:petData,headers:{Origin:'https://evil.example'}})).status,403);
});
test('pet validation counts graphemes and rejects invalid/reversed dates',async()=>{
  assert.equal((await asA('/api/pets',{method:'POST',data:{...petData,name:''}})).status,422);
  assert.equal((await asA('/api/pets',{method:'POST',data:{...petData,birthDate:'2026-99-77'}})).status,422);
  assert.equal((await asA('/api/pets',{method:'POST',data:{...petData,memorialDate:'2019-01-01'}})).status,422);
  assert.equal((await asA('/api/pets',{method:'POST',data:{...petData,name:'🐈‍⬛'.repeat(31)}})).status,422);
  const r=await asA('/api/pets',{method:'POST',data:petData});assert.equal(r.status,201);pet=r.data;
  const b=await request('/api/pets',{cookie:B,method:'POST',data:{name:'另一只',species:'dog'}});otherPet=b.data;
});
test('cross-account read/write is denied, including editor roles',async()=>{
  assert.equal((await request(`/api/pets/${pet.id}`,{cookie:B})).status,404);
  assert.equal((await request(`/api/pets/${pet.id}`,{cookie:B,method:'PATCH',data:{...pet,version:pet.version}})).status,404);
  assert.equal((await asA(`/api/memories?petId=${otherPet.id}`)).status,404);
});
test('uploads need explicit consent and detect file signatures',async()=>{
  assert.equal((await asA(`/api/assets?petId=${pet.id}`,{method:'POST',raw:Buffer.from('not a picture')})).status,422);
  const c=await asA('/api/settings',{method:'PATCH',data:{processingConsent:true,aiConsent:true}});assert.equal(c.data.user.processingConsent,true);
  const bad=await asA(`/api/assets?petId=${pet.id}&name=pretend.png`,{method:'POST',raw:Buffer.from('<html>not a real PNG image</html>')});assert.equal(bad.status,422);
  const bytes=await readFile(resolve('public/assets/woody.png'));
  const r=await asA(`/api/assets?petId=${pet.id}&name=${encodeURIComponent('团团原始照片.png')}`,{method:'POST',raw:bytes});assert.equal(r.status,201);asset=r.data;assert.equal(asset.mime,'image/png');
  const duplicate=await asA(`/api/assets?petId=${pet.id}`,{method:'POST',raw:bytes});assert.equal(duplicate.data.id,asset.id);assert.equal(duplicate.data.duplicate,true);
  assert.equal((await request(`/api/assets/${asset.id}/content`,{cookie:B})).status,404);
  assert.equal((await request(`/api/assets/${asset.id}/content`)).status,401);
});
test('memory creation is idempotent and rejects cross-pet references',async()=>{
  const data={petId:pet.id,title:'第一次见面',body:'窗边的小小身影',eventDate:'2021-05-20',assetIds:[asset.id]};const key=randomUUID();
  const r=await asA('/api/memories',{method:'POST',data,headers:{'Idempotency-Key':key}});assert.equal(r.status,201);memory=r.data;
  const duplicate=await asA('/api/memories',{method:'POST',data,headers:{'Idempotency-Key':key}});assert.equal(duplicate.data.id,memory.id);
  assert.equal((await asA('/api/memories',{method:'POST',data:{...data,body:'changed'},headers:{'Idempotency-Key':key}})).status,409);
  assert.equal((await request('/api/memories',{cookie:B,method:'POST',data:{...data,petId:otherPet.id},headers:{'Idempotency-Key':randomUUID()}})).status,404);
});
test('optimistic memory updates retain original body and unknown dates',async()=>{
  const r=await asA(`/api/memories/${memory.id}`,{method:'PATCH',data:{version:memory.version,body:'更新后的文字',eventDate:null,favorite:true}});assert.equal(r.status,200);assert.equal(r.data.eventDate,null);assert.equal(r.data.originalBody,'窗边的小小身影');
  assert.equal((await asA(`/api/memories/${memory.id}`,{method:'PATCH',data:{version:memory.version,body:'stale'}})).status,409);memory=r.data;
  const list=await asA(`/api/memories?petId=${pet.id}&favorite=true&q=${encodeURIComponent('更新')}`);assert.equal(list.data.items.length,1);
});
test('generation is idempotent, requires selected references, and awaits confirmation',async()=>{
  const data={petId:pet.id,kind:'postcard',scene:'meadow',tone:'third',assetIds:[asset.id],subjectConfirmed:true};const key=randomUUID();
  assert.equal((await asA('/api/jobs',{method:'POST',data:{...data,assetIds:[]},headers:{'Idempotency-Key':randomUUID()}})).status,422);
  const r=await asA('/api/jobs',{method:'POST',data,headers:{'Idempotency-Key':key}});assert.equal(r.status,201);
  assert.equal((await asA('/api/jobs',{method:'POST',data,headers:{'Idempotency-Key':key}})).data.id,r.data.id);
  const ready=await awaitJob(r.data.id);assert.equal(ready.status,'ready');assert.equal(ready.isDemo,true);
  assert.equal((await asA(`/api/memories?petId=${pet.id}`)).data.items.length,1);
  const accepted=await asA(`/api/jobs/${r.data.id}/accept`,{method:'POST'});assert.equal(accepted.data.status,'accepted');
  await asA(`/api/jobs/${r.data.id}/accept`,{method:'POST'});
  const memories=(await asA(`/api/memories?petId=${pet.id}`)).data.items;assert.equal(memories.length,2);const generated=memories.find(m=>m.kind==='generated');
  const edited=await asA(`/api/memories/${generated.id}`,{method:'PATCH',data:{version:generated.version,body:'Edited story',kind:'original'}});assert.equal(edited.data.kind,'generated');
  await asA('/api/settings',{method:'PATCH',data:{hideAI:true}});assert.equal((await asA(`/api/memories?petId=${pet.id}`)).data.items.length,1);
  await asA('/api/settings',{method:'PATCH',data:{hideAI:false}});
});
test('cancellation refunds exactly once and late processing cannot publish',async()=>{
  const r=await asA('/api/jobs',{method:'POST',data:{petId:pet.id,kind:'postcard',scene:'city',tone:'first',assetIds:[asset.id],subjectConfirmed:true},headers:{'Idempotency-Key':randomUUID()}});assert.equal(r.status,201);
  const before=(await asA('/api/jobs')).data.quota.used;
  await asA(`/api/jobs/${r.data.id}/cancel`,{method:'POST'});await asA(`/api/jobs/${r.data.id}/cancel`,{method:'POST'});
  await new Promise(r=>setTimeout(r,80));const job=(await asA(`/api/jobs/${r.data.id}`)).data;assert.equal(job.status,'cancelled');assert.equal(job.refunded,true);assert.equal((await asA('/api/jobs')).data.quota.used,before-1);
});
test('revocation and pause block new generation while archives remain readable',async()=>{
  await asA('/api/settings',{method:'PATCH',data:{pauseAI:true,aiConsent:false}});
  assert.equal((await asA('/api/jobs',{method:'POST',data:{petId:pet.id,kind:'postcard',scene:'city',tone:'third',assetIds:[asset.id],subjectConfirmed:true},headers:{'Idempotency-Key':randomUUID()}})).status,422);
  assert.equal((await asA(`/api/memories/${memory.id}`)).status,200);
  const consents=(await asA('/api/consents')).data.items;
  assert.ok(consents.some(c=>c.purpose==='aiConsent'&&!c.granted));
  assert.ok(consents.some(c=>c.purpose==='processingConsent'&&c.granted));
});
test('exports require reauthentication, contain originals, provenance and labeled generated artwork',async()=>{
  assert.equal((await asA('/api/exports',{method:'POST',data:{password:'wrong-password'}})).status,401);
  const r=await asA('/api/exports',{method:'POST',data:{password,petId:pet.id}});assert.equal(r.status,202);
  let item;for(let i=0;i<40;i++){item=(await asA('/api/exports')).data.items.find(e=>e.id===r.data.id);if(item.status==='ready')break;await new Promise(r=>setTimeout(r,30));}
  assert.equal(item.status,'ready');assert.equal((await request(`/api/exports/${item.id}/download`,{cookie:B})).status,404);
  const download=await asA(`/api/exports/${item.id}/download`);assert.equal(download.status,200);const tar=gunzipSync(download.data);assert.ok(tar.includes(Buffer.from('manifest.json')));assert.ok(tar.includes(Buffer.from('本地模板演示 · 非 AI 生成')));assert.ok(tar.includes(Buffer.from('第一次见面')));
});
test('editor/reviewer separation, publication validation, withdrawal, and correction audit',async()=>{
  assert.equal((await asA('/api/admin/content')).status,403);
  const userA=app.store.db.prepare('SELECT id FROM users WHERE email=?').get('a@example.test').id;
  const userB=app.store.db.prepare('SELECT id FROM users WHERE email=?').get('b@example.test').id;
  app.store.db.prepare('UPDATE users SET role=? WHERE id=?').run('admin',userA);app.store.db.prepare('UPDATE users SET role=? WHERE id=?').run('reviewer',userB);
  let r=(await asA('/api/admin/content',{method:'POST',data:{name:'测试物种',scientificName:'Test taxon',category:'DD'}})).data;
  assert.equal((await asA(`/api/admin/content/${r.id}/submit`,{method:'POST',data:{version:r.version}})).status,422);
  r=(await asA(`/api/admin/content/${r.id}`,{method:'PATCH',data:{...r,sourceUrl:'https://example.org/source',sourceLicense:'Test-only fixture rights',sourcePublisher:'Test publisher',sourceVersion:'v1',assessedAt:'2025-01-01',scope:'全球',region:'亚洲',assessmentSystem:'测试评估'}})).data;
  r=(await asA(`/api/admin/content/${r.id}/submit`,{method:'POST',data:{version:r.version}})).data;
  assert.equal((await asA(`/api/admin/content/${r.id}/publish`,{method:'POST',data:{version:r.version}})).status,422);
  r=(await request(`/api/admin/content/${r.id}/publish`,{cookie:B,method:'POST',data:{version:r.version}})).data;assert.equal(r.status,'published');
  assert.equal((await request(`/api/species/${r.id}`)).status,200);
  assert.equal((await request(`/api/pets/${pet.id}`,{cookie:B})).status,404);
  const report=await asA('/api/reports',{method:'POST',data:{speciesId:r.id,reason:'这里的日期需要核实'}});assert.equal(report.status,201);
  const withdrawn=await request(`/api/admin/content/${r.id}/withdraw`,{cookie:B,method:'POST',data:{version:r.version,reason:'需要更正'}});assert.equal(withdrawn.data.status,'withdrawn');assert.equal((await request(`/api/species/${r.id}`)).status,404);
  const history=(await asA(`/api/admin/content/${r.id}/versions`)).data.items;assert.ok(history.length>=3);
  const restored=await asA(`/api/admin/content/${r.id}/restore`,{method:'POST',data:{version:withdrawn.data.version,snapshotId:history[0].id,reason:'恢复历史资料核对'}});assert.equal(restored.data.status,'draft');assert.equal((await request(`/api/species/${r.id}`)).status,404);
  assert.ok((await asA('/api/admin/audit')).data.items.length>=4);
});
test('asset deletion removes derivative images, jobs, generated memories and stale exports',async()=>{
  const r=await asA(`/api/assets/${asset.id}`,{method:'DELETE'});assert.equal(r.status,200);assert.equal(r.data.deletion.localState,'completed');
  assert.equal((await asA(`/api/assets/${asset.id}/content`)).status,404);
  const memories=(await asA(`/api/memories?petId=${pet.id}`)).data.items;assert.equal(memories.length,1);assert.equal(memories[0].id,memory.id);assert.deepEqual(memories[0].assetIds,[]);
  assert.equal((await asA('/api/exports')).data.items.length,0);assert.equal((await asA('/api/jobs')).data.items.length,0);
});
test('deleting a pet removes media, memories, jobs and invalidates export snapshots',async()=>{
  const r=await asA(`/api/pets/${pet.id}`,{method:'DELETE',data:{confirm:pet.name,password}});assert.equal(r.status,200);assert.equal(r.data.localState,'completed');assert.equal(r.data.providerState,'not_applicable');
  assert.equal((await asA(`/api/assets/${asset.id}/content`)).status,404);assert.equal((await asA(`/api/memories/${memory.id}`)).status,404);assert.equal((await asA('/api/exports')).data.items.length,0);assert.equal((await asA('/api/jobs')).data.items.length,0);
});
test('logout invalidates the server-side session',async()=>{await asA('/api/auth/logout',{method:'POST'});assert.equal((await asA('/api/pets')).status,401);});
