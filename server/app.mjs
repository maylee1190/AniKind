import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { ROOT, openStore, fail, assert, date, count, text, secureURL, now, uid } from './core.mjs';
import { authentication } from './auth.mjs';
import { validateMedia, hash, archive, labeledImage } from './media.mjs';
import { generation, ACTIVE } from './generation.mjs';
import { seed, SCENES } from './seed.mjs';
import { puzzleService } from './puzzles.mjs';
import { SPECIES_EN } from '../public/js/locales/species-en.js';

const MIME = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json','.geojson':'application/geo+json','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.ico':'image/x-icon','.webmanifest':'application/manifest+json'};
async function body(req, max = 1024*1024, binary = false) {
  if (Number(req.headers['content-length']) > max) fail(413,'FILE_TOO_LARGE','提交内容超出大小限制');
  const chunks=[];let size=0;
  for await(const chunk of req){size+=chunk.length;if(size>max)fail(413,'FILE_TOO_LARGE','提交内容超出大小限制');chunks.push(chunk);}
  const buffer=Buffer.concat(chunks);
  if(binary)return buffer;
  try{const value=buffer.length?JSON.parse(buffer.toString('utf8')):{};assert(value&&typeof value==='object'&&!Array.isArray(value),'请求格式错误');return value;}catch(e){if(e.status)throw e;fail(400,'INVALID_JSON','请求格式错误');}
}
function petInput(data) {
  const name=typeof data.name==='string'?data.name.trim():''; assert(count(name)>=1&&count(name)<=30,'宠物名称需要 1–30 个字符');
  assert(['dog','cat','other','unknown'].includes(data.species),'请选择宠物种类');
  const birthDate=date(data.birthDate),memorialDate=date(data.memorialDate);
  assert(!birthDate||!memorialDate||birthDate<=memorialDate,'出生日期不能晚于纪念日期');
  return {name,species:data.species,breed:text(data.breed,100),traits:text(data.traits,200),birthDate,memorialDate,location:text(data.location,100),description:text(data.description,1000)};
}
function speciesInput(data, publish = false) {
  const record={};
  for(const key of ['name','englishName','scientificName','region','category','scope','habitat','summary','threats','sourcePublisher','sourceVersion','sourceLicense','assessmentSystem','actionOrganization','actionPurpose'])record[key]=text(data[key],key==='summary'||key==='threats'?3000:500);
  record.sourceUrl=secureURL(data.sourceUrl);record.assessedAt=date(data.assessedAt);record.actionUrl=secureURL(data.actionUrl);record.actionVerifiedAt=date(data.actionVerifiedAt);
  record.icon=text(data.icon,10)||'🌿';record.point=Array.isArray(data.point)&&data.point.length===2&&data.point.every(Number.isFinite)&&Math.abs(data.point[0])<=180&&Math.abs(data.point[1])<=90?data.point:null;
  record.assessments=Array.isArray(data.assessments)?data.assessments.slice(0,20).map(a=>({category:text(a.category,2),scope:text(a.scope,100),assessedAt:date(a.assessedAt),sourceUrl:secureURL(a.sourceUrl),system:text(a.system,100)})):[];
  assert(record.name&&record.scientificName,'中文名称和学名不能为空');
  assert(['CR','EN','VU','NT','LC','DD','NE','EW','EX'].includes(record.category),'保护等级无效');
  if(publish){
    assert(record.sourceUrl&&record.sourceLicense&&record.sourcePublisher&&record.sourceVersion&&record.assessedAt&&record.scope&&record.assessmentSystem&&record.region,'发布前需补全来源、授权、版本、评估日期、评估体系和地区范围');
    for(const a of record.assessments)assert(['CR','EN','VU','NT','LC','DD','NE','EW','EX'].includes(a.category)&&a.scope&&a.assessedAt&&a.sourceUrl&&a.system,'附加评估缺少来源或范围');
    assert(!record.actionUrl||(record.actionOrganization&&record.actionPurpose&&record.actionVerifiedAt),'行动入口需要机构、目的和核验日期');
  }
  return record;
}

