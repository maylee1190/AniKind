import {EN} from './locales/en.js';
import {CONTENT_EN} from './locales/species-en.js';

export function readLanguage(storage){const param=typeof location==='undefined'?null:new URLSearchParams(location.search).get('lang');if(['zh-CN','en'].includes(param))return param;try{return (storage??globalThis.localStorage)?.getItem('anikind:language')==='en'?'en':'zh-CN';}catch{return 'zh-CN';}}
export const language=typeof window==='undefined'?'zh-CN':readLanguage();
export function saveLanguage(value,storage){if(!['zh-CN','en'].includes(value))return false;try{(storage??globalThis.localStorage)?.setItem('anikind:language',value);}catch{}return true;}
const normalize=value=>value.replace(/\{\d+\}/g,(_,offset)=>'{'+(value.slice(0,offset).match(/\{\d+\}/g)||[]).length+'}');
const messages=new Map(Object.entries({...CONTENT_EN,...EN}).map(([key,value])=>[normalize(key),value]));
function phrase(text,locale){
  if(locale!=='en')return text;
  const key=text.trim(),translation=messages.get(normalize(key));
  if(translation===undefined)return text;
  const slots=key.match(/\{\d+\}/g)||[];
  return text.slice(0,text.indexOf(key))+translation.replace(/\{(\d+)\}/g,(m,n)=>slots[n]??m)+text.slice(text.indexOf(key)+key.length);
}
export function translate(text,locale=language){
  if(typeof text!=='string'||locale!=='en')return text;
  if(!/<[a-z/!]/i.test(text))return phrase(text,locale);
  return text.split(/(<[^>]*>)/g).map(part=>part.startsWith('<')?part.replace(/((?:aria-label|placeholder|title|alt)=")([^"]*)(")/g,(_,before,label,after)=>before+phrase(label,locale)+after):phrase(part,locale)).join('');
}
export const t=translate;
// Translate only template-authored text. Interpolated names, form values and user
// memories are inserted afterwards and are never searched or machine-translated.
export function tr(strings,...values){const key=strings.map((s,i)=>s+(i<values.length?'{'+i+'}':'')).join('');return t(key).replace(/\{(\d+)\}/g,(_,index)=>String(values[index]??''));}
export function contentText(value,locale=language){
  if(locale!=='en'||typeof value!=='string')return value;
  if(CONTENT_EN[value]||EN[value])return CONTENT_EN[value]||EN[value];
  const summary=value.match(/^(.+)生活在(.+)。了解它们的栖息地，也了解这个共同的世界。$/);
  if(summary)return `${contentText(summary[1],locale)} lives in ${contentText(summary[2],locale).toLowerCase()}. Learn about its habitat and the world we share.`;
  const fact=value.match(/^代表地区：(.+)。保护等级：(.+)。$/);
  if(fact)return `Representative region: ${contentText(fact[1],locale)}. Conservation category: ${fact[2]}.`;
  if(value.endsWith(' · 真实动物照片'))return contentText(value.slice(0,-' · 真实动物照片'.length),locale)+' · Wildlife photograph';
  return value;
}
export function localizeResponse(path,result,locale=language){
  if(locale!=='en')return result;
  const species=s=>{const translated={...s};for(const key of ['name','habitat','summary','threats','sourcePublisher','sourceVersion','sourceLicense','assessmentSystem','mapNote'])translated[key]=contentText(s[key],locale);translated.regionLabel=contentText(s.region,locale);return translated;};
  const challenge=c=>{if(!c)return c;return {...c,name:contentText(c.name,locale),subtitle:contentText(c.subtitle,locale),imageNote:contentText(c.imageNote,locale),photo:{...c.photo,changes:contentText(c.photo?.changes,locale)}};};
  if(/^\/species(?:\?|$)/.test(path))return {...result,items:result.items.map(species)};
  if(path.startsWith('/species/'))return species(result);
  if(path==='/puzzles')return {...result,items:result.items.map(challenge)};
  if(path.startsWith('/puzzles/'))return {...result,challenge:challenge(result.challenge),cards:result.cards.map(c=>Object.fromEntries(Object.entries(c).map(([k,v])=>[k,k==='sourceUrl'?v:contentText(v,locale)])))};
  if(path==='/config')return {...result,scenes:result.scenes.map(s=>({...s,name:contentText(s.name,locale),subtitle:contentText(s.subtitle,locale)}))};
  return result;
}
