import {t,language,localizeResponse} from './i18n.js';
export class ApiError extends Error { constructor(message,code,status,fields){super(t(message));Object.assign(this,{code,status,fields});} }
export async function api(path,{method='GET',data,key,...options}={}){
  let response;
  try{response=await fetch(`/api${path}`,{method,credentials:'same-origin',cache:'no-store',headers:{'X-AniKind':'1',...(data===undefined?{}:{'Content-Type':'application/json'}),...(key?{'Idempotency-Key':key}:{})},...(data===undefined?{}:{body:JSON.stringify(data)}),...options});}
  catch{throw new ApiError('网络中断，输入已保留，请检查网络后重试','NETWORK_ERROR',0);}
  const result=await response.json();if(!response.ok)throw new ApiError(result.error?.message||'操作未完成，请重试',result.error?.code,response.status,result.error?.fields);return localizeResponse(path,result);
}
export function upload(file,petId,onProgress){
  return new Promise((resolve,reject)=>{
    const xhr=new XMLHttpRequest();xhr.open('POST',`/api/assets?petId=${encodeURIComponent(petId)}&name=${encodeURIComponent(file.name)}`);xhr.setRequestHeader('X-AniKind','1');
    xhr.upload.onprogress=e=>{if(e.lengthComputable)onProgress(Math.round(e.loaded/e.total*100));};
    xhr.onload=()=>{let data;try{data=JSON.parse(xhr.responseText);}catch{return reject(new Error('上传响应异常，请重试'));}if(xhr.status>=200&&xhr.status<300)resolve(data);else reject(new ApiError(data.error?.message||'上传失败',data.error?.code,xhr.status));};
    xhr.onerror=()=>reject(new ApiError('网络中断，请重试此文件','NETWORK_ERROR',0));xhr.send(file);
  });
}
export const assetURL=id=>id?`/api/assets/${encodeURIComponent(id)}/content`:'';
export const escapeHTML=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const E=escapeHTML;
export const dateLabel=value=>value?new Intl.DateTimeFormat(language==='en'?'en-US':'zh-CN',{year:'numeric',month:language==='en'?'short':'long',day:'numeric',timeZone:'UTC'}).format(new Date(value.slice(0,10)+'T00:00:00Z')):t('日期待补充');
export const query=data=>new URLSearchParams(Object.entries(data).filter(([,v])=>v!==''&&v!==undefined&&v!==null)).toString();
