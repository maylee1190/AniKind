export const DEG=Math.PI/180;
export const PRESETS={africa:{lon:18,lat:12,label:'Europe · Africa',name:'欧洲与非洲'},americas:{lon:-78,lat:14,label:'The Americas',name:'美洲'},asia:{lon:112,lat:8,label:'Asia · Pacific',name:'亚洲与太平洋'}};
export const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export const wrapLon=n=>((n+180)%360+360)%360-180;
export function viewPoint([lon,lat],camera){
  const a=(lon-camera.lon)*DEG,b=lat*DEG,c=camera.lat*DEG;
  return [Math.cos(b)*Math.sin(a),Math.cos(c)*Math.sin(b)-Math.sin(c)*Math.cos(b)*Math.cos(a),Math.sin(c)*Math.sin(b)+Math.cos(c)*Math.cos(b)*Math.cos(a)];
}
export function inversePoint(x,y,camera){
  const rho=Math.hypot(x,y);if(rho>1)return null;
  if(rho<1e-9)return [camera.lon,camera.lat];
  const c=Math.asin(rho),p=camera.lat*DEG;
  return [wrapLon(camera.lon+Math.atan2(x*Math.sin(c),rho*Math.cos(p)*Math.cos(c)-y*Math.sin(p)*Math.sin(c))/DEG),Math.asin(Math.cos(c)*Math.sin(p)+y*Math.sin(c)*Math.cos(p)/rho)/DEG];
}
// Figma positions describe callout layout, not wildlife occurrence coordinates.
export function designAnchor(design){
  if(!design?.position)return null;
  const [x,y]=design.position,p=PRESETS[design.view];
  const [cx,cy,rx,ry]=design.view==='asia'?[204.091,399.5,185.091,183.5]:[203.043,399.957,183.043,183.043];
  return inversePoint((x-cx)/rx,(cy-y)/ry,p);
}
export function moveCamera(camera,dx,dy){return {...camera,lon:wrapLon(camera.lon-dx),lat:clamp(camera.lat+dy,-89.9,89.9)};}
export function zoomCamera(zoom,factor){return clamp(zoom*factor,.72,4);}
export function pointInRing(lon,lat,ring){let inside=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const[xi,yi]=ring[i],[xj,yj]=ring[j];if((yi>lat)!==(yj>lat)&&lon<(xj-xi)*(lat-yi)/(yj-yi)+xi)inside=!inside;}return inside;}
export function pointInPolygon(lon,lat,polygon){return pointInRing(lon,lat,polygon[0])&&!polygon.slice(1).some(r=>pointInRing(lon,lat,r));}