export function createApp(options = {}) {
  const production=options.production??process.env.NODE_ENV==='production';
  const config={ production,demo:options.demo??(!production&&process.env.DEMO_CONTENT!=='false'),aiMode:options.aiMode||process.env.AI_MODE||'disabled',dailyLimit:Number(process.env.AI_DAILY_LIMIT)||5,platformLimit:Number(process.env.AI_PLATFORM_DAILY_LIMIT)||100,aiEndpoint:process.env.AI_ENDPOINT,aiKey:process.env.AI_API_KEY,aiModel:process.env.AI_MODEL,...options };
  if(!['disabled','demo','http'].includes(config.aiMode))throw new Error('AI_MODE must be disabled, demo or http.');
  if(production&&(config.demo||config.aiMode==='demo'))throw new Error('Production must disable all demo data and AI simulation.');
  if(config.aiMode==='http'&&(!secureURL(config.aiEndpoint)||!config.aiKey||!config.aiModel))throw new Error('HTTP AI provider requires HTTPS endpoint, key and model.');
  const store=openStore(options.dataDir),auth=authentication(store,production);seed(store,config.demo);
  const ai=generation(store,config);let closed=false;
  const timers=new Set();
  function later(fn){const timer=setTimeout(()=>{timers.delete(timer);if(!closed)fn();},20);timers.add(timer);}
  function publicSpecies(){return store.list('species').filter(s=>s.status==='published'||(config.demo&&s.status==='demo')).map(s=>({...s,englishName:s.englishName||SPECIES_EN[s.scientificName]||''}));}
  const puzzles=puzzleService(store,auth,config,publicSpecies);
  function deleteScope(user, petId) {
    const rows=store.db.prepare('SELECT id FROM records WHERE owner_id=?').all(user.id).map(x=>store.get(x.id)).filter(r=>!petId||r.petId===petId||r.id===petId||r.type==='export');
    const providerJobs=rows.filter(r=>r.type==='job'&&!r.isDemo&&r.status!=='queued').map(r=>r.id);
    const deletion=store.tx(()=>{
      for(const row of rows){if(row.type==='job')ai.cancel(row.id,'资料已删除');store.remove(row.id);}
      store.db.prepare('DELETE FROM idempotency WHERE owner_id=?').run(user.id);
      return store.create('deletion',{scope:petId?'pet':'account',objectCount:rows.length,localState:'completed',providerState:providerJobs.length?'pending':'not_applicable',providerJobs,backupState:'not_configured',completedAt:providerJobs.length?null:now()},{owner:user.id,status:providerJobs.length?'pending':'completed'});
    });
    store.audit(user.id,'delete_scope',deletion.id,{scope:petId?'pet':'account',objectCount:rows.length});
    return deletion;
  }
  async function retryProviderDeletions(){
    if(closed||config.aiMode!=='http')return;
    for(const d of store.list('deletion').filter(d=>d.status==='pending')){
      try{
        for(const id of d.providerJobs){const res=await fetch(`${config.aiEndpoint.replace(/\/$/,'')}/${encodeURIComponent(id)}`,{method:'DELETE',headers:{Authorization:`Bearer ${config.aiKey}`},signal:AbortSignal.timeout(10_000)});if(![200,204].includes(res.status))throw new Error('pending');}
        if(!closed)store.update(d.id,{providerState:'completed',completedAt:now(),providerJobs:[]},undefined,'completed');
      }catch{ /* Pending remains visible; never claim vendor erasure prematurely. */ }
    }
  }
  function housekeeping(){
    if(closed)return;
    for(const item of store.list('export'))if(item.expiresAt<now()&&item.status!=='expired'){
      store.db.prepare('DELETE FROM blobs WHERE id=?').run(item.id);
      store.update(item.id,{reason:'导出已过期，请重新申请'},undefined,'expired');
    }
    store.db.prepare('DELETE FROM sessions WHERE expires_at<?').run(Date.now());
    void retryProviderDeletions();
  }
  const deletionTimer=setInterval(housekeeping,30_000);deletionTimer.unref();housekeeping();
  const server=createServer(async(req,res)=>{
    const traceId=uid();
    res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');
    res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'");
    res.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=()');
    if(production)res.setHeader('Strict-Transport-Security','max-age=31536000');
    const send=(data,status=200)=>{if(res.writableEnded)return;res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(data));};
    try {
      const url=new URL(req.url,'http://localhost'),path=url.pathname,method=req.method;
      if(path.startsWith('/api/')){
        res.setHeader('Cache-Control','no-store');
        if(!['GET','HEAD'].includes(method)){
          if(req.headers['x-anikind']!=='1')fail(403,'CSRF_BLOCKED','请求验证失败，请刷新后重试');
          if(req.headers.origin){const origin=new URL(req.headers.origin);if(origin.host!==req.headers.host)fail(403,'ORIGIN_BLOCKED','请求来源不匹配');}
        }
        if(path==='/api/health'&&method==='GET')return send({status:'ok',service:'anikind',version:'0.1.0'});
        if(path==='/api/config'&&method==='GET')return send({demo:config.demo,aiMode:config.aiMode,generationEnabled:store.setting('generationEnabled',true),mediaVideoEnabled:!!process.env.FFPROBE_PATH,scenes:SCENES,consentVersion:'2026-09-v1'});
        if(path==='/api/session'&&method==='GET')return send({user:auth.current(req)});
        if(['/api/auth/register','/api/auth/login'].includes(path)&&method==='POST')return send({user:await auth.signIn(req,res,await body(req),path.endsWith('register'))});
        if(path==='/api/auth/logout'&&method==='POST'){auth.logout(req,res);return send({ok:true});}
        if(path==='/api/species'&&method==='GET'){
          const q=text(url.searchParams.get('q'),200).toLowerCase(),region=url.searchParams.get('region'),category=url.searchParams.get('category'),scope=url.searchParams.get('scope');
          const collection=url.searchParams.get('collection');
          const items=publicSpecies().filter(s=>(collection!=='figma'||s.datasetId==='anikind-figma-wildlife-v1')&&(!q||`${s.name} ${s.englishName} ${s.scientificName}`.toLowerCase().includes(q))&&(!region||s.region===region||(region==='美洲'&&s.region.endsWith('美洲'))||(region==='海洋'&&['全球海洋','南部海岛'].includes(s.region)))&&(!category||s.category===category)&&(!scope||s.scope===scope)).sort((a,b)=>(a.sourceRecordId||1000)-(b.sourceRecordId||1000));
          return send({items,total:items.length,mapped:items.filter(s=>s.design).length,coverage:'此前物种图谱收录的代表物种，非全球受威胁物种总数',datasetId:collection==='figma'?'anikind-figma-wildlife-v1':config.demo?'anikind-editorial-examples-v1':'anikind-reviewed-v1',updatedAt:items.reduce((v,s)=>s.updatedAt>v?s.updatedAt:v,''),demo:items.some(s=>s.isDemo)});
        }
        const speciesPath=path.match(/^\/api\/species\/([^/]+)$/);
        if(speciesPath&&method==='GET'){const s=publicSpecies().find(s=>s.id===speciesPath[1]);if(!s)fail(404,'SPECIES_NOT_FOUND','当前资料库未收录');return send(s);}
        if(path==='/api/puzzles'&&method==='GET')return send(puzzles.list(req,res));
        const puzzlePath=path.match(/^\/api\/puzzles\/([a-zA-Z0-9-]+)$/);
        if(puzzlePath&&method==='GET')return send(puzzles.get(req,res,puzzlePath[1]));
        if(puzzlePath&&method==='POST')return send(puzzles.update(req,res,puzzlePath[1],await body(req)));
        const user=auth.require(req);
        if(path==='/api/settings'&&method==='PATCH'){
          const data=await body(req),next={...user};
          for(const key of ['processingConsent','aiConsent','pauseAI','hideAI','ecoRecommendations','notifications'])if(data[key]!==undefined){assert(typeof data[key]==='boolean','设置值必须为布尔值');next[key]=data[key];}
          if(data.name!==undefined){next.name=text(data.name,40);assert(next.name,'昵称不能为空');}
          for(const purpose of ['processingConsent','aiConsent','notifications'])if(next[purpose]!==user[purpose])store.create('consent',{purpose,version:'2026-09-v1',granted:next[purpose],recordedAt:now()},{owner:user.id});
          const{id,email,role,createdAt,...profile}=next;
          store.db.prepare('UPDATE users SET data=? WHERE id=?').run(JSON.stringify(profile),user.id);
          if(!next.processingConsent||!next.aiConsent||next.pauseAI)for(const j of store.list('job',user.id))if(ACTIVE.includes(j.status))ai.cancel(j.id,'创作授权已撤销或已暂停');
          return send({user:next});
        }
        if(path==='/api/consents'&&method==='GET')return send({items:store.list('consent',user.id)});
        if(path==='/api/pets'&&method==='GET')return send({items:store.list('pet',user.id)});
        if(path==='/api/pets'&&method==='POST'){assert(store.list('pet',user.id).length<3,'每个账号最多创建 3 个宠物档案');return send(store.create('pet',petInput(await body(req)),{owner:user.id}),201);}
        const petPath=path.match(/^\/api\/pets\/([^/]+)$/);
        if(petPath){const pet=store.owned(petPath[1],user.id,'pet');
          if(method==='GET')return send(pet);
          if(method==='PATCH'){const data=await body(req);assert(Number.isInteger(data.version),'请携带档案版本号');const fields=petInput(data);if(data.avatarId!==undefined){if(data.avatarId){const a=store.owned(data.avatarId,user.id,'asset');assert(a.petId===pet.id&&a.kind==='image'&&!a.generated,'请选择当前宠物的原始照片');}fields.avatarId=data.avatarId||null;fields.avatarKind='original';}return send(store.update(pet.id,fields,data.version));}
          if(method==='DELETE'){const data=await body(req);assert(data.confirm===pet.name,'请输入宠物名称确认删除');await auth.reauth(user,data.password);return send(deleteScope(user,pet.id));}
        }
        if(path==='/api/assets'&&method==='GET'){const petId=url.searchParams.get('petId');store.owned(petId,user.id,'pet');return send({items:store.list('asset',user.id).filter(a=>a.petId===petId)});}
        if(path==='/api/assets'&&method==='POST'){
          assert(user.processingConsent,'上传前请先确认素材处理授权');
          const petId=url.searchParams.get('petId');store.owned(petId,user.id,'pet');
          const bytes=await body(req,200*1024*1024,true),info=await validateMedia(bytes),checksum=hash(bytes);
          // Authorization and ownership may have changed while the stream was uploading.
          const current=auth.require(req);assert(current.processingConsent,'素材处理授权已撤销');store.owned(petId,current.id,'pet');
          const existing=store.list('asset',user.id).find(a=>a.petId===petId&&a.hash===checksum&&!a.generated);if(existing)return send({...existing,duplicate:true});
          const used=store.list('asset',user.id).reduce((n,a)=>n+a.size,0);if(used+bytes.length>2*1024**3)fail(413,'STORAGE_LIMIT','账号 2 GB 存储额度已用完');
          const asset=store.tx(()=>{const a=store.create('asset',{...info,size:bytes.length,hash:checksum,name:text(url.searchParams.get('name'),200)||`素材.${info.ext}`,generated:false},{owner:user.id,pet:petId});store.db.prepare('INSERT INTO blobs VALUES(?,?)').run(a.id,bytes);return a;});return send(asset,201);
        }
        const assetPath=path.match(/^\/api\/assets\/([^/]+)(\/content)?$/);
        if(assetPath){const asset=store.owned(assetPath[1],user.id,'asset');
          if(method==='GET'&&assetPath[2]){
            const bytes=Buffer.from(store.db.prepare('SELECT bytes FROM blobs WHERE id=?').get(asset.id).bytes);
            res.setHeader('Content-Type',asset.mime);res.setHeader('Accept-Ranges','bytes');
            if(req.headers.range){const m=/^bytes=(\d+)-(\d*)$/.exec(req.headers.range);if(!m)fail(416,'RANGE_INVALID','媒体范围无效');const start=Number(m[1]),end=m[2]?Number(m[2]):bytes.length-1;if(start>end||end>=bytes.length)fail(416,'RANGE_INVALID','媒体范围无效');res.writeHead(206,{'Content-Range':`bytes ${start}-${end}/${bytes.length}`,'Content-Length':end-start+1});return res.end(bytes.subarray(start,end+1));}
            res.setHeader('Content-Length',bytes.length);return res.end(bytes);
          }
          if(method==='DELETE'){
            const jobs=store.list('job',user.id).filter(j=>j.assetIds.includes(asset.id)||j.result?.assetId===asset.id);
            const affectedIds=new Set([asset.id,...jobs.map(j=>j.result?.assetId).filter(Boolean)]);
            const providerJobs=jobs.filter(j=>!j.isDemo&&j.status!=='queued').map(j=>j.id);
            const deletion=store.tx(()=>{
              for(const j of jobs){if(ACTIVE.includes(j.status))ai.cancel(j.id,'参考素材已删除');store.remove(j.id);}
              for(const m of store.list('memory',user.id)){
                if(m.kind==='generated'&&(m.sourceIds?.includes(asset.id)||m.assetIds?.some(id=>affectedIds.has(id))))store.remove(m.id);
                else if(m.assetIds?.includes(asset.id))store.update(m.id,{assetIds:m.assetIds.filter(id=>id!==asset.id)});
              }
              const pet=store.get(asset.petId);if(affectedIds.has(pet?.avatarId))store.update(pet.id,{avatarId:null});
              for(const id of affectedIds)store.remove(id);
              for(const e of store.list('export',user.id))store.remove(e.id);
              return store.create('deletion',{scope:'asset',objectCount:affectedIds.size+jobs.length,localState:'completed',providerState:providerJobs.length?'pending':'not_applicable',providerJobs,backupState:'not_configured',completedAt:providerJobs.length?null:now()},{owner:user.id,status:providerJobs.length?'pending':'completed'});
            });
            return send({ok:true,deletion});
          }
        }
        if(path==='/api/memories'&&method==='GET'){
          const petId=url.searchParams.get('petId');store.owned(petId,user.id,'pet');const q=text(url.searchParams.get('q'),200).toLowerCase(),kind=url.searchParams.get('kind');
          const items=store.list('memory',user.id).filter(m=>m.petId===petId&&(!q||`${m.title} ${m.body}`.toLowerCase().includes(q))&&(!kind||m.kind===kind)&&(!user.hideAI||m.kind!=='generated')&&(url.searchParams.get('favorite')!=='true'||m.favorite));
          items.sort((a,b)=>url.searchParams.get('sort')==='oldest'?(a.eventDate||'9999').localeCompare(b.eventDate||'9999'):(b.eventDate||'').localeCompare(a.eventDate||''));return send({items});
        }
        if(path==='/api/memories'&&method==='POST'){
          const data=await body(req);store.owned(data.petId,user.id,'pet');const title=text(data.title,120),content=text(data.body,10000);assert(title,'请填写记忆标题');
          const assetIds=Array.isArray(data.assetIds)?[...new Set(data.assetIds)]:[];assert(assetIds.length<=20,'每条记忆最多 20 个素材');
          for(const id of assetIds){const a=store.owned(id,user.id,'asset');assert(a.petId===data.petId&&!a.generated,'请选择当前宠物的原始素材');}
          assert(content||assetIds.length,'请写下一段文字或添加素材');
          const key=req.headers['idempotency-key'];assert(typeof key==='string'&&/^[\w-]{8,100}$/.test(key),'缺少有效提交标识');const fp=hash(JSON.stringify(data));const old=store.db.prepare('SELECT * FROM idempotency WHERE owner_id=? AND key=?').get(user.id,key);
          if(old){if(old.fingerprint!==fp)fail(409,'IDEMPOTENCY_CONFLICT','提交标识已用于其他内容');const r=store.get(old.result_id);if(!r)fail(410,'RESULT_DELETED','记录已删除');return send(r);}
          const memory=store.tx(()=>{const m=store.create('memory',{title,body:content,originalBody:content,eventDate:date(data.eventDate),kind:'original',assetIds,favorite:false},{owner:user.id,pet:data.petId});store.db.prepare('INSERT INTO idempotency VALUES(?,?,?,?)').run(user.id,key,fp,m.id);return m;});return send(memory,201);
        }
        const memoryPath=path.match(/^\/api\/memories\/([^/]+)$/);
        if(memoryPath){const m=store.owned(memoryPath[1],user.id,'memory');
          if(method==='GET')return send(m);
          if(method==='PATCH'){const data=await body(req);assert(Number.isInteger(data.version),'请携带记忆版本号');const fields={};if(data.title!==undefined){fields.title=text(data.title,120);assert(fields.title,'标题不能为空');}if(data.body!==undefined)fields.body=text(data.body,10000);if(data.eventDate!==undefined)fields.eventDate=date(data.eventDate);if(data.favorite!==undefined){assert(typeof data.favorite==='boolean','收藏状态无效');fields.favorite=data.favorite;}return send(store.update(m.id,fields,data.version));}
          if(method==='DELETE'){store.remove(m.id);return send({ok:true});}
        }
        if(path==='/api/jobs'&&method==='POST')return send(ai.create(user,await body(req),req.headers['idempotency-key']),201);
        if(path==='/api/jobs'&&method==='GET')return send({items:store.list('job',user.id),quota:ai.quota(user.id)});
        const jobPath=path.match(/^\/api\/jobs\/([^/]+)(?:\/(cancel|accept|reject))?$/);
        if(jobPath){const job=store.owned(jobPath[1],user.id,'job');if(method==='GET'&&!jobPath[2])return send(job);if(method==='POST'&&jobPath[2])return send(jobPath[2]==='cancel'?ai.cancel(job.id):ai.decide(user,job.id,jobPath[2]==='accept'));}
        if(path==='/api/exports'&&method==='GET')return send({items:store.list('export',user.id).map(({...r})=>r)});
        if(path==='/api/exports'&&method==='POST'){
          const data=await body(req);await auth.reauth(user,data.password);if(data.petId)store.owned(data.petId,user.id,'pet');
          if(store.list('export',user.id).some(e=>['queued','processing'].includes(e.status)))fail(409,'EXPORT_ACTIVE','已有导出任务正在处理');
          const item=store.create('export',{scope:data.petId||'account',expiresAt:new Date(Date.now()+86400_000).toISOString()},{owner:user.id,pet:data.petId||null,status:'queued'});
          later(()=>{
            if(!store.get(item.id))return;
            try{
              store.update(item.id,{},undefined,'processing');
              const pets=store.list('pet',user.id).filter(p=>!data.petId||p.id===data.petId),memories=store.list('memory',user.id).filter(m=>pets.some(p=>p.id===m.petId)),assets=store.list('asset',user.id).filter(a=>pets.some(p=>p.id===a.petId));
              const entries=[{name:'manifest.json',data:JSON.stringify({product:'AniKind',exportedAt:now(),pets,memories,assets,consents:store.list('consent',user.id),notice:'原始素材与 AI 创作分别标记；下载到应用外后无法撤回。'},null,2)}];
              for(const a of assets){const bytes=Buffer.from(store.db.prepare('SELECT bytes FROM blobs WHERE id=?').get(a.id).bytes);entries.push({name:`assets/${a.id}.${a.generated?'svg':a.ext||'bin'}`,data:a.generated?labeledImage(bytes,a.mime,a.isDemo?'本地模板演示 · 非 AI 生成':'AI 创作 · 虚构内容'):bytes});}
              const bytes=archive(entries);store.db.prepare('INSERT INTO blobs VALUES(?,?)').run(item.id,bytes);store.update(item.id,{size:bytes.length,assetCount:assets.length,memoryCount:memories.length},undefined,'ready');
            }catch{store.update(item.id,{reason:'导出未完成，请重试'},undefined,'failed');}
          });return send(item,202);
        }
        const exportPath=path.match(/^\/api\/exports\/([^/]+)\/download$/);
        if(exportPath&&method==='GET'){
          const item=store.owned(exportPath[1],user.id,'export');if(item.expiresAt<now()){store.db.prepare('DELETE FROM blobs WHERE id=?').run(item.id);fail(410,'EXPORT_EXPIRED','导出链接已过期，请重新申请');}assert(item.status==='ready','导出尚未完成');res.setHeader('Content-Type','application/gzip');res.setHeader('Content-Disposition',"attachment; filename=anikind-memories.tar.gz; filename*=UTF-8''AniKind-%E8%AE%B0%E5%BF%86%E5%AF%BC%E5%87%BA.tar.gz");return res.end(Buffer.from(store.db.prepare('SELECT bytes FROM blobs WHERE id=?').get(item.id).bytes));
        }
        if(path==='/api/deletions'&&method==='GET')return send({items:store.list('deletion',user.id)});
        if(path==='/api/account'&&method==='DELETE'){const data=await body(req);assert(data.confirm==='删除我的账户','请输入“删除我的账户”确认');await auth.reauth(user,data.password);const deletion=deleteScope(user);store.db.prepare('DELETE FROM users WHERE id=?').run(user.id);auth.logout(req,res);return send({deletion});}
        if(path==='/api/reports'&&method==='POST'){const data=await body(req);assert(publicSpecies().some(s=>s.id===data.speciesId),'资料不存在');assert(text(data.reason,2000).length>=5,'请至少填写 5 个字符说明问题');return send(store.create('report',{speciesId:data.speciesId,reason:text(data.reason,2000)},{owner:user.id,status:'open'}),201);}
        if(path.startsWith('/api/admin/')){
          auth.role(user,['editor','reviewer','admin']);
          if(path==='/api/admin/content'&&method==='GET')return send({items:store.list('species'),reports:store.list('report').map(({ownerId,...r})=>r),generationEnabled:store.setting('generationEnabled',true)});
          if(path==='/api/admin/audit'&&method==='GET')return send({items:store.db.prepare('SELECT * FROM audit ORDER BY created_at DESC LIMIT 100').all()});
          if(path==='/api/admin/content'&&method==='POST'){auth.role(user,['editor','admin']);const data=speciesInput(await body(req));const r=store.create('species',{...data,editorId:user.id,isDemo:false},{status:'draft'});store.audit(user.id,'content_create',r.id);return send(r,201);}
          const historyPath=path.match(/^\/api\/admin\/content\/([^/]+)\/(versions|restore)$/);
          if(historyPath){
            const content=store.get(historyPath[1]);assert(content?.type==='species','资料不存在');
            if(method==='GET'&&historyPath[2]==='versions')return send({items:store.list('contentVersion').filter(v=>v.contentId===content.id)});
            if(method==='POST'&&historyPath[2]==='restore'){
              auth.role(user,['editor','admin']);const data=await body(req);assert(data.version===content.version,'版本已变化，请刷新');assert(content.status!=='published','请先下架，再恢复历史版本');
              const snapshot=store.get(data.snapshotId);assert(snapshot?.type==='contentVersion'&&snapshot.contentId===content.id,'历史版本不存在');assert(text(data.reason),'请填写恢复原因');
              store.create('contentVersion',{contentId:content.id,snapshot:content,action:'restore',actorId:user.id,reason:text(data.reason)});
              const restored=store.update(content.id,{...speciesInput(snapshot.snapshot),editorId:user.id,reviewerId:null,reviewedAt:null,isDemo:false,reason:text(data.reason)},content.version,'draft');
              store.audit(user.id,'content_restore',content.id,{snapshotId:snapshot.id,reason:text(data.reason)});return send(restored);
            }
          }
          const contentPath=path.match(/^\/api\/admin\/content\/([^/]+)(?:\/(submit|publish|reject|withdraw))?$/);
          if(contentPath){const r=store.get(contentPath[1]);if(!r||r.type!=='species')fail(404,'NOT_FOUND','资料不存在');const action=contentPath[2];
            if(method==='PATCH'&&!action){auth.role(user,['editor','admin']);assert(['draft','rejected','withdrawn','demo'].includes(r.status),'请先撤下已发布内容再修改');const data=await body(req);assert(Number.isInteger(data.version),'请携带版本号');const edited=store.update(r.id,{...speciesInput(data),editorId:user.id,isDemo:false,reviewerId:null},data.version,'draft');store.audit(user.id,'content_edit',r.id);return send(edited);}
            if(method==='POST'&&action){const data=await body(req);assert(data.version===r.version,'内容版本已变化，请刷新后重试');let status;
              if(action==='submit'){auth.role(user,['editor','admin']);assert(['draft','rejected'].includes(r.status),'当前内容不可提交审核');speciesInput(r,true);status='pending';}
              if(action==='publish'){auth.role(user,['reviewer','admin']);assert(r.status==='pending','仅可发布待审核版本');assert(r.editorId!==user.id,'编辑不能审核自己提交的内容');speciesInput(r,true);status='published';}
              if(action==='reject'){auth.role(user,['reviewer','admin']);assert(r.status==='pending','仅可驳回待审核版本');assert(text(data.reason),'请填写驳回原因');status='rejected';}
              if(action==='withdraw'){auth.role(user,['reviewer','admin']);assert(['published','demo'].includes(r.status),'当前内容不可下架');assert(text(data.reason),'请填写下架原因');status='withdrawn';}
              store.create('contentVersion',{contentId:r.id,snapshot:r,action,actorId:user.id,reason:text(data.reason)});
              const changed=store.update(r.id,{reason:text(data.reason),...(action==='publish'?{reviewerId:user.id,reviewedAt:now().slice(0,10),publishedAt:now(),isDemo:false}:{})},r.version,status);store.audit(user.id,`content_${action}`,r.id,{version:changed.version,reason:text(data.reason)});return send(changed);
            }
          }
          if(path==='/api/admin/generation'&&method==='PATCH'){auth.role(user,['admin']);const data=await body(req);assert(typeof data.enabled==='boolean'&&text(data.reason),'请填写开关状态和原因');store.setSetting('generationEnabled',data.enabled);if(!data.enabled)for(const j of store.list('job'))if(ACTIVE.includes(j.status))ai.cancel(j.id,'运营已暂停生成服务');store.audit(user.id,'generation_switch',null,{enabled:data.enabled,reason:text(data.reason)});return send({enabled:data.enabled});}
          const reportPath=path.match(/^\/api\/admin\/reports\/([^/]+)$/);
          if(reportPath&&method==='PATCH'){auth.role(user,['reviewer','admin']);const r=store.get(reportPath[1]);assert(r?.type==='report','纠错不存在');const data=await body(req);assert(text(data.resolution),'请填写处理结果');store.audit(user.id,'report_resolved',r.id);return send(store.update(r.id,{resolution:text(data.resolution),reviewerId:user.id},undefined,'resolved'));}
        }
        fail(404,'NOT_FOUND','请求的内容不存在');
      }
      if(!['GET','HEAD'].includes(method))fail(405,'METHOD_NOT_ALLOWED','请求方式不支持');
      const publicRoot=resolve(ROOT,'public');let decoded;try{decoded=decodeURIComponent(path);}catch{fail(400,'INVALID_PATH','路径无效');}
      const file=resolve(publicRoot,`.${decoded==='/'?'/index.html':decoded}`);if(!file.startsWith(publicRoot+sep))fail(403,'FORBIDDEN','无法访问');
      let target=file;try{if(!(await stat(target)).isFile())fail(404,'NOT_FOUND','资源不存在');}catch{if(!extname(decoded))target=resolve(publicRoot,'index.html');else fail(404,'NOT_FOUND','资源不存在');}
      res.setHeader('Content-Type',MIME[extname(target)]||'application/octet-stream');res.setHeader('Cache-Control',target.includes(`${sep}assets${sep}`)?'public, max-age=86400':'no-cache');res.end(method==='HEAD'?undefined:await readFile(target));
    }catch(error){
      if(res.headersSent){res.end();return;}
      const status=error.status||500;
      if(status===500)console.error(JSON.stringify({traceId,code:'INTERNAL_ERROR',message:error.message}));
      send({error:{code:error.code||'INTERNAL_ERROR',message:status===500?'服务暂时不可用，请重试':error.message,fields:error.fields,traceId,retryable:status>=500}},status);
    }
  });
  server.requestTimeout=120_000;server.headersTimeout=15_000;
  return {server,store,config,close:()=>{closed=true;ai.stop();clearInterval(deletionTimer);for(const t of timers)clearTimeout(t);server.closeAllConnections();return new Promise(resolve=>server.close(()=>{store.db.close();resolve();}));}};
}
