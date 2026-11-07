import {language,t} from './i18n.js';
import {E} from './api.js';

const say=(zh,en)=>language==='en'?en:zh;
const dir='/assets/refined/';
const pictures=(name,cls='',alt='')=>`<img class="${cls}" src="${dir}${name}.png" alt="${alt}">`;
const petName=p=>p==='milo'?'Milo':'Woody';
const titles={
  woody:[['荒野漫游','Wilderness roaming'],['广场偶遇','Plaza encounter'],['巴黎时光','Paris moment'],['午后片刻','Afternoon moments']],
  milo:[['毛茸茸的旅伴','Furry travel mate'],['猫咪之旅','Cat’s trip'],['旅行瞬间','Pet travel moments'],['与毛孩子漫步','Roam with fur baby']]
};
const label=(key)=>({memorial:say('我的伙伴','My companions'),collection:say('发现收藏','Memory collection'),explore:say('野生动物图谱','Wildlife atlas'),welcome:say('欢迎','Welcome'),settings:t('我的'),travel:say('旅行日记','Travel diary')}[key]||'AniKind');
export function pageTitle(route,pet){
  if(route==='travel')return petName(pet)+' · '+label('travel');
  return ({companion:label('memorial'),entry:label('travel'),letter:say('纪念信','Memory letter'),photo:say('伙伴照片','Companion photo'),mood:say('心情记录','Mood check-in'),puzzle:t('拼图探索'),puzzles:t('拼图收藏'),album:t('记忆相册'),admin:t('内容管理')})[route]||label(route);
}
export function sidebar(route,pet){
  const links=[['welcome','⌂',say('总览','Overview')],['memorial','♧',label('memorial')],['collection','▦',label('collection')],['explore','◎',label('explore')]];
  return `<a class="ref-brand" href="#welcome">ani<b>kind ·</b></a><nav>${links.map(([id,icon,name])=>`<a href="#${id}" ${id===route?'aria-current="page"':''}><i>${icon}</i>${name}</a>`).join('')}</nav><div class="ref-petlinks">${['woody','milo'].map(id=>`<a href="#companion/${id}" ${id===pet?'aria-current="true"':''}>${pictures(id,'mini')}${petName(id)}</a>`).join('')}</div><a class="rail-account" href="#settings">${pictures('juliet','mini')}${say('个人空间','Personal space')}</a>`;
}
function favoriteKey(p,i){return 'anikind:diary:'+p+':'+i;}
function stored(key){try{return localStorage.getItem(key);}catch{return null;}}
function tile(p,i){
  const id=favoriteKey(p,i),liked=stored(id)==='1';
  return `<article class="diary-tile" data-diary-kind="${i===3?'everyday':'travel'}"><a href="#entry/${p}-${i}">${pictures(p+'-'+i,'diary-photo',say(...titles[p][i]))}</a><div><a href="#entry/${p}-${i}"><strong>${say(...titles[p][i])}</strong></a><small>${petName(p)} · ${['11-12','11-09','11-12','11-12'][i]}-2025</small><button data-heart="${id}" aria-label="${say('收藏','Favorite')}" aria-pressed="${liked}">${liked?'♥':'♡'}</button></div></article>`;
}
export function companion(p){
  const name=petName(p),letter=p==='milo'?'milo-letter':'letter';
  return `<div class="pet-switch"><a href="#companion/woody">Woody</a> · <a href="#companion/milo">Milo</a></div><section class="ref-comp"><div class="portrait"><div class="portrait-card"><h1>${name.toUpperCase()}</h1><small>${p==='milo'?say('英国短毛猫','British shorthair'):'Papillon'}</small><div class="quotes"><span>@Luna　${say('太可爱了！','You’re way too cute!')}</span><span>@Bobo　${say('今天也被治愈了','You made my day')}</span></div><div class="friend-row">${[0,1].map((_,j)=>`<div>${[0,1,2].map(i=>pictures('friend-'+((i+j)%4),'mini')).join('')}<small>${j?say('朋友','Friends'):say('访客','Visitors')}</small></div>`).join('')}</div><a href="#travel/${p}">${label('travel')} →</a></div>${pictures(p,'portrait-cut')}</div><div class="comp-stories"><h2>${say('纪念信','COMMEMORATE')}</h2><a class="letter" href="#letter/${p}">${pictures(letter,'',say('打开纪念信','Read this memory'))}</a><header><h2>${label('travel')}</h2><a href="#travel/${p}">${say('查看全部','View all')} →</a></header><div class="diary-grid">${tile(p,0)+tile(p,1)}</div></div></section><a class="ref-link" href="#welcome">${say('添加我的伙伴','Add my companion')} →</a>`;
}
export function diary(p){
  const filters=[['all',say('全部回忆','All memories')],['travel',say('旅行','Travel')],['everyday',say('日常','Everyday life')]];
  return `<section class="ref-diary"><a href="#companion/${p}">‹ ${petName(p)}</a><header class="diary-head">${pictures(p,'mini')}<h1>${petName(p)} · ${label('travel')}</h1></header><div class="diary-filters" role="group" aria-label="${label('travel')}">${filters.map(([id,title])=>`<button type="button" data-diary-filter="${id}" aria-pressed="${id==='all'}">${title}</button>`).join('')}</div><div class="diary-grid">${titles[p].map((_,i)=>tile(p,i)).join('')}</div></section>`;
}
export function entry(p,i,isLetter){return `<article class="entry"><a href="#${isLetter?'companion':'travel'}/${p}">‹ ${petName(p)}</a><h1>${isLetter?'COMMEMORATE':say(...titles[p][i])}</h1>${pictures(isLetter?(p==='milo'?'milo-letter':'letter'):p+'-'+i,'entry-img')}</article>`;}
export function collection(items,user){
  const name=user?E(user.name):'Juliet';
  const groups={VU:say('易危','Vulnerable'),CR:say('极危','Critically endangered'),EN:say('濒危','Endangered')};
  const featured=['Panthera uncia','Ursus maritimus','Rangifer tarandus','Pongo abelii','Rhinoceros sondaicus','Eretmochelys imbricata','Ailurus fulgens','Elephas maximus','Panthera tigris'];
  const rank=c=>{const i=featured.indexOf(c.scientificName);return i<0?featured.length:i;};
  const card=c=>`<a href="#puzzle/${E(c.id)}"><img loading="lazy" src="${E(c.cover)}" alt=""><strong>${E(t(c.name))}</strong><em>${E(c.scientificName)}</em><small>● ${E(c.category)}${c.unlocked?' ✓':''}</small></a>`;
  const rows=Object.entries(groups).map(([level,title])=>{
    const list=items.filter(c=>c.category===level).sort((a,b)=>rank(a)-rank(b));
    return `<section class="risk-group risk-${level}"><h3>●　${level} · ${title}</h3><div>${list.slice(0,3).map(card).join('')}</div>${list.length>3?`<details><summary>${say('更多物种','More species')} (+${list.length-3})</summary><div class="more-species">${list.slice(3).map(card).join('')}</div></details>`:''}</section>`;
  });
  return `<section class="collection"><aside>${pictures('juliet','avatar')}<h1>${name}</h1><small>${user?say('我的发现','Your discoveries'):say('示例档案','Demo profile')}</small><p>${say('已解锁','Unlocked')}　<b>${items.filter(c=>c.unlocked).length}</b></p><a href="#settings">${label('settings')} →</a></aside><div><h2>${say('物种收藏','COMMEMORATE')}</h2>${rows.join('')}</div></section>`;
}
let photoURL='',selectedPhoto=null,mood=50;
export function resetPreview(){
  if(photoURL)URL.revokeObjectURL(photoURL);
  photoURL='';selectedPhoto=null;mood=50;
}
export function applyPreview(input){
  if(!selectedPhoto)return;
  const selection=new DataTransfer();
  selection.items.add(selectedPhoto);
  input.files=selection.files;
}
export function onboarding(route){
 const back=route==='mood'?'photo':route==='photo'?'welcome':'memorial';
 const nav=`<div class="on-top"><a href="#${back}">‹ ${say('返回','Back')}</a><a href="#memorial">${say('跳过','Skip')}</a></div>`;
 if(route==='welcome')return nav+`<section class="welcome"><div class="animal-orbit">${pictures('panda','panda')}${[0,1,2,3].map(i=>pictures('friend-'+i,'sat s'+i)).join('')}</div><h1>HELLO</h1><p>${say('欢迎来到我的世界！','Welcome to my world!')}</p><button class="ref-btn" data-action="login">${say('使用邮箱登录或注册','Sign in with email')}</button><a href="#photo">${say('体验伙伴建档','Try the companion preview')} →</a></section>`;
 if(route==='photo')return nav+`<section class="photo-step"><h1>${say('添加宠物照片','Add a photo of your pet')}</h1><p>${say('选择一张承载共同回忆的照片，在这里预览。','Choose a photo to preview a shared memory.')}</p><label class="photo-input">${photoURL?`<img src="${photoURL}" alt="">`:'＋'}<input type="file" accept="image/png,image/jpeg" aria-label="${say('选择照片','Choose photo')}" id="preview-photo"></label><a href="#mood" class="ref-btn">${say('继续','Continue')}</a></section>`;
 return nav+`<section class="mood-step"><div><h1>${say('今天感觉怎么样？','How are you feeling today?')}</h1><p>${say('选出最贴近此刻心情的描述。','Select the mood that best describes how you feel.')}</p></div><div class="mood-panel"><div class="faces">${['😵‍💫','🙁','🤨','😄','😃'].map((v,i)=>`<button data-mood="${i*25}" aria-label="${i*25}%">${v}</button>`).join('')}</div><div class="mood-scale">${[say("低落","Low"),say("有点难过","A little down"),say("平静","Okay"),say("不错","Good"),say("很开心","Wonderful")].map(v=>`<small>${v}</small>`).join("")}</div><output id="mood-value">${mood}%</output><span>${say('情绪支持','Emotional support')}</span><input aria-label="${say('心情','Mood')}" type="range" id="mood-slider" min="0" max="100" value="${mood}"><button data-action="finish-onboarding" class="ref-btn">${say('继续建档','Continue to profile')}</button></div></section>`;
}
export function syncMood(value){mood=Number(value);document.querySelector('#mood-value').textContent=mood+'%';document.querySelector('#mood-slider').value=mood;document.querySelectorAll('[data-mood]').forEach(b=>b.setAttribute('aria-pressed',Number(b.dataset.mood)===Math.round(mood/25)*25));}
document.addEventListener('input',e=>{if(e.target.id==='mood-slider')syncMood(e.target.value);});
document.addEventListener('click',e=>{
 const filter=e.target.closest('[data-diary-filter]');
 if(filter){
   const diary=filter.closest('.ref-diary'),kind=filter.dataset.diaryFilter;
   diary.querySelectorAll('[data-diary-filter]').forEach(b=>b.setAttribute('aria-pressed',String(b===filter)));
   diary.querySelectorAll('[data-diary-kind]').forEach(card=>{card.hidden=kind!=='all'&&kind!==card.dataset.diaryKind;});
 }
 const face=e.target.closest('[data-mood]');if(face)syncMood(face.dataset.mood);
 const heart=e.target.closest('[data-heart]');if(heart){const on=heart.getAttribute('aria-pressed')!=='true';heart.setAttribute('aria-pressed',on);heart.textContent=on?'♥':'♡';try{localStorage.setItem(heart.dataset.heart,on?'1':'0');}catch{}}
});
document.addEventListener('change',e=>{if(e.target.id!=='preview-photo')return;const file=e.target.files[0];if(!file||!file.type.startsWith('image/'))return;selectedPhoto=file;if(photoURL)URL.revokeObjectURL(photoURL);photoURL=URL.createObjectURL(file);const label=e.target.parentElement;label.querySelector('img')?.remove();const img=new Image();img.src=photoURL;img.alt='';label.prepend(img);});
