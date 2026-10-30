import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
let failed=false;
function check(dir){for(const f of readdirSync(dir,{withFileTypes:true})){const p=resolve(dir,f.name);if(f.isDirectory())check(p);else if(/\.(m?js)$/.test(p)){const r=spawnSync(process.execPath,['--check',p],{encoding:'utf8',windowsHide:true});if(r.status!==0){console.error(p,r.stderr||r.error?.message);failed=true;}}}}
for(const dir of ['server','public/js','scripts','tests'])check(resolve(dir));
console.log(failed?'Syntax check failed':'All JavaScript syntax checks passed');process.exitCode=failed?1:0;
