import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const DIR=fileURLToPath(new URL('.',import.meta.url));
// File URL paths are normalized below for Windows.

const BG='#1b1b1b',PANEL='#2b2b2b',CORAL='#e28c78',TEAL='#8cbebb',INK='#f4f2f0',MUTED='#bbb9b7',DIM='#858381';
const F='Microsoft YaHei';
export const data=JSON.parse(await fs.readFile(DIR+'/content.json','utf8'));
export const inventory=JSON.parse(await fs.readFile(DIR+'/inventory.json','utf8'));
const photos=JSON.parse(await fs.readFile(new URL('../../server/wildlife-photos.json',import.meta.url),'utf8'));
function box(s,x,y,w,h,fill=PANEL,line='none',round=true){return s.shapes.add({geometry:round?'roundRect':'rect',position:{left:x,top:y,width:w,height:h},fill,line:{fill:line,width:line==='none'?0:1.4},borderRadius:round?14:0});}
function text(s,txt,x,y,w,h,size=21,color=INK,bold=false,align='left'){
 const sh=s.shapes.add({geometry:'textbox',position:{left:x,top:y,width:w,height:h},fill:'none',line:{fill:'none',width:0}});
 sh.text=txt;sh.text.style={fontFamily:F,fontSize:size,bold,color,alignment:align,verticalAlignment:'middle',insets:0,wrap:true};return sh;
}
function rule(s,x,y,w,color='#44413f'){box(s,x,y,w,1.2,color,'none',false);}
function arrow(s,x,y,vertical=false){text(s,vertical?'⌄':'›',x,y,40,38,39,CORAL,false,'center');}
async function image(s,name,x,y,w,h){const bytes=await fs.readFile(DIR+'/screens/'+name);return s.images.add({blob:new Uint8Array(bytes),contentType:name.endsWith('.png')?'image/png':'image/jpeg',fit:'contain',position:{left:x,top:y,width:w,height:h},alt:name});}
function flow(s,items,x,y,w,h,active=false){
 const gutter=26,wi=(w-gutter)/2;
 items.forEach((item,i)=>{box(s,x+i*(wi+gutter),y,wi,h,active?'#34332f':'#323232',active?CORAL:'#6c6966',true);text(s,item,x+14+i*(wi+gutter),y+12,wi-28,h-24,20,active?INK:MUTED,false,'center');});
 arrow(s,x+wi-7,y+h/2-20);
}
function refs(c){return c.refs.slice(0,2).map(r=>r.file+':'+r.line).join('   ');}
function sourceNote(s,c){return [c.id+' '+c.title,'Related insight: '+c.insight,'Iteration type: '+c.kind,'Evidence: '+c.evidence,'BEFORE: '+c.before.join(' / '),'AFTER: '+c.after.join(' / '),'Result: '+c.result,'Details: '+c.detail,'Code:',...c.refs.map(r=>''+r.file+':'+r.line+' ('+r.symbol+')'),'Validation: '+c.test].join('\n');}
async function card(s,c,x,y,w,wide=false){
 text(s,`${c.id} - ${c.title}`,x+5,y,w-10,34,25,CORAL,true);
 text(s,'Related insight  修改原因：'+c.insight,x+5,y+41,w-10,56,19,MUTED);
 text(s,'Iteration type  迭代类型：'+c.kind,x+5,y+102,w-10,28,18,INK);
 const py=y+148,ph=wide?270:515;
 box(s,x,py,w,ph);
 if(!wide){
   text(s,'BEFORE',x+28,py+19,125,28,19,INK,true);
   text(s,c.evidence==='需求基线'?'需求阶段示意':c.evidence==='源码差异'?'历史源码 / 新增前状态':'依据开发记录示意',x+161,py+20,w-185,24,14,DIM);
   if(c.oldImage){
      await image(s,c.oldImage,x+24,py+55,235,140);
      text(s,c.before.join('\n'),x+286,py+62,w-313,125,21,MUTED);
   }else flow(s,c.before,x+28,py+65,w-56,105);
   arrow(s,x+w/2-20,py+185,true);
   text(s,'AFTER',x+28,py+232,120,28,19,INK,true);
   if(c.image){
      await image(s,c.image,x+28,py+274,278,160);
      text(s,c.after.join('\n'),x+331,py+280,w-359,149,21,INK);
   }else flow(s,c.after,x+28,py+280,w-56,108,true);
   if(c.id==='F2')text(s,'照片：Sunuwargr / CC BY-SA 4.0',x+28,py+432,w-56,16,12,DIM);
   rule(s,x+28,py+448,w-56);
   text(s,'✓',x+27,py+460,30,33,26,TEAL,true);
   text(s,c.result,x+69,py+458,w-96,55,19,TEAL);
 } else {
   const gap=70,inner=w-56,cw=(inner-gap)/2,lx=x+28,rx=lx+cw+gap;
   text(s,'BEFORE',lx,py+16,cw,25,18,INK,true);
   text(s,'AFTER',rx,py+16,cw,25,18,INK,true);
   if(c.oldImage){await image(s,c.oldImage,lx,py+56,cw*.45,120);text(s,c.before.join('\n'),lx+cw*.49,py+56,cw*.51,120,20,MUTED);}else {box(s,lx,py+56,cw,120,'#323232','#6c6966');text(s,c.before.join('\n'),lx+18,py+67,cw-36,98,21,MUTED);}
   arrow(s,lx+cw+15,py+99);
   if(c.image){await image(s,c.image,rx,py+52,cw*.4,132);text(s,c.after.join('\n'),rx+cw*.44,py+56,cw*.56,120,21,INK);}else {box(s,rx,py+56,cw,120,'#34332f',CORAL);text(s,c.after.join('\n'),rx+18,py+67,cw-36,98,21,INK);}
   rule(s,x+28,py+196,w-56);
   text(s,'✓',x+27,py+209,30,33,26,TEAL,true);
   text(s,c.result,x+69,py+206,w-96,51,20,TEAL);
 }
 text(s,refs(c),x+6,py+ph+8,w-12,29,13,DIM);
}
export async function buildOverview(p){
 const s=p.slides.add({width:1920,height:1280});s.background.fill=BG;
 text(s,'AniKind 前后端迭代图册',66,57,1760,85,60,CORAL,true);
 text(s,'按修改原因、迭代类型与 BEFORE / AFTER 对照整理',69,158,1760,53,29,INK);
 text(s,'范围：当前本地 Web App    截止：2026-10-29    共 45 项实现与迭代',69,224,1750,35,22,MUTED);
 rule(s,70,290,1780);
 const xs=[70,690,1310];
 for(let i=0;i<9;i++){const [id,title]=data.groups[i],x=xs[i%3],y=331+Math.floor(i/3)*146;
 text(s,id,x,y,56,70,51,CORAL,true);text(s,title,x+78,y+7,490,40,26,INK,true);text(s,`${id}1–${id}5   从代码定位到页面或流程结果`,x+78,y+56,490,35,18,MUTED);}
 box(s,70,816,1780,297,PANEL);
 text(s,'阅读说明',101,836,420,44,28,INK,true);
 text(s,'首次实现：BEFORE 是 PRD 需求阶段示意，不是假造的旧页面。',101,899,1690,40,24,MUTED);
 text(s,'后续迭代：依据用户要求、开发记录及 9 月 17 日部署源码包对比当前源码。',101,955,1690,40,24,MUTED);
 text(s,'截图为实际页面或原始素材。流程图为可编辑示意。详细代码定位、差异与文件清单随附。',101,1011,1690,56,24,TEAL);
 text(s,'当前是本地 MVP。公网发布已暂停，真实 AI、真机触屏与生产负载尚未验收。',72,1153,1770,42,22,MUTED);
 s.speakerNotes.text='来源：用户图三为版式参考，不复用示例中的植物产品内容。需求记录：本任务历史。源码快照：anikind/output/deploy/anikind-singapore-20260917-161121.zip。当前源码：.。没有完整 Git 历史，差异仅代表两个可用快照。';
}
export async function buildGroup(p,index){
 const [id,title]=data.groups[index],cs=data.cards.filter(c=>c.id.startsWith(id));
 const s=p.slides.add({width:1920,height:1280});s.background.fill=BG;
 text(s,`${id}  ${title}`,50,24,1540,49,31,INK,true);
 text(s,`${index+2} / 13`,1710,25,155,43,20,DIM,false,'right');
 for(let i=0;i<3;i++)await card(s,cs[i],50+i*617,93,586,false);
 for(let i=3;i<5;i++)await card(s,cs[i],50+(i-3)*927,805,896,true);
 s.speakerNotes.text=cs.map(c=>sourceNote(s,c)).join('\n\n')+'\n\n图片：实际应用截图；Figma 原始资源路径见 docs/figma-globe-assets.json。动物照片作者/许可：\n'+photos.filter(ph=>[4,8].includes(ph.recordId)).map(ph=>JSON.stringify(ph)).join('\n');
}
const STATUS={unchanged:'与快照一致',modified:'与快照有差异',new:'快照未收录',removed:'当前已移除'};
export function mappedIds(file){
 const ids=data.cards.filter(c=>c.refs.some(r=>r.file===file)).map(c=>c.id);
 if(ids.length)return ids.join('、');
 if(file.startsWith('tests/'))return 'I5';
 if(file.includes('LANGUAGES')||file.includes('locales/'))return 'H1–H5';
 if(file.includes('PUZZLE')||file.includes('puzzle-assets'))return 'F1–G5';
 if(file.includes('WILDLIFE')||file.includes('wildlife'))return 'F2、F3、I4';
 if(file.includes('GLOBE')||file.includes('globe-assets'))return 'D1–D5';
 if(file.includes('AI_PROVIDER'))return 'B2–B4';
 if(file.includes('SINGAPORE')||file.includes('docker')||file.includes('env.example'))return 'I2、I4';
 return 'I4、I5';
}
export function buildInventory(p,idx){
 const rows=inventory.slice(idx*20,(idx+1)*20);const s=p.slides.add({width:1920,height:1280});s.background.fill=BG;
 text(s,`源码文件登记 ${idx+1} / 3`,65,40,1600,68,43,CORAL,true);
 text(s,'对比 2026-09-17 部署包与 2026-10-29 当前工作区，忽略 BOM 和换行差异',65,124,1790,45,23,MUTED);
 const vals=[['文件','当前行数','快照比较','对应迭代'],...rows.map(r=>[r.file,String(r.lines),STATUS[r.status],mappedIds(r.file)])];
 const table=s.tables.add({rows:vals.length,columns:4,left:65,top:200,width:1790,height:vals.length*44,columnWidths:[855,190,320,425],values:vals});
 table.borders.assign({style:'solid',fill:'#343231',width:0.6});
 for(let i=0;i<vals.length;i++){table.rows[i].height=44;for(let j=0;j<4;j++){const cell=table.getCell(i,j);cell.fill=BG;cell.text.style={fontFamily:F,fontSize:j===3?17:21,color:i===0?INK:j===2?(rows[i-1].status==='modified'?CORAL:rows[i-1].status==='new'?TEAL:MUTED):j===0?INK:MUTED,bold:i===0,verticalAlignment:'middle',insets:10};}}
 text(s,'“快照未收录”不代表该文件一定在快照日期之后新建，部署包可能没有包含维护脚本。',67,1150,1780,38,20,TEAL);
 text(s,'另有公开资产目录：Figma 图标、拼块遮罩、32 张照片（含 1 张归档）、地图数据及 D3 许可。详见随附清单。',67,1201,1780,40,19,MUTED);
 s.speakerNotes.text='完整 SHA-256、增删行数、所有公开资产文件与逐项详情见随附完整迭代清单及文件清单 CSV。私人数据库、.env、日志和第三方库内部代码不作为自研迭代正文。';
}
