import {plannedRefining} from './refining-integration.js';
// Itinerario operativo sin inventar rutas físicas, distancias o tiempos.
export function planLogistics(plan){const buys=new Map(),crafts=new Map(),sells=new Map();
 for(const m of plan?.materials||[]){const city=m.city||'Sin especificar',list=buys.get(city)||[];
  list.push({id:m.id,qty:Math.ceil(m.qtyGross),budget:Math.ceil(m.qtyGross)*(m.unitPrice||0)});buys.set(city,list);}
 for(const r of plan?.rows||[]){const city=r.craftCity||'Sin especificar',list=crafts.get(city)||[];
  list.push({id:r.id,qty:r.qty,products:r.qty*(r.craftAmount||1)});crafts.set(city,list);
  const to=r.city==='Black Market'?'Caerleon · Mercado Negro':r.city;
  const sold=sells.get(to)||[];sold.push({id:r.id,qty:r.qty*(r.craftAmount||1),mode:r.mode});sells.set(to,sold);
 }
 const steps=[];for(const [city,items] of buys)steps.push({stage:'Comprar materiales',city,items,units:items.reduce((a,x)=>a+x.qty,0),cost:items.reduce((a,x)=>a+x.budget,0)});
 for(const [city,items] of [...new Map(plannedRefining(plan?.rows).reduce((m,r)=>{const arr=m.get(r.city)||[];arr.push({id:r.id,qty:r.crafts,budget:r.stationFee+r.transferFee});m.set(r.city,arr);return m;},new Map()))])steps.push({stage:'Refinar materiales',city,items,units:items.reduce((a,x)=>a+x.qty,0),cost:items.reduce((a,x)=>a+x.budget,0)});
 for(const [city,items] of crafts)steps.push({stage:'Fabricar',city,items,units:items.reduce((a,x)=>a+x.qty,0),cost:0});
 for(const [city,items] of sells)steps.push({stage:'Vender',city,items,units:items.reduce((a,x)=>a+x.qty,0),cost:0});
 return {steps,cities:[...new Set(steps.map(s=>s.city))],transportEstimated:(plan?.rows||[]).reduce((a,x)=>a+x.qty*(x.transportCost||0),0),note:'Plan por ciudades. La ruta exacta, distancia, tiempo y seguridad requieren información adicional y no se suponen.'};
}
