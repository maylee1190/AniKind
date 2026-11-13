import {t,tr} from './i18n.js';
import {api,E} from './api.js';
const masks=['75591','926e4','5c68e','4e5d3','667cc','a3137','75591','6a881','f9553','e74ae','d8627','ad8ca'];
const art=c=>`<img src="${E(c.cover)}" alt="${E(c.name)}${c.kind==='extinct'?t('骨架展陈实拍'):t('实拍照片')}" loading="lazy" width="${c.photo?.width||180}" height="${c.photo?.height||180}">`;
const credit=c=>c.photo?tr`<details class="puzzle-photo-credit"><summary>摄影与图片来源</summary><p>${E(c.photo.author)} · <a href="${E(c.photo.licenseUrl)}" target="_blank" rel="noopener noreferrer">${E(c.photo.license)}</a><br><a href="${E(c.photo.sourceUrl)}" target="_blank" rel="noopener noreferrer">查看照片原始来源 ↗</a><br>${E(c.photo.changes)}</p></details>`:'';
export function puzzleEntry(){return tr`<a class="puzzle-entry" href="#puzzles"><span class="puzzle-entry-art"><img src="/assets/wildlife-photos/5.jpg" width="80" height="80" alt=""></span><span><strong>拼起生命的故事</strong><small>完成地球动物拼图，解锁知识卡片</small></span><span aria-hidden="true">↗</span></a>`;}
export function puzzleLink(s){return s.datasetId==='anikind-figma-wildlife-v1'&&s.point&&s.design&&s.iconAsset&&!s.design.emptyInFigma?tr`<button class="puzzle-detail-entry" data-action="species-puzzle" data-id="${s.id}"><span><strong>拼出${E(s.name)}，解锁知识卡</strong><small>实拍拼图 · 支持拖动或点击交换</small></span><span aria-hidden="true">→</span></button>`:'';}
export function puzzleLibrary(data){
  const unlocked=data.items.filter(c=>c.unlocked).length;
  const card=c=>tr`<a class="puzzle-challenge ${c.kind}" href="#puzzle/${c.id}"><div class="puzzle-challenge-art">${art(c)}<span class="tag ${c.unlocked?'original':'neutral'}">${c.unlocked?t('已解锁'):c.correct?t('继续拼图'):t('待解锁')}</span></div><div class="puzzle-challenge-copy"><span class="eyebrow">${c.kind==='extinct'?'FOSSIL DISCOVERY':E(c.category)+' · WILDLIFE'}</span><h2>${E(c.name)}</h2><p>${E(c.subtitle)}</p><small class="puzzle-cover-credit">${E(c.photo.author)} · ${E(c.photo.license)}</small><div><span>${c.correct} / ${c.rows*c.cols} 块</span><span>${c.unlocked?t('阅读知识卡'):t('开始探索')} →</span></div></div></a>`;
  return tr`<section class="puzzle-library"><a class="text-button" href="#explore">← 返回地球</a><div class="puzzle-library-heading"><div><span class="eyebrow">PIECE BY PIECE, LIFE REVEALED</span><h1>拼起生命的故事</h1><p>从一块拼图开始，认识一个生命。</p></div><div class="puzzle-collection-count"><strong>${unlocked}</strong><span>已解锁 / ${data.items.length} 组知识卡</span></div></div><div class="puzzle-library-grid">${data.items.map(card).join('')}</div><p class="info-note">${data.scope==='account'?t('进度保存在当前账号，登录同一账号可继续。'):t('无需登录也能体验；进度保存在当前浏览器身份下，清除 Cookie 后将无法找回。登录后的进度单独保存在账号中。')}</p></section>`;
}
export function puzzleView(data){const c=data.challenge;return tr`<section class="puzzle-page photo-puzzle" aria-label="${E(c.name)}拼图"><header class="puzzle-page-header"><a class="puzzle-back" href="#puzzles">← <span>拼图收藏</span></a><div><span class="eyebrow">${c.kind==='extinct'?'FOSSIL DISCOVERY':'WILDLIFE DISCOVERY'}</span><h1>${E(c.name)}</h1></div><span class="puzzle-piece-count">${c.rows*c.cols} 块</span></header><div class="puzzle-workspace"><section class="puzzle-play"><div class="puzzle-progress-heading"><strong id="puzzle-progress-text"></strong><span id="puzzle-moves"></span></div><progress id="puzzle-progress" max="${c.rows*c.cols}" value="0" aria-label="拼图完成进度"></progress><button class="puzzle-target-reference" data-puzzle-action="preview" aria-pressed="false">${art(c)}<span><strong>${c.kind==='extinct'?t('骨架实拍参考'):t('真实照片参考')}</strong><small>${E(c.scientificName)}</small><span>点击查看完整照片 ↗</span></span></button><p class="puzzle-instructions" id="puzzle-instructions">拖动交换两块拼图，或依次点选两块；Tab 与回车也可操作。</p><div class="puzzle-board-shell ${c.kind}"><div class="puzzle-board" id="puzzle-board" aria-label="拼图位置" aria-describedby="puzzle-instructions"></div><img class="puzzle-reference" src="${E(c.image)}" alt="${E(c.name)}完整实拍参考" hidden></div><p class="puzzle-image-note">${E(c.imageNote)}</p>${credit(c)}<p class="puzzle-feedback" id="puzzle-feedback" role="status" aria-live="polite"></p><div class="puzzle-actions"><button class="secondary" data-puzzle-action="preview" aria-pressed="false">查看照片</button><button class="secondary" data-puzzle-action="hint">帮我拼一块</button><button class="text-button" data-puzzle-action="restart">重新开始</button></div><p class="puzzle-save-note" id="puzzle-save-note">${data.scope==='account'?t('进度自动保存到当前账号'):t('进度自动保存在当前浏览器身份下')}</p></section><aside class="puzzle-learning" id="puzzle-learning" aria-label="解锁的知识卡片"></aside></div></section>`;}

