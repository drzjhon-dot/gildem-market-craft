import {gameFocusCost,focusAfterEfficiency} from './game-focus.js';
// Exploración multi-rama. No afirma escanear TODO Albion si los límites de consulta
// obligan a seleccionar una muestra. La cobertura se devuelve explícitamente.
import {itemTier,itemEnch,craftCost,craftProfit,craftingReturnRate,quote} from './engine.js';
import {specialType,blackMarketEligible} from './special-recipes.js';
import {scenarioProfit} from './optimizer.js';
import {itemMatches} from './item-selection.js';
import {diversifiedRecipeIds} from './craft-plan-controls.js';
import {compareRefining} from './refining-integration.js';
import {materialPurchaseCities} from './material-cities.js';

const mainBranch = (branches,id)=>branches.find(b=>b.test(id)&&!(/_all$/.test(b.key)||b.key==='weapons_all'))||branches.find(b=>b.test(id));
export function selectUniversalRecipes(recipes,branches,{categories=['armor','weapons','accessories','gathering','potions','mounts','foods'],tierMin=4,tierMax=8,enchant=1,limit=240,categoryForBranch,branchKeys=null,itemFilter=null,idFilter=null}={}){
 const offered=new Map();const seen=new Set();
 for(const [id,rec] of Object.entries(recipes||{})){
  if(!rec?.materials?.length||!rec.city)continue;
  const tier=itemTier(id),ench=itemEnch(id);
  if(tier<tierMin||tier>tierMax||ench>enchant)continue;
  if(itemFilter&&!itemMatches(id,itemFilter))continue;
  if(idFilter&&!idFilter(id))continue;
  const eligibleBranches=branches.filter(b=>b.test(id)&&categories.includes(categoryForBranch(b.key))&&(!branchKeys||branchKeys.includes(b.key)));
  const b=eligibleBranches.find(b=>!(/_all$/.test(b.key)||b.key==='weapons_all'))||eligibleBranches[0];
  if(!b)continue;
  const category=categoryForBranch(b.key);if(!categories.includes(category))continue;
  let lane=offered.get(b.key);if(!lane){lane=[];offered.set(b.key,lane);}
  lane.push(id);seen.add(id);
 }
 const buckets=[...offered.entries()].sort((a,b)=>a[0].localeCompare(b[0]));
 // Round-robin across branches, then tiers, to prevent T4 armors dominating the scan.
 for(const [,ids] of buckets){const balanced=diversifiedRecipeIds(ids);ids.splice(0,ids.length,...balanced);}
 const chosen=[],used=new Set();let pass=0;
 while(chosen.length<limit){let progress=false;
  for(const [branch,ids] of buckets){const id=ids[pass];if(!id||used.has(id))continue;
   chosen.push({id,branch});used.add(id);progress=true;if(chosen.length>=limit)break;
  }
  if(!progress)break;pass++;
 }
 return {chosen,eligible:seen.size,branches:offered.size,scanned:chosen.length,coverage:seen.size?chosen.length/seen.size:0,partial:chosen.length<seen.size};
}
export function createUniversalCandidates({selected,recipes,priceMap,inputs,profile={},experience=new Map(),nameOf=id=>id,maxAge=24}){
 const saleCities=Array.isArray(inputs.saleCities)?inputs.saleCities:inputs.cities;
 const targets=inputs.market==='black'?['Black Market']:inputs.market==='royal'?saleCities: [...saleCities,'Black Market'];
 const results=[],missing={material:0,sale:0,focus:0},side=inputs.buyMode==='order'?'buy_price_max':'sell_price_min';
 for(const {id,branch} of selected){const r=recipes[id];if(!r?.materials?.length||!r.city)continue;
  const kind=specialType(id),products=Math.max(1,Number(r.amountCrafted)||1),noSpecial=r.specialtyEnabled===false;
  // v9.10 · Coste de Focus: el de Ajustes por objeto; si no, el del juego con tu FCE; si no, el manual.
  const focusPerUnit=inputs.focus?(Number(profile[id]?.focus)||focusAfterEfficiency(gameFocusCost(id,r)||0,inputs.focusEfficiency)||inputs.focusPerUnit||0):0;
  if(inputs.focus&&focusPerUnit<=0){missing.focus++;continue;}
  // Royal only products cannot be sold at BM, regardless of user selection.
  if(inputs.market==='black'&&!blackMarketEligible(id))continue;
  const craftCities=inputs.city==='compare'
   ?(noSpecial?inputs.cities:[...new Set([r.city,'Caerleon'])])
   :inputs.city&&inputs.city!=='auto'?[inputs.city]
   :(noSpecial?inputs.cities:[r.city]);
  let best=null;
  for(const craftCity of craftCities){
   const marketFinder=(materialId,targetCity)=>{let b=null;for(const city of materialPurchaseCities(materialId,inputs.materialPurchase||'all',inputs.cities)){const q=quote(priceMap,materialId,city,side,maxAge);if(!q)continue;
    const fee=inputs.buyMode==='order'?(inputs.listingFee/100):0;
    const shipping=city===targetCity?0:inputs.materialShipping;
    const rate=q.price*(1+fee)+shipping;
    if(!b||rate<b.price)b={...q,price:rate,originalPrice:q.price,shippingPerUnit:shipping,city};
   }return b;};
   const finder=materialId=>{const direct=marketFinder(materialId,craftCity);
    if(!inputs.refiningMode||inputs.refiningMode==='off')return direct;
    const compared=compareRefining({id:materialId,craftCity,buyRefined:direct,findMarket:marketFinder,
      mode:inputs.refiningMode,stationFee:inputs.refiningFee||0,transferFee:inputs.materialShipping||0,
      focus:!!inputs.refiningFocus,focusPerRefine:inputs.refiningFocusUnit||0,dailyBonus:inputs.refiningDaily||0});
    return compared.source?{...compared.source,refinementComparison:compared.comparison}:null;
   };
   const specialty=!noSpecial&&r.city===craftCity;
   const bonus=r.dailyEnabled===false?0:inputs.daily;
   const returnRate=craftingReturnRate({specialty,dailyBonus:bonus,focus:inputs.focus}).returnRate;
   const without=craftingReturnRate({specialty,dailyBonus:bonus,focus:false}).returnRate;
   const cost=craftCost(r,finder,returnRate,inputs.station);
   if(!cost){missing.material++;continue;}
   const refiningFocusCost=cost.materials.reduce((sum,m)=>sum+m.count*(m.refining?.focusPerRefine||0),0);
   const focusGain=inputs.focus?cost.materials.reduce((sum,m)=>sum+(m.ret?m.count*m.unitPrice*(returnRate-without)/100:0),0):0;
   for(const dest of targets){if(dest==='Black Market'&&!blackMarketEligible(id))continue;
    // Royal can sell immediately to a verified buy-order OR publish a sell-order.
    // This exposes viable alternatives when the listing market is saturated.
    for(const mode of (dest==='Black Market'?['listed']:inputs.includeInstantRoyal?['listed','instant']:[inputs.saleMode])){
    // El BM únicamente publica pujas verificables, no cotizaciones de ask
    // públicas de su propio libro. Para una orden nuestra se usa la puja
    // actual como precio base PRUDENTE: no significa que se ejecutará.
    const referenceSide=dest==='Black Market'?'buy_price_max':(mode==='instant'?'buy_price_max':'sell_price_min');
    const sale=quote(priceMap,id,dest,referenceSide,maxAge);
    if(!sale){missing.sale++;continue;}
    const transport=(dest===craftCity||dest==='Black Market'&&craftCity==='Caerleon')?0:products*inputs.transport;
    const lost=dest===craftCity?0:(dest==='Black Market'?inputs.riskBM:inputs.riskRoyal);
    const riskCost=cost.total*lost/100;
    const tax=dest==='Black Market'?inputs.bmTax:inputs.royalTax;
    const result=craftProfit(cost,sale.price*products,{tax:tax/100,setup:inputs.listingFee/100,mode,transport});
    if(!result||(!inputs.allowLoss&&result.profit-riskCost<=0))continue;
    const upfront=cost.rawMaterials+inputs.station+transport;
    if(upfront<=0)continue;
    const stress=scenarioProfit({sale:sale.price*products,cost:cost.total,tax:tax/100,setup:inputs.listingFee/100,mode,transport,materialCost:cost.materialCost,journal:0,drop:inputs.priceStress/100,materialsRise:inputs.resourceStress/100});
    const age=Math.max(sale.ageHours,...cost.materials.map(m=>m.at?(Date.now()-m.at)/3600000:0));
    const candidate={id,itemName:nameOf(id),branch,craftCity,city:dest,mode,sell:sale.price,profit:result.profit-riskCost,cost:result.cost+riskCost,capitalPerUnit:upfront,roi:100*(result.profit-riskCost)/(result.cost+riskCost),
     returnRate,materials:cost.materials,rawMaterials:cost.rawMaterials,at:sale.at,ageHours:age,activity:null,confidence:null,personalLearning:experience.get(id+'|'+dest)||null,
     focusPerUnit:focusPerUnit+refiningFocusCost,focusGain,stressProfit:stress.stressed-riskCost,taxRate:tax/100,saleTaxPercent:tax,craftAmount:products,recipeKind:kind||'equipo',setupRate:mode==='listed'?inputs.listingFee/100:0,referenceSide,listingUnverified:dest==='Black Market'&&mode==='listed',transportCost:transport,transportRiskPct:lost,expectedRiskCost:riskCost,stationCost:inputs.station,buyMode:inputs.buyMode,buySetup:inputs.listingFee/100,qualityMode:'normal',qualityWeights:[100,0,0,0,0],journal:null,journalBonus:0};
    // Retain one production location for the same item and destination; prevent double counting market depth.
    const key=id+'|'+dest+'|'+mode;const score=candidate.profit;
    if(!best)best=new Map();
    const old=best.get(key);if(!old||score>old.profit)best.set(key,candidate);
    }
   }
  }
  if(best)results.push(...best.values());
 }
 return {candidates:results,missing};
}
export function verifiedRotation(route){const days=route.personalLearning?.averageDays,qty=route.personalLearning?.qtySold;
 if(!(qty>=3&&Number.isFinite(days)&&days>=0))return null;
 return {days:Math.max(.25,days),silverPerDay:route.profit/Math.max(.25,days),source:'ventas personales',sample:qty};
}
