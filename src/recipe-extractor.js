// Catálogo de recetas de categorías fuera del equipo tradicional.
// Se deriva EXCLUSIVAMENTE de los craftingrequirements publicados en ao-bin-dumps.
// Nunca se inventan recetas, animales criados, cantidades de salida ni tarifas.
export const FULL_ITEM_DUMP = 'https://cdn.jsdelivr.net/gh/ao-data/ao-bin-dumps@master/items.json';
export const FULL_ITEM_DUMP_BACKUP = 'https://raw.githubusercontent.com/ao-data/ao-bin-dumps/master/items.json';
// Recolección: vestimenta/mochilas y herramientas del fabricante (incluidas variantes avalonianas).
// NO incluir martillos de asedio: son herramientas de demolición, no de recolección.
export const GATHER_TOOL_PATTERN=/^T[2-8]_2H_TOOL_(?:AXE|PICK|SICKLE|KNIFE|HAMMER|FISHINGROD)(?:_AVALON)?(?:@\d+)?$/;
export const TRACKING_KIT_PATTERN=/^T[3-8]_2H_TOOL_TRACKING(?:@\d+)?$/;
export const SIEGE_EQUIPMENT_PATTERN=/^(?:T[2-8]_2H_TOOL_SIEGEHAMMER(?:_AVALON)?|T[4-8]_SIEGE_BANNER)(?:@\d+)?$/;
const gather=/^T[3-8]_(?:HEAD|ARMOR|SHOES|BACKPACK)_GATHERER_(?:WOOD|ORE|HIDE|FIBER|ROCK|FISH)(?:@\d+)?$/;
const mount=/^T[3-8]_MOUNT_(?!.*(?:_SKIN|_UNIQUE))(?:[A-Z0-9_]+)$/;
const potion=/^T[2-8]_POTION_[A-Z0-9_]+$/;
const food=/^T[1-8]_MEAL_[A-Z0-9_]+$/;
const singles=v=>Array.isArray(v)?v:v?[v]:[];
const positive=v=>Number.isFinite(Number(v))&&Number(v)>0?Number(v):null;
export function specialType(id){const root=String(id||'').split('@')[0];if(potion.test(root))return 'potion';if(food.test(root))return 'food';if(TRACKING_KIT_PATTERN.test(root))return 'kit';if(SIEGE_EQUIPMENT_PATTERN.test(root))return 'siege';if(gather.test(root)||GATHER_TOOL_PATTERN.test(root))return 'gather';if(mount.test(root))return 'mount';return null;}
export function blackMarketEligible(id){return !specialType(id)&&!/(?:_CRYSTAL|_SKIN)(?:@\d+)?$/.test(String(id||''));}
export function craftCityForSpecial(type){return type==='potion'?'Brecilien':type==='food'?'Caerleon':type==='gather'?'Caerleon':type==='kit'?'Caerleon':type==='siege'?'Caerleon':'Caerleon';}
export function specialNoCityBonus(type){return type==='mount';}
export function specialNoDailyBonus(type){return type==='mount';}
function materials(req){const mats=[];for(const m of singles(req?.craftresource)){
 const id=m?.['@uniquename'],quantity=positive(m?.['@count']);if(!id||!quantity)continue;
 const enchant=Number(m['@enchantmentlevel']||0);
 // La API utiliza IDs como T4_CLOTH_LEVEL1@1 para materias encantadas.
 const materialId=enchant>0&&!id.includes('@')?id+'@'+enchant:id;
 const cap=m['@maxreturnamount']===undefined?null:Number(m['@maxreturnamount']);
 mats.push({id:materialId,count:quantity,ret:!(cap===0),maxReturn:cap===null||!Number.isFinite(cap)?null:Math.max(0,cap)});
 }return mats;
}
function build(id,type,req){const ms=materials(req);if(!ms.length)return null;
 // El juego declara @amountcrafted en cada craftingrequirements. En especial
 // algunas pociones dan 5 o 10 por lote. Sin él se usa 1, jamás un número supuesto.
 const amountCrafted=positive(req?.['@amountcrafted'])||1;
 return {materials:ms,city:craftCityForSpecial(type),amountCrafted,kind:type,
    specialtyEnabled:!specialNoCityBonus(type),dailyEnabled:!specialNoDailyBonus(type),
    market:'royal',recipeSource:'ao-bin-dumps'};
}
export function extractSpecialRecipes(dump){
 const buckets=dump?.items&&typeof dump.items==='object'?Object.values(dump.items):Array.isArray(dump)?[dump]:null;
 if(!buckets)throw Error('Archivo del juego sin sección de objetos');
 const result={};for(const entries of buckets){
   for(const item of singles(entries)){
    const id=item?.['@uniquename'];if(!id||item['@showinmarketplace']==='false')continue;
    const type=specialType(id);if(!type)continue;
    const first=singles(item.craftingrequirements).find(x=>materials(x).length>0);
    if(first){const r=build(id,type,first);if(r)result[id]=r;}
    for(const e of singles(item.enchantments?.enchantment)){
      const ench=Number(e['@enchantmentlevel']);if(!ench||!Number.isInteger(ench)||ench>4)continue;
      const req=singles(e.craftingrequirements).find(x=>materials(x).length>0);if(!req)continue;
      const r=build(id+'@'+ench,type,req);if(r)result[id+'@'+ench]=r;
    }
   }
 }
 return result;
}
