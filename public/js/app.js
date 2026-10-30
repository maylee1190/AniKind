import {api,upload,assetURL,E,dateLabel,query} from './api.js';
import * as V from './views.js';
import {mountGlobe} from './globe.js';

const $=s=>document.querySelector(s);
const S={user:null,config:null,pets:[],pet:null,memories:[],filteredMemories:[],jobs:[],quota:null,exports:[],route:'memorial',memoryFilters:{q:'',kind:'',favorite:false,sort:'newest'},speciesFilters:{q:'',region:'',category:'',scope:''},speciesData:{items:[],total:0},adminData:null};
let routeVersion=0,filterVersion=0,modalContext={},pendingAction=null,disposeGlobe=()=>{},toastTimer,searchTimer,polling=false;
const D=$('#dialog');
const activeStatuses=['queued','generating','reviewing'];
function toast(message){clearTimeout(toastTimer);$('#toast').textContent=message;$('#toast').hidden=false;toastTimer=setTimeout(()=>$('#toast').hidden=true,4500);}
function modal(html,context={}){modalContext=context;$('#dialog-content').innerHTML=html;if(!D.open)D.showModal();else D.scrollTop=0;setTimeout(()=>D.querySelector('input:not([type=checkbox]):not([type=radio]),textarea,button')?.focus(),0);}
function closeDialog(force=false){if(!force&&modalContext.busy)return;if(!force&&modalContext.dirty&&$('#memory-form')){saveMemoryDraft();toast('文字草稿已保留，可继续编辑');}D.close();modalContext={};}
function formError(error){const el=$('#form-error');if(el){el.textContent=error.message||String(error);el.scrollIntoView({block:'nearest'});}else toast(error.message||String(error));}
function clearPrivate(){S.pets=[];S.pet=null;S.memories=[];S.filteredMemories=[];S.jobs=[];S.exports=[];S.quota=null;for(let i=sessionStorage.length-1;i>=0;i--){const key=sessionStorage.key(i);if(key.startsWith('anikind:'))sessionStorage.removeItem(key);}}
async function guarded(action){try{await action();}catch(e){if(e.status===401&&e.code==='AUTH_REQUIRED'){clearPrivate();S.user=null;closeDialog(true);openAuth();updateChrome();}else formError(e);}}
async function busy(form,fn){if(modalContext.busy)return;modalContext.busy=true;const b=form.querySelector('button[type=submit]'),label=b?.textContent;if(b){b.disabled=true;b.textContent='正在处理…';}$('#form-error')?.replaceChildren();try{await fn();}catch(e){formError(e);}finally{modalContext.busy=false;if(b?.isConnected){b.disabled=false;b.textContent=label;}}}
function updateChrome(){
  const route=S.route==='album'?'memorial':S.route==='admin'?'settings':S.route;
  document.querySelectorAll('[data-route]').forEach(a=>{if(a.dataset.route===route)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
  $('#account-button').innerHTML=S.user?`<span class="user-initial" aria-hidden="true">${E(S.user.name.slice(0,1))}</span><span>${E(S.user.name)}</span>`:'登录 / 注册 <span aria-hidden="true">↗</span>';
  document.title=`${{memorial:'纪念',album:'记忆相册',explore:'生态探索',settings:'我的',admin:'内容管理'}[S.route]||'纪念'} · AniKind`;
  document.body.classList.toggle('is-exploring',S.route==='explore');
  const navIcons=S.route==='explore'?['/assets/globe/1-7357-6e637.svg','/assets/globe/1-7361-7bba4.svg','/assets/globe/1-7365-c73fc.svg']:['/assets/home.svg','/assets/pin.svg','/assets/paw.svg'];
  document.querySelectorAll('.bottom-nav a img').forEach((img,i)=>img.src=navIcons[i]);
}
function navigate(route){if(location.hash===`#${route}`)void renderRoute();else location.hash=route;}
async function loadPrivate(){
  if(!S.user)return;
  const [pets,jobs,exports]=await Promise.all([api('/pets'),api('/jobs'),api('/exports')]);
  S.pets=pets.items;const saved=sessionStorage.getItem(`anikind:pet:${S.user.id}`);S.pet=S.pets.find(p=>p.id===(S.pet?.id||saved))||S.pets[0]||null;
  S.jobs=jobs.items;S.quota=jobs.quota;S.exports=exports.items;
  S.memories=S.pet?(await api(`/memories?${query({petId:S.pet.id})}`)).items:[];
}
async function mountMap(){const saved=disposeGlobe.getState?.()||S.globeCamera;disposeGlobe();try{disposeGlobe=await mountGlobe($('#globe'),S.speciesData.items,{region:S.speciesFilters.region,camera:S.globeRegion===S.speciesFilters.region?saved:undefined,onSelect:id=>guarded(()=>showSpecies(id)),onChange:camera=>{S.globeCamera=camera;}});S.globeRegion=S.speciesFilters.region;}catch(e){const canvas=$('#globe');if(canvas)canvas.replaceWith(Object.assign(document.createElement('p'),{className:'notice',textContent:'地球暂时无法显示，仍可通过物种列表继续探索。'}));console.error(e);}}
async function renderRoute({refresh=true}={}){
  const version=++routeVersion;const [route,detailId]=location.hash.slice(1).split('/');const detail=['memory','species','pet'].includes(route)&&detailId?{type:route,id:detailId}:null;S.route=detail?(route==='species'?'explore':'memorial'):route||'memorial';if(!['memorial','album','explore','settings','admin'].includes(S.route))S.route='memorial';
  updateChrome();disposeGlobe();
  try{
    if(detail&&detail.type!=='species'&&!S.user){openAuth(()=>renderRoute());$('#main').innerHTML=V.empty('这是一个私有纪念空间','登录后可查看属于你的内容。',V.primary('登录后继续','login'));return;}
    if(refresh&&S.user&&S.route!=='explore'&&navigator.onLine)await loadPrivate();
    if(version!==routeVersion)return;
    if(detail?.type==='pet'){const selected=S.pets.find(p=>p.id===detail.id);if(!selected)throw new Error('档案不存在或无权访问');S.pet=selected;S.memories=navigator.onLine?(await api(`/memories?petId=${selected.id}`)).items:S.memories.filter(m=>m.petId===selected.id);}
    if(S.route==='album'&&(!S.user||!S.pet)){navigate('memorial');return;}
    if(S.route==='explore'){if(navigator.onLine)S.speciesData=await api(`/species?${query({...S.speciesFilters,collection:'figma'})}`);if(version!==routeVersion)return;$('#main').innerHTML=V.explore(S);await mountMap();}
    else if(S.route==='album'){S.filteredMemories=navigator.onLine?(await api(`/memories?${query({petId:S.pet.id,...S.memoryFilters})}`)).items:S.memories.filter(m=>m.petId===S.pet.id);if(version!==routeVersion)return;$('#main').innerHTML=V.album(S);}
    else if(S.route==='settings')$('#main').innerHTML=V.settings(S);
    else if(S.route==='admin'){if(!S.user){openAuth(()=>navigate('admin'));navigate('settings');return;}S.adminData=await api('/admin/content');if(version!==routeVersion)return;$('#main').innerHTML=adminView();}
    else $('#main').innerHTML=V.memorial(S);
    if(detail?.type==='species')await showSpecies(detail.id);
    if(detail?.type==='memory')await showMemory(detail.id);
  }catch(e){if(e.status===401){clearPrivate();S.user=null;updateChrome();}$('#main').innerHTML=V.empty('暂时没能打开这一页',E(e.message),'<button class="primary" data-action="retry">重新加载</button>','↻');}
}
function openAuth(after=null){pendingAction=after;modal(V.authForm('login'),{authMode:'login'});}
function requireLogin(fn){if(!S.user){openAuth(fn);return false;}return true;}
async function createPet(id){if(!requireLogin(()=>createPet(id)))return;const pet=id?S.pets.find(p=>p.id===id):null;modal(V.petForm(pet||{}),{pet});if(S.user.processingConsent)D.querySelector('[name=processingConsent]').checked=true;}
const draftKey=(id='new')=>`anikind:draft:${S.user.id}:${S.pet.id}:${id}`;
function saveMemoryDraft(){const form=$('#memory-form');if(!form||!S.user||!S.pet)return;const data=Object.fromEntries(new FormData(form));sessionStorage.setItem(draftKey(form.dataset.id||'new'),JSON.stringify({title:data.title,body:data.body,eventDate:data.eventDate,baseVersion:modalContext.memory?.version}));}
async function createMemory(id){
  if(!requireLogin(()=>createMemory(id)))return;if(!S.pet){await createPet();return;}
  const memory=id?await api(`/memories/${id}`):null;let data=memory||{};
  try{const draft=JSON.parse(sessionStorage.getItem(draftKey(id||'new'))||'null');if(draft&&(!memory||draft.baseVersion===memory.version))data={...data,...draft};}catch{}
  modal(V.memoryForm(S,data),{memory,uploaded:[],key:crypto.randomUUID()});
}
async function createPostcard(scene='meadow'){
  if(!requireLogin(()=>createPostcard(scene)))return;if(!S.pet){await createPet();return;}
  const assets=(await api(`/assets?petId=${S.pet.id}`)).items.filter(a=>a.kind==='image'&&!a.generated&&['image/jpeg','image/png'].includes(a.mime));
  modal(V.generationForm(S,assets,scene),{key:crypto.randomUUID()});
}
function uploadRow(file,index,status){let container=$('#upload-list');if(!container)return;let row=container.querySelector(`[data-upload="${index}"]`);if(!row){row=document.createElement('div');row.className='upload-item';row.dataset.upload=index;row.innerHTML=`<span class="grow">${E(file.name)}</span><span class="status"></span>`;container.append(row);}row.querySelector('.status').textContent=status;}
async function uploadFiles(files,petId){
  if(files.length>20)throw new Error('每次最多添加 20 个文件');const success=[],failures=[];
  for(let i=0;i<files.length;i++){
    const file=files[i];try{uploadRow(file,i,'等待上传');const asset=await upload(file,petId,p=>uploadRow(file,i,`上传 ${p}%`));uploadRow(file,i,asset.duplicate?'已保存，无需重复':'已保存');success.push(asset);}catch(e){uploadRow(file,i,e.message);failures.push(`${file.name}：${e.message}`);}
  }
  return {success,failures};
}
async function ensureProcessing(form,hasFiles){if(hasFiles&&!S.user.processingConsent){if(!form.elements.processingConsent?.checked)throw new Error('请先确认素材处理授权');S.user=(await api('/settings',{method:'PATCH',data:{processingConsent:true}})).user;}}
async function showMemory(id){
  const m=navigator.onLine?await api(`/memories/${id}`):S.memories.find(m=>m.id===id);if(!m)throw new Error('当前内容未缓存，联网后可重试');const assets=m.assetIds?.length&&navigator.onLine?(await api(`/assets?petId=${m.petId}`)).items:[];
  modal(V.header(E(m.title))+`<div class="dialog-body"><div class="detail-meta">${V.badge(m.kind,m.isDemo)}<span>仅自己可见</span><time>${dateLabel(m.eventDate)}</time></div><p class="detail-copy">${E(m.body)}</p>${m.assetIds.map(id=>{const a=assets.find(a=>a.id===id);if(!a)return '';return a.kind==='video'?`<video class="detail-media" controls preload="metadata" src="${assetURL(id)}"></video>`:a.kind==='audio'?`<audio class="detail-media" controls preload="metadata" src="${assetURL(id)}"></audio>`:`<img class="detail-media" src="${assetURL(id)}" alt="${E(a.name)}">`;}).join('')}${m.kind!=='original'?`<div class="notice">${m.isDemo?'本地模板演示，并非 AI 生成结果。':'AI 创作内容，不代表真实经历。'}编辑和导出会保留该标识。</div><p class="info-note">模型 / 模板：${E(m.model||'未记录')}<br>确认来源：${E(m.jobId||'未记录')}</p>`:''}<div class="dialog-actions"><button class="secondary" data-action="favorite-memory" data-id="${m.id}" data-version="${m.version}" data-value="${!m.favorite}">${m.favorite?'取消收藏':'♡ 收藏'}</button><button class="secondary" data-action="edit-memory" data-id="${m.id}">编辑</button><button class="secondary" data-action="download-memory" data-id="${m.id}">导出</button><button class="danger-button" data-action="delete-memory" data-id="${m.id}">删除</button></div><p class="info-note">作者：你 · 版本 ${m.version} · ${dateLabel(m.createdAt.slice(0,10))}保存</p></div>`,{memory:m});
}
async function showSpecies(id){
  const s=navigator.onLine?await api(`/species/${id}`):S.speciesData.items.find(s=>s.id===id);if(!s)throw new Error('当前物种资料未缓存，联网后可重试');
  modal(V.header('生命档案')+`<div class="dialog-body"><div class="detail-cover"><div class="animal" aria-hidden="true">${V.speciesImage(s)}</div><h3>${E(s.name)}</h3><em>${E(s.scientificName)}</em><p><span class="tag ${s.category}">${s.category} ${V.categories[s.category]}</span></p></div>${s.isDemo?'<div class="notice warn">历史物种表资料：分类与经纬度沿用此前图谱，正式评估版本仍待逐条复核。</div>':''}<p class="detail-copy">${E(s.summary)}</p><dl class="fact-list"><dt>地理范围</dt><dd>${E(s.region)} · ${E(s.scope)}</dd><dt>栖息地</dt><dd>${E(s.habitat||'暂无足够资料')}</dd><dt>评估体系</dt><dd>${E(s.assessmentSystem)}</dd><dt>评估日期</dt><dd>${s.assessedAt?dateLabel(s.assessedAt):'待核实（未用网页日期代替）'}</dd><dt>种群数量</dt><dd>暂无足够资料</dd><dt>审核日期</dt><dd>${s.reviewedAt?dateLabel(s.reviewedAt):'尚未正式发布审核'}</dd></dl>${s.assessments?.length?`<h3>其他地区与版本评估</h3>${s.assessments.map(a=>`<div class="notice">${E(a.scope)} · ${E(a.category)} · ${dateLabel(a.assessedAt)} <a href="${E(a.sourceUrl)}" target="_blank" rel="noopener noreferrer">查看来源 ↗</a></div>`).join('')}`:''}<p class="info-note">${E(s.mapNote||"")}</p><h3>它们面临什么</h3><p class="detail-copy">${E(s.threats||'暂无足够资料')}</p><div class="dataset-note"><strong>资料来源</strong><p class="info-note"><a href="${E(s.sourceUrl)}" target="_blank" rel="noopener noreferrer">${E(s.sourcePublisher)} · 物种资料 ↗</a><br>${E(s.sourceVersion)}<br>${s.sourceLicense?'许可记录：'+E(s.sourceLicense):'发布许可：待核实'}</p></div><div class="dialog-actions">${s.actionUrl&&s.actionVerifiedAt?`<button class="primary" data-action="external-action" data-id="${s.id}">了解保护行动 ↗</button>`:''}<button class="secondary" data-action="report-species" data-id="${s.id}">报告资料问题</button></div></div>`,{species:s});
}
async function manageAssets(petId){
  const pet=S.pets.find(p=>p.id===petId);const {items}=await api(`/assets?petId=${petId}`);
  modal(V.header(`${E(pet.name)}的素材`)+`<div class="dialog-body"><p class="info-note">原始素材默认私有。删除参考素材时，其关联创作结果也会移除；记忆中的文字会保留。</p><div class="stack">${items.length?items.map(a=>`<div class="upload-item">${a.kind==='image'?`<img src="${assetURL(a.id)}" alt="${E(a.name)}">`:'<span aria-hidden="true">♫</span>'}<div class="grow"><strong>${E(a.name)}</strong><p class="small muted">${a.generated?'创作结果':'原始素材'} · ${(a.size/1024/1024).toFixed(2)} MB</p></div><button class="text-button" data-action="view-asset" data-id="${a.id}">查看</button><button class="text-button" data-action="delete-asset" data-id="${a.id}">删除</button></div>`).join(''):'<p>还没有素材，记录记忆时可以添加。</p>'}</div></div>`,{assets:items,pet});
}
function simpleForm(heading,content,formId,label='确认',context={}){modal(V.header(heading)+`<div class="dialog-body"><form id="${formId}">${content}${V.errorSlot}<div class="dialog-actions"><button type="button" class="secondary" data-action="close-dialog">取消</button><button type="submit" class="primary">${label}</button></div></form></div>`,context);}
async function deletePet(id){const p=S.pets.find(p=>p.id===id);simpleForm('删除宠物档案',`<div class="notice warn">将永久删除「${E(p.name)}」的档案、素材、记忆和创作结果，并取消未完成任务。建议先导出资料。</div>${V.field('输入宠物名字确认','confirm','',{required:true})}${V.field('当前账号密码','password','',{type:'password',required:true})}`,'delete-pet-form','永久删除',{pet:p});}
async function exportDialog(){simpleForm('导出我的资料',`<p class="info-note">资料包包含原始素材与可读的 JSON 清单。创作图片会保留可见标识。24 小时内可下载。</p><label class="field"><span>导出范围</span><select name="petId"><option value="">全部档案</option>${S.pets.map(p=>`<option value="${p.id}">${E(p.name)}</option>`).join('')}</select></label>${V.field('当前账号密码','password','',{type:'password',required:true})}`,'export-form','创建导出包');}
async function downloadMemory(id){
  const m=await api(`/memories/${id}`);
  if(!m.assetIds.length){downloadBlob(new Blob([JSON.stringify(m,null,2)],{type:'application/json'}),`${m.title}.json`);return;}
  const assets=(await api(`/assets?petId=${m.petId}`)).items;const a=assets.find(a=>a.id===m.assetIds[0]);
  if(a?.kind==='image'&&a.mime!=='image/heic'){
    const img=new Image();img.src=assetURL(a.id);await img.decode();const canvas=document.createElement('canvas');canvas.width=Math.min(img.naturalWidth,1800);const h=Math.round(img.naturalHeight*canvas.width/img.naturalWidth);canvas.height=h+100;const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,h);ctx.fillStyle='#17131b';ctx.font=`${Math.max(14,Math.min(28,canvas.width/22))}px system-ui`;ctx.fillText(`${m.isDemo?'本地模板演示 · 非 AI 生成':m.kind==='generated'?'AI 创作 · 虚构内容':'真实记录'} · AniKind`,20,h+40);ctx.fillText(dateLabel(m.eventDate),20,h+75);canvas.toBlob(blob=>downloadBlob(blob,`${m.title}.png`));
  }else{const response=await fetch(assetURL(a.id));if(!response.ok)throw new Error('素材无法下载，请重试');downloadBlob(await response.blob(),a.name);}
  downloadBlob(new Blob([JSON.stringify(m,null,2)],{type:'application/json'}),`${m.title}-文字与来源.json`);toast('已导出首个素材和文字记录；全部附件可从「我的」导出');
}
function downloadBlob(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);}
function adminView(){const data=S.adminData;return V.title('CONTENT STUDIO','可信内容，从来源开始。','编辑与审核分开，每一次发布都保留记录。',`<div class="button-group"><button class="secondary" data-action="audit">操作记录</button>${['editor','admin'].includes(S.user.role)?V.primary('＋ 新建物种资料','new-content'):''}</div>`)+`<div class="notice">当前角色：${E({editor:'编辑',reviewer:'审核者',admin:'管理员'}[S.user.role])}。后台不提供其他用户私人记忆的访问能力。</div>${S.user.role==='admin'?`<div class="section-title"><h2>生成服务：${data.generationEnabled?'已开启':'已暂停'}</h2><button class="secondary" data-action="generation-switch">${data.generationEnabled?'暂停服务':'恢复服务'}</button></div>`:''}<div class="section-title"><h2>物种内容 <span class="count">${data.items.length}</span></h2></div><div class="admin-list">${data.items.map(s=>`<article class="card admin-row"><div><h3>${E(s.name)} <span class="tag">${V.statuses[s.status]}</span></h3><p>${E(s.scientificName)} · ${E(s.scope)} · 版本 ${s.version}</p><p>${s.sourceLicense?'已记录来源许可':'待补全来源许可'}${s.reason?' · '+E(s.reason):''}</p></div><div class="button-group"><button class="secondary" data-action="edit-content" data-id="${s.id}">查看 / 编辑</button><button class="secondary" data-action="content-history" data-id="${s.id}">历史版本</button>${['draft','rejected'].includes(s.status)?`<button class="primary" data-action="content-submit" data-id="${s.id}">提交审核</button>`:''}${s.status==='pending'?`<button class="primary" data-action="content-publish" data-id="${s.id}">审核发布</button><button class="secondary" data-action="content-reject" data-id="${s.id}">退回</button>`:''}${['published','demo'].includes(s.status)?`<button class="secondary" data-action="content-withdraw" data-id="${s.id}">下架</button>`:''}</div></article>`).join('')}</div><div class="section-title"><h2>用户纠错</h2></div>${data.reports.length?data.reports.map(r=>`<article class="card"><p>${E(r.reason)}</p><p class="info-note">${E(r.speciesId)} · ${r.status==='open'?'待处理':'已处理'}</p>${r.status==='open'?`<button class="text-button" data-action="resolve-report" data-id="${r.id}">记录处理结果 ↗</button>`:`<p class="small">${E(r.resolution)}</p>`}</article>`).join(''):V.empty('目前没有待处理的纠错','用户反馈会进入这里，由审核人员核实后处理。','','✓')}`;}
function contentForm(id){const s=S.adminData.items.find(s=>s.id===id)||{};const readonly=s.status&& !['draft','rejected','withdrawn','demo'].includes(s.status)||S.user.role==='reviewer';
  const fields=[['中文名称','name'],['英文名称','englishName'],['学名','scientificName'],['地区（亚洲 / 非洲等）','region'],['范围（全球 / 纳米比亚等）','scope'],['栖息地','habitat'],['评估体系','assessmentSystem'],['来源发布者','sourcePublisher'],['来源 HTTPS 地址','sourceUrl'],['来源版本','sourceVersion'],['内容发布许可说明','sourceLicense'],['行动机构','actionOrganization'],['行动入口 HTTPS 地址','actionUrl'],['行动目的','actionPurpose']];
  modal(V.header(s.id?'物种内容与证据':'新建物种资料')+`<div class="dialog-body">${readonly?'<div class="notice">当前为只读预览。已发布内容需先下架再修改。</div>':''}<form id="content-form"><fieldset ${readonly?'disabled':''}><div class="form-grid">${fields.map(([l,n])=>V.field(l,n,s[n]||'',{required:['name','scientificName'].includes(n),max:500})).join('')}</div><label class="field"><span>保护等级</span><select name="category">${Object.entries(V.categories).map(([k,v])=>`<option value="${k}" ${s.category===k?'selected':''}>${k} ${v}</option>`).join('')}</select></label><div class="form-grid">${V.field('评估日期','assessedAt',s.assessedAt,{type:'date'})}${V.field('行动入口核验日期','actionVerifiedAt',s.actionVerifiedAt,{type:'date'})}</div>${V.area('摘要','summary',s.summary,3000)}${V.area('威胁及依据','threats',s.threats,3000)}${V.area('附加地域评估 JSON（可选）','assessments',JSON.stringify(s.assessments||[],null,2),8000)}<p class="info-note">附加评估字段：category、scope、assessedAt、sourceUrl、system。缺少地图数据时仅显示在列表中。</p></fieldset>${V.errorSlot}<div class="dialog-actions"><button type="button" class="secondary" data-action="close-dialog">关闭</button>${readonly?'':'<button type="submit" class="primary">保存为草稿</button>'}</div></form></div>`,{content:s});
}

