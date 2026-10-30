const C={ink:'#313b42',muted:'#69777c',faint:'#98a2a5',line:'#dce3e4',coral:'#bd7664',teal:'#438b88',pale:'#eef6f5',gray:'#f3f5f5',white:'#ffffff'};
function rect(s,x,y,w,h,fill,line='none',r=false){return s.shapes.add({geometry:r?'roundRect':'rect',position:{left:x,top:y,width:w,height:h},fill,line:{fill:line,width:line==='none'?0:1.5},borderRadius:r?12:0});}
function tx(s,str,x,y,w,h,size=24,color=C.ink,bold=false,align='left'){let q=rect(s,x,y,w,h,'none');q.text=str;q.text.style={fontFamily:'Microsoft YaHei',fontSize:size,bold,color,alignment:align,verticalAlignment:'middle',insets:0,wrap:true};return q;}
function rule(s,x,y,w){rect(s,x,y,w,1.4,C.line);}
function arrow(s,x,y,down=false){tx(s,down?'↓':'→',x,y,40,40,30,C.coral,false,'center');}
function node(s,a,x,y,w,h=82,active=false){rect(s,x,y,w,h,active?C.pale:C.gray,active?'#a8cbca':C.line,true);tx(s,a,x+12,y+8,w-24,h-16,23,active?C.ink:C.muted,false,'center');}
function chain(s,arr,x,y,w,h=82,active=false){let nw=(w-(arr.length-1)*42)/arr.length;arr.forEach((a,i)=>{node(s,a,x+i*(nw+42),y,nw,h,active);if(i<arr.length-1)arrow(s,x+nw+i*(nw+42)+1,y+h/2-20);});}
function head(s,id,title,insight,kind,x,y,w){tx(s,`${id}  ${title}`,x,y,w,45,32,C.coral,true);tx(s,'Related insight  '+insight,x,y+54,w,55,22,C.muted);tx(s,'Iteration type  '+kind,x,y+113,w,32,21,C.muted);}
function label(s,t,x,y,w=700){tx(s,t,x,y,w,28,19,C.muted,true);}
function result(s,t,x,y,w){rule(s,x,y,w);tx(s,'✓',x,y+18,35,35,28,C.teal,true);tx(s,t,x+43,y+13,w-43,64,24,C.teal);}
export async function build(p){
 const s=p.slides.add({width:2400,height:1500});s.background.fill=C.white;
 tx(s,'AniKind 技术迭代',60,30,1490,64,48,C.ink,true);
 tx(s,'TECHNICAL ITERATIONS',1680,42,660,42,23,C.muted,false,'right');
 tx(s,'前端渲染、数据契约与后端状态的五项关键演进',63,101,1900,34,25,C.muted);
 rule(s,60,154,2280);
 // A1: geography and input pipeline.
 head(s,'A1','球面渲染与交互引擎','地区示意不足以承载旋转与缩放。','渲染管线 / 输入事件',60,188,720);
 label(s,'BEFORE  /  早期实现记录',60,356);
 chain(s,['地区示意地图','地区浏览'],60,398,720,78);
 arrow(s,400,487,true);
 label(s,'AFTER  /  当前实现',60,535);
 chain(s,['Natural Earth\n真实地理数据','D3 正射投影\n半球裁切','Canvas\n地球 + 标记'],60,578,720,93,true);
 rect(s,60,687,720,58,'#fff8f4',C.coral,true);
 tx(s,'拖动 / 双指 / 滚轮  →  相机状态  →  重绘',74,695,692,42,23,C.coral,false,'center');
 result(s,'惯性与自动旋转；缩放范围 72%–400%。',60,763,720);
 tx(s,'public/js/globe.js  +  globe-math.js  ·  D1 / D3',60,847,720,26,18,C.faint);
 // A2: shared membership predicates.
 head(s,'A2','物种映射与目录一致性','地球、拼图必须指向同一物种。','数据契约 / 资产筛选',840,188,720);
 label(s,'BEFORE  /  源码与开发记录',840,356);
 chain(s,['33 个设计绑定\n包含 2 个空圈','早期 32 个拼图\n含三角龙'],840,398,720,78);
 arrow(s,1180,487,true);
 label(s,'AFTER  /  当前实现',840,535);
 chain(s,['40 条物种资料\n同一 recordId','有效图标筛选\n排除空占位','31 个地球标记\n31 个拼图'],840,578,720,93,true);
 rect(s,840,687,720,58,'#fff8f4',C.coral,true);
 tx(s,'iconAsset && !emptyInFigma  ·  实拍按学名核对',853,695,694,42,22,C.coral,false,'center');
 result(s,'保留原始绑定供追溯；不改动地球运动函数。',840,763,720);
 tx(s,'server/puzzles.mjs  +  public/js/globe.js  ·  D4 / F3–F4',840,847,720,26,18,C.faint);
 // A3: authoritative puzzle transaction.
 head(s,'A3','服务端拼图与知识卡解锁','完成状态需要验证，进度需要续存。','API / 事务 / 持久化',1620,188,720);
 label(s,'BEFORE  /  09-17 源码快照',1620,356);
 chain(s,['仅有物种浏览','尚无拼图进度\n与知识卡接口'],1620,398,720,78);
 arrow(s,1960,487,true);
 label(s,'AFTER  /  当前实现',1620,535);
 chain(s,['客户端操作\nfrom / to / version','服务端校验\n合法交换 + 版本','SQLite\n排列与解锁状态'],1620,578,720,93,true);
 rect(s,1620,687,720,58,'#fff8f4',C.coral,true);
 tx(s,'版本冲突：409 后重取进度   /   完成：返回 3 张知识卡',1633,695,694,42,21,C.coral,false,'center');
 result(s,'后端判定完成；未解锁时不返回卡片正文。',1620,763,720);
 tx(s,'server/app.mjs  +  core.mjs  +  public/js/puzzles.js  ·  G1–G4',1620,847,720,26,18,C.faint);
 // Bottom row: two wider compositions.
 head(s,'B1','语言切换与交互状态保留','翻译界面时，需要维持正在进行的探索与拼图。','国际化 / 状态恢复',60,934,1110);
 label(s,'BEFORE  /  中文界面',60,1100,450);
 node(s,'中文模板与资料\n无全站语言入口',60,1144,310,114);
 arrow(s,389,1177);
 label(s,'AFTER  /  双语与状态恢复',454,1100,716);
 chain(s,['URL / 本地偏好\n选择 zh-CN / en','i18n 字典\n渲染界面文案','恢复视角与筛选\n复用拼图存档'],454,1144,716,114,true);
 result(s,'t / tr 处理界面文案；私人输入与物种 ID 保持原值。',60,1285,1110);
 tx(s,'public/js/i18n.js  +  locales/  +  app.js  ·  H1–H5',60,1369,1110,26,18,C.faint);
 head(s,'B2','服务恢复与可交付运行环境','服务停止会导致本机网址无法访问。','运行管理 / 部署配置 / 回归测试',1230,934,1110);
 label(s,'BEFORE  /  本地服务停止',1230,1100,450);
 node(s,'进程未运行\n127.0.0.1 无响应',1230,1144,310,114);
 arrow(s,1559,1177);
 label(s,'AFTER  /  已恢复本机服务',1624,1100,716);
 chain(s,['启动脚本\nPID / 日志 / 健康检查','Node 同源服务\nAPI + 本地资源','回归测试\n24 项 → 39 项'],1624,1144,716,114,true);
 result(s,'Docker / Compose / Caddy 已备配置；公网部署尚未执行。',1230,1285,1110);
 tx(s,'Start-AniKind.ps1  +  compose.yaml  +  tests/  ·  I1–I5',1230,1369,1110,26,18,C.faint);
 rule(s,60,1420,2280);
 tx(s,'依据：2026-09-17 部署源码快照、开发记录与 2026-10-29 实现审计。Before 为技术流程示意；B2 的启动脚本为既有能力，本次属于服务恢复。',60,1440,2280,35,19,C.muted);
 s.speakerNotes.text='技术迭代精选图。依据 output/anikind-iterations/完整迭代清单.md 与 20260917-20261029源码差异.patch。A1=D1,D3；A2=D2,D4,F3,F4；A3=G1,G2,G3,G4；B1=H1-H5；B2=I1-I5。D3 双指设备未真机验收。Natural Earth 陆地1:50m、国界1:110m。地球点位为代表坐标，非完整分布范围。访客与账号进度隔离，不自动合并。B2 启动脚本9月17日已存在，后续为运行恢复。新加坡尚未购买资源或实际发布，39项测试为审计记录，不代表生产负载或真实网络验收。';
 return s;
}
