// Flips al Mercado Negro (v4.1) · lógica sin interfaz.
// Compra en Caerleon (mismo sitio que el Mercado Negro: sin transporte) o, si lo activas, en ciudades Royal
// (hay que llevarlo a Caerleon: riesgo + coste de transporte). Vende al instante a la orden de compra del MN.
const num=x=>Number.isFinite(Number(x))?Number(x):0;
export const FLIP_DEFAULTS=Object.freeze({buyCities:['Caerleon'],tax:4,setupFee:2.5,maxAgeHours:6,transportPct:3,saleDays:1,sharePct:10,minMarginPct:8,minProfit:3000});

/**
 * @param ids objetos a revisar · quotes = quoteMap (calidad 1) · demand = Map(id → ventas/día al MN)
 * Devuelve dos formas de comprar: al instante (orden de venta más barata) y con orden de compra (más lento).
 */
export function blackMarketFlips({ids=[],quotes,demand=new Map(),config={},now=Date.now()}){
 const c={...FLIP_DEFAULTS,...config},fresh=x=>x?.price>0&&now-x.time<=c.maxAgeHours*3600e3;
 const rows=[],skipped={noBid:0,noAsk:0,noMargin:0};
 for(const id of ids){
  const bid=quotes?.get?.(id+'|Black Market')?.bid;if(!fresh(bid)){skipped.noBid++;continue;}
  const net=bid.price*(1-c.tax/100);let best=null,anyAsk=false;
  for(const city of c.buyCities){const q=quotes?.get?.(id+'|'+city);
   const freight=city==='Caerleon'?0:c.transportPct/100;
   if(fresh(q?.ask)){anyAsk=true;const cost=q.ask.price*(1+freight),profit=net-cost;
    if(!best||profit>best.profit)best={id,city,mode:'instant',buy:q.ask.price,buyAgeH:(now-q.ask.time)/3600e3,cost,profit,margin:profit/cost};}
   if(fresh(q?.bid)){const price=q.bid.price+1,cost=price*(1+c.setupFee/100)*(1+freight),profit=net-cost;
    const alt={city,buy:price,cost,profit,margin:profit/cost};
    if(best&&best.city===city)best.order=alt;else if(!best)best={id,city,mode:'order',buy:price,buyAgeH:(now-q.bid.time)/3600e3,cost,profit,margin:profit/cost,order:alt};}}
  if(!best){skipped[anyAsk?'noMargin':'noAsk']++;continue;}
  if(best.margin*100<c.minMarginPct||best.profit<c.minProfit){skipped.noMargin++;continue;}
  const daily=num(demand.get?.(id)),units=Math.max(daily>=1?1:0,Math.floor(daily*c.saleDays*c.sharePct/100));
  rows.push({...best,sell:bid.price,sellAgeH:(now-bid.time)/3600e3,net,daily,units,totalProfit:units*best.profit,capital:units*best.cost,risky:best.city!=='Caerleon'});
 }
 rows.sort((a,b)=>b.totalProfit-a.totalProfit||b.profit-a.profit);
 return {rows,skipped,config:c};
}
