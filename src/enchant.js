// Encantar para vender (v4.0) · lógica sin interfaz.
// Cantidades EXACTAS de runas/almas/reliquias del juego (ao-bin-dumps, assets/data/game-extra.json):
// .0→.1 runas · .1→.2 almas · .2→.3 reliquias, todas en el mismo tier del objeto.
export const ENCHANT_RES=['RUNE','SOUL','RELIC'];
export const ENCHANT_ES={RUNE:'runas',SOUL:'almas',RELIC:'reliquias'};
const num=x=>Number.isFinite(Number(x))?Number(x):0;
export const baseOf=id=>String(id).replace(/@\d$/,'');
export const levelOf=id=>{const m=String(id).match(/@(\d)$/);return m?Number(m[1]):0;};
export const tierOf=id=>{const m=String(id).match(/^T(\d)_/);return m?Number(m[1]):null;};
export const atLevel=(base,l)=>l>0?`${base}@${l}`:base;

/** Cantidad para pasar de nivel l-1 a l (l = 1..3). `counts` = game-extra.enchant. */
export function stepCount(counts,base,level){const c=counts?.[base];if(c==null)return 0;return Array.isArray(c)?num(c[level-1]):num(c);}
export function enchantSteps(counts,base,from,to){const t=tierOf(base),steps=[];
 for(let l=from+1;l<=to;l++){const count=stepCount(counts,base,l);if(!count)return null;steps.push({level:l,id:`T${t}_${ENCHANT_RES[l-1]}`,count});}
 return steps;}

function cheapestAsk(quotes,id,cities,now,maxAgeHours){let best=null;
 for(const city of cities){const a=quotes?.get?.(id+'|'+city)?.ask;if(!a?.price||now-a.time>maxAgeHours*3600e3)continue;if(!best||a.price<best.price)best={price:a.price,city,time:a.time};}
 return best;}

/**
 * Oportunidades: comprar el objeto en un nivel bajo, encantarlo y venderlo al Mercado Negro
 * (orden de compra, venta instantánea → solo impuesto). Se elige el nivel de partida más barato.
 */
export function enchantOpportunities({bases=[],counts={},quotes,demand=new Map(),config={},now=Date.now()}){
 const c={tax:4,maxAgeHours:24,buyCities:['Caerleon','Bridgewatch','Fort Sterling','Lymhurst','Martlock','Thetford'],saleDays:3,sharePct:6,minMarginPct:10,...config};
 const rows=[],skipped=[];
 for(const base of bases){if(!counts[base])continue;
  for(let target=1;target<=3;target++){const tid=atLevel(base,target);
   const bid=quotes?.get?.(tid+'|Black Market')?.bid;
   if(!bid?.price||now-bid.time>c.maxAgeHours*3600e3){skipped.push({id:tid,reason:'Sin puja reciente del Mercado Negro'});continue;}
   const net=bid.price*(1-c.tax/100);let best=null;
   for(let from=0;from<target;from++){const item=cheapestAsk(quotes,atLevel(base,from),c.buyCities,now,c.maxAgeHours);if(!item)continue;
    const steps=enchantSteps(counts,base,from,target);if(!steps)continue;let ok=true,matCost=0;const mats=[];
    for(const s of steps){const q=cheapestAsk(quotes,s.id,c.buyCities,now,c.maxAgeHours);if(!q){ok=false;break;}matCost+=q.price*s.count;mats.push({...s,price:q.price,city:q.city});}
    if(!ok)continue;const cost=item.price+matCost;
    if(!best||cost<best.cost)best={from,fromId:atLevel(base,from),buyCity:item.city,buyPrice:item.price,mats,matCost,cost};}
   if(!best){skipped.push({id:tid,reason:'Faltan precios de compra del objeto o de los materiales'});continue;}
   const profit=net-best.cost,margin=profit/best.cost,daily=num(demand.get?.(tid));
   const units=Math.floor(daily*c.saleDays*c.sharePct/100);
   if(margin*100<c.minMarginPct){skipped.push({id:tid,reason:`Margen ${Math.round(margin*100)} %`});continue;}
   rows.push({id:tid,base,target,...best,sell:bid.price,sellAgeH:(now-bid.time)/3600e3,net,profit,margin,daily,units,totalProfit:units*profit,capital:units*best.cost});}
 }
 rows.sort((a,b)=>(b.totalProfit||0)-(a.totalProfit||0)||b.margin-a.margin);
 return {rows,skipped};
}
/** Lista de IDs a consultar para un grupo de bases (objetos .0–.3 y materiales). */
export function enchantQueryIds(bases,counts){
 const items=new Set(),mats=new Set();
 for(const b of bases){if(!counts[b])continue;const t=tierOf(b);for(let l=0;l<=3;l++)items.add(atLevel(b,l));for(const r of ENCHANT_RES)mats.add(`T${t}_${r}`);}
 return {items:[...items],mats:[...mats]};
}
