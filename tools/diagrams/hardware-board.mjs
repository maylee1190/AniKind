const C={bg:'#1c1d1d',panel:'#2a2c2c',box:'#303333',ink:'#eef0ed',muted:'#b8bfbb',dim:'#929b96',coral:'#db907c',teal:'#93c9c4',line:'#727d76'};
function r(s,x,y,w,h,fill='none',line='none',round=false){return s.shapes.add({geometry:round?'roundRect':'rect',position:{left:x,top:y,width:w,height:h},fill,line:{fill:line,width:line==='none'?0:2},borderRadius:round?18:0});}
function t(s,str,x,y,w,h,size=25,color=C.ink,bold=false,align='left'){let a=r(s,x,y,w,h);a.text=str;a.text.style={fontFamily:'Microsoft YaHei',fontSize:size,color,bold,alignment:align,verticalAlignment:'middle',wrap:true,insets:0};return a;}
function line(s,x,y,w,color=C.line){r(s,x,y,w,2,color);}
function arrow(s,x,y,w=100,dash=false){if(dash){for(let i=0;i<w-20;i+=18)r(s,x+i,y+18,10,2,C.dim);}else line(s,x,y+18,w-18,C.muted);t(s,'›',x+w-24,y-6,28,46,39,dash?C.dim:C.muted,false,'center');}
function dashBox(s,x,y,w,h){for(let a=0;a<w;a+=22){r(s,x+a,y,Math.min(11,w-a),2,C.line);r(s,x+a,y+h,Math.min(11,w-a),2,C.line);}for(let a=0;a<h;a+=22){r(s,x,y+a,2,Math.min(11,h-a),C.line);r(s,x+w,y+a,2,Math.min(11,h-a),C.line);}}
function pc(s,x,y,scale=1,color=C.ink){r(s,x,y,150*scale,94*scale,'none',color,true);r(s,x+8*scale,y+8*scale,134*scale,68*scale,'none',color);r(s,x+70*scale,y+94*scale,10*scale,24*scale,color);r(s,x+36*scale,y+118*scale,78*scale,5*scale,color);}
function server(s,x,y,scale=1,color=C.ink){for(let i=0;i<3;i++){r(s,x,y+i*37*scale,116*scale,29*scale,'none',color,true);r(s,x+12*scale,y+(10+i*37)*scale,7*scale,7*scale,color);r(s,x+34*scale,y+(13+i*37)*scale,61*scale,3*scale,color);}}
function disk(s,x,y,scale=1,color=C.ink){r(s,x,y,116*scale,104*scale,'none',color,true);r(s,x+14*scale,y+17*scale,88*scale,6*scale,color);r(s,x+14*scale,y+37*scale,64*scale,4*scale,color);r(s,x+14*scale,y+54*scale,64*scale,4*scale,color);r(s,x+82*scale,y+82*scale,13*scale,6*scale,color);}
function phone(s,x,y,scale=1,color=C.ink){r(s,x,y,68*scale,118*scale,'none',color,true);line(s,x+10*scale,y+16*scale,48*scale,color);line(s,x+23*scale,y+105*scale,22*scale,color);}
export async function build(p){
 let s=p.slides.add({width:1400,height:1800});s.background.fill=C.bg;
 t(s,'A1 · 终端设备与服务部署迭代',70,44,1260,75,46,C.coral,true);
 t(s,'Related insight  用户需要在电脑和手机上，连续完成探索与拼图。',70,135,1260,43,25,C.muted);
 t(s,'Iteration type  终端适配与运行环境拓展',70,191,1260,40,25,C.ink,true);
 r(s,50,275,1300,1450,C.panel,'none',true);
 t(s,'BEFORE',100,315,200,40,28,C.ink,true);
 t(s,'早期本机版本 · 2026.09.17',320,317,950,35,23,C.dim);
 r(s,100,379,1200,319,C.box,'#535c56',true);
 t(s,'同一台开发电脑内运行',130,393,1130,35,23,C.dim);
 pc(s,190,445,1,C.muted);server(s,643,450,1,C.muted);disk(s,1070,450,1,C.muted);
 arrow(s,390,488,194);arrow(s,815,488,194);
 t(s,'电脑浏览器',135,585,270,35,27,C.muted,true,'center');
 t(s,'本地 Node 服务',561,585,280,35,27,C.muted,true,'center');
 t(s,'电脑本地磁盘',989,585,280,35,27,C.muted,true,'center');
 t(s,'地球探索 / 纪念空间',125,631,290,36,22,C.dim,false,'center');
 t(s,'本机 HTTP 请求',561,631,280,36,22,C.dim,false,'center');
 t(s,'SQLite / 地图与图标',979,631,300,36,22,C.dim,false,'center');
 t(s,'↓',650,709,100,63,48,C.muted,false,'center');
 t(s,'AFTER',100,790,200,40,28,C.ink,true);
 t(s,'当前实现 · 终端交互与数据反馈扩展',320,791,950,38,23,C.teal);
 r(s,100,853,1200,334,C.box,'#718d85',true);
 t(s,'当前仍在同一台开发电脑内运行',130,864,1130,36,23,C.teal);
 pc(s,190,918);server(s,643,923);disk(s,1070,923);
 arrow(s,390,961,194);arrow(s,815,961,194);
 t(s,'电脑浏览器',135,1055,270,35,27,C.ink,true,'center');
 t(s,'本地 Node 服务',561,1055,280,35,27,C.ink,true,'center');
 t(s,'电脑本地磁盘',989,1055,280,35,27,C.ink,true,'center');
 t(s,'鼠标 / 键盘输入\n地球、拼图与中英切换',123,1100,294,65,22,C.muted,false,'center');
 t(s,'校验拼图完成\n返回进度与知识卡',553,1100,296,65,22,C.muted,false,'center');
 t(s,'持久保存进度\n实拍照片本地加载',980,1100,300,65,22,C.muted,false,'center');
 // Device and infrastructure extensions are clearly separated from the live link.
 dashBox(s,100,1240,565,235);
 t(s,'手机端适配 · 真机待验收',126,1253,515,38,23,C.coral,true);
 phone(s,142,1314,1,C.muted);
 t(s,'响应式页面已实现\n拖动 / 双指缩放 / 点选拼块\n已做浏览器窄屏验证',253,1312,385,117,22,C.muted);
 dashBox(s,705,1240,595,235);
 t(s,'远程访问 · 新加坡部署待执行',731,1253,545,38,23,C.coral,true);
 phone(s,748,1312,.65,C.dim);pc(s,803,1324,.5,C.dim);arrow(s,902,1330,108,true);server(s,1054,1312,.72,C.dim);
 t(s,'真实手机 / 其他电脑',727,1412,280,33,20,C.dim,false,'center');
 t(s,'云服务器',1030,1412,190,33,20,C.dim,false,'center');
 t(s,'HTTPS',919,1373,105,30,17,C.dim,false,'center');
 t(s,'✓',107,1512,54,54,36,C.teal,true);
 t(s,'保留本机存储与接口，增加交互输入和完成反馈。\n远程多设备访问需完成服务器部署与真实设备验证。',179,1505,1080,92,27,C.teal);
 line(s,103,1631,1190,'#4b544e');
 t(s,'实线：已实现的本机连接     虚线框：真机待验证或尚未部署的拓展',111,1649,1170,42,22,C.muted);
 t(s,'说明：当前没有新增实体硬件、传感器或执行器。图示为终端与运行环境关系，非硬件制造迭代。',70,1742,1260,39,20,C.dim);
 s.speakerNotes.text='依据 anikind/docs/GLOBE_IMPLEMENTATION.md、PUZZLE_IMPLEMENTATION.md、LANGUAGES.md、SINGAPORE_DEPLOYMENT.md、VALIDATION.md 及 output/anikind-iterations/完整迭代清单.md。9月17日已具备基础响应式布局，因此没有宣称此前不支持手机。旧版和当前硬件均为同一开发电脑，变化在软件交互与存储内容。双指逻辑已实现，真机触控未验收。未购买域名/新加坡服务器，公网部署暂停。Docker/Compose/Caddy已有配置但未验证容器运行。示意用服务器图形表示电脑内的 Node 服务，节点由同一电脑边框包围，不代表新增物理机器。2026-10-30 制图。';
}
