// Isla (v4.1): animales (crianza, carne, monturas, huevos/leche) y cocina/alquimia con tu cosecha.
// Datos del juego (ao-bin-dumps) en assets/data/game-extra.json: tiempos de crecimiento, nutrición,
// probabilidad de cría, usos del animal adulto y recetas de cocina y alquimia.
import {salePrice} from './farm.js';
export const ANIMALS_PER_PLOT=9;
const num=x=>Number.isFinite(Number(x))?Number(x):0;
const FARM_PRODUCT=/^T\d_(CARROT|BEAN|WHEAT|TURNIP|CABBAGE|POTATO|CORN|PUMPKIN|AGARIC|COMFREY|BURDOCK|TEASEL|FOXGLOVE|MULLEIN|YARROW|MEAT|EGG|MILK)$/;
export const isFarmProduct=id=>FARM_PRODUCT.test(String(id));

export function cheapestAsk(quotes,id,cities,now,maxAgeHours){let best=null;
 for(const city of cities){const a=quotes?.get?.(id+'|'+city)?.ask;if(!a?.price||now-a.time>maxAgeHours*3600e3)continue;if(!best||a.price<best.price)best={price:a.price,city};}
 return best;}
/** Comida más barata por punto de nutrición (el favorito del animal rinde ×(1+bono)). */
export function cheapestFood({nutrition={},quotes,category,favorite,favoriteBonus=0,cities,now=Date.now(),maxAgeHours=48}){
 let best=null;
 for(const [id,f] of Object.entries(nutrition)){if(f.cat!==category)continue;const q=cheapestAsk(quotes,id,cities,now,maxAgeHours);if(!q)continue;
  const per=num(f.n)*(id===favorite?1+num(favoriteBonus):1);if(!per)continue;const ppn=q.price/per;
  if(!best||ppn<best.pricePerNutrition)best={id,price:q.price,city:q.city,nutritionPerItem:per,pricePerNutrition:ppn};}
 return best;}

/**
 * Beneficio por parcela de pasto (9 animales) y por día.
 * Premium: crecen al doble de velocidad (+100 %). La comida total se mantiene (estimación prudente).
 * Con Focus: la cría vuelve con probabilidad + bono del juego (tope 100 %), estimación.
 */
export function animalRows({animals=[],nutrition={},quotes,config={},now=Date.now()}){
 const c={premium:true,focus:true,plots:1,sellCity:'Lymhurst',sellMode:'order',buyCities:['Bridgewatch','Fort Sterling','Lymhurst','Martlock','Thetford','Caerleon','Brecilien'],tax:4,listingFee:2.5,maxAgeHours:48,...config};
 const sp=id=>salePrice(quotes,id,{city:c.sellCity,mode:c.sellMode,tax:c.tax,listingFee:c.listingFee,now,maxAgeHours:c.maxAgeHours});
 const rows=[],skipped=[];
 for(const a of animals){
  if(!['plants','meat'].includes(a.foodCategory)){continue;}
  const baby=cheapestAsk(quotes,a.baby,c.buyCities,now,c.maxAgeHours);
  if(!baby){skipped.push({id:a.baby,reason:'Sin precio reciente de la cría'});continue;}
  const food=cheapestFood({nutrition,quotes,category:a.foodCategory,favorite:a.favorite,favoriteBonus:a.favoriteBonus,cities:c.buyCities,now,maxAgeHours:c.maxAgeHours});
  if(!food){skipped.push({id:a.baby,reason:'Sin precio de comida'});continue;}
  const nutritionNeeded=a.secondsPerNutrition?a.growHours*3600/a.secondsPerNutrition:0,foodCost=nutritionNeeded*food.pricePerNutrition;
  const back=c.focus?Math.min(1,num(a.offspringChance)+num(a.focusBonus)):num(a.offspringChance);
  const babyCost=baby.price*(1-back);
  const options=[];
  const g=sp(a.grown);if(g)options.push({kind:'grown',id:a.grown,label:'Vender adulto',value:g.net,price:g.price});
  for(const u of a.uses||[]){const s=sp(u.id);if(!s)continue;let mats=0,ok=true;
   for(const m of u.mats||[]){const q=cheapestAsk(quotes,m.id,c.buyCities,now,c.maxAgeHours);if(!q){ok=false;break;}mats+=q.price*m.count;}
   if(!ok)continue;options.push({kind:u.kind,id:u.id,label:u.kind==='meat'?`Carnicero: ${u.amount} carne`:'Ensillar montura',value:u.amount*s.net-mats,price:s.price,amount:u.amount,mats});}
  if(!options.length){skipped.push({id:a.grown,reason:`Sin precio de venta en ${c.sellCity}`});continue;}
  options.sort((x,y)=>y.value-x.value);const best=options[0];
  const perAnimal=best.value-babyCost-foodCost,days=a.growHours/24/(c.premium?2:1);
  let product=null;
  if(a.product){const s=sp(a.product.id);if(s){const adultFood=a.adultSecondsPerNutrition?a.product.hours*3600/a.adultSecondsPerNutrition*food.pricePerNutrition:0;
   const perDay=(a.product.amount*a.product.chance*s.net-adultFood)*(24/a.product.hours);product={id:a.product.id,amount:a.product.amount,price:s.price,perAdultDay:perDay};}}
  rows.push({...a,babyPrice:baby.price,babyCity:baby.city,food,nutritionNeeded,foodCost,back,babyCost,best,options,perAnimal,days,
   perPlot:perAnimal*ANIMALS_PER_PLOT*c.plots,perPlotDay:perAnimal*ANIMALS_PER_PLOT*c.plots/Math.max(days,1/24),
   focusUsed:c.focus?num(a.focusCost)*num(a.focusCycles||1)*ANIMALS_PER_PLOT*c.plots:0,startCost:ANIMALS_PER_PLOT*c.plots*(baby.price+foodCost),product});
 }
 rows.sort((x,y)=>y.perPlotDay-x.perPlotDay);
 return {rows,skipped,config:c};
}

