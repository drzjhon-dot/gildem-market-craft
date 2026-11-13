import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {resultsSummary,budgetGroups,shoppingWithCeilings,preflightOverview,shoppingListText} from '../core/results-view.js';
import {marketReferenceSnapshot} from '../core/market-references.js';
import {evidenceForPlan} from '../core/market-proof.js';
import {stagedMaterialNeeds,observedRotation} from '../core/intelligent-portfolio.js';
import {groupProduction,groupLogistics,materialUsage} from '../core/production-view.js';
import {observedWeeklyActivity} from '../core/high-volume.js';
import {saturationSummary,PLAN_STYLES,DEFAULT_STYLE} from '../core/market-impact.js';
import {marketNeedsRanking} from '../core/market-mechanics.js';
import {sellHoursByCity,bestSellHours,parseFestivities} from '../core/sell-hours.js';
const fragment=readFileSync(new URL('../app.js',import.meta.url),'utf8');
// La prueba ejecuta un fragmento aislado de la pantalla sobre datos reales de estructura
// del motor, sin que sea necesario un navegador, API de precios o login.
const start='// Gildem Craft Pro v8.5.5 · Resultados.';
const end='function craftResult(p){';
const begin=fragment.indexOf(start),finish=fragment.indexOf(end);
if(begin<0||finish<begin)throw Error('No se encuentra el código de Resultados instalado');
const source=fragment.slice(begin,finish);
const fake={budget:1000000,market:'black',branch:'Hachas',plan:{totalCost:850000,totalProfit:110000,focusUsed:2500,remaining:150000,rows:[
 {id:'T5_MAIN_AXE',qty:2,craftAmount:1,craftCity:'Thetford',city:'Black Market',profit:55000,totalProfit:110000,maxCrafts:10,capitalPerUnit:400000,ageHours:2,mode:'instant',depthVerified:true,confidence:{score:77},activity:{activeDays:11}}
 ],materials:[{id:'T5_METALBAR',qtyGross:130,unitPrice:3000,city:'Thetford'},{id:'T5_PLANKS',qtyGross:115,unitPrice:4000,city:'Fort Sterling'}],journalSummary:{items:[]}}};
const esc=v=>String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;');
function run(current=fake,report=null){
 const main={innerHTML:''};
 const state={resultSource:'crafting',plan:current,autoPlan:null,preflight:report};
 const context={main,state,prefs:{region:'west'},document:{body:{classList:{add(){}}}},
   currentPlan:()=>current,resultsSummary,budgetGroups,shoppingWithCeilings,preflightOverview,shoppingListText,marketReferenceSnapshot,evidenceForPlan,stagedMaterialNeeds,observedRotation,groupProduction,groupLogistics,materialUsage,saturationSummary,PLAN_STYLES,DEFAULT_STYLE,marketNeedsRanking,sellHoursByCity,bestSellHours,parseFestivities,observedWeeklyActivity,
   itemName:id=>id,itemTier:()=>5,itemEnch:()=>0,
   itemCell:id=>`<span class="item-cell"><img src="https://render.albiononline.com/v1/item/${id}.png">${id}</span>`,
   copyableItemCell:id=>`<span class="gcp-copyable-name"><span class="item-cell"><img src="https://render.albiononline.com/v1/item/${id}.png">${id}</span><button data-copy-item-name="${id}">Copiar</button></span>`,
   moneyCell:n=>`<span>${n}</span>`,preflightResult:report=>`<aside>${report.ok?'OK':'REVISAR'}</aside>`,
   short:n=>String(Math.round(n)),fmt:n=>String(n),h:esc,
   BRANCHES:[{key:'axes',test:id=>id.includes('AXE')}],isAggregateBranch:()=>false,categoryForBranch:()=> 'weapons',
   showToast(){},navigator:{clipboard:{writeText:async()=>{}}}
 };
 vm.runInNewContext(source+'\nresultsPage();',context,{timeout:1500});
 return main.innerHTML;
}
test('el dashboard representa números reales, íconos, el destino y botones',()=>{
 const html=run();
 assert.match(html,/Resultados del plan/);
 assert.match(html,/110000/);
 assert.match(html,/850000/);
 assert.match(html,/render\.albiononline\.com\/v1\/item\/T5_MAIN_AXE\.png/);
 assert.match(html,/Lista de compras/);
 assert.match(html,/data-action="preflight"/);
 assert.match(html,/data-action="save-investment"/);
 assert.match(html,/Comprobación pendiente/);
 assert.doesNotMatch(html,/Comprobación favorable/);
});
test('la comprobación favorable solo aparece con reporte positivo',()=>{
 const ok=run(fake,{ok:true,blockers:[],notes:[],at:'2026-11-09T19:00:00Z'});
 assert.match(ok,/Comprobación favorable/);
 const danger=run(fake,{ok:false,blockers:['Material insuficiente'],notes:[]});
 assert.match(danger,/Material insuficiente/);
 assert.match(danger,/Revisión necesaria/);
});
