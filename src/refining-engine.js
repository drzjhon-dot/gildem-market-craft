// REFINAMIENTO INTELIGENTE · Motor 3.0
// Planifica refinado completo: dónde comprar (con transmutación si sale más barata), refinado en cadena
// opcional desde tiers inferiores, Focus, capacidad de montura, coste por salto entre ciudades,
// reparto de la venta en varias ciudades (divisiones) y aviso de plan arriesgado.
import {freshestQuotes,HOUR} from './market.js';
import {REFINING_TYPES} from './refining.js';
import {REFINE_RECIPES,TRANSMUTE,WEIGHT} from './refining-data.js';
import {returnRate,focusCostFactor} from './planner.js';
import {optimize} from './optimizer.js';
import {PRIORITIES,CAPTURE,IMPACT,SELL_RATE,saleGross,confidenceOf} from './engine-v3.js';
import {demandSignals} from './demand-signals.js';

export const REFINE_TYPES=REFINING_TYPES.filter(t=>t.key!=='STONEBLOCK');
export const ROYAL_RING=Object.freeze(['Fort Sterling','Thetford','Martlock','Bridgewatch','Lymhurst']);
/** Saltos aproximados entre ciudades (anillo de ciudades Royal; Caerleon en el centro). */
export function hops(a,b){if(a===b)return 0;if(a==='Caerleon'||b==='Caerleon')return 1;
 const i=ROYAL_RING.indexOf(a),j=ROYAL_RING.indexOf(b);if(i<0||j<0)return 2;const d=Math.abs(i-j);return Math.min(d,5-d);}
export const REFINE_DEFAULTS=Object.freeze({type:'CLOTH',tiers:[4,5,6],enchants:[0,1,2],budget:10_000_000,priority:'fast-buy',style:'balanced',
 saleDays:7,premium:true,tax:4,listingFee:2.5,focus:false,focusAvailable:30000,focusBonus:59,focusEfficiency:0,dailyBonus:0,
 refineCity:null,buyCities:['Bridgewatch','Fort Sterling','Lymhurst','Martlock','Thetford'],sellCities:['Bridgewatch','Fort Sterling','Lymhurst','Martlock','Thetford'],
 mountKg:0,trips:1,hopPct:2,divisions:'auto',transmute:true,chain:true,maxQuoteHours:48,historyPriceCapPct:10,minRoiPct:3,useBudget:false});
const num=x=>Number.isFinite(Number(x))?Number(x):0;
const parse=id=>{const m=/^T([2-8])_([A-Z]+?)(?:_LEVEL([1-4])@\3)?$/.exec(id);return m?{tier:+m[1],kind:m[2],ench:+(m[3]||0)}:null;};
export function refineSettings(cfg={}){
 const c={...REFINE_DEFAULTS,...cfg};const type=REFINE_TYPES.find(t=>t.key===c.type);
 if(!type)throw Error('Elige un recurso para refinar.');
 if(!Array.isArray(c.tiers)||!c.tiers.length||c.tiers.some(t=>![4,5,6,7,8].includes(Number(t))))throw Error('Selecciona al menos un tier (T4–T8).');
 if(!Array.isArray(c.enchants)||!c.enchants.length||c.enchants.some(e=>![0,1,2,3,4].includes(Number(e))))throw Error('Selecciona al menos un encantamiento.');
 if(!(num(c.budget)>=1000))throw Error('Presupuesto mínimo: 1.000 silver.');
 if(!c.buyCities?.length)throw Error('Elige al menos una ciudad de compra.');
 if(!c.sellCities?.length)throw Error('Elige al menos una ciudad de venta.');
 if(!PRIORITIES[c.priority])c.priority='fast-buy';
 if(!['prudent','balanced','dynamic'].includes(c.style))c.style='balanced';
 if(c.divisions!=='auto'&&!(Number(c.divisions)>=1&&Number(c.divisions)<=5))c.divisions='auto';
 if(c.focus&&!(num(c.focusAvailable)>0))throw Error('Con Focus activado indica tu Focus disponible.');
 c.refineCity=c.refineCity||type.city;c.typeInfo=type;
 return c;
}
/** IDs que hay que cotizar: productos, cadena inferior, crudos y orígenes de transmutación. */
export function refiningIds(cfg){const c=refineSettings(cfg),out=new Set();
 const visit=id=>{if(out.has(id))return;out.add(id);const r=REFINE_RECIPES[id];if(r)for(const [m] of r.m)visit(m);
  if(c.transmute)for(const [,...src] of TRANSMUTE[id]||[])for(const [s] of src)visit(s);};
 for(const id of productIds(c))visit(id);return [...out];}
