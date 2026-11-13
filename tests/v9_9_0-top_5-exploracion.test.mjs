import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {makeCraftProposals,proposalMetrics,proposalSignature,PLAN_PROPOSALS} from '../core/portfolio-proposals.js';
import {validateCraftPlan,variantParts,diversifiedRecipeIds} from '../core/craft-plan-controls.js';
import {selectUniversalRecipes} from '../core/opportunity-scan.js';
import {allocatePortfolioV6} from '../core/allocator-v6.js';
const code=f=>readFileSync(new URL('../'+f,import.meta.url),'utf8');
function fixture({city='Black Market',valid=true}={}){
 const rows=[];
 for(let tier=4;tier<=7;tier++)for(let enchant=0;enchant<=3;enchant++)for(let stem=0;stem<4;stem++){
  const id=`T${tier}_${['MAIN_MACE','2H_MACE','2H_FLAIL','MAIN_ROCKMACE_KEEPER'][stem]}${enchant?'@'+enchant:''}`;
  const sell=13_000*Math.pow(1.8,tier-4)*Math.pow(1.8,enchant)*(1+stem*.2);
  const daily=310/(1+.8*(tier-4)+enchant*1.5+stem*.6);
  const cost=sell*.74,capitalPerUnit=sell*.68,profit=sell*.23;
  rows.push({id,craftCity:'Thetford',city,mode:'listed',sell,cost,capitalPerUnit,profit,
   stressProfit:valid?profit*.7:-1,confidence:{score:85},craftFame:(1500*Math.pow(2,tier-4)*Math.pow(2,enchant))*(stem===3?3:1),
   focusPerUnit:0,craftAmount:1,materials:[],saleTaxPercent:4,setupRate:.025,
   demandDaily:daily,qualityFactor:1,activity:{observations:14,count:daily*14,observedDaily:daily,medianPrice:sell},
   activity7:{observations:7,count:daily*7,observedDaily:daily},depthVerified:false});
 }
 return rows;
}
const opts={style:2,horizonDays:7,focusLimit:null,useAll:true,primaryGoal:1};
test('tres propuestas reales, mismas cotizaciones y sin superar presupuesto BM',()=>{
 const routes=fixture();
 const proposals=makeCraftProposals(routes,5_000_000,opts);
 assert.deepEqual(proposals.map(x=>x.id),['silver','balance','fame']);
 assert(proposals.every(x=>x.plan.totalCost<=5_000_000));
 assert(proposals.every(x=>x.plan.rows.every(r=>r.totalProfit>0&&r.stressProfit>0&&r.qty<=r.maxCrafts)));
 for(const proposal of proposals){
  const safety=validateCraftPlan(proposal.plan.rows,{tiers:[4,5,6,7],enchants:[0,1,2,3],ids:routes.map(x=>x.id),budget:5_000_000,market:'black',totalCost:proposal.plan.totalCost});
  assert(safety.ok,safety.problems.join(' · '));
  assert.equal(proposal.metrics.profit,proposal.plan.totalProfit);
 }
 console.log('SIMULADOR_TOP_5_BM',JSON.stringify(proposals.map(p=>({mode:p.id,capital:Math.round(p.metrics.capital),profit:Math.round(p.metrics.profit),fame:Math.round(p.metrics.fame),items:p.metrics.items,variants:p.metrics.variants}))));
 assert(new Set(proposals.map(x=>proposalSignature(x.plan))).size>=2,'Distintos objetivos deben generar propuestas distintas cuando hay mercado');
});
test('tres propuestas respetan tiers no consecutivos, encantamientos no consecutivos y presupuesto Royal',()=>{
 const rows=fixture({city:'Martlock'}).filter(r=>[4,6].includes(variantParts(r.id).tier)&&[0,2].includes(variantParts(r.id).enchant));
 for(const budget of [650_000,2_500_000,8_000_000])for(const style of [1,2,3]){
  const proposals=makeCraftProposals(rows,budget,{...opts,style});
  assert.equal(proposals.length,3);
  for(const option of proposals){
   const check=validateCraftPlan(option.plan.rows,{tiers:[4,6],enchants:[0,2],ids:rows.map(r=>r.id),market:'royal',budget,totalCost:option.plan.totalCost});
   assert(check.ok,check.problems.join(' / '));
  }
 }
});
test('sin beneficio bajo estrés no se generan tres inversiones ficticias',()=>{
 const proposals=makeCraftProposals(fixture({valid:false}),9_000_000,opts);
 assert(proposals.every(p=>p.plan.rows.length===0&&p.plan.totalProfit===0));
 assert(proposals.slice(1).every(p=>p.duplicateOf!==null));
});
test('plan original comprobado se conserva exactamente como opción activa',()=>{
 const routes=fixture();
 const full=makeCraftProposals(routes,2_000_000,{...opts,primaryGoal:2});
 const original=full[2].plan;
 const repeat=makeCraftProposals(routes,2_000_000,{...opts,primaryGoal:2,primaryPlan:original});
 assert.equal(repeat[2].plan,original);
 assert.equal(repeat[2].metrics.fame,proposalMetrics(original).fame);
});
test('exploración de rama cubre carriles reales antes de truncar y declara cobertura',()=>{
 const recipes={},branches=[{key:'mace',test:id=>id.includes('MACE')||id.includes('FLAIL')}];
 for(const r of fixture()){recipes[r.id]={city:'Thetford',materials:[{id:'T4_PLANKS',count:4}]};}
 const pick=selectUniversalRecipes(recipes,branches,{categories:['weapons'],tierMin:4,tierMax:8,enchant:4,limit:1000,categoryForBranch:()=> 'weapons'});
 assert.equal(pick.partial,false);assert.equal(pick.eligible,pick.scanned);
 const sample=selectUniversalRecipes(recipes,branches,{categories:['weapons'],tierMin:4,tierMax:8,enchant:4,limit:18,categoryForBranch:()=> 'weapons'});
 assert.equal(sample.partial,true);assert(new Set(sample.chosen.map(x=>variantParts(x.id).tier+'.'+variantParts(x.id).enchant)).size>=12);
});
test('la aplicación muestra tres propuestas y permite comprobar el cambio en Black/Royal',()=>{
 const app=code('app.js'),sw=code('sw.js'),css=code('styles.css');
 assert(app.includes('makeCraftProposals(adaptive.routes,')&&app.includes('makeCraftProposals(routes,'));
 assert(app.includes('function craftProposalCards('));
 assert(app.includes('async function selectCraftProposal(')&&app.includes('guardMaterialPurchases(option.plan'));
 assert(app.includes('apply-craft-proposal')&&app.includes('sendPlanToCalculator(source)'));
 assert(sw.includes('portfolio-proposals.js')&&css.includes('.gcp-proposals'));
});

