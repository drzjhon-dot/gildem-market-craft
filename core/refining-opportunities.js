// Refinamiento como INVERSIÓN independiente dentro de Encontrar oportunidades.
// Las cotizaciones AODP son observaciones, no ventas garantizadas.
// Se contabiliza una etapa de refinado por unidad: recurso crudo + refinado del
// tier anterior. No se presume que el inventario previo sea gratuito.
import {CITIES,quote} from './engine.js';
import {REFINING_FAMILIES,refiningRecipeFor,refiningReturnRate} from './refining-integration.js';
import {gameFocusCost,focusAfterEfficiency} from './game-focus.js';

export const REFINERY_CHOICES=Object.freeze(Object.entries(REFINING_FAMILIES).map(([key,family])=>({key,label:family.label,city:family.city,iconId:'T4_'+key})));
const finite=(v,otherwise=0)=>Number.isFinite(Number(v))?Number(v):otherwise;

export function refinementScanIds({families=REFINERY_CHOICES.map(x=>x.key),tierMin=4,tierMax=8,enchant=1,enchExact='all'}={}){
 const allowed=new Set(families);const results=[];
 for(const {key} of REFINERY_CHOICES){
  if(!allowed.has(key))continue;
  for(let t=Math.max(2,tierMin);t<=Math.min(8,tierMax);t++){
   for(let e=0;e<=Math.min(4,enchant);e++){
    if(enchExact!=='all'&&String(e)!==String(enchExact))continue;
    const id=`T${t}_${key}${e?`_LEVEL${e}@${e}`:''}`;
    const recipe=refiningRecipeFor(id);
    if(recipe)results.push({id,recipe});
   }
  }
 }
 return results;
}

export function refiningPriceIds(items){
 const ids=new Set();
 for(const {id,recipe} of items||[]){ids.add(id);ids.add(recipe.rawId);if(recipe.previousId)ids.add(recipe.previousId);}
 return [...ids];
}

export function createRefiningCandidates({selected=[],priceMap,market='mixed',saleCities=CITIES,mode='listed',maxAge=24,
  stationFee=0,dailyBonus=0,bonusCity=true,materialShipping=0,transport=0,royalTax=4,listingFee=2.5,
  riskRoyal=0,priceStress=8,resourceStress=7,nameOf=id=>id,focus=false,focusEfficiency=0}={}){
 const result=[];const missing={materials:0,sales:0};
 if(market==='black')return {candidates:result,missing};
 if(!['listed','instant'].includes(mode))throw Error('Forma de venta del refinado no válida');
 const fee=Math.max(0,finite(stationFee)),shipping=Math.max(0,finite(materialShipping)),delivery=Math.max(0,finite(transport));
 const tax=Math.max(0,finite(royalTax)),setup=mode==='listed'?Math.max(0,finite(listingFee)):0;
 const baseRate=refiningReturnRate({bonusCity,dailyBonus});
 for(const {id,recipe:r} of selected){
  // v9.10 · Focus de refinado con el coste del juego (y tu FCE): retorno 53,9 % en la ciudad de bono.
  const focusPerUnit=focus?focusAfterEfficiency(gameFocusCost(id)||0,focusEfficiency):0;
  const rate=focusPerUnit>0?refiningReturnRate({bonusCity,dailyBonus,focus:true}):baseRate;
  // Comprobación defensiva: no se construyen productos que no tengan receta reconocida.
  if(!r||!refiningRecipeFor(id))continue;
  const refiningCity=bonusCity?r.city:(r.city==='Caerleon'?'Bridgewatch':'Caerleon');
  const inputs=[{id:r.rawId,count:r.rawCount},...(r.previousId?[{id:r.previousId,count:1}]:[])];
  const materials=[];
  for(const m of inputs){
   let best=null;
   for(const city of CITIES){const q=quote(priceMap,m.id,city,'sell_price_min',maxAge);if(!q)continue;
    const freight=city===refiningCity?0:shipping;
    const effective=q.price+freight;
    if(!best||effective<best.unitPrice)best={...m,city,at:q.at,unitPrice:effective,originalPrice:q.price,shippingPerUnit:freight};
   }
   if(!best)break;
   const returned=m.count*rate/100;
   materials.push({...best,used:m.count-returned,returned,ret:true,cost:(m.count-returned)*best.unitPrice});
  }
  if(materials.length!==inputs.length){missing.materials++;continue;}
  const gross=materials.reduce((v,m)=>v+m.count*m.unitPrice,0);
  const net=materials.reduce((v,m)=>v+m.cost,0);
  for(const saleCity of CITIES.filter(city=>saleCities.includes(city))){
   const q=quote(priceMap,id,saleCity,mode==='listed'?'sell_price_min':'buy_price_max',maxAge);
   if(!q){missing.sales++;continue;}
   const shippingSale=saleCity===refiningCity?0:delivery;
   const riskCost=net*Math.max(0,finite(riskRoyal))/100;
   const cost=net+fee+shippingSale+riskCost;
   const upfront=gross+fee+shippingSale;
   const revenue=q.price*(1-(tax+setup)/100);
   const profit=revenue-cost;
   if(!(profit>0&&upfront>0))continue;
   const stressRevenue=q.price*(1-Math.max(0,finite(priceStress))/100)*(1-(tax+setup)/100);
   const stressCost=net*(1+Math.max(0,finite(resourceStress))/100)+fee+shippingSale+riskCost;
   const at=Math.min(q.at,...materials.map(m=>m.at));
   result.push({id,itemName:nameOf(id),branch:'refining_'+r.family,craftCity:refiningCity,city:saleCity,mode,
    sell:q.price,profit,cost,capitalPerUnit:upfront,roi:profit/cost*100,returnRate:rate,
    materials,rawMaterials:gross,at:q.at,ageHours:(Date.now()-at)/3600000,
    activity:null,confidence:null,personalLearning:null,focusPerUnit,focusGain:focusPerUnit>0?gross*(rate-baseRate)/100:0,
    stressProfit:stressRevenue-stressCost,taxRate:tax/100,saleTaxPercent:tax,craftAmount:1,
    recipeKind:'refining',setupRate:setup/100,referenceSide:mode==='listed'?'sell_price_min':'buy_price_max',transportCost:shippingSale,
    transportRiskPct:0,expectedRiskCost:riskCost,stationCost:fee,
    buyMode:'instant',buySetup:0,qualityMode:'normal',qualityWeights:[100,0,0,0,0],
    journal:null,journalBonus:0});
  }
 }
 return {candidates:result,missing};
}
