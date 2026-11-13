// Cálculo de inversiones y ventas realmente registradas. Los datos se guardan
// localmente, no se envían ni sincronizan sin consentimiento.
const finite=x=>Number.isFinite(Number(x))?Number(x):0;
export function createPortfolioFromPlan(plan, title='Plan de crafting'){
 if(!plan?.rows?.length)throw Error('El plan está vacío');
 const when=new Date().toISOString();
 return {id:`p-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,title,createdAt:when,closed:false,
  lots:plan.rows.map((r,i)=>({lotId:`lot-${i}`,id:r.id,itemName:r.itemName||r.id,market:r.city,craftCity:r.craftCity,qty:Math.max(0,Math.trunc(r.qty))*Math.max(1,Math.trunc(r.craftAmount||1)),craftAmount:Math.max(1,Math.trunc(r.craftAmount||1)),
   unitCost:Math.max(0,finite(r.cost))/Math.max(1,Math.trunc(r.craftAmount||1)),costSource:'estimado',capitalPerUnit:Math.max(0,finite(r.capitalPerUnit))/Math.max(1,Math.trunc(r.craftAmount||1)),expectedPrice:finite(r.sell),expectedProfit:finite(r.profit)/Math.max(1,Math.trunc(r.craftAmount||1)),
   feesRate:finite(r.taxRate)||.04,setupRate:finite(r.setupRate)||0,freightPerUnit:(finite(r.transportCost)||0)/Math.max(1,Math.trunc(r.craftAmount||1)),sales:[]}))};
}
export function summarizePortfolio(p){let spent=0,qty=0,sold=0,netRevenue=0,realizedCost=0,netProfit=0,unrealizedEst=0,upfront=0;
 for(const lot of p?.lots||[]){const n=finite(lot.qty);qty+=n;spent+=n*finite(lot.unitCost);upfront+=n*finite(lot.capitalPerUnit);
  const sells=(lot.sales||[]).reduce((a,s)=>a+finite(s.qty),0);sold+=sells;
  for(const s of lot.sales||[]){let revenue=finite(s.qty)*finite(s.price);let fees=finite(s.fees);let logistics=finite(s.transport);
   netRevenue+=revenue-fees-logistics;realizedCost+=finite(s.qty)*finite(lot.unitCost);
  }
  unrealizedEst+=(n-sells)*finite(lot.expectedProfit);
 }
 netProfit=netRevenue-realizedCost;
 return {upfront,spent,qty,sold,unsold:qty-sold,netRevenue,realizedCost,realizedProfit:netProfit,unrealizedEst,progress:qty?sold/qty:0};
}
export function recordSale(portfolio,lotId,{qty,price,fees,transport=0,at=new Date().toISOString()}={}){
 const p=structuredClone(portfolio),lot=p.lots.find(x=>x.lotId===lotId);
 if(!lot)throw Error('No se encontró ese lote');
 const n=Number(qty),sell=Number(price),fee=Number(fees),shipping=Number(transport);
 const used=(lot.sales||[]).reduce((a,s)=>a+Number(s.qty),0);
 if(!Number.isSafeInteger(n)||n<1||n>lot.qty-used)throw Error('La cantidad supera las unidades pendientes');
 if(!(sell>0)||fee<0||shipping<0||![sell,fee,shipping].every(Number.isFinite))throw Error('Precio o gastos inválidos');
 lot.sales.push({qty:n,price:sell,fees:fee,transport:shipping,at});
 return p;
}
export function setLotCost(portfolio,lotId,cost){const p=structuredClone(portfolio);const l=p.lots.find(x=>x.lotId===lotId);if(!l)throw Error('Lote inexistente');if(!Number.isFinite(Number(cost))||Number(cost)<0)throw Error('Costo inválido');l.unitCost=Number(cost);l.costSource='real introducido';return p;}
export function overallDashboard(portfolios){const summ=(portfolios||[]).map(summarizePortfolio);return summ.reduce((a,b)=>{for(const k of ['upfront','spent','qty','sold','unsold','netRevenue','realizedCost','realizedProfit','unrealizedEst'])a[k]+=b[k];return a;},{upfront:0,spent:0,qty:0,sold:0,unsold:0,netRevenue:0,realizedCost:0,realizedProfit:0,unrealizedEst:0});}
