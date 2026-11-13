import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createApp} from '../server/app.mjs';
import photographs from '../server/wildlife-photos.json' with {type:'json'};
let app,directory,base,guest,current,wildlifeId;
const path='/api/puzzles/species-tiger';
async function request(url,{cookie,method='GET',data,csrf=true,origin}={}){
  const res=await fetch(base+url,{method,headers:{...(csrf?{'X-AniKind':'1'}:{}),...(cookie?{Cookie:cookie}:{}),...(data?{'Content-Type':'application/json'}:{}),...(origin?{Origin:origin}:{})},body:data?JSON.stringify(data):undefined});
  return {status:res.status,headers:res.headers,data:res.headers.get('content-type')?.includes('json')?await res.json():await res.text()};
}
async function boot(){app=createApp({dataDir:directory,demo:true,aiMode:'disabled'});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));base=`http://127.0.0.1:${app.server.address().port}`;}
const post=(data,cookie=guest,url=path)=>request(url,{method:'POST',data,cookie});
before(async()=>{directory=await mkdtemp(join(tmpdir(),'anikind-puzzles-'));await boot();});
after(async()=>{await app?.close();if(directory)await rm(directory,{recursive:true,force:true});});
test('puzzle catalogue uses visible Figma species and never returns locked card bodies',async()=>{
  const catalogue=await request('/api/puzzles'),species=await request('/api/species?collection=figma');
  const visible=species.data.items.filter(s=>s.point&&s.design&&s.iconAsset&&!s.design.emptyInFigma);
  assert.equal(catalogue.status,200);assert.equal(catalogue.data.items.length,visible.length);assert.equal(catalogue.headers.get('set-cookie'),null);
  for(const challenge of catalogue.data.items){assert.equal(challenge.cards,undefined);assert.equal(challenge.unlocked,false);}
  for(const s of visible){const c=catalogue.data.items.find(c=>c.id===s.id);assert.notEqual(c.image,s.iconAsset);assert.match(c.image,/^\/assets\/wildlife-photos\/\d+\.jpg$/);assert.equal(c.name,s.name);assert.equal(c.photo.scientificName,s.scientificName);assert.equal(c.cover,c.image);}
  assert.deepEqual(catalogue.data.items.map(c=>c.id).sort(),visible.map(s=>s.id).sort());
  assert.equal((await request('/api/puzzles/fossil-triceratops')).status,404);
  assert.equal((await post({action:'start'},null,'/api/puzzles/fossil-triceratops')).status,404);
  wildlifeId=visible[0].id;
  const locked=await request(path);assert.equal(locked.data.progress,null);assert.deepEqual(locked.data.cards,[]);
  assert.equal((await request('/api/puzzles/not-found')).status,404);
});
test('guest start creates a private persistent unsolved permutation and is idempotent',async()=>{
  const first=await post({action:'start'});assert.equal(first.status,200);guest=first.headers.get('set-cookie').split(';')[0];current=first.data;
  assert.match(first.headers.get('set-cookie'),/HttpOnly; SameSite=Strict/);
  assert.equal(current.scope,'browser');assert.equal(current.progress.completed,false);assert.equal(current.progress.moves,0);
  assert.deepEqual([...current.progress.board].sort((a,b)=>a-b),Array.from({length:12},(_,i)=>i));assert.deepEqual(current.cards,[]);
  assert.deepEqual((await post({action:'start'})).data,current);
  const other=await post({action:'start'},null);assert.ok(other.headers.get('set-cookie'));assert.notEqual(other.headers.get('set-cookie'),first.headers.get('set-cookie'));
  assert.equal((await request(path)).data.progress,null);
});
test('CSRF, forged completion, invalid swaps and stale versions cannot unlock or overwrite progress',async()=>{
  const state=structuredClone(current),version=current.progress.version;
  assert.equal((await request(path,{method:'POST',data:{action:'hint',version},cookie:guest,csrf:false})).status,403);
  assert.equal((await request(path,{method:'POST',data:{action:'hint',version},cookie:guest,origin:'https://elsewhere.example'})).status,403);
  for(const data of [{action:'complete',completed:true,unlockedAt:'now'},{action:'swap',from:0,to:1},{action:'swap',version,from:-1,to:1},{action:'swap',version,from:0,to:12},{action:'swap',version,from:0,to:0},{action:'swap',version,from:'0',to:1}])assert.equal((await post(data)).status,422);
  assert.equal((await post({action:'hint',version:version+1})).status,409);
  assert.deepEqual((await request(path,{cookie:guest})).data,state);
  const forged=await post({action:'start',board:Array.from({length:12},(_,i)=>i),completed:true,unlockedAt:'now'});assert.deepEqual(forged.data,state);
});
test('valid swaps and hints persist across server restarts; only a solved board unlocks cards',async()=>{
  const board=current.progress.board,from=board.findIndex((piece,i)=>piece!==i),to=board.indexOf(from),oldVersion=current.progress.version;
  const step=await post({action:'swap',version:oldVersion,from,to});assert.equal(step.status,200);current=step.data;
  assert.equal(current.progress.board[from],from);assert.equal(current.progress.moves,1);
  assert.equal((await post({action:'hint',version:oldVersion})).status,409);
  await app.close();await boot();assert.deepEqual((await request(path,{cookie:guest})).data,current);
  for(let tries=0;!current.progress.completed&&tries<12;tries++){
    assert.deepEqual(current.cards,[]);const previous=current.progress.correct;
    const next=await post({action:'hint',version:current.progress.version});assert.equal(next.status,200);current=next.data;assert.ok(current.progress.correct>previous);
  }
  assert.equal(current.progress.correct,12);assert.equal(current.progress.completed,true);assert.ok(current.progress.unlockedAt);assert.equal(current.cards.length,3);assert.equal(current.cards[0].title,'虎');
  const catalog=await request('/api/puzzles',{cookie:guest});assert.equal(catalog.data.items.find(c=>c.id===current.challenge.id).unlocked,true);
  const unlockedAt=current.progress.unlockedAt;current=(await post({action:'restart',version:current.progress.version})).data;
  assert.equal(current.progress.completed,false);assert.equal(current.progress.moves,0);assert.equal(current.progress.unlockedAt,unlockedAt);assert.equal(current.cards.length,3);
  assert.equal((await request(path)).data.cards.length,0);
});
test('account progress is isolated from guest and other accounts and removed on account deletion',async()=>{
  const password='Puzzle-test-only-password-24';
  async function account(email){const r=await request('/api/auth/register',{method:'POST',data:{name:'拼图测试',email,password,adult:true}});assert.equal(r.status,200);return r.headers.get('set-cookie').split(';')[0];}
  const a=await account('puzzle-a@example.test'),b=await account('puzzle-b@example.test');
  const first=await post({action:'start'},a+'; '+guest);assert.equal(first.data.scope,'account');assert.deepEqual(first.data.cards,[]);
  const moved=await post({action:'hint',version:first.data.progress.version},a);assert.equal(moved.data.progress.moves,1);
  assert.equal((await request(path,{cookie:b})).data.progress,null);
  assert.deepEqual((await request(path,{cookie:guest})).data,current);
  assert.equal((await request('/api/account',{cookie:a,method:'DELETE',data:{confirm:'删除我的账户',password}})).status,200);
  const a2=await account('puzzle-a@example.test');assert.equal((await request(path,{cookie:a2})).data.progress,null);
});
test('animal puzzles unlock their own species cards and withdrawn content stays unavailable',async()=>{
  const url='/api/puzzles/'+wildlifeId;
  let animal=(await post({action:'start'},guest,url)).data;assert.equal(animal.challenge.rows*animal.challenge.cols,12);
  for(let tries=0;!animal.progress.completed&&tries<12;tries++)animal=(await post({action:'hint',version:animal.progress.version},guest,url)).data;
  assert.equal(animal.cards.length,3);assert.equal(animal.cards[0].title,animal.challenge.name);
  const s=app.store.get(wildlifeId);app.store.update(s.id,{},s.version,'withdrawn');
  assert.equal((await request(url,{cookie:guest})).status,404);
  assert.ok(!(await request('/api/puzzles',{cookie:guest})).data.items.some(c=>c.id===wildlifeId));
});
test('puzzle images and masks are served locally',async()=>{
  for(const file of ['/assets/wildlife-photos/triceratops.jpg','/assets/wildlife-photos/1.jpg','/assets/puzzle/75591.svg','/puzzle.css','/js/puzzles.js'])assert.equal((await request(file)).status,200);
});
test('active and archived photographs have a species identity, local JPEG, dimensions and attribution',async()=>{
  assert.equal(photographs.length,32);assert.equal(new Set(photographs.map(p=>p.path)).size,32);
  for(const p of photographs){
    assert.ok(p.author&&p.license&&p.scientificName&&p.name);assert.ok(p.width>=200&&p.height>=200);assert.ok(['photograph','skeleton-photograph'].includes(p.kind));
    assert.match(p.sourceUrl,/^https:\/\/(commons\.wikimedia\.org|www\.qld\.gov\.au)\//);assert.match(p.licenseUrl,/^https:\/\//);
    const bytes=await readFile(new URL('../public'+p.path,import.meta.url));assert.deepEqual([...bytes.subarray(0,3)],[255,216,255]);assert.equal(createHash('sha256').update(bytes).digest('hex'),p.sha256);
  }
  const vaquita=photographs.find(p=>p.recordId===20);assert.match(vaquita.author,/Olson/);assert.equal(vaquita.kind,'photograph');
  const wombat=photographs.find(p=>p.recordId===31);assert.match(wombat.sourceUrl,/qld\.gov\.au/);assert.equal(wombat.scientificName,'Lasiorhinus krefftii');
  assert.ok((await request('/api/puzzles')).data.items.every(c=>c.kind==='wildlife'&&c.photo.kind==='photograph'));
});

test('animals without a globe marker are unavailable through catalogue and direct puzzle access',async()=>{
  const species=app.store.get('species-tiger');
  for(const change of [{point:null},{design:null},{iconAsset:null},{design:{...species.design,emptyInFigma:true}}]){
    const currentSpecies=app.store.get(species.id);app.store.update(species.id,change,currentSpecies.version);
    assert.ok(!(await request('/api/puzzles',{cookie:guest})).data.items.some(c=>c.id===species.id));
    assert.equal((await request(path,{cookie:guest})).status,404);
    assert.equal((await post({action:'start'})).status,404);
    const modified=app.store.get(species.id);app.store.update(species.id,{point:species.point,design:species.design,iconAsset:species.iconAsset},modified.version);
  }
  assert.equal((await request(path,{cookie:guest})).status,200);
});
