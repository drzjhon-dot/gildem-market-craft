// All Albion icons use the same origin and one shared size bucket so browsers
// can reuse downloads. No whitelist of preferred item IDs is needed.
import {LOCALLY_CACHED_ICONS} from './icon-manifest.js';
export const FALLBACK_ICON='./icons/item-fallback.svg';
export const imageProviders=['Netlify CDN (caché global)','Albion Render oficial'];
export function validIconId(id){return /^T[1-9]_[A-Z0-9_]+(?:@[1-4])?$/.test(String(id||''));}
export function iconBucket(size=84){const x=Number(size)||84;return x>128?192:96;}
export function iconSources(id,size=84,{localIcons=LOCALLY_CACHED_ICONS}={}){
 if(!validIconId(id))return [FALLBACK_ICON];
 const px=iconBucket(size),encoded=encodeURIComponent(id);
 const out=[];
 if(localIcons.has(id))out.push('./item-icons/'+encoded+'.png');
 out.push('./.netlify/functions/item-image?id='+encoded+'&size='+px);
 out.push('https://render.albiononline.com/v1/item/'+encoded+'.png?size='+px+'&quality=1');
 out.push(FALLBACK_ICON);
 return out;
}
export function nextIconSource(id,size,step,options={}){
 const sources=iconSources(id,size,options);
 const next=Math.max(0,Math.floor(Number(step)||0)+1);
 return {src:sources[Math.min(next,sources.length-1)],step:next,final:next>=sources.length-1};
}
