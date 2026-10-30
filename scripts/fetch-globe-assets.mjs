import { mkdir, writeFile, readFile, access } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
const files = [
  ['public/vendor/d3-array.min.js','https://cdn.jsdelivr.net/npm/d3-array@3.2.4/dist/d3-array.min.js'],
  ['public/vendor/d3-geo.min.js','https://cdn.jsdelivr.net/npm/d3-geo@3.1.1/dist/d3-geo.min.js'],
  ['public/vendor/d3-array.LICENSE','https://cdn.jsdelivr.net/npm/d3-array@3.2.4/LICENSE'],
  ['public/vendor/d3-geo.LICENSE','https://cdn.jsdelivr.net/npm/d3-geo@3.1.1/LICENSE'],
  ['public/assets/world-land-50m.geojson','https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/ne_50m_land.geojson'],
  ['public/assets/globe/red-panda.png','https://www.figma.com/api/mcp/asset/a4b6a06d-0273-40e6-afb6-3bce6d300a7b/1962a.png'],
  ['public/assets/globe/red-panda-ring.svg','https://www.figma.com/api/mcp/asset/a4b6a06d-0273-40e6-afb6-3bce6d300a7b/7ffd7.svg']
];
const manifest=JSON.parse(await readFile('docs/figma-globe-assets.json','utf8'));
files.push(...manifest.flatMap(n=>n.assets.map(a=>['public'+a.path,a.url])));
for (const [path,url] of files) {
  try { await access(path); continue; } catch {}
  const response=await fetch(url,{signal:AbortSignal.timeout(60000)});
  if(!response.ok)throw new Error(`${path}: HTTP ${response.status}`);
  const bytes=Buffer.from(await response.arrayBuffer());
  await mkdir(dirname(resolve(path)),{recursive:true});
  await writeFile(resolve(path),bytes);
  console.log(`${path}: ${bytes.length} bytes`);
}
