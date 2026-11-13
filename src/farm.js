// Granja (v4.0) · cultivos y hierbas de la isla. Datos del juego (ao-bin-dumps) en assets/data/game-extra.json:
// cosecha 3–6 por semilla (media 4,5; Premium +100 %), retorno de semilla sin Focus, ciclo de 22 h.
export const SEEDS_PER_PLOT=9;
const num=x=>Number.isFinite(Number(x))?Number(x):0;
function cheapestAsk(quotes,id,cities,now,maxAgeHours){let best=null;
 for(const city of cities){const a=quotes?.get?.(id+'|'+city)?.ask;if(!a?.price||now-a.time>maxAgeHours*3600e3)continue;if(!best||a.price<best.price)best={price:a.price,city};}
 return best;}
export function salePrice(quotes,id,{city,mode='order',tax=4,listingFee=2.5,now=Date.now(),maxAgeHours=24}){
 const q=quotes?.get?.(id+'|'+city);const side=mode==='instant'?q?.bid:q?.ask;
 if(!side?.price||now-side.time>maxAgeHours*3600e3)return null;
 return {price:side.price,net:side.price*(1-tax/100-(mode==='order'?listingFee/100:0))};
}
/**
 * Beneficio por parcela (9 semillas) y cosecha, con y sin Focus.
 * Sin Focus: se recupera la semilla con su probabilidad del juego; con Focus: `focusSeedReturn` (100 % por defecto).
 */
export function farmRows({farm=[],quotes,config={},now=Date.now()}){
 const c={premium:true,plots:1,sellCity:'Lymhurst',sellMode:'order',buyCities:['Bridgewatch','Fort Sterling','Lymhurst','Martlock','Thetford','Caerleon','Brecilien'],tax:4,listingFee:2.5,focusSeedReturn:1,maxAgeHours:48,kinds:['farm','herbgarden'],...config};
 const rows=[],skipped=[];
 for(const f of farm){if(!c.kinds.includes(f.kind))continue;
  const seed=cheapestAsk(quotes,f.seed,c.buyCities,now,c.maxAgeHours);
  const sale=salePrice(quotes,f.crop,{city:c.sellCity,mode:c.sellMode,tax:c.tax,listingFee:c.listingFee,now,maxAgeHours:c.maxAgeHours});
  if(!seed||!sale){skipped.push({id:f.crop,reason:!seed?'Sin precio reciente de la semilla':`Sin precio reciente en ${c.sellCity}`});continue;}
  const perSeed=(num(f.yieldMin)+num(f.yieldMax))/2*(c.premium?2:1);
  const harvest=SEEDS_PER_PLOT*perSeed,revenue=harvest*sale.net;
  const cost=back=>SEEDS_PER_PLOT*(1-Math.min(1,back))*seed.price;
  const profitNoFocus=revenue-cost(num(f.seedChance)),profitFocus=revenue-cost(num(c.focusSeedReturn));
  const focusUsed=SEEDS_PER_PLOT*num(f.focusCost||1000);
  rows.push({...f,seedPrice:seed.price,seedCity:seed.city,cropPrice:sale.price,cropNet:sale.net,perSeed,harvest,revenue,
   profitNoFocus:profitNoFocus*c.plots,profitFocus:profitFocus*c.plots,focusUsed:focusUsed*c.plots,
   silverPerFocus:focusUsed?(profitFocus-profitNoFocus)/focusUsed:0,startCost:SEEDS_PER_PLOT*seed.price*c.plots,seedReturn:num(f.seedChance)});
 }
 rows.sort((a,b)=>b.profitFocus-a.profitFocus);
 return {rows,skipped,config:c};
}
