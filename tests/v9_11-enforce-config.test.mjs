import test from 'node:test';
import assert from 'node:assert/strict';
import {portfolioSettings,variantParts} from '../core/craft-plan-controls.js';
import {allocatePortfolioV6} from '../core/allocator-v6.js';
import {bulkMarketCandidates,bulkItemExposureFraction} from '../core/high-volume.js';
import {filterViableCraftRoutes} from '../core/viability.js';
import {PLAN_STYLES} from '../core/market-impact.js';
import {enforcePlanConfig,strictCapacity,enforcementSummary} from '../core/enforce-config.js';
const stems=['MAIN_MACE','2H_MACE','2H_FLAIL','2H_MACE_MORGANA','MAIN_ROCKMACE_KEEPER'];
function fixture({city='Black Market',budget=10_000_000}={}){
 const rows=[];
 for(let tier=4;tier<=8;tier++)for(let ench=0;ench<=3;ench++)for(let stemIndex=0;stemIndex<stems.length;stemIndex++){
  const stem=stems[stemIndex],id=`T${tier}_${stem}${ench?'@'+ench:''}`;
  const price=20_000*Math.pow(2.15,tier-4)*Math.pow(2.4,ench)*(1+stemIndex*.13);
  const cost=price*.76,capitalPerUnit=cost*.97;
  // Simular actividad de alta, media y baja rotación según tier/enchant.
  const daily=Math.max(0,Math.round(600/(1+stemIndex*.48)/(1+Math.pow(tier-4,1.65)*.7)/(1+ench*ench*1.35)));
  const profit=price*.22;
  rows.push({id,city,craftCity:'Thetford',mode:'listed',sell:price,cost,capitalPerUnit,profit,stressProfit:profit*.68,
   saleTaxPercent:6.5,setupRate:.025,transportCost:100,stationCost:cost*.012,
   craftAmount:1,craftFame:1800*Math.pow(2.2,tier-4)*Math.pow(2.3,ench),
   confidence:{score:82},ageHours:2,referenceSide:city==='Black Market'?'buy_price_max':'sell_price_min',
   activity:{observations:14,count:daily*14,activeDays:14,observedDaily:daily,medianPrice:price*.97,coverage:1},
   activity7:{observations:7,count:daily*7,activeDays:7,observedDaily:daily},
   demandDaily:daily,qualityFactor:1,materials:[],
   competition:{known:true,unitsAhead:10,penalty:1},marketSignals:{bid:price*.85,ask:price,spreadPercent:15},
   salePriceProvisional:false,depthVerified:false});
 }
 return rows;
}

