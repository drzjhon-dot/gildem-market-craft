import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {sellHoursByCity,bestSellHours,parseFestivities,ticksToMs} from '../core/sell-hours.js';
const now=Date.UTC(2026,10,10,12);
const H=3600000,D=86400000;
const pt=(daysAgo,hourUtc,count,price)=>({timestamp:new Date(Date.UTC(2026,10,10-daysAgo,hourUtc)).toISOString().replace('Z',''),item_count:count,avg_price:price});

test('agrupa por hora UTC con marcas sin zona, pondera el índice de precio por unidades y respeta la ventana',()=>{
 const rows=[{item_id:'T5_BOW',location:'Black Market',quality:1,data:[
  pt(1,20,10,120000),pt(2,20,10,120000),  // 20h paga 1.2x
  pt(1,8,10,80000),pt(2,8,10,80000),      // 8h paga 0.8x
  pt(3,14,20,100000),pt(4,14,20,100000),
  pt(12,23,500,999999)                     // fuera de la ventana de 7 días
 ]}];
 const profiles=sellHoursByCity(rows,{days:7,now});
 const bm=profiles.get('Black Market');
 assert(bm&&bm.totalUnits===80&&bm.items===1);
 const h20=bm.hours[20],h8=bm.hours[8],h14=bm.hours[14];
 assert.equal(h20.units,20);assert(Math.abs(h20.priceIndex-1.2)<.01);
 assert(Math.abs(h8.priceIndex-.8)<.01);
 assert(Math.abs(h14.priceIndex-1)<.01);
 assert.equal(bm.hours[23].units,0,'lo de hace 12 días no cuenta');
 const top=bestSellHours(bm,{market:'black',count:2});
 assert.equal(top[0].hourUtc,20,'en el Mercado Negro manda el precio');
 assert(top[0].reason.includes('20 %'));
 const royal=bestSellHours(bm,{market:'royal',count:1});
 assert.equal(royal[0].hourUtc,14,'en Royal manda la actividad');
});
test('horas con muestra mínima: un pico de 3 unidades no gana; sin datos, lista vacía',()=>{
 const rows=[{item_id:'T4_BAG',location:'Lymhurst',quality:1,data:[
  pt(1,3,3,500000),  // pico diminuto de precio
  ...Array.from({length:6},(_,i)=>pt(i+1,18,80,10000))
 ]}];
 const p=sellHoursByCity(rows,{days:7,now}).get('Lymhurst');
 const top=bestSellHours(p,{market:'black',count:1});
 assert.equal(top[0].hourUtc,18,'la hora con 3 de 483 unidades no supera el umbral');
 assert.deepEqual(bestSellHours(null),[]);
 assert.deepEqual(bestSellHours({hours:[]}),[]);
});
test('festivities: convierte ticks, filtra pasados y lejanos, tolera formatos y basura',()=>{
 const tick=ms=>ms*10000+621355968000000000;
 const list=[
  {Name:'Carnaval',StartTime:tick(now-2*H),EndTime:tick(now+2*H)},
  {name:'Futuro',startTime:tick(now+2*D),endTime:tick(now+3*D)},
  {Name:'Pasado',StartTime:tick(now-9*D),EndTime:tick(now-8*D)},
  {Name:'Lejano',StartTime:tick(now+20*D),EndTime:tick(now+21*D)},
  {Name:'Roto',StartTime:'x',EndTime:null},
 ];
 const out=parseFestivities(list,now);
 assert.deepEqual(out.map(e=>[e.name,e.active]),[['Carnaval',true],['Futuro',false]]);
 assert.deepEqual(parseFestivities({events:list},now).length,2);
 assert.deepEqual(parseFestivities('nada',now),[]);
 assert.equal(ticksToMs(621355968000000000+10000000*60),60000);
 assert.equal(ticksToMs(5),null);
});
test('la app consulta horas y eventos sin bloquear el plan, y el proxy permite time-scale=1',()=>{
 const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
 for(const t of ['historyHourly(ids,prefs.region,false)','void loadSellHours(plan.rows);','sellHoursHtml(rows)','Mejores horas para vender','gameEventsLine()'])assert(app.includes(t),t);
 assert.equal(app.split('void loadSellHours(plan.rows);').length,3,'Black Craft y Royal Craft lanzan la señal');
 const proxy=readFileSync(new URL('../netlify/functions/market.mjs',import.meta.url),'utf8');
 assert(proxy.includes("['1','6','24'].includes(ts)"));
 assert(readFileSync(new URL('../sw.js',import.meta.url),'utf8').includes('./core/sell-hours.js'));
 const data=readFileSync(new URL('../core/data.js',import.meta.url),'utf8');
 assert(data.includes("'time-scale':'1'")&&data.includes('festivities'));
});