test('al elegir propuesta Royal se comprueban abastecimiento y filtros ANTES de enviarla a la calculadora',async()=>{
 const {runInNewContext}=await import('node:vm');
 const text=code('app.js');
 const segment=text.slice(text.indexOf('async function selectCraftProposal('),text.indexOf('function preflightResult(report)'));
 assert(segment.startsWith('async function selectCraftProposal('));
 const route={id:'T5_MAIN_MACE@1',city:'Martlock',mode:'listed',craftCity:'Thetford',qty:2,capitalPerUnit:11000,craftFame:400,stressProfit:2500,profit:3000};
 const candidate={id:'balance',label:'Silver y rotación',plan:{rows:[route],totalCost:22000,totalProfit:6000,materials:[]},metrics:{}};
 const data={proposals:[{...candidate,id:'silver'},candidate,{...candidate,id:'fame'}],selectedProposal:0,
  plan:{rows:[route],totalCost:22000,totalProfit:6000},budget:50000,horizonDays:7,
  allowedTiers:[5],allowedEnchants:[1],allowedIds:[route.id],frozenFocusLimit:null};
 const state={autoPlan:data,proposalApplying:false,preflight:{previous:true}};
 const results={id:'auto-results',innerHTML:''};let calls=0,sent=[];
 const ctx={state,prefs:{region:'west'},control:()=>results,setBusy:()=>{},
  async guardMaterialPurchases(plan){calls++;return {plan,supplyPending:false,depthAudit:null};},
  validateCraftPlan:validateCraftPlan,
  portfolioDiversityStats:()=>({differentItems:1}),portfolioFillSummary:()=>({percent:44}),
  proposalMetrics,autoResults:()=>'<p>Simulated plan</p>',craftResult:()=>'',
  sendPlanToCalculator:source=>sent.push(source),showToast:()=>{},Error};
 runInNewContext(segment+'\nthis.selectCraftProposal=selectCraftProposal;',ctx);
 await ctx.selectCraftProposal('autocraft',1);
 assert.equal(calls,1);assert.equal(data.selectedProposal,1);
 assert.equal(data.plan.totalCost,22000);assert.equal(state.preflight,null);
 assert.deepEqual(sent,['autocraft']);
 assert.equal(state.proposalApplying,false);
});

test('una propuesta que exceda presupuesto o salga del enchant seleccionado NO sustituye el plan existente',async()=>{
 const {runInNewContext}=await import('node:vm');
 const app=code('app.js'),chunk=app.slice(app.indexOf('async function selectCraftProposal('),app.indexOf('function preflightResult(report)'));
 const bad={id:'T6_MAIN_MACE@2',city:'Black Market',mode:'listed',qty:200,capitalPerUnit:100_000,profit:20_000,stressProfit:10_000};
 const plan={rows:[bad],totalCost:20_000_000,totalProfit:3_000_000};
 const data={selectedProposal:0,proposals:[{plan:{rows:[{id:'T5_MAIN_MACE',city:'Black Market',qty:1,capitalPerUnit:10000}]}},{plan}],
  plan:{rows:[{id:'T5_MAIN_MACE'}]},budget:1_000_000,allowedTiers:[5],allowedEnchants:[0],allowedIds:['T5_MAIN_MACE'],horizonDays:7};
 const state={plan:data,preflight:null};let sent=0,errors=0;
 const ctx={state,prefs:{region:'west'},control:()=>({id:'craft-results'}),setBusy:()=>{},
  guardMaterialPurchases:async p=>({plan:p}),validateCraftPlan,proposalMetrics,
  portfolioDiversityStats:()=>({}),portfolioFillSummary:()=>({}),
  craftResult:()=>'',autoResults:()=>'',sendPlanToCalculator:()=>sent++,showToast:()=>errors++,Error};
 runInNewContext(chunk+'\nthis.selectCraftProposal=selectCraftProposal;',ctx);
 await ctx.selectCraftProposal('crafting',1);
 assert.equal(data.selectedProposal,0);assert.equal(sent,0);assert.equal(errors,1);
});