const combo=id=>{const p=variantParts(id);return `T${p.tier}.${p.enchant}`;};
function setup({city='Lymhurst',budget=10e6,style=2,tiers=[4,5,6,7,8],enchants=[0,1,2,3]}={}){
 const routes=fixture({city}).map(r=>({...r,craftCity:'Thetford'}));
 const eligible=bulkMarketCandidates(filterViableCraftRoutes(routes,{budget,mode:city==='Black Market'?'black':'royal'}).accepted,{minWeekly:24}).accepted;
 const itemFraction=Math.min(bulkItemExposureFraction(eligible),portfolioSettings({style,fameGoal:1,eligibleItems:new Set(eligible.map(x=>x.id)).size}).itemFractionCeiling);
 const plan=allocatePortfolioV6(eligible,budget,{goal:'balanced',useAll:true,capFraction:PLAN_STYLES[style].maxShare,unknownCap:0,horizonDays:7,intelligent:true,bulkMode:true,saturation:style,maxPerItemFraction:itemFraction,maxVariants:80});
 const cfg={tiers,enchants,budget,invest:'all',market:city==='Black Market'?'black':'royal',saleCities:[city],city:'auto',recipeCity:()=>'Thetford',focus:false,style,horizonDays:7,itemFraction};
 return {plan,eligible,cfg};
}
test('v9.11 · Cumple filtros: quita tiers/encantamientos no marcados y otra ciudad de fabricación',()=>{
 const {plan,eligible,cfg}=setup();
 const rows=[...plan.rows,{...plan.rows[0],craftCity:'Martlock'}];
 const r=enforcePlanConfig({rows,pool:eligible,cfg:{...cfg,tiers:[4,5],enchants:[0,1]}});
 assert(r.rows.every(x=>[4,5].includes(variantParts(x.id).tier)&&[0,1].includes(variantParts(x.id).enchant)));
 assert(r.rows.every(x=>x.craftCity==='Thetford'));
 assert(r.report.removed.some(x=>/Fuera de la ciudad de bono/.test(x.reason)));
});
test('v9.11 · Límites estrictos: capacidad por estilo y % por objeto, sin excepciones',()=>{
 for(const style of [1,2,3]){const {plan,eligible,cfg}=setup({style});const r=enforcePlanConfig({rows:plan.rows,pool:eligible,cfg:{...cfg,style}});
  const byItem=new Map();for(const x of r.rows){assert(x.qty<=strictCapacity(x,{style,horizonDays:7}),x.id);byItem.set(x.id,(byItem.get(x.id)||0)+x.qty*x.capitalPerUnit);}
  for(const v of byItem.values())assert(v<=cfg.budget*cfg.itemFraction+1e-6);
  assert(r.rows.reduce((a,x)=>a+x.qty*x.capitalPerUnit,0)<=cfg.budget+1e-6);}
});
test('v9.11 · Cobertura: un lote de cada tier/encantamiento marcado que tenga ruta rentable',()=>{
 const {eligible,cfg}=setup();
 const wanted=new Set(eligible.map(x=>combo(x.id)));
 // Plan inicial concentrado en T4.0: el cumplimiento añade el resto.
 const only=eligible.filter(x=>combo(x.id)==='T4.0').slice(0,1).map(x=>({...x,qty:5}));
 const r=enforcePlanConfig({rows:only,pool:eligible,cfg});
 const got=new Set(r.rows.map(x=>combo(x.id)));
 for(const c of wanted)assert(got.has(c)||r.report.coverageMissing.some(m=>m.combo===c),c);
 assert(r.report.coverageAdded.length>5);assert(/cubrir todos los tiers/.test(enforcementSummary(r.report)));
});
test('v9.11 · Usar todo: invierte el capital restante sin pérdidas ni pasar límites',()=>{
 const {eligible,cfg}=setup({budget:30e6});
 const r=enforcePlanConfig({rows:[],pool:eligible,cfg:{...cfg,budget:30e6}});
 const spent=r.rows.reduce((a,x)=>a+x.qty*x.capitalPerUnit,0);
 assert(spent>30e6*.9||r.report.leftoverReason);assert(r.rows.every(x=>x.qty>0));
 const safe=enforcePlanConfig({rows:[],pool:eligible,cfg:{...cfg,budget:30e6,invest:'safe'}});
 assert(safe.report.filled===0);
});
test('v9.11 · Focus: nunca supera el Focus disponible',()=>{
 const {eligible,cfg}=setup();const pool=eligible.map(x=>({...x,focusPerUnit:300}));
 const r=enforcePlanConfig({rows:[],pool,cfg:{...cfg,focus:true,focusLimit:9000}});
 assert(r.rows.reduce((a,x)=>a+x.qty*x.focusPerUnit,0)<=9000);
});
test('v9.11 · Royal: solo ciudades de venta marcadas y máximo de ciudades de fabricación',()=>{
 const a=setup({city:'Lymhurst'}),b=setup({city:'Martlock'});
 const pool=[...a.eligible,...b.eligible.map(x=>({...x,craftCity:'Bridgewatch'}))];
 const r=enforcePlanConfig({rows:[],pool,cfg:{...a.cfg,saleCities:['Lymhurst'],city:'compare',maxCraftCities:'1'}});
 assert(r.rows.every(x=>x.city==='Lymhurst'));assert.equal(new Set(r.rows.map(x=>x.craftCity)).size,1);
});
