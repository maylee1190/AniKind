import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createApp} from '../server/app.mjs';
import collection from '../server/globe-species.json' with {type:'json'};
globalThis.window={};globalThis.localStorage={getItem:()=> 'en'};
const {translate,tr,readLanguage,saveLanguage,localizeResponse}=await import('../public/js/i18n.js');
const V=await import('../public/js/views.js');
const {E}=await import('../public/js/api.js');
const han=/[\u3400-\u9fff]/;
const visible=html=>html.replace(/<[^>]*>/g,'');
let app,directory,base;
before(async()=>{directory=await mkdtemp(join(tmpdir(),'anikind-i18n-'));app=createApp({dataDir:directory,demo:true,aiMode:'disabled'});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));base=`http://127.0.0.1:${app.server.address().port}`;});
after(async()=>{await app?.close();await rm(directory,{recursive:true,force:true});delete globalThis.window;delete globalThis.localStorage;});
test('language preference validates values and works when storage is unavailable',()=>{
  const values=new Map(),storage={getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v)};
  assert.equal(readLanguage(storage),'zh-CN');assert.equal(saveLanguage('en',storage),true);assert.equal(readLanguage(storage),'en');
  assert.equal(saveLanguage('fr',storage),false);assert.equal(readLanguage(storage),'en');
  const blocked={getItem(){throw Error('blocked');},setItem(){throw Error('blocked');}};
  assert.equal(readLanguage(blocked),'zh-CN');assert.equal(saveLanguage('zh-CN',blocked),true);
});
test('translation changes authored labels without changing HTML values or interpolated private content',()=>{
  assert.equal(translate('拼图收藏','en'),'Puzzle collection');assert.equal(translate('拼图收藏','zh-CN'),'拼图收藏');
  assert.equal(translate('<option value="全球">全球</option>','en'),'<option value="全球">Global</option>');
  assert.equal(translate('<button aria-label="在地球上定位{8}">定位</button>','en'),'<button aria-label="Locate {8} on the globe">Locate</button>');
  assert.equal(tr`你好，${'小明 <script>{3}</script>'}。`,'Hello, 小明 <script>{3}</script>.');
  const html=V.petForm({name:'小熊猫',description:'这是我的私人记忆 <script>alert(1)</script>'});
  assert.ok(html.includes('value="小熊猫"'));assert.ok(html.includes(E('这是我的私人记忆 <script>alert(1)</script>')));assert.ok(!html.includes('<script>alert'));
  const privateResponse={name:'小熊猫',body:'真实记忆'};assert.equal(localizeResponse('/memories/1',privateResponse,'en'),privateResponse);
});
test('all forty species have English content while identifiers, coordinates and region filter values stay stable',()=>{
  const data={items:collection.map(s=>({id:String(s.id),name:s.name,scientificName:s.scientific,region:s.region,point:[s.lon,s.lat],habitat:s.ecosystem,threats:s.threat,summary:`${s.name}生活在${s.ecosystem}。了解它们的栖息地，也了解这个共同的世界。`}))};
  const localized=localizeResponse('/species?collection=figma',data,'en');
  for(let i=0;i<data.items.length;i++){const a=data.items[i],b=localized.items[i];assert.equal(b.id,a.id);assert.equal(b.region,a.region);assert.deepEqual(b.point,a.point);assert.equal(b.scientificName,a.scientificName);for(const key of ['name','summary','habitat','threats','regionLabel'])assert.ok(!han.test(b[key]),`${a.name}: ${key}`);}
  assert.ok(han.test(data.items[0].name));
});
test('public search accepts Chinese, English and scientific names for the same species',async()=>{
  const results=await Promise.all(['小熊猫','red panda','Ailurus fulgens'].map(async q=>(await (await fetch(base+'/api/species?collection=figma&q='+encodeURIComponent(q))).json()).items));
  assert.ok(results.every(items=>items.length===1&&items[0].id===results[0][0].id));
  assert.equal(results[0][0].englishName,'Red panda');
});
test('guest pages and forms have English labels',async()=>{
  const config=localizeResponse('/config',await (await fetch(base+'/api/config')).json(),'en');
  const S={user:null,config,pets:[],pet:null,jobs:[],memories:[],speciesFilters:{q:'',region:'',category:'',scope:''},speciesData:{items:[],total:0,datasetId:'test'},exports:[]};
  for(const [name,html]of [['memorial',V.memorial(S)],['settings',V.settings(S)],['auth',V.authForm()],['registration',V.authForm('register')],['pet',V.petForm()],['explore',V.explore(S)]])assert.ok(!han.test(visible(html)),`${name}: ${visible(html).match(/[^.]*[\u3400-\u9fff][^.]+/)?.[0]}`);
});
test('English puzzle cards use the same photos and saved progress; locked content stays locked',async()=>{
  const url='/api/puzzles/species-globe-8';
  const started=await fetch(base+url,{method:'POST',headers:{'Content-Type':'application/json','X-AniKind':'1'},body:JSON.stringify({action:'start'})});
  const cookie=started.headers.get('set-cookie').split(';')[0];let state=await started.json();
  const locked=localizeResponse(url.slice(4),state,'en');assert.deepEqual(locked.cards,[]);assert.deepEqual(locked.progress,state.progress);assert.equal(locked.challenge.image,state.challenge.image);
for(let i=0;!state.progress.completed&&i<state.challenge.rows*state.challenge.cols;i++)state=await (await fetch(base+url,{method:'POST',headers:{Cookie:cookie,'Content-Type':'application/json','X-AniKind':'1'},body:JSON.stringify({action:'hint',version:state.progress.version})})).json();
  const english=localizeResponse(url.slice(4),state,'en');assert.equal(english.cards.length,3);assert.equal(english.challenge.name,'Red panda');assert.deepEqual(english.progress,state.progress);
  for(const card of english.cards)for(const key of ['title','subtitle','section','body','fact','sourceTitle'])assert.ok(!han.test(card[key]),`${key}: ${card[key]}`);
  assert.equal(english.challenge.imageNote,'Red panda · Wildlife photograph');assert.equal(localizeResponse(url.slice(4),state,'zh-CN'),state);
});
