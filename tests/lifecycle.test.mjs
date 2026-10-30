import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../server/app.mjs';
import { generation } from '../server/generation.mjs';
import { openStore } from '../server/core.mjs';
import { sniff } from '../server/media.mjs';

test('production refuses simulation and unknown modes before opening a database',()=>{
  assert.throws(()=>createApp({production:true,demo:true,aiMode:'disabled'}),/Production/);
  assert.throws(()=>createApp({production:true,demo:false,aiMode:'demo'}),/Production/);
  assert.throws(()=>createApp({production:true,demo:false,aiMode:'typo'}),/AI_MODE/);
});
test('SQLite preserves records, versions and deletion tombstones across restarts',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'anikind-persistence-'));
  try{
    let store=openStore(dir);const p=store.create('pet',{name:'持久化测试',species:'dog'},{owner:'owner'});store.update(p.id,{name:'版本二'},1);
    const removed=store.create('memory',{title:'已删除的测试记录'},{owner:'owner',pet:p.id});store.remove(removed.id);
    const tombstone=store.create('deletion',{scope:'memory',objectCount:1},{owner:'owner',status:'completed'});store.db.close();
    store=openStore(dir);assert.equal(store.get(p.id).name,'版本二');assert.equal(store.get(p.id).version,2);assert.equal(store.get(removed.id),null);assert.equal(store.get(tombstone.id).status,'completed');store.db.close();
  }finally{await rm(dir,{recursive:true,force:true});}
});
test('in-flight jobs fail safely and release quota after process restart',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'anikind-recovery-'));
  try{
    const store=openStore(dir);const job=store.create('job',{refunded:false,assetIds:[],isDemo:true},{owner:'owner',pet:'pet',status:'generating'});
    const service=generation(store,{aiMode:'demo',dailyLimit:5,platformLimit:100,tickMs:1000});assert.equal(store.get(job.id).status,'failed');assert.equal(store.get(job.id).refunded,true);assert.equal(service.quota('owner').used,0);service.stop();store.db.close();
  }finally{await rm(dir,{recursive:true,force:true});}
});
test('arbitrary HTML and misleading filenames cannot become executable media',()=>{
  assert.equal(sniff(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>')),null);
  assert.equal(sniff(Buffer.from('<html><body>fake png</body></html>')),null);
});
