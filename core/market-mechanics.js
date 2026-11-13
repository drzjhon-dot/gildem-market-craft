// Gildem Craft Pro v8.9.0 · Mecánicas reales de mercado (América / West).
// Reglas tomadas de la wiki oficial y de guías que las miden con datos públicos
// (ver INVESTIGACION_MERCADOS.md). Todo lo que aquí es ESTIMACIÓN está marcado.
import {historyMetrics} from './optimizer.js';
const n=x=>Number.isFinite(Number(x))?Math.max(0,Number(x)):0;

// ── 1. Comisiones ───────────────────────────────────────────────────────────
// Igual en ciudades Royal y en el Mercado Negro:
//   vender a una orden de compra (inmediato) → solo impuesto
//   publicar orden de venta y esperar        → impuesto + 2,5 % de publicación
// El impuesto es 4 % con Premium y 8 % sin Premium. La tarifa de publicación se
// cobra al publicar o EDITAR la orden y no se devuelve al cancelar.
export const SALES_TAX=Object.freeze({premium:4,free:8});
export const SETUP_FEE=2.5;
export function saleFees({premium=true,mode='listed',tax=null,setup=null}={}){
 const taxPercent=tax==null?(premium?SALES_TAX.premium:SALES_TAX.free):n(tax);
 const setupPercent=mode==='listed'?(setup==null?SETUP_FEE:n(setup)):0;
 return {taxPercent,setupPercent,totalPercent:taxPercent+setupPercent,netFactor:1-(taxPercent+setupPercent)/100};
}

// ── 2. Calidad y demanda atendible ──────────────────────────────────────────
// Cada calidad es un mercado aparte. Una orden de compra acepta su calidad o una
// SUPERIOR, nunca una inferior. Al craftear sin bonus de calidad sale, de forma
// aproximada, 68,9 % Normal · 25 % Buena · 5 % Notable · 1 % Excelente · 0,1 % Obra
// maestra (valores base del juego; no verificados en esta investigación).
export const CRAFT_QUALITY_SHARE=Object.freeze([.689,.25,.05,.01,.001]);
// Lote máximo N que el mercado absorbe por día:
//   lo Normal solo entra en órdenes Normales →  0,689·N ≤ V1
//   todo el lote cabe en el total             →        N ≤ V1+V2+V3
export function addressableDemand(normalDaily,higher=null,share=CRAFT_QUALITY_SHARE[0]){
 if(normalDaily===null||normalDaily===undefined)return {daily:null,factor:1,byQuality:null};
 const v1=n(normalDaily),v2=n(higher?.[2]),v3=n(higher?.[3]),v4=n(higher?.[4]),v5=n(higher?.[5]);
 if(!(v1>0)||!(v2+v3+v4+v5>0))return {daily:v1,factor:1,byQuality:{1:v1,2:v2,3:v3,4:v4,5:v5}};
 const daily=Math.min(v1/Math.max(.5,share),v1+v2+v3+v4+v5);
 return {daily,factor:daily/v1,byQuality:{1:v1,2:v2,3:v3,4:v4,5:v5}};
}
// Volumen diario (14 días) de las calidades 2 y 3 por «objeto|ciudad».
export function qualityVolumeIndex(rows=[],days=14,now=Date.now()){
 const out=new Map();
 for(const r of rows||[]){
  const q=Number(r?.quality);const city=r?.location||r?.city;
  if(!r?.item_id||!city||![2,3,4,5].includes(q))continue;
  const daily=historyMetrics(Array.isArray(r.data)?r.data:[],days,now).observedDaily;
  const key=r.item_id+'|'+city,entry=out.get(key)||{};
  entry[q]=Math.max(n(entry[q]),n(daily));out.set(key,entry);
 }
 return out;
}