/**
 * Cocina y alquimia: beneficio por craft y cuánto vale tu cosecha usada aquí frente a venderla cruda.
 * `returnPct` = retorno de recursos (15,2 % sin bono, 43,5 % con Focus…). Los ingredientes raros no vuelven.
 */
export function kitchenRows({kitchen=[],quotes,config={},now=Date.now()}){
 const c={sellCity:'Lymhurst',sellMode:'order',buyCities:['Bridgewatch','Fort Sterling','Lymhurst','Martlock','Thetford','Caerleon','Brecilien'],tax:4,listingFee:2.5,returnPct:15.2,maxAgeHours:48,kinds:['food','potion'],...config};
 const rr=c.returnPct/100,rows=[],skipped=[];
 for(const k of kitchen){if(!c.kinds.includes(k.kind))continue;
  const s=salePrice(quotes,k.id,{city:c.sellCity,mode:c.sellMode,tax:c.tax,listingFee:c.listingFee,now,maxAgeHours:c.maxAgeHours});
  if(!s){skipped.push({id:k.id,reason:`Sin precio en ${c.sellCity}`});continue;}
  let cost=0,farmCost=0,farmRaw=0,ok=true;const mats=[];
  for(const m of k.mats){const q=cheapestAsk(quotes,m.id,c.buyCities,now,c.maxAgeHours);if(!q){ok=false;skipped.push({id:k.id,reason:'Falta precio de '+m.id});break;}
   const rare=/_ALCHEMY_RARE_|_FISHSAUCE|_ALCHEMY_EXTRACT/.test(m.id),eff=m.count*(rare?1:1-rr),line=eff*q.price;cost+=line;
   if(isFarmProduct(m.id)){farmCost+=line;const raw=salePrice(quotes,m.id,{city:c.sellCity,mode:c.sellMode,tax:c.tax,listingFee:c.listingFee,now,maxAgeHours:c.maxAgeHours});farmRaw+=eff*(raw?raw.net:q.price);}
   mats.push({...m,price:q.price,city:q.city,farm:isFarmProduct(m.id)});}
  if(!ok)continue;
  const revenue=k.amount*s.net,profit=revenue-cost-num(k.silver);
  // Valor de tu cosecha aquí: lo que queda tras pagar lo demás, frente a venderla cruda.
  const harvestValue=revenue-(cost-farmCost)-num(k.silver);
  rows.push({...k,price:s.price,revenue,cost,profit,margin:cost?profit/cost:0,mats,farmCost,farmRaw,harvestValue,upliftPct:farmRaw?100*(harvestValue-farmRaw)/farmRaw:null});
 }
 rows.sort((a,b)=>b.profit-a.profit);
 return {rows,skipped,config:c};
}
