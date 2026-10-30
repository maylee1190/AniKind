import {randomBytes,randomInt,createHash} from 'node:crypto';
import {assert,fail,now} from './core.mjs';
import photographs from './wildlife-photos.json' with {type:'json'};

const photographFor=s=>photographs.find(p=>p.recordId===s.sourceRecordId&&p.scientificName===s.scientificName);

export function shuffledBoard(size){
  const board=Array.from({length:size},(_,i)=>i);
  for(let i=size-1;i>0;i--){const j=randomInt(i+1);[board[i],board[j]]=[board[j],board[i]];}
  if(board.every((piece,i)=>piece===i))[board[0],board[1]]=[board[1],board[0]];
  return board;
}
export const solved=board=>board.every((piece,i)=>piece===i);
function speciesChallenge(s){const photo=photographFor(s);return {id:s.id,name:s.name,scientificName:s.scientificName,subtitle:'拼合真实照片，解锁物种知识卡',kind:'wildlife',category:s.category,rows:3,cols:3,image:photo.path,cover:photo.path,photo,imageNote:s.sourceRecordId===1?'爪哇犀历史实拍照片 · 1884 年伦敦动物园':s.sourceRecordId===31?'北方毛鼻袋熊红外监测实拍 · 昆士兰政府':s.name+' · 真实动物照片',cards:[
  {title:s.name,subtitle:s.scientificName,section:'认识它',body:s.summary||`${s.name}是收录在这份物种名录中的生命。`,fact:`代表地区：${s.region}。保护等级：${s.category}。`,sourceTitle:s.sourcePublisher,sourceUrl:s.sourceUrl},
  {title:'它的家园',subtitle:s.name,section:'栖息地',body:s.habitat||'暂无足够的栖息地资料。',fact:'地球标记显示代表地区中心，并不是物种完整的分布范围。',sourceTitle:s.sourcePublisher,sourceUrl:s.sourceUrl},
  {title:'一起了解保护',subtitle:s.name,section:'它们面临什么',body:s.threats||'暂无足够的威胁因素资料。',fact:'从了解物种和栖息地开始，让保护建立在可靠资料之上。',sourceTitle:s.sourcePublisher,sourceUrl:s.sourceUrl}
],isDemo:!!s.isDemo};}
export function puzzleService(store,auth,config,publicSpecies){
  const digest=value=>createHash('sha256').update(value).digest('hex');
  function owner(req,res,create=false){
    const user=auth.current(req);if(user)return {id:user.id,scope:'account'};
    let token=(req.headers.cookie||'').match(/(?:^|;\s*)anikind_puzzle=([a-f0-9]{64})(?:;|$)/)?.[1];
    if(!token&&create){token=randomBytes(32).toString('hex');res.setHeader('Set-Cookie',`anikind_puzzle=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=31536000${config.production?'; Secure':''}`);}
    return {id:token?'puzzle-guest:'+digest(token):null,scope:'browser'};
  }
  function challenges(){return publicSpecies().filter(s=>s.datasetId==='anikind-figma-wildlife-v1'&&s.point&&s.design&&s.iconAsset&&!s.design.emptyInFigma&&photographFor(s)).sort((a,b)=>a.sourceRecordId-b.sourceRecordId).map(speciesChallenge);}
  function challenge(id){const c=challenges().find(c=>c.id===id);if(!c)fail(404,'PUZZLE_NOT_FOUND','这个拼图暂时不可用');return c;}
  const recordId=(ownerId,id)=>'puzzle-'+digest(ownerId+'|'+id);
  const publicChallenge=({cards,...c})=>c;
  function payload(c,r,scope){return {challenge:publicChallenge(c),progress:r?{board:r.board,moves:r.moves,hints:r.hints,version:r.version,correct:r.board.filter((p,i)=>p===i).length,completed:solved(r.board),unlockedAt:r.unlockedAt,updatedAt:r.updatedAt}:null,cards:r?.unlockedAt?c.cards:[],scope};}
  return {
    list(req,res){const o=owner(req,res);return {items:challenges().map(c=>{const r=o.id?store.get(recordId(o.id,c.id)):null;return {...publicChallenge(c),correct:r?.board.filter((p,i)=>p===i).length||0,unlocked:!!r?.unlockedAt};}),scope:o.scope};},
    get(req,res,id){const c=challenge(id),o=owner(req,res);return payload(c,o.id?store.get(recordId(o.id,id)):null,o.scope);},
    update(req,res,id,data){
      const c=challenge(id);assert(['start','swap','hint','restart'].includes(data.action),'无效的拼图操作');
      const o=owner(req,res,true),key=recordId(o.id,id);
      return store.tx(()=>{
        let r=store.get(key);
        if(data.action==='start'){
          if(!r)r=store.create('puzzle',{challengeId:id,board:shuffledBoard(c.rows*c.cols),moves:0,hints:0,unlockedAt:null},{id:key,owner:o.id,status:'playing'});
          return payload(c,r,o.scope);
        }
        if(!r)fail(409,'PUZZLE_NOT_STARTED','请先开始拼图');
        assert(Number.isInteger(data.version),'缺少进度版本');
        if(data.version!==r.version)fail(409,'VERSION_CONFLICT','拼图进度已更新，已为你重新载入');
        if(data.action==='restart')return payload(c,store.update(key,{board:shuffledBoard(c.rows*c.cols),moves:0,hints:0},r.version,'playing'),o.scope);
        if(solved(r.board))return payload(c,r,o.scope);
        const board=[...r.board];let a=data.from,b=data.to;
        if(data.action==='hint'){a=board.findIndex((p,i)=>p!==i);b=board.indexOf(a);}
        assert(Number.isInteger(a)&&Number.isInteger(b)&&a>=0&&b>=0&&a<board.length&&b<board.length&&a!==b,'请选择两个不同的有效位置');
        [board[a],board[b]]=[board[b],board[a]];
        const completed=solved(board);
        r=store.update(key,{board,moves:r.moves+1,hints:r.hints+(data.action==='hint'?1:0),unlockedAt:r.unlockedAt||(completed?now():null)},r.version,completed?'completed':'playing');
        return payload(c,r,o.scope);
      });
    }
  };
}
