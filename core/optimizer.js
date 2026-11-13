import {routeProfitAtQuantity} from './depth.js';
// Modelos puros de riesgo, datos históricos y asignación de capital.
// AODP registra órdenes observadas; sus item_count NO comprueban ventas ejecutadas.
const day=86400000;
export function toEpoch(value){
 if(typeof value==='number'){
   if(value>6.2e17)return (value-621355968000000000)/10000; // ticks .NET -> ms
   if(value>1e12)return value;
   if(value>1e9)return value*1000;
 }
 if(typeof value==='string'&&/^\d+$/.test(value))return toEpoch(Number(value));
 return Date.parse(value||'');
}
export function historyMetrics(data,days=14,now=Date.now()){
 const today=Math.floor(now/day)*day;
 const start=today-days*day;
 const observations=(data||[]).map(x=>({...x,t:toEpoch(x.timestamp)})).filter(x=>Number.isFinite(x.t)&&x.t>=start&&x.t<today&&Number(x.item_count)>=0);
 const byDay=new Map();let count=0,turnover=0;
 for(const p of observations){let k=Math.floor(p.t/day);let old=byDay.get(k)||{count:0,prices:[]};let n=Math.max(0,Number(p.item_count)||0);old.count+=n;
 const avg=Number(p.avg_price);if(n>0&&avg>0){old.prices.push(avg);turnover+=n*avg;}byDay.set(k,old);count+=n;}
 const dayCounts=[...byDay.values()].map(x=>x.count);
 const prices=[...byDay.values()].flatMap(x=>x.prices);
 const mean=prices.length?prices.reduce((a,b)=>a+b,0)/prices.length:null;
 const stdev=prices.length>1?Math.sqrt(prices.reduce((a,b)=>a+(b-mean)**2,0)/prices.length):null;
 // A single abnormal quote can distort an arithmetic average.  First reduce
 // multiple observations within the SAME UTC day to one median, then use the
 // median of those days. This is NOT a claim of executed sale prices.
 const median=values=>{const a=[...values].sort((x,y)=>x-y);return a.length?a.length%2?a[(a.length-1)/2]:(a[a.length/2-1]+a[a.length/2])/2:null;};
 const dailyMedians=[...byDay.values()].map(day=>median(day.prices)).filter(x=>x>0);
 const medianPrice=dailyMedians.length>=4?median(dailyMedians):null;
 const absoluteDeviation=medianPrice!==null?median(dailyMedians.map(p=>Math.abs(p-medianPrice))):null;
 const activeDays=[...byDay.values()].filter(row=>row.count>0).length;
 return {days,observations:observations.length,activeDays,coverage:activeDays/days,count,observedDaily:count/days,
  volatility:mean&&stdev!=null?stdev/mean:null,avgPrice:count>0&&turnover>0?turnover/count:mean,
  observedTurnover:turnover,observedSilverDaily:turnover/days,
  medianPrice,priceDays:dailyMedians.length,priceVariation:medianPrice>0?absoluteDeviation/medianPrice:null,
  // This deliberately does not expose "sales per day" or "time to sell".
  isSalesData:false};
}
export function confidenceOf({ageHours=Infinity,activity=null,market='Royal',spread=null,completeness=1,depthVerified=false,listed=false}={}){
 if(!Number.isFinite(ageHours)||ageHours<0)return {score:0,label:'Sin datos',tone:'red',reasons:['Falta fecha válida']};
 let score=100,reasons=[];
 if(ageHours>48){score-=65;reasons.push('Cotización con más de 48 horas');}
 else if(ageHours>24){score-=40;reasons.push('Cotización con más de 24 horas');}
 else if(ageHours>6){score-=22;reasons.push('Cotización con más de 6 horas');}
 else if(ageHours>1){score-=9;}
 if(!activity||activity.observations===0||activity.activeDays===0){score-=36;reasons.push('Sin historial observable');}
 else{if(activity.coverage<.2){score-=27;reasons.push('Pocos días con observaciones');}
 else if(activity.coverage<.5){score-=17;reasons.push('Cobertura histórica parcial');}
 if(activity.volatility!=null&&activity.volatility>.3){score-=20;reasons.push('Precio histórico volátil');}}
 if(spread!=null&&spread>.4){score-=10;reasons.push('Diferencia amplia entre compra y venta');}
 if(completeness<1){score-=Math.round(20*(1-completeness));reasons.push('Calidades o datos incompletos');}
 if(market==='Black Market'&&!depthVerified&&!listed){score=Math.min(score,54);reasons.push('Sin profundidad de órdenes verificable; solo 1 unidad provisional');}
 if(market==='Black Market'&&depthVerified&&!listed){score=Math.min(score+12,95);reasons.push('Niveles de órdenes observados (pueden cambiar)');}
 if(market==='Black Market'&&listed){score=Math.min(score,74);reasons.push('Orden propia BM pendiente de compra; la puja observada NO asegura ejecución');}
 score=Math.max(0,Math.min(100,Math.round(score)));
 return {score,label:score>=75?'Alta':score>=45?'Media':'Baja',tone:score>=75?'green':score>=45?'amber':'red',reasons};
}
export function scenarioProfit({sale,cost,tax=.04,setup=.025,mode='listed',transport=0,materialCost=null,station=0,journal=0,drop=.08,materialsRise=.07}={}){
 const net=sale*(1-tax-(mode==='listed'?setup:0));
 const marketNet=sale*(1-drop)*(1-tax-(mode==='listed'?setup:0));
 const sensitivity=materialCost==null?cost:materialCost;
 const base=net-cost-transport+journal;
 const stressed=marketNet-cost-transport+journal-sensitivity*materialsRise;
 return {base,stressed,delta:stressed-base};
}
export function qualityWeightedSale(quotes,weights){
 if(!Array.isArray(weights)||weights.length!==5||weights.some(x=>!Number.isFinite(x)||x<0))return null;
 const sum=weights.reduce((a,b)=>a+b,0);if(Math.abs(sum-100)>.001)return null;
 let weighted=0,latest=0,oldest=0;
 for(let i=0;i<5;i++){if(weights[i]===0)continue;
  const q=quotes?.[i+1];if(!q||!(q.price>0)||!Number.isFinite(q.at))return null;
  weighted+=q.price*weights[i]/100;latest=Math.max(latest,q.at);oldest=oldest?Math.min(oldest,q.at):q.at;
 }
 return {price:weighted,at:oldest,latest,mode:'weighted',coverage:1};
}
function scoreCandidate(x,goal='balanced'){
 const roi=(x.profit/x.capitalPerUnit);
 const activity=x.activity;
 const q=x.confidence?.score??38;
 const risk=Math.max(.16,q/100);
 // Observations are only a *signal* for activity, not executed purchases.
 const activityFactor=activity?.observations ? .7+Math.min(.3,activity.coverage*.3):.52;
 if(goal==='profit'){const capUnits=activity?.observations?Math.max(1,activity.observedDaily*.1):2;
   const throughput=Math.min(1000000,capUnits*x.capitalPerUnit);
   return roi*risk*activityFactor*(.7+.3*Math.log1p(throughput)/Math.log1p(1e6));}
 if(goal==='roi')return roi*risk*activityFactor;
 if(goal==='focus')return (x.focusGain||0)/Math.max(1,x.focusPerUnit||0)*risk*activityFactor;
 return (roi*.6+Math.log1p(Math.max(0,x.profit))/14*.4)*risk*activityFactor;
}
export function allocateSmartPortfolio(candidates,budget,{goal='balanced',useAll=false,capFraction=.1,unknownCap=2,maxVariants=130,ensureBothMarkets=false,focusLimit=null,minimumConfidence=0,maxPerItemFraction=.3}={}){
 const capital=Number(budget),focusBudget=focusLimit==null?Infinity:Number(focusLimit);
 if(!(capital>0)||!(focusBudget>=0))return {rows:[],totalCost:0,totalProfit:0,remaining:Math.max(0,capital||0),materials:[],cities:[],focusUsed:0,capital};
 const sorted=[...(candidates||[])].filter(x=>x.id&&x.city&&x.profit>0&&x.capitalPerUnit>0&&x.cost>0&&(x.confidence?.score??0)>=minimumConfidence&&(!Number.isFinite(focusBudget)||x.focusPerUnit>0))
  .sort((a,b)=>scoreCandidate(b,goal)-scoreCandidate(a,goal)||b.profit-a.profit);
 let remaining=capital,remainingFocus=focusBudget;
 const chosen=new Map(),spentByItem=new Map();
 function capacity(x){
  const used=chosen.get(x)||0;
  const observed=x.activity?.observations ? x.activity.observedDaily : null;
  const perRoute=Number.isFinite(x.marketCapacity)?x.marketCapacity:(x.city==='Black Market'&&x.mode==='instant'?1:(observed!=null?Math.max(1,Math.floor(Math.max(0,observed)*capFraction)):unknownCap));
  const possible=Math.floor(remaining/x.capitalPerUnit);
  const exposure=useAll?Infinity:Math.floor(Math.max(0,capital*maxPerItemFraction-(spentByItem.get(x.id)||0))/x.capitalPerUnit);
  const focus=Number.isFinite(remainingFocus)?Math.floor(remainingFocus/x.focusPerUnit):Infinity;
  return Math.max(0,Math.min(perRoute-used,possible,exposure,focus));
 }
 function take(x,n=Infinity){if(!chosen.has(x)&&chosen.size>=maxVariants)return 0;const q=Math.min(n,capacity(x));if(q<=0)return 0;
  chosen.set(x,(chosen.get(x)||0)+q);const c=q*x.capitalPerUnit;remaining-=c;
  spentByItem.set(x.id,(spentByItem.get(x.id)||0)+c);if(Number.isFinite(remainingFocus))remainingFocus-=q*x.focusPerUnit;return q;}
 if(ensureBothMarkets&&maxVariants>1){
  let pair=null;
  for(const b of sorted.filter(x=>x.city==='Black Market'))for(const r of sorted.filter(x=>x.city!=='Black Market')){
   if(b.capitalPerUnit+r.capitalPerUnit>capital)continue;
   if(Number.isFinite(focusBudget)&&(b.focusPerUnit+r.focusPerUnit)>focusBudget)continue;
   if(!useAll&&b.id===r.id&&(b.capitalPerUnit+r.capitalPerUnit)>capital*maxPerItemFraction)continue;
   const sc=scoreCandidate(b,goal)+scoreCandidate(r,goal);
   if(!pair||sc>pair.sc)pair={b,r,sc};
  }
  if(pair){take(pair.b,1);take(pair.r,1);}
 }
 for(const c of sorted)take(c);
 const rows=[],matMap=new Map(),cityMap=new Map();let totalProfit=0,totalNetCost=0,focusUsed=0;
 for(const [x,qty] of chosen){
  if(!qty)continue;
  const allocation=qty*x.capitalPerUnit,total=routeProfitAtQuantity(x,qty);
  if(!(total>0))continue;
  rows.push({...x,qty,allocation,totalProfit:total,opportunityScore:scoreCandidate(x,goal),maxCrafts:Number.isFinite(x.marketCapacity)?x.marketCapacity:(x.activity?.observations?Math.max(1,Math.floor(x.activity.observedDaily*capFraction)):unknownCap)});
  totalProfit+=total;totalNetCost+=qty*x.cost;focusUsed+=qty*(x.focusPerUnit||0);
  const c=cityMap.get(x.city)||{city:x.city,qty:0,products:0,profit:0,capital:0};
  c.qty+=qty;c.products++;c.profit+=total;c.capital+=allocation;cityMap.set(x.city,c);
  for(const m of x.materials||[]){const k=m.id+'|'+(m.city||'');const o=matMap.get(k)||{...m,qtyGross:0,qtyNet:0};o.qtyGross+=m.count*qty;o.qtyNet+=m.used*qty;matMap.set(k,o);}
  if(x.journal?.prices&&x.journal.ratio>0){const j=x.journal,k=j.empty+'|'+(j.buyCity||'');const o=matMap.get(k)||{id:j.empty,city:j.buyCity||'—',unitPrice:j.price,count:j.ratio,used:j.ratio,ret:false,qtyGross:0,qtyNet:0};o.qtyGross+=qty*j.ratio;o.qtyNet+=qty*j.ratio;matMap.set(k,o);}
 }
 const materials=[...matMap.values()],journalGap=materials.filter(x=>String(x.id).endsWith('_EMPTY')).reduce((s,x)=>s+(Math.ceil(x.qtyGross)-x.qtyGross)*x.unitPrice,0);
 return {rows,capital,totalCost:capital-remaining,totalNetCost,totalProfit,remaining,materials,cities:[...cityMap.values()].sort((a,b)=>b.profit-a.profit),focusUsed,focusLimit,extraJournalCapital:Math.ceil(journalGap),goal,qualityWarnings:[]};
}
export function focusPerSilver(x){return x?.focusPerUnit>0?(x.focusGain||0)/x.focusPerUnit:null;}
