import {readFile,mkdir,writeFile,stat} from 'node:fs/promises';
const manifest=JSON.parse(await readFile(new URL('../docs/figma-puzzle-assets.json',import.meta.url)));
await mkdir(new URL('../public/assets/puzzle/',import.meta.url),{recursive:true});
for(const asset of manifest.assets){const destination=new URL('../public'+asset.path,import.meta.url);if(await stat(destination).then(s=>s.size>0).catch(()=>false))continue;const r=await fetch(asset.url);if(!r.ok)throw new Error('Asset download failed: '+r.status);await writeFile(destination,Buffer.from(await r.arrayBuffer()));}
console.log('Saved '+manifest.assets.length+' original Figma assets.');
