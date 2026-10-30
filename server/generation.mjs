import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { ROOT, assert, fail, now, text } from './core.mjs';
import { SCENES } from './seed.mjs';
import { hash, sniff } from './media.mjs';
export const ACTIVE = ['queued','generating','reviewing'];
export function generation(store, config) {
  const running = new Map();
  let stopped = false;
  const mode = config.aiMode;
  const quota = owner => {
    const day = now().slice(0,10);
    const jobs = store.list('job', owner).filter(j => j.createdAt.startsWith(day) && !j.refunded);
    return { limit: config.dailyLimit, used: jobs.length, remaining: Math.max(0, config.dailyLimit-jobs.length), mode };
  };
  function cancel(id, reason = '用户取消') {
    const job = store.get(id);
    if (!job || !ACTIVE.includes(job.status)) return job;
    running.get(id)?.abort();
    return store.update(id, { refunded: true, reason, finishedAt: now() }, undefined, 'cancelled');
  }
  async function execute(job) {
    const controller = new AbortController(); running.set(job.id, controller);
    const timeout = setTimeout(()=>controller.abort(), config.generationTimeout || 300_000);
    try {
      if (mode === 'demo') await new Promise(r=>setTimeout(r, config.demoDelay ?? 1200));
      if (stopped || store.get(job.id)?.status !== 'queued') return;
      store.update(job.id, {}, undefined, 'generating');
      let result;
      if (mode === 'demo') {
        const scene = SCENES.find(s=>s.id === job.scene) || SCENES[0];
        const pet = store.get(job.petId);
        const imageFile = job.kind === 'portrait' ? '/assets/woody.png' : scene.image;
        result = { title: job.kind === 'portrait' ? `${pet.name} · 形象流程示例` : scene.name,
          body: `这是一张本地模板演示明信片。在想象的故事里，${job.tone === 'first' ? '“我”' : pet.name}走过一片温柔的风景。这段文字不是宠物的真实经历，配图来自设计稿，也并非为这只宠物生成。`,
          bytes: await readFile(resolve(ROOT,'public',imageFile.slice(1))), mime: 'image/png', model: 'local-template-demo-v1', isDemo: true };
        await new Promise(r=>setTimeout(r, config.demoDelay ?? 1200));
      } else {
        const assets = job.assetIds.map(id=>store.owned(id,job.ownerId,'asset'));
        const res = await fetch(config.aiEndpoint, { method:'POST', signal:controller.signal, headers:{ 'Content-Type':'application/json', 'Authorization':`Bearer ${config.aiKey}`, 'Idempotency-Key':job.id }, body:JSON.stringify({
          jobId: job.id, model:config.aiModel, kind:job.kind, scene:job.scene, tone:job.tone, petName:store.get(job.petId)?.name,
          instruction:'Create explicitly fictional commemorative artwork. Never claim real memories, resurrection, or known intent. Respond in Chinese. Do not train on inputs.',
          assets:assets.map(a=>({ id:a.id, mime:a.mime, base64:Buffer.from(store.db.prepare('SELECT bytes FROM blobs WHERE id=?').get(a.id).bytes).toString('base64') }))
        }) });
        if (!res.ok) throw new Error('供应商暂时不可用');
        let length = 0; const chunks = [];
        for await (const chunk of res.body) { length += chunk.length; if (length > 30*1024*1024) { controller.abort(); throw new Error('生成结果超出大小限制'); } chunks.push(chunk); }
        const payload = JSON.parse(Buffer.concat(chunks).toString());
        if (payload.moderation !== 'approved') throw new Error('生成内容未通过供应商审核');
        const bytes = Buffer.from(payload.imageBase64 || '', 'base64'); const info = sniff(bytes);
        if (!info || !['image/png','image/jpeg'].includes(info.mime) || bytes.length > 20*1024*1024 || !text(payload.body) || !text(payload.title)) throw new Error('生成结果格式不完整');
        result = { title:text(payload.title,120), body:text(payload.body,5000), bytes, mime:info.mime, model:text(payload.model,100)||config.aiModel, isDemo:false };
      }
      if (stopped || controller.signal.aborted || store.get(job.id)?.status !== 'generating') return;
      store.update(job.id, {}, undefined, 'reviewing');
      store.tx(()=>{
        if (store.get(job.id)?.status !== 'reviewing') return;
        const asset = store.create('asset',{ mime:result.mime, kind:'image', name:'创作预览', size:result.bytes.length, hash:hash(result.bytes), generated:true, isDemo:result.isDemo },{owner:job.ownerId,pet:job.petId});
        store.db.prepare('INSERT INTO blobs VALUES(?,?)').run(asset.id,result.bytes);
        const { bytes, ...metadata } = result;
        store.update(job.id,{ result:{...metadata,assetId:asset.id}, finishedAt:now(), expiresAt:new Date(Date.now()+7*86400_000).toISOString() },undefined,'ready');
      });
    } catch (error) {
      if (stopped) return;
      const current = store.get(job.id);
      if (current && ACTIVE.includes(current.status)) store.update(job.id,{refunded:true,reason:controller.signal.aborted?'生成超时，额度已返还':'生成服务暂时不可用，额度已返还',finishedAt:now()},undefined,'failed');
    } finally { clearTimeout(timeout); running.delete(job.id); }
  }
  function tick() {
    if (stopped) return;
    for (const job of store.list('job')) {
      if (job.status === 'ready' && job.expiresAt < now()) {
        if (job.result?.assetId) store.remove(job.result.assetId);
        store.update(job.id,{result:null, reason:'预览已过期，请重新创建'},undefined,'expired');
      }
      if (job.status === 'queued' && !running.has(job.id)) void execute(job);
    }
  }
  // No provider idempotency guarantee is assumed across process restarts.
  for (const job of store.list('job')) if (ACTIVE.includes(job.status)) store.update(job.id,{refunded:true,reason:'服务重新启动，请重试；额度已返还'},undefined,'failed');
  const timer = setInterval(tick,config.tickMs || 500); timer.unref();
  return {
    mode, quota, cancel,
    create(user, data, key) {
      assert(typeof key === 'string' && /^[\w-]{8,100}$/.test(key), '缺少有效幂等键');
      const fingerprint = hash(JSON.stringify(data));
      const previous = store.db.prepare('SELECT * FROM idempotency WHERE owner_id=? AND key=?').get(user.id,key);
      if (previous) { if(previous.fingerprint !== fingerprint) fail(409,'IDEMPOTENCY_CONFLICT','请勿重复使用同一提交标识'); const j=store.get(previous.result_id); if(!j) fail(410,'RESULT_DELETED','该任务已被删除'); return j; }
      if(mode === 'disabled' || !store.setting('generationEnabled',true)) fail(503,'GENERATION_DISABLED','AI 创作暂未开放，原始记忆仍可正常保存');
      assert(user.processingConsent && user.aiConsent && !user.pauseAI, '请先开启素材处理与 AI 创作授权，并解除暂停');
      const pet = store.owned(data.petId,user.id,'pet');
      assert(['portrait','postcard'].includes(data.kind),'请选择形象或明信片');
      assert(SCENES.some(s=>s.id === data.scene),'请选择已审核场景');
      assert(['third','first'].includes(data.tone),'请选择叙事口吻');
      assert(Array.isArray(data.assetIds) && new Set(data.assetIds).size === data.assetIds.length && data.assetIds.length <= 10,'参考照片最多 10 张，不能重复');
      const min = data.kind === 'portrait'?3:1;
      assert(data.assetIds.length >= min,`请主动选择至少 ${min} 张参考照片`);
      for(const id of data.assetIds){const a=store.owned(id,user.id,'asset');assert(a.petId === pet.id && !a.generated && ['image/png','image/jpeg'].includes(a.mime),'仅可选择当前宠物的 JPEG 或 PNG 原始照片');assert(a.width >= 256 && a.height >=256,'参考照片的宽和高均需至少 256 像素');}
      assert(data.subjectConfirmed === true,'请确认照片主体清楚，且具有使用权限');
      return store.tx(()=>{
        if(store.list('job',user.id).some(j=>ACTIVE.includes(j.status))) fail(409,'JOB_IN_PROGRESS','已有一个创作任务正在进行');
        if(quota(user.id).remaining <=0) fail(429,'QUOTA_EXCEEDED','今日体验额度已用完，输入已保留');
        const total=store.list('job').filter(j=>j.createdAt.startsWith(now().slice(0,10))&&!j.refunded).length;
        if(total>=config.platformLimit) fail(503,'PLATFORM_LIMIT','今日创作服务已达到体验上限');
        const job=store.create('job',{kind:data.kind,scene:data.scene,tone:data.tone,assetIds:data.assetIds,refunded:false,consentVersion:'2026-09-v1',templateVersion:'v1',isDemo:mode==='demo'},{owner:user.id,pet:pet.id,status:'queued'});
        store.db.prepare('INSERT INTO idempotency VALUES(?,?,?,?)').run(user.id,key,fingerprint,job.id);
        return job;
      });
    },
    decide(user,id,accept) {
      const job=store.owned(id,user.id,'job');
      if(job.status === (accept?'accepted':'rejected'))return job;
      assert(job.status === 'ready','仅可确认或拒绝已完成的预览');
      return store.tx(()=>{
        if(accept){
          if(job.kind === 'portrait')store.update(job.petId,{avatarId:job.result.assetId,avatarKind:'generated',avatarIsDemo:job.isDemo,avatarConfirmedAt:now()});
          else store.create('memory',{title:job.result.title,body:job.result.body,originalBody:job.result.body,kind:'generated',isDemo:job.isDemo,eventDate:now().slice(0,10),assetIds:[job.result.assetId],sourceIds:job.assetIds,jobId:job.id,model:job.result.model,favorite:false},{owner:user.id,pet:job.petId});
        }else if(job.result?.assetId)store.remove(job.result.assetId);
        return store.update(job.id,{confirmedAt:now(),...(accept?{}:{result:null})},undefined,accept?'accepted':'rejected');
      });
    },
    stop() {stopped=true;clearInterval(timer);for(const c of running.values())c.abort();}
  };
}
