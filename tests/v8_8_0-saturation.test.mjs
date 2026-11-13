import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PLAN_STYLES,resolveStyle,impactCapacity,saturationLoss,saturationInfo,saturationSummary,effectiveDaily,horizonVolumeUnits} from '../core/market-impact.js';
import {routeProfitAtQuantity} from '../core/depth.js';
import {rebuildPlan} from '../core/plan.js';
import {bulkMarketCandidates,bulkItemExposureFraction} from '../core/high-volume.js';
import {allocatePortfolioV6} from '../core/allocator-v6.js';
const mk=(d,i,profit,extra={})=>({id:`T${4+i%4}_ITEM${i}`,city:i%3?'Black Market':'Martlock',craftCity:'Martlock',mode:'listed',
 cost:40000,capitalPerUnit:50000,profit,stressProfit:profit*.45,sell:60000,saleTaxPercent:6.5,
 activity:{observations:14,count:d*14,observedDaily:d,activeDays:14,coverage:1},
 activity7:{observations:7,count:d*7,observedDaily:d,activeDays:7},
 demandDaily:d,ageHours:2,confidence:{score:85},competition:{known:false,penalty:.92},craftAmount:1,...extra});
const alloc=(routes,budget,style,horizon=14)=>allocatePortfolioV6(bulkMarketCandidates(routes).accepted,budget,{
 intelligent:true,bulkMode:true,useAll:true,maxPerItemFraction:bulkItemExposureFraction(routes),maxVariants:65,targetDifferentItems:28,
 capFraction:resolveStyle(style).maxShare,horizonDays:horizon,saturation:style});

test('margen alto => lote mayor; margen fino => lote pequeño; nunca supera la cuota máxima del estilo',()=>{
 const fat=mk(300,0,12000),thin=mk(300,1,1500);
 for(const style of [1,2,3]){
  const f=impactCapacity(fat,{horizonDays:14,style}),t=impactCapacity(thin,{horizonDays:14,style});
  assert(f>t,`estilo ${style}: ${f} <= ${t}`);
  assert(f<=Math.floor(PLAN_STYLES[style].maxShare*300*14)+0);
 }
});
test('estilos ordenados: prudente <= equilibrado <= agresivo',()=>{
 const r=mk(500,0,9000);
 const c=[1,2,3].map(style=>impactCapacity(r,{horizonDays:14,style}));
 assert(c[0]<=c[1]&&c[1]<=c[2]&&c[0]<c[2],String(c));
});
test('la saturación resta beneficio y crece con la cuota; sin datos de volumen no inventa nada',()=>{
 const r={...mk(100,0,8000),saturation:{k:.3,volumeUnits:1400,style:'balanced'}};
 const small=routeProfitAtQuantity(r,10)/10,big=routeProfitAtQuantity(r,200)/200;
 assert(small<8000&&big<small);
 assert.equal(saturationLoss({...r,saturation:null},50),0);
 assert.equal(saturationLoss({...r,saturation:{k:.3,volumeUnits:0}},50),0);
 const info=saturationInfo(r,140);
 assert(Math.abs(info.share-.1)<1e-9&&Math.abs(info.discount-.03)<1e-9);
});
test('rutas con libro de órdenes verificado no reciben penalización doble',()=>{
 const book={...mk(100,0,8000),depthVerified:true,orderLevels:[{price:60000,amount:50,at:Date.now()}],saleTaxPercent:2.5,saturation:{k:.3,volumeUnits:1400}};
 const out=allocatePortfolioV6([book],10_000_000,{intelligent:true,bulkMode:true,useAll:true,saturation:2,horizonDays:14,capFraction:.22});
 for(const row of out.rows)assert.equal(row.saturation,null);
});
test('presupuesto holgado: la cuota por ruta respeta el estilo y el beneficio ya viene ajustado',()=>{
 const specs=[[2500,8000],[1200,3000],[600,12000],[300,1500],[200,6000],[150,9000],[100,2500],[80,8000]];
 const routes=specs.map(([d,p],i)=>mk(d,i,p));
 for(const style of [1,2,3]){
  const r=alloc(routes,400_000_000,style);
  for(const x of r.rows){
   const share=x.qty/x.saturation.volumeUnits;
   assert(share<=PLAN_STYLES[style].maxShare+1e-9,`${x.id} cuota ${share}`);
   assert(x.totalProfit<x.profit*x.qty,'el beneficio total debe descontar la saturación');
  }
  const sum=saturationSummary(r.rows);
  assert(sum&&sum.adjustedProfit<sum.naiveProfit&&Math.abs(sum.naiveProfit-sum.loss-r.totalProfit)<1);
 }
});
test('presupuesto escaso: el capital va a los márgenes mejores sin saturar',()=>{
 const routes=[mk(500,0,12000),mk(500,1,1200),mk(500,2,6000)];
 const r=alloc(routes,6_000_000,2);
 const spend=id=>r.rows.filter(x=>x.id===id).reduce((a,x)=>a+x.allocation,0);
 assert(spend(routes[0].id)>=spend(routes[1].id),'el margen alto debe recibir al menos tanto como el fino');
 for(const x of r.rows)assert(x.qty/x.saturation.volumeUnits<=.22+1e-9);
});
test('rebuildPlan y el asignador dan el mismo beneficio (edición coherente)',()=>{
 const r=alloc([mk(600,0,12000),mk(300,1,6000)],20_000_000,2);
 const rebuilt=rebuildPlan(r.rows.map(x=>({...x})),20_000_000);
 assert.equal(rebuilt.ok,true);
 for(const x of rebuilt.rows){
  const original=r.rows.find(y=>y.id===x.id&&y.city===x.city);
  assert(Math.abs(x.totalProfit-original.totalProfit)<1);
 }
});
test('una caída reciente de actividad reduce el volumen del horizonte; una subida no lo infla',()=>{
 const base=mk(100,0,5000);
 assert.equal(effectiveDaily(base),100);
 assert.equal(effectiveDaily({...base,activity7:{observations:7,observedDaily:40}}),40);
 assert.equal(effectiveDaily({...base,activity7:{observations:7,observedDaily:400}}),100);
 assert.equal(horizonVolumeUnits(base,7),700);
 assert.equal(effectiveDaily({demandDaily:null,activity:{observations:0}}),null);
});
test('la interfaz ofrece estilo del plan, usa el horizonte como días hasta el próximo craft y muestra la cuota',()=>{
 const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
 assert(app.includes("Estilo del plan"));
 assert(app.includes('Días para vender el lote'));
 assert(app.includes('saturation:style'));
 assert(app.includes('saturationSummary(rows)'));
 const sw=readFileSync(new URL('../sw.js',import.meta.url),'utf8');
 assert(sw.includes('./core/market-impact.js'));
});
