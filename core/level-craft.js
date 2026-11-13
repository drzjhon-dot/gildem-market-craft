// Level Craft: progression and liquidity-aware crafting plan.
// All forecasts are estimates unless the player provides the exact fame still
// needed from the Destiny Board. No AODP order observation is an executed sale.
import {itemStem} from './item-selection.js';
import {routeProfitAtQuantity} from './depth.js';
import {prudentListingCapacity} from './market-volume.js';
import {itemTier,itemEnch} from './engine.js';
import {materialPurchaseCities} from './material-cities.js';
import {filterViableCraftRoutes} from './viability.js';

const BASE_PROGRESS=[[0,0],[10,14424],[30,169582],[60,750526],[90,2886914],[100,12879472]];
export const FAME_REFERENCE=''; // Sin consultas ni referencias a webs externas de mercado.
export const CRAFT_FAME_BY_MATERIAL_TIER={2:1.5,3:7.5,4:22.5,5:90,6:270,7:645,8:1395};
function clean(id){return String(id||'').split('@')[0];}
export function specFameTotal(id){
 const stem=itemStem(id),raw=clean(id);
 if(/^(MAIN_|2H_)/.test(stem)&&!stem.startsWith('2H_TOOL_'))return 25758944;
 if(/^ARMOR_(PLATE|CLOTH|LEATHER)/.test(stem))return 12879472;
 if(/^(HEAD|SHOES)_(PLATE|CLOTH|LEATHER)/.test(stem))return 6439736;
 if(/^OFF_/.test(stem))return 6439736;
 if(/^BAG|^CAPE/.test(stem))return 19319208;
 if(/^2H_TOOL_TRACKING/.test(stem))return 19319208;
 if(/^SIEGE_BANNER|^2H_TOOL_SIEGEHAMMER/.test(stem))return 38638416;
 if(/^2H_TOOL_/.test(stem))return 19319208;
 // For uncommon families (food, potions, mounts, gathering gear) do not
 // pretend a general crafting-spec total applies to the selected node.
 return null;
}
function interpolatedBase(level){
 const x=Math.max(0,Math.min(100,Number(level)||0));
 for(let i=1;i<BASE_PROGRESS.length;i++){
  const [high,hi]=BASE_PROGRESS[i],[low,lo]=BASE_PROGRESS[i-1];
  if(x<=high){const t=(x-low)/(high-low);
   // Monotonic smooth interpolation in cumulative fame, not exact destiny data.
   return lo+(hi-lo)*t*t*(3-2*t);
  }
 }
 return BASE_PROGRESS.at(-1)[1];
}
export function specFameGoal({itemId,spec=0,exactRemaining=null}={}){
 const level=Number(spec);
 if(!Number.isInteger(level)||level<0||level>100)throw Error('La spec debe estar entre 0 y 100.');
 const known=specFameTotal(itemId);
 if(level===100)return {required:0,total:known,estimate:false,source:'Meta completada',level};
 if(exactRemaining!==null&&exactRemaining!==''&&Number.isFinite(Number(exactRemaining))&&Number(exactRemaining)>0){
  return {required:Math.ceil(Number(exactRemaining)),total:known,estimate:false,source:'Fama restante introducida desde el juego',level};
 }
 if(!known)throw Error('Para esta especialización necesitamos la fama pendiente exacta de tu Destiny Board.');
 const fraction=interpolatedBase(level)/BASE_PROGRESS.at(-1)[1];
 return {required:Math.max(1,Math.ceil(known*(1-fraction))),total:known,estimate:level!==0,source:level===0?'Referencia total de especialización':'Curva de nivel interpolada: aproximación',level};
}
export function craftingFameFromRecipe(itemId,recipe,{premium=true,manualFame=null}={}){
 if(manualFame!==null&&manualFame!==''&&Number(manualFame)>0)return {value:Number(manualFame)*(premium?1.5:1),estimated:false,manual:true};
 if(!recipe?.materials?.length)return null;
 let value=0,nonRefined=[];
 for(const m of recipe.materials){
  const id=String(m.id||'');const tier=itemTier(id),ench=itemEnch(id)||Number(id.match(/_LEVEL([1-4])/)?.[1]||0);
  const refined=/^T[2-8]_(?:METALBAR|PLANKS|CLOTH|LEATHER|STONEBLOCK)(?:_LEVEL[1-4])?(?:@[1-4])?$/.test(id);
  if(!refined){nonRefined.push(id);continue;}
  const f=CRAFT_FAME_BY_MATERIAL_TIER[tier];if(!f)return null;
  value+=f*Math.pow(2,ench)*Number(m.count||0);
 }
 if(value<=0)return null;
 // Artefactos pueden incrementar la fama; sin factor verificado se
 // muestra una estimación base y se permite aportar la cifra real.
 return {value:value*(premium?1.5:1),estimated:nonRefined.length>0,nonRefined,manual:false};
}
export function eligibleToStudy(id,recipe){return !/^(?:T[2-8]_MOUNT_|T[2-8]_(?:METALBAR|CLOTH|PLANKS|LEATHER|STONEBLOCK))/.test(id)&&recipe?.kind!=='mount'&&recipe?.kind!=='refining';}
// Per-route exposure is a TOTAL for the projected plan, not a renewable
// allowance each "round". Orders observed today cannot justify 24 reloads.
function conservativeCapacity(route,capFraction=.10){
 const units=Math.max(1,Number(route.craftAmount)||1);
 if(route.city==='Black Market'||route.mode==='instant')return route.depthVerified&&Number.isFinite(route.marketCapacity)?Math.max(0,Math.floor(route.marketCapacity)):0;
 const activity=route.activity,days=Number(activity?.activeDays||Math.min(14,activity?.observations||0));
 if(!(days>=5&&Number(activity?.observedDaily)>=2))return 0;
 const base=prudentListingCapacity(route,capFraction)??0;
 // Independently recorded personal sales may support more than one round,
 // but a market-history endpoint alone does not demonstrate turnover.
 const multiplier=Number(route.personalLearning?.qtySold)>=3?2:1;
 return Math.max(0,Math.min(80,base*multiplier));
}
const number=x=>Number.isFinite(Number(x))?Number(x):0;
function bestRouteScore(route,fame,goal){
 const capital=Math.max(1,number(route.capitalPerUnit));
 const roi=number(route.profit)/capital;
 const stressed=Math.max(0,number(route.stressProfit))/capital;
 const famePerSilver=fame/capital;
 const trusted=Math.max(.5,Math.min(1,number(route.confidence?.score||70)/100));
 if(goal==='fast')return (roi*2+stressed+famePerSilver*8)*trusted;
 if(goal==='cheap')return (roi*5+stressed*2+famePerSilver*3)*trusted;
 return (roi*4+stressed*2+famePerSilver*5)*trusted;
}
export function planLevelCraft({routes=[],recipes={},goalFame=0,budget=0,premium=true,study=false,studyFee=0,manualCraftFame=null,goal='balanced',capFraction=.1,maxStages=24,focusBudget=0}={}){
 if(!(goalFame>=0&&Number.isFinite(goalFame))||!(budget>0))throw Error('Fama y presupuesto inválidos.');
 if(study&&(!Number.isFinite(Number(studyFee))||Number(studyFee)<0))throw Error('La tarifa de estudio debe ser válida.');
 const available=routes.map(route=>{
  const f=craftingFameFromRecipe(route.id,recipes[route.id],{premium,manualFame:manualCraftFame});
  return {...route,famePerCraft:f?.value||0,fameEstimated:!!f?.estimated,craftAmount:Math.max(1,number(route.craftAmount)||1)};
 }).filter(r=>r.famePerCraft>0&&r.capitalPerUnit>0);
 const saleRoutes=available.filter(r=>!r.studyOnly&&r.city&&r.sell>0);
 // IMPORTANT: never pass the 'allowLoss' switch to the level allocator. Loss
 // makers are categorically excluded from craft-for-sale, even for speed goals.
 const checks=filterViableCraftRoutes(saleRoutes,{budget,mode:'level',capFraction});
 const unique=new Map();for(const r of checks.accepted){const key=r.id+'|'+r.city+'|'+r.mode;
  const old=unique.get(key);if(!old||bestRouteScore(r,r.famePerCraft,goal)>bestRouteScore(old,old.famePerCraft,goal))unique.set(key,r);
 }
 const ranked=[...unique.values()].sort((a,b)=>bestRouteScore(b,b.famePerCraft,goal)-bestRouteScore(a,a.famePerCraft,goal));
 const studyRoutes=study&&studyFee>0?available.filter(r=>r.studyOnly&&eligibleToStudy(r.id,recipes[r.id])):[];
 const studyOptions=studyRoutes.map(r=>{
  const gross=r.materials.reduce((sum,m)=>sum+number(m.count)*number(m.upfrontUnitPrice||m.unitPrice),0);
  const net=r.materials.reduce((sum,m)=>sum+number(m.used)*number(m.unitPrice),0);
  const investment=gross+number(r.stationCost)+number(studyFee)*r.craftAmount;
  const netCost=net+number(r.stationCost)+number(studyFee)*r.craftAmount;
  const fame=r.famePerCraft*3.75; // study fame + crafting fame, approximate
  return {...r,studyInvestment:investment,studyNetCost:netCost,studyFame:fame};
 }).filter(r=>r.studyInvestment>0&&r.studyNetCost>0&&r.studyFame>0&&r.studyInvestment<=budget*.20)
  .sort((a,b)=>a.studyNetCost/a.studyFame-b.studyNetCost/b.studyFame);
 let remaining=goalFame,wallet=budget,earned=0,netProfit=0,peakCapital=0,studyCount=0,focusRemaining=Number(focusBudget)||0,focusUsed=0;
 const stages=[],availableSales=new Map(),usedSaleCrafts=new Map(),usedStudyInvestment={value:0},usedStudyLoss={value:0};
 for(const r of ranked)availableSales.set(r.id+'|'+r.city+'|'+r.mode,Math.min(conservativeCapacity(r,capFraction),
  Math.floor(budget*.22/r.capitalPerUnit)));
 // Plans cannot treat the same market depth as replenished after each round.
 for(let step=1;step<=Math.min(maxStages,8)&&remaining>0.01;step++){
  let cash=Math.max(0,wallet*.80),spent=0,net=0,fameEarned=0,stageCount=0;
  const entries=[],perItem=new Map();
  for(const r of ranked){
   if(remaining<=0.01)break;
   const key=r.id+'|'+r.city+'|'+r.mode,availableCount=availableSales.get(key)||0;
   const byMoney=Math.floor((cash+1e-8)/r.capitalPerUnit);
   const byFocus=r.focusPerUnit>0?Math.floor((focusRemaining+1e-8)/r.focusPerUnit):Infinity;
   const byItem=Math.floor(Math.max(0,budget*.22-(perItem.get(r.id)||0))/r.capitalPerUnit);
   let qty=Math.max(0,Math.min(availableCount,byMoney,byFocus,byItem,Math.ceil(remaining/r.famePerCraft),40));
   if(!qty)continue;
   const previous=usedSaleCrafts.get(key)||0;
   const incrementalProfit=amount=>{const cumulative=routeProfitAtQuantity(r,previous+amount);
    const prior=previous?routeProfitAtQuantity(r,previous):0;
    return cumulative===null||prior===null?null:cumulative-prior;};
   let profit=incrementalProfit(qty);
   // Never reuse the best bid in a later round: subtract levels already used.
   while(qty>0&&(profit===null||profit<=0||profit/(qty*r.capitalPerUnit)<.09)){
    qty--;profit=qty>0?incrementalProfit(qty):null;
   }
   if(!qty||profit===null)continue;
   const inv=qty*r.capitalPerUnit;
   entries.push({id:r.id,craftCity:r.craftCity,city:r.city,mode:r.mode,kind:'sell',qty,units:qty*r.craftAmount,
    profit,investment:inv,materials:r.materials,returnRate:r.returnRate,famePerCraft:r.famePerCraft,fame:qty*r.famePerCraft,
    ageHours:r.ageHours,depthVerified:!!r.depthVerified,activity:r.activity});
   cash-=inv;spent+=inv;net+=profit;focusUsed+=qty*(r.focusPerUnit||0);focusRemaining-=qty*(r.focusPerUnit||0);
   fameEarned+=qty*r.famePerCraft;remaining=Math.max(0,remaining-qty*r.famePerCraft);stageCount+=qty;
   perItem.set(r.id,(perItem.get(r.id)||0)+inv);availableSales.set(key,availableCount-qty);usedSaleCrafts.set(key,previous+qty);
  }
  // Explicit opt-in only. Never destroy an item that was also allocated for sale.
  // The automatic study allocation may consume at most 20% of initial capital.
  if(study&&studyFee>0&&remaining>0.01){
   for(const r of studyOptions){if(remaining<=0.01)break;
    const byFocus=r.focusPerUnit>0?Math.floor((focusRemaining+1e-8)/r.focusPerUnit):Infinity;
    const moneyLeft=budget*.20-usedStudyInvestment.value;
    const lossLeft=budget*.20-usedStudyLoss.value;
    const qty=Math.max(0,Math.min(40,Math.floor((cash+1e-8)/r.studyInvestment),Math.floor(moneyLeft/r.studyInvestment),
     Math.floor(lossLeft/r.studyNetCost),Math.ceil(remaining/r.studyFame),byFocus));
    if(!qty)continue;
    const investment=qty*r.studyInvestment,cost=qty*r.studyNetCost;
    entries.push({id:r.id,craftCity:r.craftCity,city:null,kind:'study',qty,units:qty*r.craftAmount,
     investment,profit:-cost,famePerCraft:r.studyFame,fame:qty*r.studyFame,returnRate:r.returnRate,materials:r.materials,studyFee:Number(studyFee)});
    usedStudyInvestment.value+=investment;usedStudyLoss.value+=cost;studyCount+=qty*r.craftAmount;
    cash-=investment;spent+=investment;net-=cost;focusUsed+=qty*(r.focusPerUnit||0);focusRemaining-=qty*(r.focusPerUnit||0);
    fameEarned+=qty*r.studyFame;remaining=Math.max(0,remaining-qty*r.studyFame);stageCount+=qty;
   }
  }
  if(stageCount===0)break;
  // Stages beyond the first REQUIRE receiving the previous sales proceeds.
  wallet+=net;earned+=fameEarned;netProfit+=net;peakCapital=Math.max(peakCapital,spent);
  stages.push({number:step,rows:entries,investment:spent,netProfit:net,fame:fameEarned,cashAfter:wallet,conditional:step>1});
  if(wallet<=0||![...availableSales.values()].some(x=>x>0)&&(!study||studyOptions.length===0))break;
 }
 const totals=new Map(),materials=new Map(),sales=new Map();
 for(const stage of stages)for(const r of stage.rows){
  const key=r.id+'|'+r.kind+'|'+r.craftCity;
  const prev=totals.get(key)||{id:r.id,method:r.kind,craftCity:r.craftCity,qty:0,units:0,fame:0,profit:0,investment:0};
  prev.qty+=r.qty;prev.units+=r.units;prev.fame+=r.fame;prev.profit+=r.profit;prev.investment+=r.investment;totals.set(key,prev);
  if(r.kind==='sell'){
   const saleKey=r.id+'|'+r.city,prior=sales.get(saleKey)||{id:r.id,city:r.city,qty:0,units:0,profit:0};
   prior.qty+=r.qty;prior.units+=r.units;prior.profit+=r.profit;sales.set(saleKey,prior);
  }
  for(const m of r.materials||[]){const materialKey=m.id+'|'+m.city,prior=materials.get(materialKey)||{id:m.id,city:m.city,qtyGross:0,qtyNet:0,unitPrice:m.unitPrice};
   prior.qtyGross+=m.count*r.qty;prior.qtyNet+=m.used*r.qty;materials.set(materialKey,prior);
  }
 }
 const safetySummary=checks.reasons.slice(0,3).map(x=>`${x.reason} (${x.count})`).join('; ');
 return {stages,items:[...totals.values()],sales:[...sales.values()],materials:[...materials.values()],remainingFame:Math.ceil(remaining),earnedFame:Math.ceil(earned),
  completed:remaining<=0.01,budget,peakCapital,netProfit,walletAfter:wallet,studyCount,goalFame,hasEstimatedFame:available.some(r=>r.fameEstimated),
  qualifyingRoutes:ranked.length,focusUsed,rejectedRoutes:checks.rejected.length,safetySummary,
  warning:`Plan limitado a rutas con margen, actividad y liquidez prudentes. ${checks.rejected.length} rutas descartadas. ${safetySummary||''} ${study&&studyFee<=0?'No se recomendó estudiar porque falta confirmar la tarifa de estudio.':''} ${ranked.some(x=>x.costReserve>0)?'Se reservó margen para tarifas de taller o transporte en cero; verifica los costos reales.':''} Las rondas siguientes dependen de que vendas y cobres las anteriores; los datos AODP no garantizan ventas.`};
}