// ── 3. Mercado Negro: precio en sierra ──────────────────────────────────────
// Cada mob muerto puede generar una orden de compra; cuando se acumulan sin
// atender, el NPC sube el precio, y al venderle alguien vuelve a bajar. Por eso la
// puja de un instante NO es el precio de un lote: quien vende varias unidades
// cobra, de media, lo que el Mercado Negro pagó de media. Si la puja actual está
// por encima de la mediana de 14 días, el lote se valora a la mediana.
export function applyBmReversion(route,{minRatio=1.03}={}){
 if(!route||route.city!=='Black Market'||route.mode!=='listed')return null;
 if(route.salePriceProvisional||route.depthVerified||route.bmSpike)return null;
 const median=n(route.activity?.medianPrice),bid=n(route.sell);
 if(!(median>0)||!(bid>median*minRatio))return null;
 const amount=Math.max(1,n(route.craftAmount)||1);
 const net=1-n(route.taxRate)-n(route.setupRate);
 const delta=(bid-median)*amount*Math.max(0,net);
 route.bmSpike={bid,median,ratio:bid/median,spikeProfit:route.profit};
 route.liveBmBid=route.liveBmBid||bid;
 route.sell=median;
 route.profit=Number(route.profit)-delta;
 if(Number.isFinite(Number(route.stressProfit)))route.stressProfit=Number(route.stressProfit)-delta;
 if(n(route.cost)>0)route.roi=route.profit/route.cost*100;
 route.salePriceSource='Mediana 14 d de lo pagado por el Mercado Negro (la puja actual es un pico)';
 return route.bmSpike;
}

// ── 4. Necesidad del mercado ────────────────────────────────────────────────
// Mercado Negro: puja actual / mediana de 14 días. >1 = pedidos acumulados.
// Royal: días de oferta por delante (unidades listadas a nuestro precio o menos
// entre la venta diaria). Sin libro, precio actual frente a la mediana.
// El peso es una preferencia SUAVE de orden, nunca crea beneficio.
export function marketNeed(route){
 if(!route)return null;
 const median=n(route.activity?.medianPrice);
 const daily=n(route.demandDaily??route.activity?.observedDaily);
 if(route.city==='Black Market'){
  const bid=n(route.liveBmBid)||n(route.observedNpcBid)||(route.referenceSide==='buy_price_max'?n(route.sell):0);
  if(!(bid>0&&median>0))return null;
  const ratio=bid/median,pct=Math.round((ratio-1)*100);
  const state=ratio>=1.10?'alta':ratio<=.90?'baja':'normal';
  return {market:'black',state,ratio,daysOfSupply:null,weight:Math.min(1.12,Math.max(.90,1+(ratio-1)*.5)),
   label:state==='alta'?`El Mercado Negro paga ${pct} % sobre su media: pedidos acumulados`
    :state==='baja'?`Paga ${Math.abs(pct)} % bajo su media: recién abastecido, suele recuperarse`
    :'Precio en su media de 14 días'};
 }
 if(route.competition?.known&&daily>0){
  const days=n(route.competition.unitsAhead)/daily;
  const state=days<.5?'alta':days>3?'baja':'normal';
  return {market:'royal',state,ratio:null,daysOfSupply:days,
   weight:days<.5?1.08:days<1.5?1.03:days>5?.90:days>3?.95:1,
   label:state==='alta'?'Poca oferta por delante: menos de medio día de ventas'
    :state==='baja'?`Mercado abastecido: ${days.toFixed(1)} días de ventas por delante de tu orden`
    :`${days.toFixed(1)} días de ventas por delante de tu orden`};
 }
 const ask=n(route.marketSignals?.ask)||n(route.sell);
 if(!(ask>0&&median>0))return null;
 const ratio=ask/median,state=ratio>=1.12?'alta':ratio<=.88?'baja':'normal';
 return {market:'royal',state,ratio,daysOfSupply:null,weight:state==='alta'?1.03:state==='baja'?.95:1,
  label:state==='alta'?'Precio sobre su media: posible escasez (puede volver a bajar)'
   :state==='baja'?'Precio bajo su media: exceso de oferta':'Precio en su media de 14 días'};
}
export const needWeight=route=>marketNeed(route)?.weight||1;

// Ranking de «qué pide el mercado» entre las rutas analizadas (para la interfaz).
export function marketNeedsRanking(routes=[],limit=8){
 const best=new Map();
 for(const r of routes||[]){
  const need=marketNeed(r);if(!need||!r?.id)continue;
  const daily=n(r.demandDaily??r.activity?.observedDaily);
  const silverDaily=daily*n(r.sell);
  const score=need.weight*Math.log1p(silverDaily);
  const key=r.id+'|'+r.city,old=best.get(key);
  if(!old||score>old.score)best.set(key,{id:r.id,city:r.city,daily,silverDaily,need,score,profit:Number(r.profit)||0});
 }
 return [...best.values()].filter(x=>x.need.state==='alta'&&x.daily>0).sort((a,b)=>b.score-a.score).slice(0,Math.max(1,limit));
}
