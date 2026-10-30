import { readFileSync,writeFileSync } from 'node:fs';
import { pointInPolygon } from '../public/js/globe-math.js';
const raw=readFileSync('../global-endangered-species-map.html','utf8').replaceAll('&quot;','"').replaceAll('&#x27;',"'").replaceAll('&lt;','<').replaceAll('&gt;','>').replaceAll('&amp;','&');
const species=JSON.parse(raw.match(/<script id="gea-species-data" type="application\/json">([\s\S]*?)<\/script>/)[1]);
const assets=JSON.parse(readFileSync('docs/figma-globe-assets.json','utf8'));
// [source record, exported node, design view, marker circle center X/Y].
const bindings=[
  [1,'1:8324','asia',195,452],[2,'1:8321','asia',163,415],[3,'1:8290','asia',248,279],[4,'1:8304','asia',235,323],
  [5,'1:8307','asia',114,343],[6,'1:8293','asia',129,288],[7,'1:8313','asia',167,370],[8,'1:8310','asia',154,327],
  [9,'1:1190','africa',242,497],[10,'1:8313','africa',212,422],[11,null,'africa',240,431],[12,'1:1187','africa',180,397],
  [13,'1:1197','africa',212,468],[16,'1:1204','africa',211,264],[17,null,'africa',126,341],[18,'1:1210','africa',157,320],[19,'1:1206','africa',229,322],
  [20,'1:6360','americas',124,342],[22,'1:6358','americas',176,299],[23,'1:6362','americas',211,278],[24,'1:6356','americas',240,246],
  [25,'1:6368','americas',215,494],[26,'1:6371','americas',253,465],[28,'1:6375','americas',272,501],[29,'1:6366','americas',183,454],
  [30,'1:8338','asia',323,518],[31,'1:8346','asia',311,481],[32,'1:8333','asia',257,514],[33,'1:8341','asia',288,504],[34,'1:8330','asia',275,542],
  [36,'1:8318','asia',105,390],[37,'1:6374','americas',275,550],[39,'1:8327','asia',272,429]
];
const mapped=species.map(s=>{
  const binding=bindings.find(b=>b[0]===s.id),asset=binding&&assets.find(a=>a.nodeId===binding[1])?.assets.find(a=>a.path.endsWith('.png'));
  return {...s,design:binding?{fileKey:'c19dGrM1HqpIPqOMB9x4tt',nodeId:binding[1]||(s.id===11?'1:1166':'1:1217'),view:binding[2],position:binding.slice(3),icon:asset?.path||null,emptyInFigma:!asset,floatingInFigma:[30,31,33].includes(s.id)}:null};
});
writeFileSync('server/globe-species.json',JSON.stringify(mapped,null,2)+'\n');
const world=JSON.parse(readFileSync('public/assets/world-land-50m.geojson','utf8'));
const polygons=world.features.flatMap(f=>f.geometry.type==='Polygon'?[f.geometry.coordinates]:f.geometry.coordinates).map(p=>({p,minX:Math.min(...p[0].map(c=>c[0])),maxX:Math.max(...p[0].map(c=>c[0])),minY:Math.min(...p[0].map(c=>c[1])),maxY:Math.max(...p[0].map(c=>c[1]))}));
const dots=[];
for(let lat=-89;lat<=89;lat++)for(let lon=-180;lon<180;lon++){
  if(polygons.some(b=>lon>=b.minX&&lon<=b.maxX&&lat>=b.minY&&lat<=b.maxY&&pointInPolygon(lon,lat,b.p)))dots.push([lon,lat]);
}
writeFileSync('public/assets/land-dots.json',JSON.stringify({source:'Natural Earth 5.1.2, 1:50m land; 1-degree samples',dots}));
console.log(JSON.stringify({species:mapped.length,figmaMarkers:bindings.length,landDots:dots.length}));