const actions={
  account:()=>S.user?navigate('settings'):openAuth(),login:()=>openAuth(),memorial:()=>navigate('memorial'),explore:()=>navigate('explore'),album:()=>navigate('album'),admin:()=>navigate('admin'),retry:()=>renderRoute(),
  'close-dialog':()=>closeDialog(),'auth-tab':b=>{const email=D.querySelector('[name=email]')?.value||'';modal(V.authForm(b.dataset.value),{authMode:b.dataset.value});D.querySelector('[name=email]').value=email;},
  'create-pet':()=>createPet(),'edit-pet':b=>createPet(b.dataset.id||S.pet?.id),'create-memory':()=>{closeDialog(true);return createMemory();},'edit-memory':b=>createMemory(b.dataset.id),'create-postcard':b=>createPostcard(b.dataset.scene),
  'toggle-species-panel':()=>{const shell=$('.explore-shell');shell?.classList.toggle('browser-open');const open=shell?.classList.contains('browser-open');shell?.querySelector('[aria-expanded]')?.setAttribute('aria-expanded',String(open));if(open)$('#species-search')?.focus();},
  'locate-species':b=>{$('.explore-shell')?.classList.remove('browser-open');disposeGlobe.focus?.(b.dataset.id);$('#globe')?.focus();},
  'memory-detail':b=>showMemory(b.dataset.id),'species-detail':b=>showSpecies(b.dataset.id),'save-draft':()=>{saveMemoryDraft();closeDialog(true);toast('文字草稿已保存');},
  'favorite-memory':async b=>{await api(`/memories/${b.dataset.id}`,{method:'PATCH',data:{version:Number(b.dataset.version),favorite:b.dataset.value==='true'}});await showMemory(b.dataset.id);await renderRoute();},
  'delete-memory':b=>simpleForm('删除这条记忆',`<p>删除后不会再出现在相册和收藏中。原始素材仍保留在该宠物的素材库，可单独管理。</p><label class="checkbox"><input type="checkbox" name="confirm" required><span>确认删除这条记忆</span></label>`,'delete-memory-form','删除记忆',{memory:modalContext.memory}),
  'download-memory':b=>downloadMemory(b.dataset.id),
  'memory-filter':async b=>{S.memoryFilters.kind=b.dataset.value==='favorite'?'':b.dataset.value;S.memoryFilters.favorite=b.dataset.value==='favorite';await renderRoute({refresh:false});},
  'clear-memory-filter':()=>{S.memoryFilters={q:'',kind:'',favorite:false,sort:'newest'};return renderRoute({refresh:false});},
  'species-filter':b=>{S.speciesFilters.category=b.dataset.value;return renderRoute({refresh:false});},
  'clear-species-filter':()=>{S.speciesFilters={q:'',region:'',category:'',scope:''};return renderRoute({refresh:false});},
  'toggle-setting':async b=>{b.disabled=true;try{S.user=(await api('/settings',{method:'PATCH',data:{[b.dataset.key]:!S.user[b.dataset.key]}})).user;await renderRoute();toast('偏好已保存');}finally{b.disabled=false;}},
  logout:async()=>{await api('/auth/logout',{method:'POST'});S.user=null;clearPrivate();closeDialog(true);await renderRoute();toast('已安全退出');},
  export:exportDialog,'delete-pet':b=>deletePet(b.dataset.id),
  'manage-assets':b=>manageAssets(b.dataset.id),
  'view-asset':b=>{const a=modalContext.assets.find(a=>a.id===b.dataset.id);modal(V.header(E(a.name))+`<div class="dialog-body">${a.kind==='image'?`<img class="detail-media" src="${assetURL(a.id)}" alt="${E(a.name)}">`:a.kind==='video'?`<video class="detail-media" controls src="${assetURL(a.id)}"></video>`:`<audio class="detail-media" controls src="${assetURL(a.id)}"></audio>`}<p class="info-note">${a.generated?(a.isDemo?'本地模板演示 · 非 AI 生成':'AI 创作'):'原始素材 · 仅自己可见'}</p><button class="secondary" data-action="manage-assets" data-id="${a.petId}">返回素材库</button></div>`);},
  'delete-asset':b=>{const a=modalContext.assets.find(a=>a.id===b.dataset.id);simpleForm('删除素材与关联创作',`<p>将删除「${E(a.name)}」、由此产生的创作结果和已有导出快照。相关原始记忆的文字保留，图片附件移除。</p><label class="checkbox"><input type="checkbox" required><span>我了解此操作无法撤销</span></label>`,'delete-asset-form','确认删除',{asset:a});},
  'delete-account':()=>simpleForm('注销我的账户',`<div class="notice warn">这会永久删除所有宠物档案、素材、记忆和生成结果，并立即退出登录。操作不可撤销。</div>${V.field('输入“删除我的账户”','confirm','',{required:true})}${V.field('当前密码','password','',{type:'password',required:true})}`,'delete-account-form','永久注销'),
  'consent-history':async()=>{const{items}=await api('/consents');modal(V.header('授权记录')+`<div class="dialog-body stack">${items.length?items.map(c=>`<div class="notice"><div>${E({processingConsent:'素材处理',aiConsent:'AI 创作',notifications:'通知偏好'}[c.purpose])} · ${c.granted?'已同意':'已撤销'}<br><span class="small">${E(c.recordedAt)} · 版本 ${E(c.version)}</span></div></div>`).join(''):'<p>暂无授权变更记录。</p>'}</div>`);},
  'deletion-history':async()=>{const{items}=await api('/deletions');modal(V.header('删除处理进度')+`<div class="dialog-body stack">${items.length?items.map(d=>`<div class="notice"><div>本地数据：已删除 ${d.objectCount} 个对象<br>第三方：${d.providerState==='pending'?'等待服务方删除确认':d.providerState==='completed'?'已确认删除':'未向第三方发送'}<br>备份：当前实例未配置备份<br><span class="small">${E(d.createdAt)}</span></div></div>`).join(''):'<p>暂无删除请求。</p>'}</div>`);},
  'external-action':()=>{const s=modalContext.species;modal(V.header('前往保护机构网站')+`<div class="dialog-body"><p>即将离开 AniKind，前往 ${E(s.actionOrganization)}。</p><p class="info-note">目的：${E(s.actionPurpose)}<br>入口核验：${dateLabel(s.actionVerifiedAt)}<br>网址：${E(s.actionUrl)}</p><p class="info-note">AniKind 不代收捐款，浏览该网页不会被记为捐赠或救助成果。</p><div class="dialog-actions"><button class="secondary" data-action="close-dialog">留在这里</button><a class="primary" href="${E(s.actionUrl)}" target="_blank" rel="noopener noreferrer">继续前往 ↗</a></div></div>`);},
  'report-species':b=>{const id=b.dataset.id;const show=()=>simpleForm('报告资料问题',V.area('请说明需要核实或更正的内容','reason','',2000),'report-form','提交问题',{speciesId:id});if(requireLogin(show))show();},
  'job-cancel':async b=>{await api(`/jobs/${b.dataset.id}/cancel`,{method:'POST'});toast('任务已取消，额度已返还');await renderRoute();},
  'job-accept':async b=>{b.disabled=true;try{await api(`/jobs/${b.dataset.id}/accept`,{method:'POST'});toast('已确认并保存');await renderRoute();}finally{b.disabled=false;}},
  'job-reject':async b=>{await api(`/jobs/${b.dataset.id}/reject`,{method:'POST'});toast('未保留此结果，原始素材不变');await renderRoute();},
  'new-content':()=>contentForm(),'edit-content':b=>contentForm(b.dataset.id),
  'content-submit':async b=>{const s=S.adminData.items.find(s=>s.id===b.dataset.id);await api(`/admin/content/${s.id}/submit`,{method:'POST',data:{version:s.version}});toast('已提交，等待另一位审核者');await renderRoute();},
  'content-publish':b=>{const s=S.adminData.items.find(s=>s.id===b.dataset.id);simpleForm('审核并发布',`<p>发布后「${E(s.name)}」将出现在公开物种库。</p><label class="checkbox"><input type="checkbox" required><span>已核对物种、地区、评估日期、引用和发布许可。</span></label>`,'content-action-form','确认发布',{content:s,action:'publish'});},
  'content-reject':b=>contentReason(b,'reject'),'content-withdraw':b=>contentReason(b,'withdraw'),
  'resolve-report':b=>simpleForm('处理纠错',V.area('核实结果与处理说明','resolution'),'resolve-report-form','标记已处理',{reportId:b.dataset.id}),
  'generation-switch':()=>simpleForm('生成服务开关',V.area('操作原因','reason'),'generation-switch-form',S.adminData.generationEnabled?'暂停所有新任务':'恢复生成服务'),
  audit:async()=>{const{items}=await api('/admin/audit');modal(V.header('内容操作记录')+`<div class="dialog-body stack">${items.map(a=>`<div class="notice"><div>${E(a.action)}<br><span class="small">${E(a.created_at)}<br>对象：${E(a.object_id||'服务设置')}<br>操作者：${E(a.actor_id)}</span></div></div>`).join('')||'<p>暂无操作记录。</p>'}</div>`);}
};
function contentReason(b,action){const s=S.adminData.items.find(s=>s.id===b.dataset.id);simpleForm(action==='reject'?'退回内容':'下架内容',V.area('处理原因','reason'),'content-action-form','确认',{content:s,action});}
actions['content-history']=async b=>{
  const s=S.adminData.items.find(s=>s.id===b.dataset.id);const {items}=await api(`/admin/content/${s.id}/versions`);
  modal(V.header('内容历史版本')+`<div class="dialog-body stack">${items.length?items.map(v=>`<article class="card"><h3>版本 ${v.snapshot.version} · ${E(v.snapshot.name)}</h3><p class="info-note">操作：${E(v.action)}<br>${E(v.createdAt)}<br>${E(v.reason||'')}</p><p class="small">${E(v.snapshot.summary||'')}</p>${['editor','admin'].includes(S.user.role)&&s.status!=='published'?`<button class="secondary" data-action="restore-content" data-id="${v.id}">恢复为草稿</button>`:''}</article>`).join(''):'<p>提交审核后会保留版本快照。</p>'}<p class="info-note">恢复产生新草稿，需要重新通过双人审核后发布。</p></div>`,{content:s,versions:items});
};
actions['restore-content']=b=>{const s=modalContext.content,v=modalContext.versions.find(v=>v.id===b.dataset.id);simpleForm('恢复历史版本',`<p>将历史版本 ${v.snapshot.version} 恢复为新的待编辑草稿。</p>${V.area('恢复原因','reason')}`,'restore-content-form','恢复为草稿',{content:s,snapshot:v});};

