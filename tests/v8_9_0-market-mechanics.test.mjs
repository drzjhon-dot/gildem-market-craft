import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {saleFees,SALES_TAX,SETUP_FEE,addressableDemand,qualityVolumeIndex,applyBmReversion,marketNeed,marketNeedsRanking,needWeight} from '../core/market-mechanics.js';
import {effectiveDaily} from '../core/market-impact.js';
import {routePriority} from '../core/allocator-v6.js';
const day=86400000,now=Date.UTC(2026,10,10,12);
const series=(count,price=1000,days=14)=>Array.from({length:days},(_,i)=>({timestamp:new Date(now-(i+1)*day).toISOString(),item_count:count,avg_price:price}));

test('comisiones: 4 % Premium / 8 % sin Premium; publicar suma 2,5 %; vender a orden de compra no',()=>{
 assert.equal(SALES_TAX.premium,4);assert.equal(SALES_TAX.free,8);assert.equal(SETUP_FEE,2.5);
 assert.equal(saleFees({premium:true,mode:'listed'}).totalPercent,6.5);
 assert.equal(saleFees({premium:false,mode:'listed'}).totalPercent,10.5);
 assert.equal(saleFees({premium:true,mode:'instant'}).totalPercent,4);
 assert.equal(saleFees({premium:false,mode:'instant'}).totalPercent,8);
});
test('el Mercado Negro ya no usa un impuesto del 2,5 %: toma el de Ajustes como Royal',()=>{
 const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
 assert(!app.includes("num('craft-bm-tax',2.5)"));
 assert(!app.includes('Number(craftPrefs.bmTax)||2.5'));
 assert(app.includes('bmTax:prefs.tax,royalTax:prefs.tax'));
 assert(app.includes('listingFee:prefs.setup'));
});
test('demanda atendible: lo Normal limita el lote y las calidades 2-3 lo amplían hasta 1/0,689',()=>{
 assert.equal(addressableDemand(null,{2:50}).daily,null);
 assert.deepEqual([addressableDemand(100,null).daily,addressableDemand(100,null).factor],[100,1]);
 const few=addressableDemand(100,{2:10,3:2});
 assert.equal(few.daily,112);
 const many=addressableDemand(100,{2:400,3:100});
 assert(Math.abs(many.daily-100/.689)<1e-9&&many.factor<1.46);
 assert.equal(addressableDemand(0,{2:500}).daily,0,'sin demanda Normal no se puede colocar el 69 % del lote');
});
test('índice de calidades: 2–5, por objeto y ciudad, media diaria de 14 días',()=>{
 const rows=[{item_id:'T5_BAG',location:'Black Market',quality:2,data:series(28)},
  {item_id:'T5_BAG',location:'Black Market',quality:3,data:series(7)},
  {item_id:'T5_BAG',location:'Black Market',quality:1,data:series(999)},
  {item_id:'T5_BAG',location:'Lymhurst',quality:5,data:series(999)}];
 const idx=qualityVolumeIndex(rows,14,now);
 assert.deepEqual(idx.get('T5_BAG|Black Market'),{2:28,3:7});
 assert.equal(idx.has('T5_BAG|Lymhurst'),true)
 assert.equal(idx.get('T5_BAG|Lymhurst')[5],999);
});
test('la caída reciente se compara con la demanda ya escalada por calidad',()=>{
 const r={demandDaily:140,qualityFactor:1.4,activity:{observations:14,observedDaily:100},activity7:{observations:7,observedDaily:100}};
 assert.equal(effectiveDaily(r),140);
 assert.equal(effectiveDaily({...r,activity7:{observations:7,observedDaily:50}}),70);
});
const bm=(extra={})=>({id:'T6_2H_BOW',city:'Black Market',mode:'listed',sell:130000,profit:30000,stressProfit:18000,cost:90000,
 craftAmount:1,taxRate:.04,setupRate:.025,activity:{medianPrice:100000,observedDaily:40,observations:14},...extra});
