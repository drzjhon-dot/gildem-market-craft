// La bonificación de ciudad corresponde al REFINAMIENTO, no garantiza mejores precios.
// Para fabricar, comprar ya refinado en la ciudad indicada; los materiales sin
// esta especialidad (artefactos, runas, diarios, etc.) se cotizan en Royal.
export const REFINED_BONUS_CITY=Object.freeze({
 METALBAR:'Thetford', PLANKS:'Fort Sterling', CLOTH:'Lymhurst',
 LEATHER:'Martlock', STONEBLOCK:'Bridgewatch'
});
export function refinedBonusCity(id){
 const match=String(id||'').match(/^T[2-8]_(METALBAR|PLANKS|CLOTH|LEATHER|STONEBLOCK)(?:_LEVEL[1-4])?(?:@[1-4])?$/);
 if(!match)return null;
 if(match[1]==='STONEBLOCK'&&String(id).match(/(?:_LEVEL[1-4]|@[1-4])/))return null;
 return REFINED_BONUS_CITY[match[1]];
}
export function materialPurchaseCities(id,selection='bonus',royalCities=[]){
 if(selection==='bonus'){
  const bonus=refinedBonusCity(id);
  return bonus?[bonus]:[...royalCities];
 }
 return selection==='all'?[...royalCities]:[selection];
}
