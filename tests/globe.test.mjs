import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import vm from 'node:vm';
import {PRESETS,viewPoint,inversePoint,designAnchor,moveCamera,zoomCamera,wrapLon,pointInPolygon} from '../public/js/globe-math.js';
import source from '../server/globe-species.json' with {type:'json'};
const close=(a,b,tolerance=1e-7)=>assert.ok(Math.abs(a-b)<tolerance,`${a} differs from ${b}`);
test('orthographic projection preserves landmarks, poles, hemispheres and date line',()=>{
  close(viewPoint([0,0],{lon:0,lat:0})[2],1);
  close(viewPoint([90,0],{lon:0,lat:0})[0],1);
  close(viewPoint([0,90],{lon:0,lat:0})[1],1);
  assert.ok(viewPoint([180,0],{lon:0,lat:0})[2]<0);
  const v=viewPoint([-179,10],{lon:179,lat:10});assert.ok(v[2]>.999);assert.ok(v[0]>0);
  for(const camera of Object.values(PRESETS))for(const point of [[31,30],[112,8],[-78,14],[20,80],[0,-85]]){
    const [x,y,z]=viewPoint(point,camera);if(z<=.01)continue;
    const p=inversePoint(x,y,camera);close(wrapLon(p[0]-point[0]),0);close(p[1],point[1]);
  }
  assert.equal(inversePoint(2,0,PRESETS.asia),null);
});
test('landmarks project identically to the independent d3-geo implementation',()=>{
  const sandbox={};vm.createContext(sandbox);
  for(const file of ['d3-array.min.js','d3-geo.min.js'])vm.runInContext(readFileSync(new URL('../public/vendor/'+file,import.meta.url),'utf8'),sandbox);
  for(const camera of [...Object.values(PRESETS),{lon:179,lat:-89.9}]){
    const projection=sandbox.d3.geoOrthographic().rotate([-camera.lon,-camera.lat]).translate([0,0]).scale(1);
    for(const point of [[0,0],[103,30],[-74,40.7],[151.2,-33.9],[179,-16.5],[0,-90]]){const[x,y]=viewPoint(point,camera),p=projection(point);close(x,p[0]);close(-y,p[1]);}
  }
});
test('all mapped Figma anchors reproduce original circle positions and have local assets',()=>{
  assert.equal(source.length,40);const mapped=source.filter(s=>s.design);assert.equal(mapped.length,33);
  for(const s of mapped){const d=s.design,p=designAnchor(d);assert.ok(p,s.name);const [x,y]=viewPoint(p,PRESETS[d.view]);const [cx,cy,rx,ry]=d.view==='asia'?[204.091,399.5,185.091,183.5]:[203.043,399.957,183.043,183.043];close(cx+x*rx,d.position[0],.01);close(cy-y*ry,d.position[1],.01);if(d.icon)assert.ok(existsSync(resolve('public'+d.icon)),s.name);else assert.equal(d.emptyInFigma,true);}
  assert.equal(mapped.filter(s=>s.design.emptyInFigma).length,2);
});
test('dragging across poles and repeated zoom never produce invalid camera coordinates',()=>{
  let camera={lon:179,lat:85,zoom:1};camera=moveCamera(camera,-500,1000);assert.ok(camera.lon>=-180&&camera.lon<180);assert.equal(camera.lat,89.9);
  assert.equal(moveCamera(camera,0,-1000).lat,-89.9);
  close(zoomCamera(1,2),2);close(zoomCamera(2,.5),1);assert.equal(zoomCamera(1,100),4);assert.equal(zoomCamera(1,.001),.72);
});
test('land sampling excludes lakes and oceans and retains all continents',()=>{
  const polygon=[[[0,0],[10,0],[10,10],[0,10],[0,0]],[[3,3],[7,3],[7,7],[3,7],[3,3]]];
  assert.equal(pointInPolygon(1,1,polygon),true);assert.equal(pointInPolygon(5,5,polygon),false);assert.equal(pointInPolygon(20,5,polygon),false);
  const {dots}=JSON.parse(readFileSync(new URL('../public/assets/land-dots.json',import.meta.url)));
  for(const [lon,lat] of [[20,0],[100,40],[-100,40],[-60,-10],[135,-25],[20,50],[0,-85]])assert.ok(dots.some(p=>p[0]===lon&&p[1]===lat),`land at ${lon},${lat}`);
  assert.ok(!dots.some(p=>p[0]===-140&&p[1]===0));
});
