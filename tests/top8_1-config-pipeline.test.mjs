import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { exactBudget } from '../core/craft-plan-controls.js';
import { PLAN_STYLES, DEFAULT_STYLE } from '../core/market-impact.js';
import { craftingReturnRate } from '../core/engine.js';

const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const a=app.indexOf('const QC_TIERS=[');
const b=app.indexOf('async function refreshCraftItems()',a);
assert(a>0&&b>a,'No se encontró la configuración real de la interfaz');
const fragment=app.slice(a,b);

function fixture(){
 const selected={
  'craft-tier':[4,6,8], 'craft-ench':[0,2,4], 'craft-daily':[20],
  'craft-horizon':[30], 'craft-style':[3], 'craft-fame':[2], 'craft-budget':[5000000],
  'auto-tier':[5,7], 'auto-ench':[1,3], 'auto-daily':[10],
  'auto-horizon':[7], 'auto-style':[1], 'auto-fame':[0], 'auto-budget':[15000000]
 };
 const states={'craft-qc-budget-custom':'8750000','auto-qc-budget-custom':'',
  'craft-branch':'maces','auto-branch':'maces'};
 const flags={'craft-qc-bonus':false,'craft-qc-focus':true,'craft-qc-invest':false,'craft-qc-diversity':true,
  'auto-qc-bonus':true,'auto-qc-focus':false,'auto-qc-invest':true,'auto-qc-diversity':false};
 const controls=new Map(),craftPrefs={focus:'no',budget:5e6},autoPrefs={focus:false,budget:15e6};
 let savedAuto=0;
 const globals={craftPrefs,autoPrefs,DEFAULT_STYLE,PLAN_STYLES,exactBudget,
  document:{querySelectorAll(selector){
   const key=selector.match(/\[data-qc-(?:multi|single)="([^"]+)"\]/)?.[1];
   return (selected[key]||[]).map(value=>({value:String(value)}));
  }},
  val:(key,fallback='')=>states[key]??controls.get(key)?.value??fallback,
  control:key=>{if(!controls.has(key))controls.set(key,{value:''});return controls.get(key);},
  checked:key=>!!flags[key],
  branchByKey:()=>({city:'Thetford'}),
  categoryForBranch:()=> 'weapons',
  itemTier:id=>Number(id.match(/^T([1-8])_/)[1]),
  itemEnch:id=>Number(id.split('@')[1]||0),
  saveCraftPrefs:p=>Object.assign(craftPrefs,p),
  saveAutoSelections:()=>{savedAuto++;},
  craftRateHelp:()=>{},
  h:x=>String(x)
 };
 const api=runInNewContext(`${fragment}\n;({qcSync,qcSelectedSettings,qcVariantIncluded})`,globals);
 return {api,craftPrefs,autoPrefs,controls,selected,flags,get savedAuto(){return savedAuto;}};
}

test('top8.1: Black Craft recibe presupuesto personalizado, tiers/discontinuos, enchants, ciudad, Focus, bono, estilo, objetivo y diversidad',()=>{
 const p=fixture();assert.equal(p.api.qcSync('craft'),true);
 const c=p.craftPrefs;
 assert.equal(c.budget,8_750_000);assert.equal(c.daily,20);assert.equal(c.horizonDays,30);
 assert.equal(c.style,3);assert.equal(c.fameGoal,2);assert.equal(c.focus,'yes');
 assert.equal(c.bonusCity,false);assert.equal(c.city,'Caerleon');
 assert.equal(c.invest,'safe');assert.equal(c.diversityPriority,true);
 assert.deepEqual([...c.tiersSelected],[4,6,8]);assert.deepEqual([...c.enchSelected],[0,2,4]);
 assert.equal(p.controls.get('craft-budget')?.value,'8750000');
 assert.equal(p.api.qcVariantIncluded('craft','T8_MAIN_MACE@4','maces'),true);
 assert.equal(p.api.qcVariantIncluded('craft','T7_MAIN_MACE@4','maces'),false);
 assert.equal(p.api.qcVariantIncluded('craft','T8_MAIN_MACE@3','maces'),false);
});

test('top8.1: Royal Craft propaga filtros y desactiva diversidad sin afectar sus otros ajustes',()=>{
 const p=fixture();assert.equal(p.api.qcSync('auto'),true);
 const c=p.autoPrefs;
 assert.equal(c.budget,15_000_000);assert.equal(c.daily,10);assert.equal(c.horizonDays,7);
 assert.equal(c.style,1);assert.equal(c.fameGoal,0);assert.equal(c.focus,false);
 assert.equal(c.city,'auto');assert.equal(c.bonusCity,true);assert.equal(c.diversityPriority,false);
 assert.equal(c.invest,'all');assert.equal(c.market,'royal');
 assert.deepEqual([...c.tiersSelected],[5,7]);assert.deepEqual([...c.enchSelected],[1,3]);
 assert.equal(p.savedAuto,1);
 assert.equal(p.api.qcVariantIncluded('auto','T5_MAIN_MACE@1','maces'),true);
 assert.equal(p.api.qcVariantIncluded('auto','T6_MAIN_MACE@1','maces'),false);
});

test('top8.1: el bono diario y Focus realmente alteran el retorno calculado',()=>{
 const standard=craftingReturnRate({specialty:true,dailyBonus:0,focus:false});
 const bonus=craftingReturnRate({specialty:true,dailyBonus:20,focus:false});
 const focused=craftingReturnRate({specialty:true,dailyBonus:20,focus:true});
 assert(bonus.returnRate>standard.returnRate,`Retorno sin bono ${standard.returnRate}, con bono ${bonus.returnRate}`);
 assert(focused.returnRate>bonus.returnRate);
});
