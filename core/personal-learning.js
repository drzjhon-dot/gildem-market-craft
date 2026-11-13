// Medición de resultados del usuario, no modelo ficticio de ventas del juego.
// Solo se usan ventas introducidas manualmente de carteras marcadas como iniciadas.
const finite=v=>Number.isFinite(Number(v))?Number(v):0;
const clamp=(x,min,max)=>Math.min(max,Math.max(min,x));
export function learnFromSales(portfolios){const map=new Map();
 for(const p of portfolios||[]){if(p?.started!==true)continue;
  const start=Date.parse(p.startedAt||p.createdAt||'');
  for(const lot of p.lots||[]){const key=lot.id+'|'+lot.market;
   for(const sale of lot.sales||[]){const qty=Math.max(0,Math.trunc(finite(sale.qty))),at=Date.parse(sale.at||'');
    if(qty<1||!Number.isFinite(at)||!Number.isFinite(start)||at<start)continue;
    const holdDays=Math.max(0,(at-start)/86400000);
    const realized=qty*(finite(sale.price)-finite(lot.unitCost))-finite(sale.fees)-finite(sale.transport);
    const estimated=qty*finite(lot.expectedProfit);
    const prev=map.get(key)||{id:lot.id,market:lot.market,qtySold:0,sales:0,realizedProfit:0,estimatedProfit:0,weightedHoldDays:0};
    prev.qtySold+=qty;prev.sales++;prev.realizedProfit+=realized;prev.estimatedProfit+=estimated;prev.weightedHoldDays+=qty*holdDays;
    map.set(key,prev);
   }
  }
 }
 for(const val of map.values()){
  val.averageDays=val.weightedHoldDays/Math.max(1,val.qtySold);
  val.profitPerUnit=val.realizedProfit/Math.max(1,val.qtySold);
  val.realizedProfitPerHoldingDay=val.realizedProfit/Math.max(1,val.averageDays);
  // Con pocos registros el ajuste es neutro. Incluso con muchos, la influencia
  // queda acotada: tu precio pasado no promete el precio de mañana.
  const ratio=val.estimatedProfit>0?val.realizedProfit/val.estimatedProfit:1;
  val.adjustment=val.qtySold>=3?clamp(.90+.10*ratio,.75,1.12):1;
 }
 return map;
}
