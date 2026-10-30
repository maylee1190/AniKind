import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createApp } from './releases/2026-09-17/anikind/server/app.mjs';

// Use a different loopback host so the archived app's cookies cannot replace
// the current app's session cookies. Historical source files remain untouched.
const archive=createApp({dataDir:fileURLToPath(new URL('./runtime/2026-09-17/',import.meta.url)),production:false,demo:true,aiMode:'disabled'});
const files=new Map([
 ['/', ['index.html','text/html; charset=utf-8']],
 ['/2026-10-29-before-language', ['screenshot.html','text/html; charset=utf-8']],
 ['/2026-10-29-before-language.jpg', ['2026-10-29-before-language.jpg','image/jpeg']]
]);
const directory=createServer(async(req,res)=>{
 const path=new URL(req.url,'http://localhost').pathname;
 res.setHeader('Cache-Control','no-store');
 res.setHeader('X-Content-Type-Options','nosniff');
 if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}
 if(path==='/health'){res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({status:'ok',service:'anikind-history',archive:'2026-09-17'}));return;}
 const file=files.get(path);
 if(!file){res.writeHead(404);res.end('Not found');return;}
 try{const bytes=await readFile(new URL('./public/'+file[0],import.meta.url));res.writeHead(200,{'Content-Type':file[1]});res.end(req.method==='HEAD'?undefined:bytes);}catch{res.writeHead(500);res.end('Archive page unavailable');}
});
for(const srv of [archive.server,directory])srv.on('error',e=>{console.error(e.message);process.exit(1);});
archive.server.listen(4174,'127.0.0.2',()=>{
 directory.listen(4180,'127.0.0.1',()=>console.log('History: http://127.0.0.1:4180/ | 2026-09-17: http://127.0.0.2:4174/#explore'));
});
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{directory.close();await archive.close();process.exit(0);});
