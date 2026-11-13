// Comparador de compra de materiales refinados y refinado propio.
// Las recetas básicas siguen los requisitos oficiales de Albion Online.
// Piedra encantada NO se trata como cuero/lingotes encantados: se excluye.
export const REFINING_FAMILIES={
 METALBAR:{raw:'ORE',city:'Thetford',label:'Lingotes'},
 PLANKS:{raw:'WOOD',city:'Fort Sterling',label:'Tablones'},
 LEATHER:{raw:'HIDE',city:'Martlock',label:'Cuero'},
 CLOTH:{raw:'FIBER',city:'Lymhurst',label:'Tela'},
 STONEBLOCK:{raw:'ROCK',city:'Bridgewatch',label:'Bloques de piedra'}
};
const AMOUNTS={2:1,3:2,4:2,5:3,6:4,7:5,8:5};
const num=(n,d=0)=>Number.isFinite(Number(n))?Number(n):d;
export function refiningRecipeFor(id){
 const match=String(id||'').match(/^T([2-8])_(METALBAR|PLANKS|LEATHER|CLOTH|STONEBLOCK)(?:_LEVEL([1-4]))?(?:@([1-4]))?$/);
 if(!match)return null;
 const tier=Number(match[1]),family=match[2],level=Number(match[3]||match[4]||0);
 if(match[3]&&match[4]&&Number(match[3])!==Number(match[4]))return null;
 if(level>0&&(tier<4||family==='STONEBLOCK'))return null;
 const settings=REFINING_FAMILIES[family];
 const suffix=level>0?'_LEVEL'+level+'@'+level:'';
 const rawId=`T${tier}_${settings.raw}${suffix}`;
 const previous=tier>2?`T${tier-1}_${family}${level>0&&tier>4?suffix:''}`:null;
 return {id,tier,level,family,city:settings.city,label:settings.label,rawId,rawCount:AMOUNTS[tier],previousId:previous};
}
export function refiningReturnRate({bonusCity=true,focus=false,dailyBonus=0}={}){
 if(![0,10,20].includes(Number(dailyBonus)))throw Error('Bono diario de refinado inválido');
 const productionBonus=18+(bonusCity?40:0)+(focus?59:0)+Number(dailyBonus);
 return 100*productionBonus/(100+productionBonus);
}
export function refiningInputsFor(ids){const result=new Set();
 for(const id of ids){const r=refiningRecipeFor(id);if(r){result.add(r.rawId);if(r.previousId)result.add(r.previousId);}}
 return [...result];
}
// findMarket(id, targetCity) => precio unitario EFECTIVO (incluye compra y
// traslado de origen a ciudad de refinado), ciudad de origen y observación.
// Solo refinamos una etapa: el material refinado del tier anterior se compra.
export function compareRefining({id,craftCity,buyRefined,findMarket,mode='auto',stationFee=0,transferFee=0,focus=false,focusPerRefine=0,dailyBonus=0}={}){
 const r=refiningRecipeFor(id);
 if(!r||!['auto','always','compare'].includes(mode))return {source:buyRefined,comparison:null};
 const raw=findMarket(r.rawId,r.city),previous=r.previousId?findMarket(r.previousId,r.city):null;
 if(!raw?.price||r.previousId&&!previous?.price)return {source:buyRefined,comparison:{id,possible:false,reason:'Faltan precios recientes de recursos crudos o material del tier anterior.'}};
 const rrr=refiningReturnRate({bonusCity:true,focus,dailyBonus});
 const inputCost=r.rawCount*raw.price+(previous?.price||0);
 const fee=num(stationFee),shipping=r.city!==craftCity?num(transferFee):0;
 const net=inputCost*(1-rrr/100)+fee+shipping;
 const upfront=inputCost+fee+shipping;
 const inputs=[{id:r.rawId,count:r.rawCount,city:raw.city,unitPrice:raw.price,originalPrice:raw.originalPrice||raw.price,at:raw.at,used:r.rawCount*(1-rrr/100)},
  ...(previous?[{id:r.previousId,count:1,city:previous.city,unitPrice:previous.price,originalPrice:previous.originalPrice||previous.price,at:previous.at,used:1-rrr/100}]:[])];
 const bestDate=Math.min(...inputs.map(x=>num(x.at,Date.now())));
 const comparison={id,possible:true,city:r.city,rrr,netCost:net,upfrontCost:upfront,directCost:buyRefined?.price||null,
  stationFee:fee,transferFee:shipping,inputs,focusPerRefine:focus?num(focusPerRefine):0,saving:buyRefined?.price?buyRefined.price-net:null};
 const shouldUse=mode==='always'||mode==='auto'&&(!buyRefined?.price||net+1e-6<buyRefined.price);
 if(!shouldUse)return {source:buyRefined,comparison};
 return {source:{price:net,upfrontUnitPrice:upfront,city:r.city,at:bestDate,
    refining:{...comparison,focus,outputId:id,craftCity,rawCount:r.rawCount},sourceKind:'refine'},comparison};
}

// Expande un material refinado producido por el usuario a recursos QUE DEBE
// COMPRAR; no añade el refinado final como compra, ni duplica los mercados.
export function purchaseComponents(material){
 if(!material?.refining)return [{...material}];
 const m=material,rrr=m.refining.rrr/100;
 return m.refining.inputs.map(x=>({id:x.id,city:x.city,count:m.count*x.count,used:m.used*x.count*(1-rrr),unitPrice:x.unitPrice,
   originalPrice:x.originalPrice,at:x.at,refinedFrom:m.id,refiningCity:m.refining.city}));
}

export function plannedRefining(rows){
 const summary=new Map();
 for(const r of rows||[])for(const m of r.materials||[]){if(!m.refining)continue;
  const data=m.refining,key=m.id+'|'+data.city+'|'+r.craftCity;
  const e=summary.get(key)||{id:m.id,city:data.city,craftCity:r.craftCity,crafts:0,rrr:data.rrr,stationFee:0,transferFee:0,saved:0,focus:0};
  const n=m.count*r.qty;
  e.crafts+=n;e.stationFee+=n*data.stationFee;e.transferFee+=n*data.transferFee;
  e.saved+=n*(data.directCost==null?0:data.directCost-data.netCost);
  e.focus+=n*data.focusPerRefine;
  summary.set(key,e);
 }
 return [...summary.values()];
}
