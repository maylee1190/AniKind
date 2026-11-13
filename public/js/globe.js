import {t,tr} from './i18n.js';
import {PRESETS,clamp,wrapLon,viewPoint,designAnchor,moveCamera,zoomCamera} from './globe-math.js';
let geography;
const COLORS={CR:'#8237f5',EN:'#4f86f7',VU:'#32cbd4'};
const SUMMARY_ORDER={africa:[9,13,19,16,12],americas:[37,28,24,25,26],asia:[36,5,33,31,7]};
const json=async url=>{const r=await fetch(url);if(!r.ok)throw new Error(t('地图资料读取失败'));return r.json();};
function imageAsset(src){return new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=reject;img.src=src;});}
function nearestView(lon){return Object.entries(PRESETS).sort((a,b)=>Math.abs(wrapLon(lon-a[1].lon))-Math.abs(wrapLon(lon-b[1].lon)))[0][0];}
export async function mountGlobe(canvas,items,{region='',camera:initial,onSelect=()=>{},onChange=()=>{}}={}){
  if(!canvas)return()=>{};
  const panel=canvas.closest('.globe-panel'),viewport=canvas.parentElement,ctx=canvas.getContext('2d');
  if(!ctx)throw new Error(t('当前设备无法绘制地球'));
  const [land,countries,dotData,sea]=await (geography||=Promise.all([json('/assets/world-land-50m.geojson'),json('/assets/world.geojson'),json('/assets/land-dots.json'),imageAsset('/assets/globe/1-6394-2485a.svg')]).catch(e=>{geography=null;throw e;}));
  if(!canvas.isConnected)return()=>{};
  const d3=window.d3;if(!d3?.geoOrthographic)throw new Error(t('地图投影模块未加载'));
  const start=!region||region==='亚洲'||region==='大洋洲'?'asia':region==='美洲'||region.endsWith('美洲')?'americas':'africa';
  let camera={...PRESETS[start],zoom:1,...initial},targetZoom=camera.zoom;
  let disposed=false,frame=0,dirty=true,previous=0,auto=false,velocity=[0,0],flight=null,selected=null,summaryView=null;
  let width=0,height=0,radius=0,baseRadius=0,dragged=false,pinch=null;
  const pointers=new Map(),abort=new AbortController(),signal=abort.signal,reduce=matchMedia('(prefers-reduced-motion: reduce)');
  const projection=d3.geoOrthographic().clipAngle(90).precision(.25),path=d3.geoPath(projection,ctx);
  const rings=f=>f.geometry.type==='Polygon'?f.geometry.coordinates:f.geometry.coordinates.flat();
  const coast={type:'MultiLineString',coordinates:land.features.flatMap(rings)};
  const borders={type:'MultiLineString',coordinates:countries.features.flatMap(rings)};
  const graticule=d3.geoGraticule().step([30,30])();
  const dots=dotData.dots.map(point=>({point,coarse:point[0]%4===0&&point[1]%4===0,medium:point[0]%2===0&&point[1]%2===0}));
  const layer=panel.querySelector('.globe-markers'),zoomLabel=panel.querySelector('.globe-zoom'),title=panel.querySelector('.globe-view-title'),coords=panel.querySelector('.globe-coordinates');
  const markers=items.filter(s=>s.point&&s.design&&s.iconAsset&&!s.design.emptyInFigma).map(s=>{
    const el=document.createElement('button');el.className='globe-marker';el.hidden=true;
    el.style.setProperty('--risk',COLORS[s.category]||COLORS.VU);
    el.dataset.speciesId=s.id;el.dataset.figmaNode=s.design.nodeId;
    el.setAttribute('aria-label',s.name+' · '+s.category+t(' · 查看物种'));
    el.title=s.name+' · '+s.category;
    const face=document.createElement('span');face.className='marker-face';
    if(s.iconAsset){const image=document.createElement('img');image.src=s.iconAsset;image.alt='';image.draggable=false;image.width=28;image.height=28;face.append(image);}
    const label=document.createElement('span');label.className='marker-label';label.textContent=s.name;
    el.append(face,label);layer.append(el);
    el.addEventListener('click',()=>{selected=s.id;auto=false;velocity=[0,0];wake();onSelect(s.id);},{signal});
    el.addEventListener('pointerenter',()=>{selected=s.id;wake();},{signal});
    el.addEventListener('pointerleave',()=>{if(document.activeElement!==el)selected=null;wake();},{signal});
    el.addEventListener('focus',()=>{selected=s.id;auto=false;wake();},{signal});
    el.addEventListener('blur',()=>{selected=null;wake();},{signal});
    return {s,el,anchor:designAnchor(s.design)||s.point};
  });
  function wake(){dirty=true;if(!frame&&!disposed)frame=requestAnimationFrame(tick);}
  function resize(){
    width=viewport.clientWidth;height=viewport.clientHeight;const ratio=Math.min(devicePixelRatio||1,2);
    canvas.width=Math.round(width*ratio);canvas.height=Math.round(height*ratio);ctx.setTransform(ratio,0,0,ratio,0,0);
    baseRadius=Math.min(width*.455,height*.485);wake();
  }
  function project(point){const p=viewPoint(point,camera);return [width/2+p[0]*radius,height/2-p[1]*radius,p[2]];}
  // Fade adjacent Figma compositions at the limb; retain all front-facing markers at the poles.
  function compositionOpacity(s){return Math.max(clamp((90-Math.abs(wrapLon(camera.lon-PRESETS[s.design.view].lon)))/20,0,1),clamp((Math.abs(camera.lat)-60)/20,0,1));}
  function updateSummary(view){
    if(summaryView===view)return;summaryView=view;
    const summary=panel.querySelector('.summary-animals');
    const preview=SUMMARY_ORDER[view].map(id=>items.find(s=>s.sourceRecordId===id&&s.iconAsset)).filter(Boolean);
    if(!preview.length)preview.push(...items.filter(s=>s.iconAsset).slice(0,5));
    summary.replaceChildren(...preview.map(s=>{const ring=document.createElement('span'),img=document.createElement('img');ring.style.setProperty('--risk',COLORS[s.category]||COLORS.VU);ring.dataset.speciesId=s.id;img.src=s.iconAsset;img.alt='';img.width=40;img.height=40;ring.append(img);return ring;}));
  }
  function draw(){
    if(!width||!height)return;
    radius=baseRadius*camera.zoom;const cx=width/2,cy=height/2;
    ctx.clearRect(0,0,width,height);
    ctx.save();ctx.shadowColor='#71cccc40';ctx.shadowBlur=24;ctx.drawImage(sea,cx-radius,cy-radius,radius*2,radius*2);ctx.restore();
    ctx.save();ctx.beginPath();ctx.arc(cx,cy,radius-.5,0,Math.PI*2);ctx.clip();
    projection.rotate([-camera.lon,-camera.lat,0]).translate([cx,cy]).scale(radius);
    ctx.beginPath();path(graticule);ctx.strokeStyle='#8ad4d540';ctx.lineWidth=.6;ctx.stroke();
    const dotStep=camera.zoom>2.65?1:camera.zoom>1.4?2:4;
    for(const d of dots){
      if(dotStep===4&&!d.coarse||dotStep===2&&!d.medium)continue;
      const[x,y,z]=project(d.point);if(z<.005||x< -5||x>width+5||y< -5||y>height+5)continue;
      ctx.beginPath();ctx.arc(x,y,Math.max(.45,(.75+.55*z)*camera.zoom*dotStep/4),0,Math.PI*2);
      ctx.fillStyle=d.point[1]<-35?'#6b94d3':d.point[1]>10?'#52bdb8':'#56b5c4';ctx.globalAlpha=.35+.5*z;ctx.fill();
    }
    ctx.globalAlpha=1;ctx.beginPath();path(borders);ctx.strokeStyle='#44adad50';ctx.lineWidth=.45;ctx.stroke();
    ctx.beginPath();path(coast);ctx.strokeStyle='#4ab6b4a0';ctx.lineWidth=.65;ctx.stroke();
    for(const {s,anchor} of markers){
      const[x,y,z]=project(anchor),opacity=compositionOpacity(s);if(z<.06||!opacity)continue;
      const r=(s.category==='CR'?32:24)*Math.min(camera.zoom,1.8);
      const heat=ctx.createRadialGradient(x,y,0,x,y,r);heat.addColorStop(0,(COLORS[s.category]||COLORS.VU)+'85');heat.addColorStop(.48,(COLORS[s.category]||COLORS.VU)+'35');heat.addColorStop(1,(COLORS[s.category]||COLORS.VU)+'00');
      ctx.globalAlpha=clamp(z*3,0,1)*opacity;ctx.fillStyle=heat;ctx.fillRect(x-r,y-r,r*2,r*2);
    }
    ctx.globalAlpha=1;
    for(const {s,el,anchor} of markers){
      const[x,y,z]=project(anchor),[gx,gy,gz]=project(s.point),opacity=s.id===selected?1:compositionOpacity(s),visible=z>.035&&opacity>.02&&x> -10&&x<width+10&&y> -10&&y<height+10;
      el.hidden=!visible;if(!visible)continue;
      el.style.transform='translate('+x.toFixed(2)+'px,'+y.toFixed(2)+'px) translate(-50%,-50%)';
      el.style.opacity=String(clamp(z*7,.25,1)*opacity);el.style.zIndex=String(s.id===selected?100:Math.round(z*30));
      el.classList.toggle('selected',s.id===selected);
      if(s.id===selected&&gz>0&&Math.hypot(x-gx,y-gy)>5){
        ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(gx,gy);ctx.strokeStyle=COLORS[s.category];ctx.lineWidth=1;ctx.setLineDash([2,3]);ctx.stroke();ctx.setLineDash([]);
        ctx.beginPath();ctx.arc(gx,gy,3,0,Math.PI*2);ctx.fillStyle=COLORS[s.category];ctx.fill();
      }
    }
    const located=items.find(s=>s.id===selected);
    if(located?.point&&(!located.design||!located.iconAsset||located.design.emptyInFigma)){
      const[x,y,z]=project(located.point);
      if(z>0){ctx.beginPath();ctx.arc(x,y,5,0,Math.PI*2);ctx.fillStyle=COLORS[located.category]||COLORS.VU;ctx.fill();ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.stroke();ctx.font='600 12px system-ui';ctx.textAlign='center';ctx.lineWidth=4;ctx.strokeText(located.name,x,y-14);ctx.fillStyle='#40354c';ctx.fillText(located.name,x,y-14);}
    }
    ctx.restore();
    const view=nearestView(camera.lon),preset=PRESETS[view];
    updateSummary(view);
    title.textContent=Math.abs(camera.lat)>65?(camera.lat>0?t('Arctic · 北极'):t('Antarctica · 南极')):t(preset.name);
    zoomLabel.textContent=Math.round(camera.zoom*100)+'%';
    coords.textContent=Math.abs(camera.lat).toFixed(1)+'°'+(camera.lat>=0?'N':'S')+' / '+Math.abs(camera.lon).toFixed(1)+'°'+(camera.lon>=0?'E':'W');
    panel.querySelectorAll('[data-globe-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.globeView===view)));
    panel.querySelector('[data-globe="spin"]').setAttribute('aria-pressed',String(auto));
    canvas.dataset.ready='true';canvas.dataset.longitude=camera.lon.toFixed(3);canvas.dataset.latitude=camera.lat.toFixed(3);canvas.dataset.zoom=camera.zoom.toFixed(3);
    onChange({...camera,zoom:targetZoom});
  }
  function tick(time){
    frame=0;if(disposed||!canvas.isConnected)return;
    const dt=Math.min(time-(previous||time),40)||16;previous=time;
    let moving=false;
    if(!document.hidden&&!panel.closest('body')?.querySelector('dialog[open]')){
      if(flight){
        const t=clamp((time-flight.time)/flight.duration,0,1),ease=1-Math.pow(1-t,3);
        camera.lon=wrapLon(flight.from.lon+wrapLon(flight.to.lon-flight.from.lon)*ease);camera.lat=flight.from.lat+(flight.to.lat-flight.from.lat)*ease;
        moving=true;if(t===1)flight=null;
      }else if(!pointers.size){
        if(auto&&!reduce.matches){camera.lon=wrapLon(camera.lon+dt*.004);moving=true;}
        if(Math.hypot(...velocity)>.003&&!reduce.matches){
          camera=moveCamera(camera,velocity[0]*dt,velocity[1]*dt);const decay=Math.exp(-dt/190);velocity=velocity.map(v=>v*decay);moving=true;
        }else velocity=[0,0];
      }
      if(Math.abs(targetZoom-camera.zoom)>.001){camera.zoom=reduce.matches?targetZoom:camera.zoom+(targetZoom-camera.zoom)*(1-Math.exp(-dt/95));moving=true;}else camera.zoom=targetZoom;
    }
    if(dirty||moving){draw();dirty=false;}
    if(moving||auto&&!document.hidden)frame=requestAnimationFrame(tick);
  }
  function fly(view){
    const to=typeof view==='string'?PRESETS[view]:view;if(!to)return;
    auto=false;velocity=[0,0];selected=null;
    if(reduce.matches)camera={...camera,...to};else flight={from:{...camera},to,time:performance.now(),duration:800};
    wake();
  }
  function control(action){
    if(action!=='spin')auto=false;
    if(action==='zoom-in')targetZoom=zoomCamera(targetZoom,1.3);
    if(action==='zoom-out')targetZoom=zoomCamera(targetZoom,1/1.3);
    if(action==='left'){flight=null;velocity=[0,0];camera.lon=wrapLon(camera.lon-20);}
    if(action==='right'){flight=null;velocity=[0,0];camera.lon=wrapLon(camera.lon+20);}
    if(action==='reset'){targetZoom=1;fly(start);}
    if(action==='spin'){velocity=[0,0];flight=null;auto=!auto;}
    if(action==='next-view'){const keys=Object.keys(PRESETS);fly(keys[(keys.indexOf(nearestView(camera.lon))+1)%keys.length]);}
    wake();
  }
  panel.addEventListener('click',e=>{const button=e.target.closest('[data-globe],[data-globe-view]');if(!button)return;if(button.dataset.globeView)fly(button.dataset.globeView);else control(button.dataset.globe);},{signal});
  viewport.addEventListener('pointerdown',e=>{
    if(e.target.closest('button')||e.button!==0)return;
    auto=false;flight=null;velocity=[0,0];dragged=false;
    pointers.set(e.pointerId,{x:e.clientX,y:e.clientY,time:performance.now()});viewport.setPointerCapture(e.pointerId);
    viewport.classList.add('is-dragging');e.preventDefault();
    if(pointers.size===2){const[a,b]=[...pointers.values()];pinch={distance:Math.hypot(a.x-b.x,a.y-b.y),zoom:targetZoom};}
    wake();
  },{signal});
  viewport.addEventListener('pointermove',e=>{
    const old=pointers.get(e.pointerId);if(!old)return;
    const now=performance.now(),dx=e.clientX-old.x,dy=e.clientY-old.y;dragged ||= Math.abs(dx)+Math.abs(dy)>2;
    pointers.set(e.pointerId,{x:e.clientX,y:e.clientY,time:now});
    if(pointers.size===2&&pinch){const[a,b]=[...pointers.values()];targetZoom=zoomCamera(pinch.zoom,Math.hypot(a.x-b.x,a.y-b.y)/Math.max(pinch.distance,1));}
    else{
      const sensitivity=90/(baseRadius*camera.zoom),dt=Math.max(8,now-old.time);
      camera=moveCamera(camera,dx*sensitivity,dy*sensitivity);velocity=[clamp(dx*sensitivity/dt,-.35,.35),clamp(dy*sensitivity/dt,-.25,.25)];
    }
    wake();
  },{signal});
  function release(e){
    const old=pointers.get(e.pointerId);if(!old)return;
    if(performance.now()-old.time>100||e.type==='pointercancel')velocity=[0,0];
    pointers.delete(e.pointerId);pinch=null;
    if(!pointers.size)viewport.classList.remove('is-dragging');else velocity=[0,0];
    if(viewport.hasPointerCapture(e.pointerId))viewport.releasePointerCapture(e.pointerId);
    wake();
  }
  viewport.addEventListener('pointerup',release,{signal});viewport.addEventListener('pointercancel',release,{signal});viewport.addEventListener('lostpointercapture',release,{signal});
  viewport.addEventListener('wheel',e=>{e.preventDefault();auto=false;targetZoom=zoomCamera(targetZoom,Math.exp(-clamp(e.deltaY,-200,200)*.002));wake();},{passive:false,signal});
  viewport.addEventListener('dblclick',e=>{if(e.target.closest('button')||dragged)return;auto=false;targetZoom=zoomCamera(targetZoom,e.shiftKey?1/1.7:1.7);wake();},{signal});
  canvas.addEventListener('keydown',e=>{
    const actions={ArrowLeft:'left',ArrowRight:'right','+':'zoom-in','=':'zoom-in','-':'zoom-out',Home:'reset',' ':'spin'};
    if(actions[e.key]){e.preventDefault();control(actions[e.key]);}
    if(['ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();auto=false;flight=null;velocity=[0,0];camera.lat=clamp(camera.lat+(e.key==='ArrowUp'?15:-15),-89.9,89.9);wake();}
  },{signal});
  document.addEventListener('visibilitychange',()=>{previous=0;wake();},{signal});
  reduce.addEventListener('change',()=>{if(reduce.matches){auto=false;velocity=[0,0];flight=null;}wake();},{signal});
  const resizeObserver=new ResizeObserver(resize);resizeObserver.observe(viewport);resize();
  const destroy=()=>{disposed=true;abort.abort();resizeObserver.disconnect();cancelAnimationFrame(frame);layer.replaceChildren();};
  destroy.getState=()=>({...camera,zoom:targetZoom});
  destroy.focus=id=>{const s=items.find(x=>x.id===id);if(s?.point){fly({lon:s.point[0],lat:s.point[1]});selected=id;}};
  return destroy;
}
