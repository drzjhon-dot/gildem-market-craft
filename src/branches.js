// Catálogo de ramas, independiente del motor de planes. Cada opción filtra IDs reales.
import {BRANCHES as ORIGINAL} from './branch-reference.js';
const base=Object.fromEntries(ORIGINAL.map(x=>[x.key,x]));
const one=(key,label,iconId,matcher)=>({key,label,iconId,test:matcher||base[key]?.test||(()=>false),city:base[key]?.city||null});
const make=(key,icon)=>one(key,base[key]?.label||key,icon);
const check=(re)=>id=>re.test(id);
const contains=(...tokens)=>id=>/^T[2-8]_MOUNT_/.test(id)&&tokens.some(t=>id.replace(/^T[2-8]_MOUNT_/,'').split('@')[0]===t);
const family=(stem)=>id=>/^T[2-8]_MOUNT_/.test(id)&&id.replace(/^T[2-8]_MOUNT_/,'').split('@')[0].includes(stem);
export const GROUPS=[
 {key:'weapons',title:'Armas',icon:'⚔',items:[
  make('axe','T4_MAIN_AXE'),make('sword','T4_MAIN_SWORD'),make('bow','T4_2H_BOW'),make('crossbow','T4_2H_CROSSBOW'),make('dagger','T4_MAIN_DAGGER'),make('spear','T4_MAIN_SPEAR'),make('mace','T4_MAIN_MACE'),make('hammer','T4_MAIN_HAMMER'),make('quarterstaff','T4_2H_QUARTERSTAFF'),make('fire','T4_MAIN_FIRESTAFF'),make('ice','T4_MAIN_FROSTSTAFF'),make('holy','T4_MAIN_HOLYSTAFF'),make('nature','T4_MAIN_NATURESTAFF'),make('curse','T4_MAIN_CURSEDSTAFF'),make('arcane','T4_MAIN_ARCANESTAFF'),make('shapeshifter','T4_2H_SHAPESHIFTER_SET1'),make('gloves','T4_2H_KNUCKLES_SET1')]},
 {key:'armor',title:'Armaduras',icon:'♜',items:[
  make('boots_plate','T4_SHOES_PLATE_SET1'),make('boots_cloth','T4_SHOES_CLOTH_SET1'),make('boots_leather','T4_SHOES_LEATHER_SET1'),make('heads_plate','T4_HEAD_PLATE_SET1'),make('heads_cloth','T4_HEAD_CLOTH_SET1'),make('heads_leather','T4_HEAD_LEATHER_SET1'),make('chests_plate','T4_ARMOR_PLATE_SET1'),make('chests_cloth','T4_ARMOR_CLOTH_SET1'),make('chests_leather','T4_ARMOR_LEATHER_SET1')]},
 {key:'offhand',title:'Manos secundarias',icon:'✧',items:[make('offhand','T4_OFF_TORCH')]},
 {key:'accessories',title:'Bolsas y capas',icon:'◇',items:[make('bags','T4_BAG'),make('capes','T4_CAPE')]},
 {key:'gathering',title:'Recolección',icon:'♧',items:[
  make('gather_wood','T4_ARMOR_GATHERER_WOOD'),make('gather_hide','T4_ARMOR_GATHERER_HIDE'),make('gather_ore','T4_ARMOR_GATHERER_ORE'),make('gather_fiber','T4_ARMOR_GATHERER_FIBER'),make('gather_rock','T4_ARMOR_GATHERER_ROCK'),make('gather_fish','T4_ARMOR_GATHERER_FISH'),make('gather_tools','T4_2H_TOOL_AXE'),make('gather_tool_axe','T4_2H_TOOL_AXE'),make('gather_tool_pick','T4_2H_TOOL_PICK'),make('gather_tool_sickle','T4_2H_TOOL_SICKLE'),make('gather_tool_knife','T4_2H_TOOL_KNIFE'),make('gather_tool_hammer','T4_2H_TOOL_HAMMER'),make('gather_tool_fishing','T4_2H_TOOL_FISHINGROD')]},
 {key:'kits',title:'Kits de rastreo',icon:'⌘',items:[make('gather_tool_tracking','T4_2H_TOOL_TRACKING')]},
 {key:'potions',title:'Pociones',icon:'⚗',items:[
  ...['potion_heal','potion_energy','potion_poison','potion_gigant','potion_resist','potion_sticky','potion_invis','potion_calm','potion_cleanse','potion_acid','potion_berserk','potion_fire','potion_gather','potion_tornado'].map((k,i)=>make(k,['T4_POTION_HEAL','T4_POTION_ENERGY','T4_POTION_COOLDOWN','T5_POTION_REVIVE','T5_POTION_STONESKIN','T5_POTION_SLOWFIELD','T8_POTION_CLEANSE','T5_POTION_MOB_RESET','T5_POTION_CLEANSE2','T5_POTION_ACID','T6_POTION_BERSERK','T6_POTION_LAVA','T6_POTION_GATHER','T6_POTION_TORNADO'][i])),
  one('potion_lifeward','Pociones · LIFEWARD','T6_POTION_LIFEWARD',check(/^T[2-8]_POTION_.*LIFEWARD(?:@\d+)?$/))]},
 {key:'foods',title:'Comidas',icon:'♨',items:[...['food_soup','food_salad','food_pie','food_omelette','food_stew','food_sandwich','food_roast','food_fish','food_avalon'].map((k,i)=>make(k,['T5_MEAL_SOUP','T4_MEAL_SALAD','T5_MEAL_PIE','T5_MEAL_OMELETTE','T6_MEAL_STEW','T6_MEAL_SANDWICH','T5_MEAL_ROAST','T4_MEAL_SALAD_FISH','T6_MEAL_STEW_AVALON'][i]))]},
 {key:'mounts',title:'Monturas',icon:'♞',items:[
  one('mount_horse','Caballos y caballos blindados','T4_MOUNT_HORSE',id=>/^T[3-8]_MOUNT_(HORSE|ARMORED_HORSE)(?:@\d+)?$/.test(id)),
  one('mount_ox','Bueyes de transporte','T4_MOUNT_OX',contains('OX')),
  ...[
   ['armored_expert','Caballo blindado del experto','ARMORED_HORSE'],['stag','Ciervo gigante del iniciado','STAG'],['moose','Alce','MOOSE'],['direwolf','Huargo','DIREWOLF'],['boar','Jabalí ensillado','BOAR'],['swampdragon','Dragón de pantano ensillado','SWAMPDRAGON'],['bear','Oso gigante ensillado','BEAR'],['mammoth','Mamut de transporte del anciano','MAMMOTH'],['moabird','Ave moa ensillada','MOABIRD'],['winterbear','Oso de invierno ensillado','WINTERBEAR'],['wildboar','Jabalí salvaje ensillado','WILDBOAR'],['bighorn','Carnero cimarrón ensillado','BIGHORN'],['swampsalamander','Salamandra de pantano ensillada','SWAMPSALAMANDER'],['greywolf','Lobo gris ensillado','GREYWOLF'],['owl','Búho místico ensillado','OWL'],['elite_moa','Ave de terror de élite','MOABIRD_ELITE'],['elite_bear','Oso de invierno de élite','WINTERBEAR_ELITE'],['elite_boar','Jabalí salvaje de élite','WILDBOAR_ELITE'],['elite_bighorn','Carnero cimarrón de élite','BIGHORN_ELITE'],['elite_salamander','Salamandra de pantano de élite','SWAMPSALAMANDER_ELITE'],['elite_wolf','Lobo gris de élite','GREYWOLF_ELITE'],['elite_owl','Búho místico de élite','OWL_ELITE'],['hellweaver','Tejedor de Infiernos','HELLWEAVER'],['firedrake','DRAKE FIRE','DRAKE_FIRE'],['battle_mammoth','MAMMOTH BATTLE','MAMMOTH_BATTLE'],['fire_basilisk','Basilisco de fuego','BASILISK_FIRE'],['poison_basilisk','Basilisco venenoso','BASILISK_POISON'],['ballista','Balista de asedio','BALLISTA'],['undead_horse','HORSE UNDEAD','HORSE_UNDEAD'],['keeper_cougar','COUGAR KEEPER','COUGAR_KEEPER'],['morgana_horse','ARMORED HORSE MORGANA','ARMORED_HORSE_MORGANA'],['spring_rabbit','Conejo primaveral','RABBIT_SPRING'],['dark_rabbit','RABBIT EASTER DARK','RABBIT_EASTER_DARK'],['avalon_basilisk','Basilisco avaloniano','BASILISK_AVALON']
  ].map(([k,label,stem])=>one('mount_'+k,'Monturas · '+label,'T6_MOUNT_'+stem,id=>/^T[3-8]_MOUNT_/.test(id)&&id.toUpperCase().includes(stem) && !/SKIN/.test(id)))
 ]},
 {key:'siege',title:'Asedio',icon:'⚒',items:[make('siege','T4_2H_TOOL_SIEGEHAMMER'),make('siege_banner','T4_SIEGE_BANNER')]}
];
export const BRANCHES=GROUPS.flatMap(g=>g.items.map(i=>({...i,group:g.key})));
export const BRANCH_BY_KEY=new Map(BRANCHES.map(x=>[x.key,x]));
export const MARKETS=['Bridgewatch','Fort Sterling','Lymhurst','Martlock','Thetford','Caerleon','Brecilien','Black Market'];
export function itemImage(id){return 'https://render.albiononline.com/v1/item/'+encodeURIComponent(id)+'.png?quality=1';}
export function matchBranch(id,keys){return keys.some(k=>BRANCH_BY_KEY.get(k)?.test(id));}
export function variant(id){const m=String(id).match(/^T([1-8])_[A-Z0-9_]+(?:@([1-4]))?$/);return m?{tier:Number(m[1]),ench:Number(m[2]||0)}:null;}
// Selección justa: distribuye el cupo entre ramas y combinaciones T/encantamiento.
export function catalogPage(ids,branchKeys,{offset=0,limit=240}={}){
 const selected=branchKeys.map(k=>BRANCH_BY_KEY.get(k)).filter(Boolean);
 const queues=selected.map(b=>{
  const lanes=new Map();for(const id of ids){if(!b.test(id))continue;const v=variant(id);if(!v)continue;const lane=`${v.ench}-${v.tier}`;if(!lanes.has(lane))lanes.set(lane,[]);lanes.get(lane).push(id);}
  const sorted=[...lanes].sort((a,b)=>a[0].localeCompare(b[0])).map(x=>x[1].sort());const result=[];let i=0;while(sorted.some(a=>i<a.length)){for(const arr of sorted){if(arr[i])result.push(arr[i]);}i++;}return result;
 });
 const ordered=[],seen=new Set();let idx=0;while(queues.some(q=>idx<q.length)){for(const q of queues){const id=q[idx];if(id&&!seen.has(id)){seen.add(id);ordered.push(id);}}idx++;}
 return {ids:ordered.slice(offset,offset+limit),total:ordered.length,offset,nextOffset:Math.min(ordered.length,offset+limit),complete:offset+limit>=ordered.length};
}
