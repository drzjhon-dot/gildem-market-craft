// Datos estáticos de refinamiento: prioridad ao-bin-dumps. La tabla de referencia
// del juego es un respaldo declarado, NUNCA se presenta como dato descargado.
export const REFINING_TYPES=Object.freeze([
 {key:'METALBAR',raw:'ORE',label:'Lingotes',city:'Thetford',icon:'T5_METALBAR'},
 {key:'PLANKS',raw:'WOOD',label:'Tablas',city:'Fort Sterling',icon:'T5_PLANKS'},
 {key:'CLOTH',raw:'FIBER',label:'Tela',city:'Lymhurst',icon:'T5_CLOTH'},
 {key:'LEATHER',raw:'HIDE',label:'Cuero',city:'Martlock',icon:'T5_LEATHER'},
 {key:'STONEBLOCK',raw:'ROCK',label:'Bloques de piedra',city:'Bridgewatch',icon:'T5_STONEBLOCK'}
]);
export const REFINING_CITIES=REFINING_TYPES.map(x=>x.city);
const BASE_COUNTS={2:1,3:2,4:2,5:3,6:4,7:5,8:5};
export const refinedId=(tier,type,ench=0)=>`T${tier}_${type}${ench?`_LEVEL${ench}@${ench}`:''}`;
export const rawId=(tier,raw,ench=0)=>`T${tier}_${raw}${ench?`_LEVEL${ench}@${ench}`:''}`;
export function refiningVariant(id){const m=String(id).match(/^T([2-8])_(METALBAR|PLANKS|CLOTH|LEATHER|STONEBLOCK)(?:_LEVEL([1-4])@\3)?$/);return m?{tier:Number(m[1]),kind:m[2],ench:Number(m[3]||0)}:null;}
export function fallbackRefiningRecipe(type,tier,ench=0){
 const t=REFINING_TYPES.find(x=>x.key===type),level=Number(tier),e=Number(ench);
 if(!t||!Number.isInteger(level)||level<2||level>8||!Number.isInteger(e)||e<0||e>4||type==='STONEBLOCK'&&e!==0||level<4&&e!==0)return null;
 const materials=[{id:rawId(level,t.raw,e),count:BASE_COUNTS[level],ret:true}];
 if(level>=3)materials.push({id:refinedId(level-1,t.key,level>4?e:0),count:1,ret:true});
 return {materials,amountCrafted:1,city:t.city,kind:'refining',specialtyBonus:40,
  specialtyEnabled:true,dailyEnabled:true,recipeSource:'referencia-oficial-albion',verifiedFromDump:false,
  sourceNote:'Receta de referencia para refinamiento; verificar tras parches del juego'};
}
export function referenceRefiningRecipes({tiers=[4,5,6,7,8],enchants=[0,1,2,3,4],type=null}={}){
 const result={};for(const t of REFINING_TYPES.filter(x=>!type||x.key===type))for(const tier of tiers)for(const ench of enchants){
  const recipe=fallbackRefiningRecipe(t.key,Number(tier),Number(ench));if(recipe)result[refinedId(Number(tier),t.key,Number(ench))]=recipe;
 }return result;
}
function array(v){return Array.isArray(v)?v:v?[v]:[];}
function allItems(data){const root=data?.items||data;
 if(Array.isArray(root))return root;
 if(!root||typeof root!=='object')return [];
 return Object.values(root).flatMap(v=>array(v));
}
function requirementMats(req){let result=[];
 for(const m of array(req?.craftresource)){
  const id=m?.['@uniquename'],count=Number(m?.['@count']);if(!id||!(count>0))continue;
  const e=Number(m['@enchantmentlevel']||0);const materialId=e>0&&!id.includes('@')?`${id}@${e}`:id;
  const maximum=m['@maxreturnamount']==null?null:Number(m['@maxreturnamount']);
  result.push({id:materialId,count,ret:maximum!==0,...(Number.isFinite(maximum)?{maxReturn:Math.max(0,maximum)}:{})});
 }return result;
}
function fromReq(req,existing,kind='crafting'){
 const mats=requirementMats(req);if(!mats.length)return null;
 const amount=Number(req['@amountcrafted']||1);
 if(!Number.isSafeInteger(amount)||amount<1)return null;
 const focus=Number(req['@craftingfocus']||0);
 return {...existing,materials:mats,amountCrafted:amount,kind,recipeSource:'ao-bin-dumps',verifiedFromDump:true,
  ...((focus>0)?{focusPerCraft:focus}:{})};
}
// Sólo sustituye recetas cuando la entrada tiene recursos verificables; un dump
// incompleto no borra recetas anteriores ni añade cantidades asumidas.
export function extractBinRecipes(data,{onlyIds=null,existingRecipes={}}={}){
 const allowed=onlyIds?new Set(onlyIds):null,out={};
 for(const item of allItems(data)){
  const id=item?.['@uniquename'];if(!id||allowed&&![...allowed].some(k=>k===id||k.startsWith(id+'@')))continue;
  const v=refiningVariant(id),type=v&&REFINING_TYPES.find(x=>x.key===v.kind);
  const base=array(item.craftingrequirements).find(r=>requirementMats(r).length);
  if(base&&(!allowed||allowed.has(id))){const previous=existingRecipes[id]||(type?fallbackRefiningRecipe(type.key,v.tier,v.ench):{});
   const entry=fromReq(base,previous,type?'refining':'crafting');if(entry){if(type){entry.city=type.city;entry.specialtyBonus=40;}out[id]=entry;}}
  for(const enchItem of array(item.enchantments?.enchantment)){
   const e=Number(enchItem['@enchantmentlevel']);if(!Number.isInteger(e)||e<1||e>4)continue;
   const enchantedId=`${id}@${e}`;if(allowed&&!allowed.has(enchantedId))continue;
   const req=array(enchItem.craftingrequirements).find(r=>requirementMats(r).length);if(!req)continue;
   const previous=existingRecipes[enchantedId]||(type?fallbackRefiningRecipe(type.key,v.tier,e):{});
   const entry=fromReq(req,previous,type?'refining':'crafting');if(entry){if(type){entry.city=type.city;entry.specialtyBonus=40;}out[enchantedId]=entry;}
  }
 }
 return out;
}
