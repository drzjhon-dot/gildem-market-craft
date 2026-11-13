// Presentación del plan: la producción se agrupa por ID exacto (tier y
// encantamiento incluidos), mientras los destinos siguen siendo rutas distintas.
// No modifica los cálculos, las órdenes, el presupuesto ni las compras.
import {routeProfitAtQuantity} from './depth.js';
import {purchaseComponents} from './refining-integration.js';

export const productionKey = row => `${row.id}|${row.recipeKind || 'equipo'}`;

export function groupProduction(rows = []) {
 const map = new Map();
 for (let index = 0; index < rows.length; index++) {
  const row = rows[index];
  if (!row || !Number.isInteger(row.qty) || row.qty <= 0) continue;
  const key = productionKey(row);
  let group = map.get(key);
  if (!group) {
   group = {key, id:row.id, kind:row.recipeKind || 'equipo', qty:0, units:0, capital:0, profit:0, focus:0, rrrMin:Infinity, rrrMax:-Infinity, craftCities:[], sourceIndices:[], capacity:0};
   map.set(key, group);
  }
  const count = row.qty;
  group.qty += count;
  group.units += count * Math.max(1, Number(row.craftAmount) || 1);
  group.capital += Number(row.allocation) || count * (Number(row.capitalPerUnit) || 0);
  group.profit += Number(row.totalProfit) || 0;
  group.focus += count * (Number(row.focusPerUnit) || 0);
  if (Number.isFinite(Number(row.returnRate))) {
   group.rrrMin = Math.min(group.rrrMin, Number(row.returnRate));
   group.rrrMax = Math.max(group.rrrMax, Number(row.returnRate));
  }
  const city = row.craftCity || 'Sin ciudad';
  const place = group.craftCities.find(x=>x.city===city);
  if (place) place.qty += count;
  else group.craftCities.push({city, qty:count});
  group.sourceIndices.push(index);
  const max = row.maxCrafts;
  group.capacity += Number.isFinite(Number(max)) && max !== null ? Math.max(0,Number(max)) : 999999;
 }
 return [...map.values()];
}

export function groupSales(rows = [], market = 'royal') {
 const groups = new Map();
 for (const row of rows) {
  if (!row || !Number.isInteger(row.qty) || row.qty <= 0) continue;
  if ((row.city==='Black Market'?'black':'royal') !== market) continue;
  const key = `${row.id}|${row.city}|${row.mode || 'listed'}`;
  let g = groups.get(key);
  if (!g) {
   g = {id:row.id, city:row.city, mode:row.mode || 'listed', units:0, profit:0, capital:0, gross:0};
   groups.set(key,g);
  }
  const units = row.qty * Math.max(1,Number(row.craftAmount)||1);
  g.units += units;
  g.profit += Number(row.totalProfit)||0;
  g.capital += Number(row.allocation)||0;
  g.gross += units * (Number(row.sell)||0);
 }
 return [...groups.values()].map(x=>({...x,pricePerUnit:x.units?x.gross/x.units:0}));
}

export function distributeProductionQuantity(rows, key, target) {
 if (!Number.isSafeInteger(target) || target<0) return {ok:false,reason:'Introduce una cantidad entera válida.'};
 const copy = (rows||[]).map(x=>({...x}));
 const matching = copy.filter(x=>productionKey(x)===key);
 if (!matching.length) return {ok:false,reason:'No se encontró el objeto del plan.'};
 const present = matching.reduce((total,x)=>total+x.qty,0);
 let change = target-present;
 if (change < 0) {
  // Reducir primero las rutas con menor beneficio unitario.
  const ordered = [...matching].sort((a,b)=>(a.profit||0)-(b.profit||0));
  for (const row of ordered) {
   const remove = Math.min(row.qty, -change);
   row.qty -= remove;
   change += remove;
   if (change===0) break;
  }
 } else if (change>0) {
  // Conservar el desglose por mercado y aumentar únicamente rutas ya
  // existentes, respetando su capacidad y la profundidad de compra conocida.
  const ordered = [...matching].sort((a,b)=>(b.profit||0)-(a.profit||0));
  for (const row of ordered) {
   const limit = Number.isFinite(Number(row.maxCrafts)) && row.maxCrafts!==null ? Math.floor(row.maxCrafts) : target;
   let low=row.qty, high=Math.min(limit,row.qty+change);
   while (low<high) {
    const middle=Math.ceil((low+high)/2);
    const p=routeProfitAtQuantity(row,middle);
    if (p!==null && p>0) low=middle;
    else high=middle-1;
   }
   const add=Math.max(0,low-row.qty);
   row.qty+=add;change-=add;
   if (change===0) break;
  }
 }
 if (change!==0) return {ok:false,reason:'La cantidad solicitada supera la capacidad rentable observada para ese objeto.'};
 return {ok:true,rows:copy};
}

// Vista logística por ruta real: la lista de fabricación muestra cada item una
// sola vez; aquí permanecen distintos destinos y ciudades de producción.
export function groupLogistics(rows=[]){
 const map=new Map();
 for(const r of rows||[]){
  if(!r||!Number.isInteger(r.qty)||r.qty<=0)continue;
  const key=[r.id,r.craftCity||'Sin ciudad',r.city||'Sin mercado',r.mode||'listed'].join('|');
  let group=map.get(key);
  if(!group){group={key,id:r.id,craftCity:r.craftCity||'Sin ciudad',city:r.city||'Sin mercado',mode:r.mode||'listed',
   qty:0,units:0,profit:0,capital:0,firstBatch:0,staged:false};map.set(key,group);}
  group.qty+=r.qty;
  group.units+=r.qty*Math.max(1,Number(r.craftAmount)||1);
  group.profit+=Number(r.totalProfit)||0;
  group.capital+=Number(r.allocation)||r.qty*(Number(r.capitalPerUnit)||0);
  group.firstBatch+=r.procurementFirstBatch==null?(r.patientSupplyPending?0:r.qty):Math.max(0,Math.min(r.qty,Number(r.procurementFirstBatch)||0));
  group.staged||=!!r.patientSupplyPending;
 }
 return [...map.values()].sort((a,b)=>a.id.localeCompare(b.id)||a.city.localeCompare(b.city));
}

// v9.0.0 · Para qué objetos del plan sirve cada material de la lista de compras.
// Clave «material|ciudad de compra», igual que en plan.materials.
export function materialUsage(rows=[]){
 const map=new Map();
 for(const r of rows||[]){
  if(!r||!Number.isInteger(r.qty)||r.qty<=0)continue;
  for(const m of r.materials||[])for(const p of purchaseComponents(m)){
   const key=p.id+'|'+(p.city||'');
   const set=map.get(key)||new Set();set.add(r.id);map.set(key,set);
  }
 }
 return new Map([...map].map(([k,v])=>[k,[...v].sort()]));
}