document.addEventListener('click',e=>{const b=e.target.closest('[data-action]');if(!b||b.disabled)return;const fn=actions[b.dataset.action];if(fn){e.preventDefault();void guarded(()=>fn(b));}});
document.addEventListener('submit',e=>{e.preventDefault();const form=e.target;if(!(form instanceof HTMLFormElement))return;const handler=forms[form.id];if(handler)void busy(form,()=>handler(form));});
const forms={
  'auth-form':async form=>{const data=Object.fromEntries(new FormData(form));data.adult=form.elements.adult?.checked||false;const result=await api(`/auth/${form.dataset.mode}`,{method:'POST',data});clearPrivate();S.user=result.user;const after=pendingAction;pendingAction=null;closeDialog(true);await renderRoute();toast('欢迎来到你的纪念空间');if(after)await after();},
  'pet-form':async form=>{
    const data=Object.fromEntries(new FormData(form)),file=form.elements.avatar.files[0];await ensureProcessing(form,!!file);const old=modalContext.pet;
    let pet=old?await api(`/pets/${old.id}`,{method:'PATCH',data:{...data,version:old.version}}):modalContext.createdPet||await api('/pets',{method:'POST',data});modalContext.createdPet=pet;modalContext.pet=pet;
    if(file){const{success,failures}=await uploadFiles([file],pet.id);if(failures.length)throw new Error('档案已保存，照片尚未完成：'+failures.join('；'));pet=await api(`/pets/${pet.id}`,{method:'PATCH',data:{...pet,avatarId:success[0].id,version:pet.version}});}
    S.pet=pet;sessionStorage.setItem(`anikind:pet:${S.user.id}`,pet.id);closeDialog(true);await renderRoute();toast('档案已保存，仅自己可见');
  },
  'memory-form':async form=>{
    const data=Object.fromEntries(new FormData(form)),existing=modalContext.memory,id=form.dataset.id;
    if(existing){await api(`/memories/${id}`,{method:'PATCH',data:{title:data.title,body:data.body,eventDate:data.eventDate,version:existing.version}});}
    else{const files=[...(form.elements.files?.files||[])];await ensureProcessing(form,files.length>0);const{success,failures}=await uploadFiles(files,S.pet.id);modalContext.uploaded=success;if(failures.length)throw new Error(`合格素材已保存。请移除失败文件后重试：${failures.join('；')}`);await api('/memories',{method:'POST',key:modalContext.key,data:{title:data.title,body:data.body,eventDate:data.eventDate,petId:S.pet.id,assetIds:success.map(a=>a.id)}});}
    sessionStorage.removeItem(draftKey(id||'new'));closeDialog(true);await renderRoute();toast(existing?'记忆已更新':'这个瞬间，已经好好收下');
  },
  'generation-form':async form=>{const fd=new FormData(form);if(!S.user.aiConsent||!S.user.processingConsent)S.user=(await api('/settings',{method:'PATCH',data:{aiConsent:true,processingConsent:true}})).user;const data={petId:S.pet.id,kind:fd.get('kind'),scene:fd.get('scene'),tone:fd.get('tone'),assetIds:fd.getAll('assetIds'),subjectConfirmed:form.elements.subjectConfirmed.checked};await api('/jobs',{method:'POST',data,key:modalContext.key});closeDialog(true);navigate('memorial');await renderRoute();toast('任务已创建，离开页面也会保留进度');},
  'delete-memory-form':async()=>{await api(`/memories/${modalContext.memory.id}`,{method:'DELETE'});closeDialog(true);await renderRoute();toast('记忆已删除');},
  'delete-asset-form':async()=>{const a=modalContext.asset;await api(`/assets/${a.id}`,{method:'DELETE'});await loadPrivate();await manageAssets(a.petId);toast('素材与关联创作已删除');},
  'export-form':async form=>{await api('/exports',{method:'POST',data:Object.fromEntries(new FormData(form))});closeDialog(true);await renderRoute();toast('正在准备资料包，完成后可在此下载');},
  'delete-pet-form':async form=>{await api(`/pets/${modalContext.pet.id}`,{method:'DELETE',data:Object.fromEntries(new FormData(form))});S.pet=null;closeDialog(true);await renderRoute();toast('档案与关联资料已删除，可查看处理进度');},
  'delete-account-form':async form=>{const result=await api('/account',{method:'DELETE',data:Object.fromEntries(new FormData(form))});S.user=null;clearPrivate();closeDialog(true);navigate('memorial');await renderRoute();toast(result.deletion.providerState==='pending'?'本地资料已删除，第三方删除仍在处理中':'账户和本地资料已删除');},
  'report-form':async form=>{await api('/reports',{method:'POST',data:{reason:form.elements.reason.value,speciesId:modalContext.speciesId}});closeDialog(true);toast('问题已提交审核，不会直接修改公开资料');},
  'content-form':async form=>{const s=modalContext.content,data=Object.fromEntries(new FormData(form));try{data.assessments=JSON.parse(data.assessments||'[]');}catch{throw new Error('附加评估 JSON 格式不正确');}data.icon=s.icon||'🌿';data.point=s.point||null;if(s.id)data.version=s.version;await api(s.id?`/admin/content/${s.id}`:'/admin/content',{method:s.id?'PATCH':'POST',data});closeDialog(true);await renderRoute();toast('已保存为草稿');},
  'content-action-form':async form=>{await api(`/admin/content/${modalContext.content.id}/${modalContext.action}`,{method:'POST',data:{version:modalContext.content.version,reason:form.elements.reason?.value||''}});closeDialog(true);await renderRoute();toast('处理结果已保存并记录');},
  'resolve-report-form':async form=>{await api(`/admin/reports/${modalContext.reportId}`,{method:'PATCH',data:{resolution:form.elements.resolution.value}});closeDialog(true);await renderRoute();toast('已记录纠错处理结果');},
  'generation-switch-form':async form=>{await api('/admin/generation',{method:'PATCH',data:{enabled:!S.adminData.generationEnabled,reason:form.elements.reason.value}});closeDialog(true);await renderRoute();toast('服务开关已更新');}
};
forms['restore-content-form']=async form=>{const s=modalContext.content;await api(`/admin/content/${s.id}/restore`,{method:'POST',data:{version:s.version,snapshotId:modalContext.snapshot.id,reason:form.elements.reason.value}});closeDialog(true);await renderRoute();toast('历史版本已恢复为草稿');};