export function productIds(c){const t=c.typeInfo||REFINE_TYPES.find(x=>x.key===c.type),out=[];
 for(const tier of c.tiers)for(const e of c.enchants){const id=`T${tier}_${t.key}${e?`_LEVEL${e}@${e}`:''}`;if(REFINE_RECIPES[id])out.push(id);}return out;}

function priceIndex(quotes,c,now){
 const buyMode=PRIORITIES[c.priority].buy,fee=1+num(c.listingFee)/100,hop=num(c.hopPct)/100;
 /** Mejor compra de un artículo entregado en la ciudad de refinado. */
 const buy=new Map();
 return function best(id){if(buy.has(id))return buy.get(id);let b=null;
  for(const city of c.buyCities){const ask=freshestQuotes(quotes,id,city,'ask',c.maxQuoteHours,now)[0];
   const bid=buyMode==='order'?freshestQuotes(quotes,id,city,'bid',c.maxQuoteHours,now)[0]:null;
   const opts=[...(ask?[{price:ask.price,mode:'instant',time:ask.time}]:[]),...(bid?[{price:Math.ceil(bid.price+1)*fee,mode:'order',time:bid.time}]:[])];
   for(const o of opts){const h=hops(city,c.refineCity),landed=o.price*(1+h*hop);
    if(!b||landed<b.landed)b={id,city,unit:o.price,landed,hops:h,mode:o.mode,time:o.time};}}
  buy.set(id,b);return b;};
}
/**
 * Lista de materiales por unidad de producto (neta del retorno), con transmutación y cadena opcionales.
 * Devuelve {cost, buys:Map(key→{id,city,units,unit,landed,mode,hops}), transmute:Map, crafts:Map, focus, kgIn}
 */