export function mountPuzzle(root,initial){
  let data=initial,selected=null,busy=false,disposed=false,preview=false,cardIndex=0,pointer=null,suppressClick=false;
  const controller=new AbortController(),signal=controller.signal;
  const board=root.querySelector('#puzzle-board'),learning=root.querySelector('#puzzle-learning'),feedback=root.querySelector('#puzzle-feedback');
  const c=data.challenge,size=c.rows*c.cols;
  board.style.setProperty('--cols',c.cols);board.style.setProperty('--rows',c.rows);
  board.style.setProperty('--puzzle-image',`url("${c.image}")`);
  const reference=root.querySelector('.puzzle-reference');
  const shell=root.querySelector('.puzzle-board-shell'),aspect=c.photo.width/c.photo.height;
  shell.style.aspectRatio=String(aspect);shell.style.maxWidth=Math.min(420,500*aspect)+'px';
  function announce(text){feedback.textContent=text;}
  function drawCards(){
    if(!data.cards.length){learning.innerHTML=tr`<div class="knowledge-locked"><span class="eyebrow">YOUR NEXT DISCOVERY</span><div class="knowledge-preview ${c.kind}">${art(c)}</div><span class="tag neutral">尚未解锁</span><h2>${c.kind==='extinct'?t('三角龙知识卡'):E(c.name)+t('知识卡')}</h2><p>拼好全部 ${size} 块，收下 3 张关于它的知识卡。</p><div class="knowledge-topics"><span>认识它</span><span>你知道吗</span><span>了解更多</span></div></div>`;return;}
    const card=data.cards[cardIndex];
    learning.innerHTML=tr`<div class="knowledge-unlocked-heading"><span class="tag original">已解锁 · 3 张知识卡</span><button class="text-button" data-puzzle-action="read-card">阅读卡片 ↓</button></div><article class="knowledge-card" tabindex="-1"><span class="eyebrow">KNOWLEDGE CARD · 0${cardIndex+1}</span><h2>${E(card.title)}</h2><p class="knowledge-subtitle">${E(card.subtitle)}</p><h3>${E(card.section)}</h3><p>${E(card.body)}</p><h3>你知道吗</h3><p>${E(card.fact)}</p><div class="knowledge-art ${c.kind}">${art(c)}</div>${c.isDemo?t('<p class="knowledge-data-note">沿用历史名录，保护等级与资料待复核。</p>'):''}<a class="knowledge-source" href="${E(card.sourceUrl)}" target="_blank" rel="noopener noreferrer">${E(card.sourceTitle)} ↗</a></article><div class="knowledge-pagination" aria-label="知识卡片分页"><button data-puzzle-action="previous-card" aria-label="上一张知识卡" ${cardIndex===0?'disabled':''}>←</button>${data.cards.map((_,i)=>tr`<button class="knowledge-page-dot" data-puzzle-card="${i}" aria-label="第 ${i+1} 张知识卡" aria-current="${i===cardIndex?'true':'false'}"><span></span></button>`).join('')}<button data-puzzle-action="next-card" aria-label="下一张知识卡" ${cardIndex===data.cards.length-1?'disabled':''}>→</button></div><a class="puzzle-next" href="#puzzles">返回收藏，认识下一个生命 →</a>`;
  }
  function draw(){
    const p=data.progress,completed=p.completed;
    board.classList.toggle('completed',completed);board.setAttribute('aria-busy',String(busy));
    board.replaceChildren(...p.board.map((piece,index)=>{
      const b=document.createElement('button');b.className='puzzle-tile';b.type='button';b.dataset.slot=index;b.dataset.piece=piece;
      b.classList.toggle('correct',piece===index);b.classList.toggle('selected',selected===index);
      b.setAttribute('aria-label',tr`第 ${Math.floor(index/c.cols)+1} 行第 ${index%c.cols+1} 列，拼块 ${piece+1}${piece===index?t('，位置正确'):''}`);
      b.setAttribute('aria-pressed',String(selected===index));b.disabled=completed||busy||preview;
      const face=document.createElement('span');face.className='puzzle-tile-face';face.style.setProperty('--piece-mask',`url('/assets/puzzle/${masks[piece]}.svg')`);
      face.style.backgroundSize=`${c.cols*100}% ${c.rows*100}%`;face.style.backgroundPosition=`${piece%c.cols/(c.cols-1)*100}% ${Math.floor(piece/c.cols)/(c.rows-1)*100}%`;
      const label=document.createElement('span');label.className='puzzle-tile-label';label.textContent=piece+1;label.setAttribute('aria-hidden','true');b.append(face,label);return b;
    }));
    root.querySelector('#puzzle-progress-text').textContent=completed?t('拼图完成，知识卡已解锁'):tr`${p.correct} / ${size} 块归位`;
    root.querySelector('#puzzle-progress').value=p.correct;root.querySelector('#puzzle-moves').textContent=tr`${p.moves} 次交换`;
    root.querySelector('[data-puzzle-action="hint"]').disabled=busy||completed;
    root.querySelector('[data-puzzle-action="restart"]').disabled=busy;
    reference.hidden=!preview&&!completed;reference.classList.toggle('is-complete',completed);
    drawCards();
  }
  async function update(action,fields={}){
    if(busy||disposed)return;busy=true;preview=false;root.querySelectorAll('[data-puzzle-action="preview"]').forEach(b=>b.setAttribute('aria-pressed','false'));const oldCorrect=data.progress.correct,wasCompleted=data.progress.completed;
    selected=null;draw();announce(t('正在保存…'));
    try{
      const next=await api('/puzzles/'+c.id,{method:'POST',data:{action,version:data.progress.version,...fields},signal});
      if(disposed)return;data=next;
      announce(next.progress.completed?t('拼图完成！3 张知识卡已解锁。'):action==='restart'?t('已重新打乱，已解锁的知识卡仍然保留。'):next.progress.correct>oldCorrect?tr`拼对了！已有 ${next.progress.correct} 块归位。`:t('已交换，再观察一下图案。'));
      if(next.progress.completed&&!wasCompleted){root.classList.add('just-unlocked');cardIndex=0;}
    }catch(error){
      if(disposed)return;
      try{const latest=await api('/puzzles/'+c.id,{signal});if(latest.progress)data=latest;}catch{}
      announce(error.status===409?t('进度已同步，请继续拼图。'):t('未能确认保存，已保留最近进度。请检查网络后重试。'));
    }finally{busy=false;if(!disposed){draw();if(fields.to!==undefined&&!data.progress.completed)board.querySelector(`[data-slot="${fields.to}"]`)?.focus({preventScroll:true});}}
  }
  function choose(slot){
    if(busy||preview||data.progress.completed)return;
    if(selected===null){selected=slot;announce(tr`已选择拼块 ${data.progress.board[slot]+1}，再选一块进行交换。`);draw();board.querySelector(`[data-slot="${slot}"]`)?.focus({preventScroll:true});}
    else if(selected===slot){selected=null;draw();announce(t('已取消选择。'));board.querySelector(`[data-slot="${slot}"]`)?.focus({preventScroll:true});}
    else void update('swap',{from:selected,to:slot});
  }
  root.addEventListener('click',e=>{
    const tile=e.target.closest('[data-slot]');if(tile){if(suppressClick&&e.detail!==0){suppressClick=false;return;}suppressClick=false;choose(Number(tile.dataset.slot));return;}
    const page=e.target.closest('[data-puzzle-card]');if(page){cardIndex=Number(page.dataset.puzzleCard);drawCards();learning.querySelector(`[data-puzzle-card="${cardIndex}"]`)?.focus({preventScroll:true});return;}
    const action=e.target.closest('[data-puzzle-action]')?.dataset.puzzleAction;
    if(action==='preview'){preview=!preview;draw();root.querySelectorAll('[data-puzzle-action="preview"]').forEach(b=>b.setAttribute('aria-pressed',String(preview)));announce(preview?t('正在显示完整照片，点击照片参考按钮可返回拼图。'):t('已返回拼图。'));}
    if(action==='hint')void update('hint');
    if(action==='restart')void update('restart');
    if(action==='previous-card'||action==='next-card'){cardIndex=Math.max(0,Math.min(data.cards.length-1,cardIndex+(action==='next-card'?1:-1)));drawCards();const button=learning.querySelector(`[data-puzzle-action="${action}"]`);(button?.disabled?learning.querySelector(`[data-puzzle-card="${cardIndex}"]`):button)?.focus({preventScroll:true});}
    if(action==='read-card'){learning.querySelector('.knowledge-card')?.focus();learning.querySelector('.knowledge-card')?.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});}
  },{signal});
  board.addEventListener('keydown',e=>{
    const tile=e.target.closest('[data-slot]');if(!tile)return;const index=Number(tile.dataset.slot),delta={ArrowLeft:-1,ArrowRight:1,ArrowUp:-c.cols,ArrowDown:c.cols}[e.key];
    if(delta!==undefined){e.preventDefault();board.querySelector(`[data-slot="${Math.max(0,Math.min(size-1,index+delta))}"]`)?.focus();}
    if(e.key==='Escape'){selected=null;draw();board.querySelector(`[data-slot="${index}"]`)?.focus();announce(t('已取消选择。'));}
  },{signal});
  board.addEventListener('pointerdown',e=>{
    const tile=e.target.closest('[data-slot]');if(!tile||busy||preview||pointer||data.progress.completed||e.button!==0)return;
    suppressClick=false;pointer={id:e.pointerId,slot:Number(tile.dataset.slot),x:e.clientX,y:e.clientY,moved:false};board.setPointerCapture(e.pointerId);
  },{signal});
  board.addEventListener('pointermove',e=>{
    if(!pointer||pointer.id!==e.pointerId)return;
    if(Math.hypot(e.clientX-pointer.x,e.clientY-pointer.y)<8&&!pointer.moved)return;
    pointer.moved=true;board.querySelector(`[data-slot="${pointer.slot}"]`)?.classList.add('is-dragging');
    const target=document.elementFromPoint(e.clientX,e.clientY)?.closest('[data-slot]');
    board.querySelectorAll('.drop-target').forEach(b=>b.classList.remove('drop-target'));if(target&&board.contains(target))target.classList.add('drop-target');
  },{signal});
  function release(e){
    if(!pointer||pointer.id!==e.pointerId)return;const drag=pointer;pointer=null;
    if(board.hasPointerCapture(e.pointerId))board.releasePointerCapture(e.pointerId);
    board.querySelectorAll('.is-dragging,.drop-target').forEach(b=>b.classList.remove('is-dragging','drop-target'));
    if(e.type!=='pointerup')return;
    const target=document.elementFromPoint(e.clientX,e.clientY)?.closest('[data-slot]');
    if(drag.moved){suppressClick=true;if(target&&board.contains(target)&&Number(target.dataset.slot)!==drag.slot)void update('swap',{from:drag.slot,to:Number(target.dataset.slot)});else announce(t('拖到另一块拼图上即可交换。'));}
    else {suppressClick=true;choose(drag.slot);}
  }
  board.addEventListener('pointerup',release,{signal});board.addEventListener('pointercancel',release,{signal});board.addEventListener('lostpointercapture',release,{signal});
  draw();announce(data.progress.completed?t('已经完成，可以随时阅读知识卡。'):t('按图案拼合，也可以根据编号从左到右、从上到下排列。'));
  return()=>{disposed=true;controller.abort();};
}