document.addEventListener('input',e=>{
  if(e.target.closest('#memory-form')){modalContext.dirty=true;saveMemoryDraft();}
  if(e.target.id==='memory-search'||e.target.id==='species-search'){
    clearTimeout(searchTimer);const species=e.target.id==='species-search';(species?S.speciesFilters:S.memoryFilters).q=e.target.value;
    searchTimer=setTimeout(()=>guarded(()=>updateFilterResults(species)),250);
  }
});
async function updateFilterResults(species){const version=++filterVersion;if(species){const data=await api(`/species?${query({...S.speciesFilters,collection:'figma'})}`);if(version!==filterVersion||S.route!=='explore')return;S.speciesData=data;$('#explore-results').innerHTML=V.exploreResults(S);$('#species-list-content').innerHTML=V.speciesList(S);document.querySelectorAll('[data-action="species-filter"]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.value===S.speciesFilters.category)));await mountMap();}else{const data=await api(`/memories?${query({petId:S.pet.id,...S.memoryFilters})}`);if(version!==filterVersion||S.route!=='album')return;S.filteredMemories=data.items;$('#memory-results').innerHTML=V.memoryResults(S);}}
document.addEventListener('change',e=>void guarded(async()=>{
  if(e.target.id==='pet-selector'){S.pet=S.pets.find(p=>p.id===e.target.value);sessionStorage.setItem(`anikind:pet:${S.user.id}`,S.pet.id);await renderRoute();}
  if(e.target.id==='species-region'){S.speciesFilters.region=e.target.value;await updateFilterResults(true);}
  if(e.target.id==='species-scope'){S.speciesFilters.scope=e.target.value;await updateFilterResults(true);}
  if(e.target.id==='memory-sort'){S.memoryFilters.sort=e.target.value;await updateFilterResults(false);}
  if(e.target.id==='memory-files'){const files=[...e.target.files];$('#upload-list').replaceChildren();if(files.length>20){formError(new Error('每次最多 20 个文件，请重新选择'));return;}files.forEach((f,i)=>uploadRow(f,i,'保存时上传'));}
}));
document.addEventListener('error',e=>{if(e.target instanceof HTMLImageElement){e.target.alt='图片暂时无法显示，可在详情中重试或导出';e.target.classList.add('image-error');}},true);
D.addEventListener('cancel',e=>{e.preventDefault();closeDialog();});
window.addEventListener('hashchange',()=>{window.scrollTo(0,0);void renderRoute();});
window.addEventListener('offline',()=>$('#offline').hidden=false);window.addEventListener('online',()=>{$('#offline').hidden=true;toast('已恢复网络，草稿仍然保留');});
setInterval(async()=>{
  if(polling||!S.user||document.hidden||(!S.jobs.some(j=>activeStatuses.includes(j.status))&&!S.exports.some(e=>['queued','processing'].includes(e.status))))return;
  polling=true;try{const [jobs,exports]=await Promise.all([api('/jobs'),api('/exports')]);const changed=JSON.stringify(jobs.items.map(j=>[j.id,j.status]))!==JSON.stringify(S.jobs.map(j=>[j.id,j.status]));S.jobs=jobs.items;S.quota=jobs.quota;S.exports=exports.items;if(changed&&!D.open&&S.route==='memorial')await renderRoute();if(S.route==='settings'&&$('#export-list'))$('#export-list').innerHTML=V.exportRows(S.exports);}catch{}finally{polling=false;}
},2000);
async function boot(){try{const[config,session]=await Promise.all([api('/config'),api('/session')]);S.config=config;S.user=session.user;$('#offline').hidden=navigator.onLine;await renderRoute();}catch(e){$('#main').innerHTML=V.empty('暂时无法连接服务',E(e.message),'<button class="primary" data-action="reload-app">重试</button>','↻');actions['reload-app']=()=>location.reload();}}
void boot();