function bomFactory(c,best){const memo=new Map();
 const rr=f=>returnRate({bonusCity:true,recipe:{city:c.refineCity===c.typeInfo.city?c.typeInfo.city:null,specialtyBonus:40,dailyEnabled:true},dailyBonus:c.dailyBonus,focus:f,focusBonus:c.focusBonus}).returnPct/100;
 const rates={0:rr(false),1:rr(true)};const fcf=focusCostFactor(c);
 const add=(map,key,obj,units)=>{const o=map.get(key)||{...obj,units:0};o.units+=units;map.set(key,o);};
 const merge=(dst,src,k)=>{for(const [key,v] of src.buys)add(dst.buys,key,v,v.units*k);for(const [key,v] of src.transmute)add(dst.transmute,key,v,v.units*k);
  for(const [key,v] of src.crafts)add(dst.crafts,key,v,v.units*k);dst.focus+=src.focus*k;dst.cost+=src.cost*k;dst.kgIn+=src.kgIn*k;};
 /** Coste de 1 unidad de un crudo (comprado o transmutado). */
 const raw=id=>{const key='raw|'+id;if(memo.has(key))return memo.get(key);
  const b=best(id);let r=b?{cost:b.landed,buys:new Map([[id+'|'+b.city,{id,city:b.city,unit:b.unit,landed:b.landed,mode:b.mode,hops:b.hops,units:1}]]),transmute:new Map(),crafts:new Map(),focus:0,
   kgIn:b.city===c.refineCity?0:num(WEIGHT[id])}:null;
  if(c.transmute)for(const [silver,...src] of TRANSMUTE[id]||[]){let alt={cost:silver,buys:new Map(),transmute:new Map(),crafts:new Map(),focus:0,kgIn:0},ok=true;
   for(const [s,n] of src){const sub=raw(s);if(!sub){ok=false;break;}merge(alt,sub,n);}
   if(!ok)continue;add(alt.transmute,id,{id,from:src.map(x=>x[0]).join(' + '),silver},1);
   if(!r||alt.cost<r.cost*.995)r=alt;}
  memo.set(key,r);return r;};
 /** Coste de 1 unidad de refinado: comprado o (si la cadena está activa) refinado por ti. */
 const refined=(id,f,isProduct=false)=>{const key=id+'|'+f+'|'+isProduct;if(memo.has(key))return memo.get(key);
  let r=null;const b=isProduct?null:best(id);
  if(b)r={cost:b.landed,buys:new Map([[id+'|'+b.city,{id,city:b.city,unit:b.unit,landed:b.landed,mode:b.mode,hops:b.hops,units:1}]]),transmute:new Map(),crafts:new Map(),focus:0,kgIn:b.city===c.refineCity?0:num(WEIGHT[id])};
  const rec=REFINE_RECIPES[id];
  if(rec&&(isProduct||c.chain)){const rate=rates[f?1:0];let own={cost:0,buys:new Map(),transmute:new Map(),crafts:new Map(),focus:f?rec.f*fcf:0,kgIn:0},ok=true;
   for(const [m,n] of rec.m){const v=parse(m),sub=v&&REFINE_TYPES.some(t=>t.key===v.kind)?refined(m,f):raw(m);if(!sub){ok=false;break;}merge(own,sub,n*(1-rate));}
   if(ok){add(own.crafts,id,{id},1);if(!r||own.cost<r.cost*.995)r=own;}}
  memo.set(key,r);return r;};
 return {product:(id,f)=>refined(id,f,true),rates};
}
export function planRefining({quotes=new Map(),history=[],materialHistory=[],config={},now=Date.now()}={}){
 const c=refineSettings(config),best=priceIndex(quotes,c,now),bom=bomFactory(c,best),warnings=[],rejected=[];
 const pr=PRIORITIES[c.priority],capture=CAPTURE[c.style]??.3,tax=num(c.tax)/100,listFee=num(c.listingFee)/100,hop=num(c.hopPct)/100;
 const hist=new Map(history.map(h=>[h.id+'|'+h.city,h]));
 const routes=[],rows=new Map();
 for(const id of productIds(c)){
  const b0=bom.product(id,false);if(!b0){rejected.push({id,reason:'Faltan precios de recursos o del refinado inferior en tus ciudades de compra'});continue;}
  const bF=c.focus?bom.product(id,true):null;const v=parse(id);
  for(const city of c.sellCities){
   const h=hist.get(id+'|'+city);const signals=h?demandSignals(h):null;
   const daily=Math.min(num(h?.quality1DailyUnits),signals?.demandDaily??Infinity);
   if(!(daily>0)){rejected.push({id,city,reason:'Sin ventas Q1 registradas en esta ciudad'});continue;}
   const mode=pr.sell,quote=freshestQuotes(quotes,id,city,mode==='order'?'ask':'bid',c.maxQuoteHours,now)[0];
   const histP=Math.min(num(h.quality1AveragePrice)||Infinity,num(signals?.recentPrice)||Infinity);
   const capP=Number.isFinite(histP)?histP*(1+num(c.historyPriceCapPct)/100):Infinity;
   let price,src;if(quote){price=Math.min(quote.price,capP);src=quote.price>capP?'histórico (cotización inflada)':'cotización actual';}
   else if(mode==='order'&&Number.isFinite(histP)){price=histP*.97;src='histórico Q1';}
   else{rejected.push({id,city,reason:mode==='order'?'Sin precio de venta':'Sin órdenes de compra vigentes'});continue;}
   const h2=hops(c.refineCity,city),fee=mode==='order'?tax+listFee:tax,conf=confidenceOf(h,signals,quote?(now-quote.time)/HOUR:null);
   const H=daily*Number(c.saleDays),maxUnits=Math.floor(H*capture*conf);
   if(maxUnits<1){rejected.push({id,city,reason:'Volumen Q1 demasiado bajo para tu estilo'});continue;}
   const r={id,city,tier:v.tier,ench:v.ench,saleMode:mode,price,priceSource:src,marketQuote:quote?.price??null,horizonUnits:H,impactK:IMPACT[mode],bookBids:null,
    hops:h2,fee,conf,daily,maxUnits,recommended:Math.floor(H*CAPTURE.balanced*conf),bom:b0,bomF:bF,history:h,signals,
    kgOut:h2>0?num(WEIGHT[id]):0};
   const net=(1-fee)*(1-h2*hop);
   const first=saleGross(r,1)*net-Math.min(b0.cost,bF?.cost??Infinity);
   if(!(first>0)){rejected.push({id,city,reason:`Pierde ${Math.round(-first).toLocaleString('es-ES')} silver por unidad (${src})`});continue;}
   r.unitProfit=first;r.net=net;rows.set(id+'|'+city,r);
   const saving=bF?b0.cost-bF.cost:0;
   const matsOf=x=>[...x.buys.values()].map(m=>({key:m.id+'|'+m.city,units:m.units}));
   routes.push({key:id+'|'+city,step:Math.max(1,Math.floor(maxUnits/40)),max:maxUnits,groups:{tier:'T'+v.tier,ench:'.'+v.ench},division:city,
    focusPts:bF&&saving>0?bF.focus:0,focusSavingPerPoint:bF&&bF.focus>0?saving/bF.focus:0,
    mats:f=>matsOf(f&&bF?bF:b0),weightPerUnit:f=>Math.max((f&&bF?bF:b0).kgIn,r.kgOut),
    totals:(q,fq)=>({revenue:saleGross(r,q)*net,cost:(q-fq)*b0.cost+(fq&&bF?fq*bF.cost:0),fame:0,cushion:0}),row:r});
  }
 }
 const ledger=new Map(),mh=new Map(materialHistory.map(h=>[h.id+'|'+h.city,h]));
 for(const r of rows.values())for(const x of [r.bom,r.bomF].filter(Boolean))for(const m of x.buys.values())ledger.set(m.id+'|'+m.city,{daily:num(mh.get(m.id+'|'+m.city)?.averageDailyUnits),price:m.landed});
 const res=optimize({routes,budget:num(c.budget),ledger,goal:'silver',minMarginalRoi:c.useBudget?0:num(c.minRoiPct)/100,
  focusCap:c.focus?num(c.focusAvailable):0,weightCap:num(c.mountKg)>0?num(c.mountKg)*Math.max(1,num(c.trips)):0,
  maxDivisions:c.divisions==='auto'?0:Number(c.divisions)});
 const sales=[],buys=new Map(),trans=new Map(),crafts=new Map();let capital=0,revenue=0,cost=0,units=0,focus=0,kg=0,recommendedUnits=0,recommendedProfit=0;
 for(const ch of res.chosen){const r=ch.route.row,t=ch.route.totals(ch.q,ch.fq),slip=ch.slip,profit=t.revenue-t.cost-slip;
  const avg=saleGross(r,ch.q)/ch.q;
  sales.push({id:r.id,city:r.city,tier:r.tier,ench:r.ench,units:ch.q,focusUnits:ch.fq,listPrice:r.price,avgPrice:avg,priceSource:r.priceSource,saleMode:r.saleMode,hops:r.hops,
   revenue:t.revenue,cost:t.cost+slip,profit,capital:ch.cap,daysToSell:r.saleMode==='order'?ch.q/Math.max(1e-9,r.daily*SELL_RATE*r.conf):0,
   share:ch.q/Math.max(1e-9,r.horizonUnits)*100,recommended:r.recommended,risky:ch.q>Math.max(1,r.recommended),confidence:r.conf,signals:r.signals});
  capital+=ch.cap;revenue+=t.revenue;cost+=t.cost+slip;units+=ch.q;
  const rec=Math.min(ch.q,Math.max(1,r.recommended));recommendedUnits+=rec;recommendedProfit+=profit*rec/ch.q;
  for(const [x,n] of [[r.bom,ch.q-ch.fq],[r.bomF,ch.fq]]){if(!x||!(n>0))continue;focus+=x.focus*n;
   for(const m of x.buys.values()){const o=buys.get(m.id+'|'+m.city)||{...m,units:0};o.units+=m.units*n;buys.set(m.id+'|'+m.city,o);}
   for(const m of x.transmute.values()){const o=trans.get(m.id)||{...m,units:0};o.units+=m.units*n;trans.set(m.id,o);}
   for(const m of x.crafts.values()){const o=crafts.get(m.id)||{id:m.id,units:0,focusUnits:0};o.units+=m.units*n;if(x===r.bomF)o.focusUnits+=m.units*n;crafts.set(m.id,o);}}
 }
 for(const s of sales)kg+=s.hops>0?s.units*num(WEIGHT[s.id]):0;
 // Retorno: comprando solo lo neto hay que reutilizar lo devuelto; se añade el retorno de un lote como margen.
 const purchases=[...buys.values()].map(b=>{const u=Math.ceil(b.units*(1+.02)-1e-9);return {...b,buy:u,total:u*b.landed,kg:u*num(WEIGHT[b.id])};}).sort((a,b)=>b.total-a.total);
 const kgIn=purchases.filter(p=>p.city!==c.refineCity).reduce((s,p)=>s+p.kg,0);
 const steps=[...crafts.values()].map(x=>({...x,units:Math.ceil(x.units-1e-9)})).sort((a,b)=>parse(a.id).tier-parse(b.id).tier);
 const transmutations=[...trans.values()].map(x=>({...x,units:Math.ceil(x.units-1e-9),totalSilver:Math.ceil(x.units)*x.silver}));
 const profit=revenue-cost,riskyUnits=sales.filter(s=>s.risky).reduce((a,s)=>a+s.units,0);
 const verdict=!sales.length?'empty':riskyUnits>units*.3?'risky':'ok';
 if(verdict==='risky')warnings.push(`Plan arriesgado: vendes ${units.toLocaleString('es-ES')} unidades; lo recomendado (30 % del volumen Q1 de cada ciudad) son ${recommendedUnits.toLocaleString('es-ES')}. Puede tardar más o bajar el precio.`);
 if(c.mountKg>0&&res.weightLeft!==null&&res.weightLeft<num(c.mountKg)*Math.max(1,num(c.trips))*.02)warnings.push('La capacidad de tu montura limita el plan: más viajes o más kg permitirían comprar más.');
 if(purchases.some(p=>p.city==='Caerleon'))warnings.push('Hay compras en Caerleon: ruta de zona roja.');
 const bookAge=purchases.length?Math.max(...purchases.map(p=>(now-p.time)/HOUR)):0;
 if(bookAge>12)warnings.push(`Algunos precios de compra tienen ${Math.round(bookAge)} h: verifica antes de comprar.`);
 return {engine:'refining-v3',config:c,verdict,sales:sales.sort((a,b)=>b.profit-a.profit),purchases,transmutations,steps,rejected,warnings,
  summary:{capital,revenue,cost,profit,roi:capital?profit/capital*100:0,units,focus,kgIn,kgOut:kg,divisions:res.divisions,budget:num(c.budget),
   remaining:num(c.budget)-capital,recommendedUnits,recommendedProfit,returnPct:bom.rates[0]*100,returnPctFocus:bom.rates[1]*100,refineCity:c.refineCity,
   transmuteSilver:transmutations.reduce((s,x)=>s+x.totalSilver,0)}};
}