test('Mercado Negro en sierra: un pico de puja se valora a la mediana de 14 días',()=>{
 const r=bm();const spike=applyBmReversion(r);
 assert(spike&&Math.abs(spike.ratio-1.3)<1e-9);
 assert.equal(r.sell,100000);
 assert(Math.abs(r.profit-(30000-30000*.935))<1e-6);
 assert(r.stressProfit<18000);
 assert.equal(r.liveBmBid,130000);
 assert.equal(applyBmReversion(r),null,'no se aplica dos veces');
});
test('la reversión no toca Royal, ventas inmediatas, objetivos históricos ni pujas en la media',()=>{
 for(const r of [bm({city:'Lymhurst'}),bm({mode:'instant'}),bm({salePriceProvisional:true}),bm({depthVerified:true}),bm({sell:101000}),bm({activity:{medianPrice:null}})]){
  const before=r.profit;assert.equal(applyBmReversion(r),null);assert.equal(r.profit,before);
 }
});
test('necesidad BM: puja sobre la media = pedidos acumulados; bajo la media = recién abastecido',()=>{
 const hot=marketNeed(bm({liveBmBid:125000,sell:100000}));
 assert.equal(hot.state,'alta');assert(hot.weight>1&&hot.weight<=1.12);
 const cold=marketNeed(bm({liveBmBid:80000,sell:100000}));
 assert.equal(cold.state,'baja');assert(cold.weight<1&&cold.weight>=.9);
 assert.equal(marketNeed(bm({liveBmBid:100000,sell:100000})).state,'normal');
 assert.equal(marketNeed(bm({liveBmBid:null,sell:100000,referenceSide:'historical_bm_target',activity:{}})),null);
});
test('necesidad Royal: días de oferta por delante de tu orden',()=>{
 const base={id:'T5_BAG',city:'Lymhurst',mode:'listed',sell:9000,demandDaily:100,activity:{medianPrice:9000,observedDaily:100}};
 assert.equal(marketNeed({...base,competition:{known:true,unitsAhead:20}}).state,'alta');
 const full=marketNeed({...base,competition:{known:true,unitsAhead:600}});
 assert.equal(full.state,'baja');assert.equal(full.weight,.90);
 assert.equal(marketNeed({...base,competition:{known:false},sell:10500}).state,'alta');
});
test('la necesidad solo reordena con suavidad (±12 %) y el ranking muestra lo más pedido',()=>{
 const common={cost:40000,capitalPerUnit:50000,profit:8000,stressProfit:4000,confidence:{score:80},craftAmount:1,demandDaily:60,
  activity:{observations:14,observedDaily:60,medianPrice:60000},activity7:{observations:7,observedDaily:60},referenceSide:'buy_price_max'};
 const hot={...common,id:'T5_A',city:'Black Market',sell:60000,liveBmBid:75000};
 const cold={...common,id:'T5_B',city:'Black Market',sell:60000,liveBmBid:50000};
 const ratio=routePriority(hot)/routePriority(cold);
 assert(ratio>1&&ratio<1.26,String(ratio));
 assert(needWeight(hot)<=1.12&&needWeight(cold)>=.9);
 const list=marketNeedsRanking([hot,cold,{...hot,profit:1}]);
 assert.deepEqual(list.map(x=>x.id),['T5_A']);
});
test('la app consulta calidades 2-3, ya no muestra el panel «Qué pide el mercado» y precachea el módulo',()=>{
 const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
 assert(app.includes('sharedTopCraftHistory(hist.rows)'));
 assert(!app.includes('Qué pide el mercado ahora'));
 assert(app.includes('applyBmReversion(x)'));
 const data=readFileSync(new URL('../core/data.js',import.meta.url),'utf8');
 assert(data.includes("qualities:'2,3,4,5'"));
 assert(readFileSync(new URL('../sw.js',import.meta.url),'utf8').includes('./core/market-mechanics.js'));
});
