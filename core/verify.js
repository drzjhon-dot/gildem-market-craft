// Revalidación puntual con cotizaciones RECONSULTADAS (sin reutilizar caché),
// conserva fecha y distingue margen potencial de ejecución asegurada.
import {rowMap,quote} from './engine.js';
import {qualityWeightedSale} from './optimizer.js';
import {enrichWithDepth} from './depth.js';
import {rebuildPlan} from './plan.js';
const finite=x=>Number.isFinite(Number(x))?Number(x):0;
export function verifyPlannedPrices(rows,priceRows,{budget,focusLimit=null,maxAgeHours=24,materialShipping=0,book=new Map()}={}){
 const map=rowMap(priceRows),blockers=[],updates=[],now=Date.now();
 for(const r of rows||[]){
  let materials=[],netMaterials=0,grossMaterials=0,stale=false;
  for(const m of r.materials||[]){
   const side=r.buyMode==='order'?'buy_price_max':'sell_price_min';
   const netUse=m.count*(m.ret===false?1:1-finite(r.returnRate)/100);
   if(m.refining){
    // Recotiza los materiales RAW y el refinado previo, no un supuesto precio
    // de venta del resultado que el usuario está produciendo internamente.
    const ref=m.refining,inputs=[];let grossInputs=0,failed=false;
    for(const x of ref.inputs){
     const q=quote(map,x.id,x.city,side,maxAgeHours);
     if(!q){blockers.push(`${r.id}: falta precio reciente para refinar ${m.id} (${x.id}, ${x.city})`);failed=true;break;}
     const shipping=x.city!==ref.city?materialShipping:0;
     const unitPrice=q.price*(1+(r.buyMode==='order'?finite(r.buySetup):0))+shipping;
     inputs.push({...x,unitPrice,originalPrice:q.price,at:q.at});grossInputs+=x.count*unitPrice;
    }
    if(failed){stale=true;break;}
    const fee=finite(ref.stationFee),transfer=finite(ref.transferFee);
    const netRefined=grossInputs*(1-finite(ref.rrr)/100)+fee+transfer;
    const upfront=grossInputs+fee+transfer;
    const updated={...m,used:netUse,unitPrice:netRefined,upfrontUnitPrice:upfront,
     refining:{...ref,inputs,netCost:netRefined,upfrontCost:upfront},
     at:Math.min(...inputs.map(x=>x.at)),cost:netUse*netRefined};
    materials.push(updated);netMaterials+=updated.cost;grossMaterials+=m.count*upfront;
    continue;
   }
   const q=quote(map,m.id,m.city,side,maxAgeHours);
   if(!q){blockers.push(`${r.id}: falta precio reciente de ${m.id} en ${m.city}`);stale=true;break;}
   const shipping=r.recipeKind==='refining'?(Number(m.shippingPerUnit)||0):(m.city!==r.craftCity?materialShipping:0);
   const effective=q.price*(1+(r.buyMode==='order'?finite(r.buySetup):0))+shipping;
   const updated={...m,unitPrice:effective,used:netUse,at:q.at,returned:m.count-netUse,cost:netUse*effective};
   materials.push(updated);netMaterials+=updated.cost;grossMaterials+=updated.count*effective;
  }
  if(stale)continue;
  const saleSide=r.city==='Black Market'?'buy_price_max':(r.mode==='instant'?'buy_price_max':'sell_price_min');
  let sale=quote(map,r.id,r.city,saleSide,maxAgeHours);
  if(r.qualityMode==='mix'){
   const values={};for(let k=1;k<=5;k++)values[k]=quote(map,r.id,r.city,saleSide,maxAgeHours,k);
   const weighted=qualityWeightedSale(values,r.qualityWeights);
   sale=weighted?{...weighted,ageHours:(now-weighted.at)/3600000}:null;
  }
  if(!sale){blockers.push(`${r.id}: falta precio reciente de venta en ${r.city}`);continue;}
  let journalBonus=0,journal=r.journal?{...r.journal}:null;
  if(journal?.ratio>0){
   const empty=quote(map,journal.empty,journal.buyCity,'sell_price_min',maxAgeHours);
   const full=journal.sellCity?quote(map,journal.full,journal.sellCity,'buy_price_max',maxAgeHours):null;
   if(journal.prices&&(!empty||!full)){
    blockers.push(`${r.id}: no se verificaron precios de sus diarios`);continue;
   }
   if(journal.prices){journal.price=empty.price;journal.fullPrice=full.price;}
   journalBonus=((journal.fullPrice||0)*(1-(journal.fullTaxRate||0)/100)-(journal.price||0))*journal.ratio;
  }
  const taxes=finite(r.taxRate),setup=finite(r.setupRate),transport=finite(r.transportCost),station=finite(r.stationCost);
  const amount=Math.max(1,finite(r.craftAmount)||1);
  const netSale=sale.price*amount*(1-taxes-setup);
  const risk=(netMaterials+station)*finite(r.transportRiskPct)/100;
  const profit=netSale-netMaterials-station-transport+journalBonus-risk;
  const capitalPerUnit=grossMaterials+station+transport+(journal?.ratio||0)*(journal?.price||0);
  const newer={...r,materials,sell:sale.price,at:sale.at,ageHours:sale.ageHours,profit,rawMaterials:grossMaterials,cost:netMaterials+station+transport+risk,
   capitalPerUnit,journal,journalBonus,expectedRiskCost:risk,roi:profit/Math.max(1,netMaterials+station+transport+risk)*100};
  const levels=book.get(r.id+'|'+r.city);
  const final=levels?enrichWithDepth(newer,levels):newer;
  if(r.depthVerified&&r.mode==='instant'&&!levels){blockers.push(`${r.id}: profundidad de órdenes no confirmada en ${r.city}`);}
  if(levels&&final.marketCapacity<r.qty){blockers.push(`${r.id}: solo ${final.marketCapacity} crafts con órdenes rentables observadas en ${r.city}`);}
  if(profit<=0)blockers.push(`${r.id}: el margen cayó a ${Math.round(profit)} silver por craft en ${r.city}`);
  updates.push({previous:r,new:final,priceChangePercent:r.sell>0?100*(sale.price-r.sell)/r.sell:null,latestQuote:new Date(sale.at).toISOString()});
 }
 if(updates.length!==(rows||[]).length)blockers.push('Una o más rutas no tienen datos completos');
 const report=updates.length===(rows||[]).length?rebuildPlan(updates.map(u=>({...u.new,qty:u.previous.qty,maxCrafts:Number.isFinite(u.new.marketCapacity)?u.new.marketCapacity:u.previous.maxCrafts})),budget,focusLimit):null;
 if(report&&!report.ok)blockers.push(report.reason);
 return {at:new Date(now).toISOString(),ok:blockers.length===0&&!!report?.ok,blockers,updates,plan:report?.ok?report:null,
  previousTotal:(rows||[]).reduce((s,r)=>s+finite(r.totalProfit),0),newTotal:report?.ok?report.totalProfit:null,
  previousCapital:(rows||[]).reduce((s,r)=>s+finite(r.allocation),0),newCapital:report?.ok?report.totalCost:null};
}
export function breakEvenPrice(route){
 const factor=1-finite(route.taxRate)-finite(route.setupRate);
 if(factor<=0)return null;
 const effectiveCost=finite(route.cost)-finite(route.journalBonus);
 return Math.max(0,effectiveCost/(factor*Math.max(1,finite(route.craftAmount)||1)));
}