// Craft-for-study needs material quotes, but never requires a fabricated sale
// quote. These candidates cannot enter the sale portion of the allocator.
export function createStudyOnlyCandidates({ids=[],recipes={},priceMap,inputs,maxAge=24}={}){
 const result=[],cities=inputs.cities||[];
 for(const id of ids){const recipe=recipes[id];if(!eligibleToStudy(id,recipe)||!recipe?.materials?.length)continue;
  const places=inputs.city==='compare'?[...new Set([recipe.city,'Caerleon'])]:inputs.city&&inputs.city!=='auto'?[inputs.city]:[recipe.city];
  for(const craftCity of places){
   const materials=[];let raw=0,net=0;
   const bonus=recipe.specialtyEnabled===false?0:(recipe.city===craftCity?15:0);
   const production=18+bonus+(recipe.dailyEnabled===false?0:Number(inputs.daily)||0)+(inputs.focus?59:0);
   const rrr=100*production/(100+production);
   for(const m of recipe.materials){
    let best=null;
    for(const city of materialPurchaseCities(m.id,inputs.materialPurchase||'bonus',cities)){const r=priceMap?.get(m.id+'|'+city+'|1');
     if(!r||!(Number(r.sell_price_min)>0))continue;
     const time=Date.parse(r.sell_price_min_date||'');if(!Number.isFinite(time)||Date.now()-time>maxAge*3600000||time>Date.now()+60000)continue;
     const px=Number(r.sell_price_min)+(city===craftCity?0:Number(inputs.materialShipping)||0);
     if(!best||px<best.unitPrice)best={city,unitPrice:px,at:time};
    }
    if(!best)break;
    const count=Number(m.count),used=m.ret===false?count:count*(1-rrr/100);
    materials.push({...m,city:best.city,unitPrice:best.unitPrice,upfrontUnitPrice:best.unitPrice,count,used,returned:count-used});
    raw+=count*best.unitPrice;net+=used*best.unitPrice;
   }
   if(materials.length!==recipe.materials.length)continue;
   const station=Number(inputs.station)||0;
   result.push({id,city:null,studyOnly:true,craftCity,materials,stationCost:station,returnRate:rrr,
    capitalPerUnit:raw+station,cost:net+station,profit:-(net+station),sell:0,craftAmount:Math.max(1,Number(recipe.amountCrafted)||1),
    focusPerUnit:inputs.focus?(Number(inputs.focusPerUnit)||0):0});
  }
 }
 return result;
}
