import globeSpecies from './globe-species.json' with { type: 'json' };
export const SCENES = [
  { id: 'meadow', name: '风吹过的草地', subtitle: '让故事，在柔软的绿意里发生', image: '/assets/journey-meadow.png' },
  { id: 'mountain', name: '山间的一封来信', subtitle: '去想象一场，慢慢走的远行', image: '/assets/journey-mountain.png' },
  { id: 'city', name: '小城的午后', subtitle: '在转角，遇见一束温柔的光', image: '/assets/journey-city.png' }
];
// Editorial examples. Source read dates are NOT assessment dates. Publication requires
// a separate editor/reviewer workflow, an assessment date and distribution rights.
const examples = [
  { id: 'panda', name: '大熊猫', englishName: 'Giant panda', scientificName: 'Ailuropoda melanoleuca', region: '亚洲', category: 'VU', icon: '🐼', point: [103, 30], habitat: '中国西南部的山地森林', summary: '竹林深处的黑白身影，也连接着整片森林的生命。', threats: '栖息地破碎化会阻碍不同种群之间的联系。', sourceUrl: 'https://www.worldwildlife.org/species/giant-panda/' },
  { id: 'tiger', name: '虎', englishName: 'Tiger', scientificName: 'Panthera tigris', region: '亚洲', category: 'EN', icon: '🐯', point: [90, 24], habitat: '亚洲的森林与草地', summary: '认识这种大型猫科动物，了解连通栖息地的意义。', threats: '栖息地丧失与非法野生动物贸易带来压力。', sourceUrl: 'https://www.worldwildlife.org/species/tiger/' },
  { id: 'forest-elephant', name: '非洲森林象', englishName: 'African forest elephant', scientificName: 'Loxodonta cyclotis', region: '非洲', category: 'CR', icon: '🐘', point: [15, 0], habitat: '非洲中部和西部的热带森林', summary: '森林中的漫步者，也是种子传播的重要参与者。', threats: '偷猎和栖息地丧失威胁着森林象。', sourceUrl: 'https://www.worldwildlife.org/species/elephant/african-elephant/african-forest-elephant/' }
];
export function seed(store, demo) {
  if (!demo) return;
  for (const x of examples) if (!store.get(`species-${x.id}`)) store.create('species', {
    ...x, scope: '全球', assessmentSystem: 'WWF 物种页面摘要（待核对正式评估）', assessedAt: null,
    sourcePublisher: 'WWF', sourceVersion: '网页核对 2026-09-16', sourceLicense: '', reviewedAt: null,
    sourceReadAt: '2026-09-16', datasetId: 'anikind-editorial-examples-v1', isDemo: true,
    mapNote: '地区示意中心，非实际分布范围或观测坐标', population: null, actionUrl: x.sourceUrl,
    actionOrganization: 'WWF', actionPurpose: '阅读物种保护资料', actionVerifiedAt: '2026-09-16'
  }, { id: `species-${x.id}`, status: 'demo' });
  for(const s of globeSpecies){
    const id=s.id===5?'species-tiger':s.id===10?'species-forest-elephant':`species-globe-${s.id}`;
    const old=store.get(id);
    // Seed migration is idempotent and never overwrites editorial changes.
    if(old&&(!old.isDemo||old.status!=='demo'||old.editorId||old.datasetId==='anikind-figma-wildlife-v1'))continue;
    const data={name:s.name,scientificName:s.scientific,region:s.region,category:s.status,point:[s.lon,s.lat],habitat:s.ecosystem,threats:s.threat,summary:`${s.name}生活在${s.ecosystem}。了解它们的栖息地，也了解这个共同的世界。`,scope:'全球',icon:'',iconAsset:s.design?.icon||null,design:s.design,sourceRecordId:s.id,sourcePublisher:'此前全球濒危动物数据图谱',sourceVersion:'本地保存版本 · 2026-08-18',sourceUrl:'https://www.iucnredlist.org/',sourceLicense:'原型资料，正式发布前核验',sourceReadAt:null,assessedAt:null,assessmentSystem:'原物种表中的 IUCN 分类（待逐条复核）',reviewedAt:null,isDemo:true,datasetId:'anikind-figma-wildlife-v1',mapNote:'经纬度为原资料中的代表地区中心；图标排布来自 Figma，非完整分布范围。',population:null,actionUrl:null};
    if(old)store.update(id,data,old.version);else store.create('species',data,{id,status:'demo'});
  }
}
