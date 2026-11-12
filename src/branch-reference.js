// Sólo taxonomía de identificadores del juego heredada del catálogo verificado; no contiene motor ni consultas antiguas.
// More precise crafting lines. All filters use actual item IDs from the public recipe dump.
const gear=(part,kind)=>id=>new RegExp(`^T[4-8]_${part}_${kind}`).test(id);
const byId=regex=>id=>regex.test(id);
// Exact line membership avoids accidentally skipping artifact/crystal weapons.
// These IDs are game item stems; tier and enchantment are handled separately.
const WEAPON_FAMILIES={
 axe:['MAIN_AXE','2H_AXE','2H_HALBERD','2H_HALBERD_MORGANA','2H_SCYTHE_HELL','2H_DUALAXE_KEEPER','2H_AXE_AVALON','2H_SCYTHE_CRYSTAL'],
 sword:['MAIN_SWORD','2H_CLAYMORE','2H_DUALSWORD','MAIN_SCIMITAR_MORGANA','2H_CLEAVER_HELL','2H_DUALSCIMITAR_UNDEAD','2H_CLAYMORE_AVALON','MAIN_SWORD_CRYSTAL'],
 bow:['2H_BOW','2H_WARBOW','2H_LONGBOW','2H_LONGBOW_UNDEAD','2H_BOW_HELL','2H_BOW_KEEPER','2H_BOW_AVALON','2H_BOW_CRYSTAL'],
 crossbow:['2H_CROSSBOW','2H_CROSSBOWLARGE','MAIN_1HCROSSBOW','2H_REPEATINGCROSSBOW_UNDEAD','2H_DUALCROSSBOW_HELL','2H_CROSSBOWLARGE_MORGANA','2H_CROSSBOW_CANNON_AVALON','2H_DUALCROSSBOW_CRYSTAL'],
 dagger:['MAIN_DAGGER','2H_DAGGERPAIR','2H_CLAWPAIR','MAIN_RAPIER_MORGANA','MAIN_DAGGER_HELL','2H_IRONGAUNTLETS_HELL','2H_DUALSICKLE_UNDEAD','2H_DAGGER_KATAR_AVALON','2H_DAGGERPAIR_CRYSTAL'],
 spear:['MAIN_SPEAR','2H_SPEAR','2H_GLAIVE','MAIN_SPEAR_KEEPER','2H_HARPOON_HELL','2H_TRIDENT_UNDEAD','MAIN_SPEAR_LANCE_AVALON','2H_GLAIVE_CRYSTAL'],
 mace:['MAIN_MACE','2H_MACE','2H_FLAIL','MAIN_ROCKMACE_KEEPER','MAIN_MACE_HELL','2H_MACE_MORGANA','2H_DUALMACE_AVALON','MAIN_MACE_CRYSTAL'],
 hammer:['MAIN_HAMMER','2H_POLEHAMMER','2H_HAMMER','2H_HAMMER_UNDEAD','2H_DUALHAMMER_HELL','2H_RAM_KEEPER','2H_HAMMER_AVALON','2H_HAMMER_CRYSTAL'],
 quarterstaff:['2H_QUARTERSTAFF','2H_IRONCLADEDSTAFF','2H_DOUBLEBLADEDSTAFF','2H_COMBATSTAFF_MORGANA','2H_TWINSCYTHE_HELL','2H_ROCKSTAFF_KEEPER','2H_QUARTERSTAFF_AVALON','2H_DOUBLEBLADEDSTAFF_CRYSTAL'],
 fire:['MAIN_FIRESTAFF','2H_FIRESTAFF','2H_INFERNOSTAFF','MAIN_FIRESTAFF_KEEPER','2H_FIRESTAFF_HELL','2H_INFERNOSTAFF_MORGANA','2H_FIRE_RINGPAIR_AVALON','MAIN_FIRESTAFF_CRYSTAL'],
 ice:['MAIN_FROSTSTAFF','2H_FROSTSTAFF','2H_GLACIALSTAFF','MAIN_FROSTSTAFF_KEEPER','2H_ICEGAUNTLETS_HELL','2H_ICECRYSTAL_UNDEAD','MAIN_FROSTSTAFF_AVALON','2H_FROSTSTAFF_CRYSTAL'],
 holy:['MAIN_HOLYSTAFF','2H_HOLYSTAFF','2H_DIVINESTAFF','MAIN_HOLYSTAFF_MORGANA','2H_HOLYSTAFF_HELL','2H_HOLYSTAFF_UNDEAD','MAIN_HOLYSTAFF_AVALON','2H_HOLYSTAFF_CRYSTAL'],
 nature:['MAIN_NATURESTAFF','2H_NATURESTAFF','2H_WILDSTAFF','MAIN_NATURESTAFF_KEEPER','2H_NATURESTAFF_HELL','2H_NATURESTAFF_KEEPER','MAIN_NATURESTAFF_AVALON','MAIN_NATURESTAFF_CRYSTAL'],
 curse:['MAIN_CURSEDSTAFF','2H_CURSEDSTAFF','2H_DEMONICSTAFF','MAIN_CURSEDSTAFF_UNDEAD','2H_SKULLORB_HELL','2H_CURSEDSTAFF_MORGANA','MAIN_CURSEDSTAFF_AVALON','MAIN_CURSEDSTAFF_CRYSTAL'],
 arcane:['MAIN_ARCANESTAFF','2H_ARCANESTAFF','2H_ENIGMATICSTAFF','MAIN_ARCANESTAFF_UNDEAD','2H_ARCANESTAFF_HELL','2H_ENIGMATICORB_MORGANA','2H_ARCANE_RINGPAIR_AVALON','2H_ARCANESTAFF_CRYSTAL'],
 shapeshifter:['2H_SHAPESHIFTER_SET1','2H_SHAPESHIFTER_SET2','2H_SHAPESHIFTER_SET3','2H_SHAPESHIFTER_MORGANA','2H_SHAPESHIFTER_HELL','2H_SHAPESHIFTER_KEEPER','2H_SHAPESHIFTER_AVALON','2H_SHAPESHIFTER_CRYSTAL'],
 gloves:['2H_KNUCKLES_SET1','2H_KNUCKLES_SET2','2H_KNUCKLES_SET3','2H_KNUCKLES_KEEPER','2H_KNUCKLES_HELL','2H_KNUCKLES_MORGANA','2H_KNUCKLES_AVALON','2H_KNUCKLES_CRYSTAL']
};
const weapon=key=>id=>/^T[4-8]_/.test(id)&&WEAPON_FAMILIES[key]?.includes(id.replace(/^T[4-8]_/, '').split('@')[0]);
export const BRANCHES=[
 {key:'boots_plate',label:'Botas de placas',city:'Martlock',test:gear('SHOES','PLATE')},
 {key:'boots_cloth',label:'Zapatos de tela',city:'Bridgewatch',test:gear('SHOES','CLOTH')},
 {key:'boots_leather',label:'Zapatos de cuero',city:'Lymhurst',test:gear('SHOES','LEATHER')},
 {key:'boots_all',label:'Todas las botas y zapatos',city:null,test:id=>/^T[4-8]_SHOES_/.test(id)&&!id.includes('_GATHERER_')},
 {key:'heads_plate',label:'Cascos de placas',city:'Fort Sterling',test:gear('HEAD','PLATE')},
 {key:'heads_cloth',label:'Capuchas de tela',city:'Thetford',test:gear('HEAD','CLOTH')},
 {key:'heads_leather',label:'Capuchas de cuero',city:'Lymhurst',test:gear('HEAD','LEATHER')},
 {key:'heads_all',label:'Todos los cascos y capuchas',city:null,test:id=>/^T[4-8]_HEAD_/.test(id)&&!id.includes('_GATHERER_')},
 {key:'chests_plate',label:'Armaduras de placas',city:'Bridgewatch',test:gear('ARMOR','PLATE')},
 {key:'chests_cloth',label:'Túnicas de tela',city:'Fort Sterling',test:gear('ARMOR','CLOTH')},
 {key:'chests_leather',label:'Chaquetas de cuero',city:'Thetford',test:gear('ARMOR','LEATHER')},
 {key:'chests_all',label:'Todas las pecheras',city:null,test:id=>/^T[4-8]_ARMOR_/.test(id)&&!id.includes('_GATHERER_')},
 {key:'axe',label:'Hachas',city:'Martlock',test:weapon('axe')},
 {key:'sword',label:'Espadas',city:'Lymhurst',test:weapon('sword')},
 {key:'bow',label:'Arcos',city:'Lymhurst',test:weapon('bow')},
 {key:'crossbow',label:'Ballestas',city:'Bridgewatch',test:weapon('crossbow')},
 {key:'dagger',label:'Dagas',city:'Bridgewatch',test:weapon('dagger')},
 {key:'spear',label:'Lanzas',city:'Fort Sterling',test:weapon('spear')},
 {key:'mace',label:'Mazas',city:'Thetford',test:weapon('mace')},
 {key:'hammer',label:'Martillos',city:'Fort Sterling',test:weapon('hammer')},
 {key:'quarterstaff',label:'Bastones de combate',city:'Martlock',test:weapon('quarterstaff')},
 {key:'fire',label:'Bastones de fuego',city:'Thetford',test:weapon('fire')},
 {key:'ice',label:'Bastones de hielo',city:'Martlock',test:weapon('ice')},
 {key:'holy',label:'Bastones sagrados',city:'Fort Sterling',test:weapon('holy')},
 {key:'nature',label:'Bastones de naturaleza',city:'Thetford',test:weapon('nature')},
 {key:'curse',label:'Bastones malditos',city:'Bridgewatch',test:weapon('curse')},
 {key:'arcane',label:'Bastones arcanos',city:'Lymhurst',test:weapon('arcane')},
 {key:'shapeshifter',label:'Bastones metamorfos',city:'Caerleon',test:weapon('shapeshifter')},
 {key:'gloves',label:'Guantes de guerra',city:'Caerleon',test:weapon('gloves')},
 {key:'offhand',label:'Manos secundarias',city:'Martlock',test:byId(/^T[4-8]_OFF_/)},
 {key:'bags',label:'Bolsas',city:'Brecilien',test:byId(/^T[4-8]_BAG/)},
 {key:'capes',label:'Capas',city:'Brecilien',test:byId(/^T[4-8]_CAPE/)},
 {key:'siege',label:'Martillos de asedio',city:'Caerleon',test:byId(/^T[2-8]_2H_TOOL_SIEGEHAMMER(?:_AVALON)?(?:@\d+)?$/),market:'royal'},
 {key:'siege_banner',label:'Estandartes de asedio',city:'Caerleon',test:byId(/^T[4-8]_SIEGE_BANNER(?:@\d+)?$/),market:'royal'},
 {key:'weapons_all',label:'Todas las armas',city:null,test:id=>/^T[4-8]_(?:MAIN_|2H_)/.test(id)&&!/^T[4-8]_2H_TOOL_/.test(id)},
];

// Recolección: profesiones + herramientas fabricables (normales y avalonianas).
// Sus identificadores oficiales empiezan por 2H_TOOL_, no por TOOL_.
// Martillo de asedio no es una herramienta para recolectar materiales.
const gatheringTools=/^T[2-8]_2H_TOOL_(?:AXE|PICK|SICKLE|KNIFE|HAMMER|FISHINGROD)(?:_AVALON)?(?:@\d+)?$/;
const gatheringTool=type=>id=>new RegExp('^T[2-8]_2H_TOOL_'+type+'(?:_AVALON)?(?:@\\d+)?$').test(id);
const gatheringFamily=(resource,tool)=>id=>new RegExp('^T[4-8]_(?:HEAD|SHOES|ARMOR|BACKPACK)_GATHERER_'+resource+'(?:@\\d+)?$').test(id)||gatheringTool(tool)(id);
const gatheringGearOrTool=id=>/^T[4-8]_(?:HEAD|SHOES|ARMOR|BACKPACK)_GATHERER_/.test(id)||gatheringTools.test(id);
BRANCHES.push(
 {key:'gather_wood',label:'Leñador · equipo, mochila y hacha',city:'Caerleon',test:gatheringFamily('WOOD','AXE'),market:'royal'},
 {key:'gather_hide',label:'Desollador · equipo, mochila y cuchillo',city:'Caerleon',test:gatheringFamily('HIDE','KNIFE'),market:'royal'},
 {key:'gather_ore',label:'Minero · equipo, mochila y pico',city:'Caerleon',test:gatheringFamily('ORE','PICK'),market:'royal'},
 {key:'gather_fiber',label:'Cosechador · equipo, mochila y hoz',city:'Caerleon',test:gatheringFamily('FIBER','SICKLE'),market:'royal'},
 {key:'gather_rock',label:'Cantero · equipo, mochila y martillo',city:'Caerleon',test:gatheringFamily('ROCK','HAMMER'),market:'royal'},
 {key:'gather_fish',label:'Pescador · equipo, mochila y caña',city:'Caerleon',test:gatheringFamily('FISH','FISHINGROD'),market:'royal'},
 {key:'gather_tools',label:'Herramientas · todas las especialidades',city:'Caerleon',test:id=>gatheringTools.test(id),market:'royal'},
 {key:'gather_tool_axe',label:'Hachas de leñador · normales y avalonianas',city:'Caerleon',test:gatheringTool('AXE'),market:'royal'},
 {key:'gather_tool_pick',label:'Picos · normales y avalonianos',city:'Caerleon',test:gatheringTool('PICK'),market:'royal'},
 {key:'gather_tool_sickle',label:'Hoces · normales y avalonianas',city:'Caerleon',test:gatheringTool('SICKLE'),market:'royal'},
 {key:'gather_tool_knife',label:'Cuchillos de desollar · normales y avalonianos',city:'Caerleon',test:gatheringTool('KNIFE'),market:'royal'},
 {key:'gather_tool_hammer',label:'Martillos de piedra · normales y avalonianos',city:'Caerleon',test:gatheringTool('HAMMER'),market:'royal'},
 {key:'gather_tool_fishing',label:'Cañas de pescar · normales y avalonianas',city:'Caerleon',test:gatheringTool('FISHINGROD'),market:'royal'},
 {key:'gather_tool_tracking',label:'Kits de rastreo',city:'Caerleon',test:gatheringTool('TRACKING'),market:'royal'},
 {key:'gather_all',label:'Todo el equipo y herramientas de recolección',city:'Caerleon',test:gatheringGearOrTool,market:'royal'},
 {key:'potion_all',label:'Todas las pociones',city:'Brecilien',test:byId(/^T[2-8]_POTION_/),market:'royal'},
 {key:'potion_heal',label:'Pociones de curación',city:'Brecilien',test:byId(/^T[2-8]_POTION_HEAL(?:@|$)/),market:'royal'},
 {key:'potion_energy',label:'Pociones de energía',city:'Brecilien',test:byId(/^T[2-8]_POTION_ENERGY(?:@|$)/),market:'royal'},
 {key:'potion_poison',label:'Pociones de veneno',city:'Brecilien',test:byId(/^T[2-8]_POTION_COOLDOWN(?:@|$)/),market:'royal'},
 {key:'potion_gigant',label:'Pociones de gigantismo',city:'Brecilien',test:byId(/^T[2-8]_POTION_REVIVE(?:@|$)/),market:'royal'},
 {key:'potion_resist',label:'Pociones de resistencia',city:'Brecilien',test:byId(/^T[2-8]_POTION_STONESKIN(?:@|$)/),market:'royal'},
 {key:'potion_sticky',label:'Pociones pegajosas',city:'Brecilien',test:byId(/^T[2-8]_POTION_SLOWFIELD(?:@|$)/),market:'royal'},
 {key:'potion_invis',label:'Pociones de invisibilidad',city:'Brecilien',test:byId(/^T[2-8]_POTION_CLEANSE(?:@|$)/),market:'royal'},
 {key:'potion_calm',label:'Pociones de calma',city:'Brecilien',test:byId(/^T[2-8]_POTION_MOB_RESET(?:@|$)/),market:'royal'},
 {key:'potion_cleanse',label:'Pociones de limpieza',city:'Brecilien',test:byId(/^T[2-8]_POTION_CLEANSE2(?:@|$)/),market:'royal'},
 {key:'potion_acid',label:'Pociones de ácido',city:'Brecilien',test:byId(/^T[2-8]_POTION_ACID(?:@|$)/),market:'royal'},
 {key:'potion_berserk',label:'Pociones de berserker',city:'Brecilien',test:byId(/^T[2-8]_POTION_BERSERK(?:@|$)/),market:'royal'},
 {key:'potion_fire',label:'Pociones de fuego infernal',city:'Brecilien',test:byId(/^T[2-8]_POTION_LAVA(?:@|$)/),market:'royal'},
 {key:'potion_gather',label:'Pociones de recolección',city:'Brecilien',test:byId(/^T[2-8]_POTION_GATHER(?:@|$)/),market:'royal'},
 {key:'potion_tornado',label:'Tornados en botella',city:'Brecilien',test:byId(/^T[2-8]_POTION_TORNADO(?:@|$)/),market:'royal'},
 {key:'mount_all',label:'Todas las monturas ensillables',city:null,test:byId(/^T[3-8]_MOUNT_(?!.*_SKIN)/),market:'royal'},
 {key:'mount_horse',label:'Caballos y caballos blindados',city:null,test:byId(/^T[3-8]_MOUNT_(?:HORSE|ARMORED_HORSE)(?:@|$)/),market:'royal'},
 {key:'mount_ox',label:'Bueyes de transporte',city:null,test:byId(/^T[3-8]_MOUNT_OX(?:@|$)/),market:'royal'},
 {key:'food_all',label:'Todas las comidas',city:'Caerleon',test:byId(/^T[1-8]_MEAL_/),market:'royal'},
 {key:'food_soup',label:'Sopas',city:'Caerleon',test:byId(/^T[1-8]_MEAL_SOUP(?:_|@|$)/),market:'royal'},
 {key:'food_salad',label:'Ensaladas',city:'Caerleon',test:byId(/^T[1-8]_MEAL_(?:SALAD|SEAWEEDSALAD)(?:_|@|$)/),market:'royal'},
 {key:'food_pie',label:'Pasteles',city:'Caerleon',test:byId(/^T[1-8]_MEAL_PIE(?:_|@|$)/),market:'royal'},
 {key:'food_omelette',label:'Tortillas',city:'Caerleon',test:byId(/^T[1-8]_MEAL_OMELETTE(?:_|@|$)/),market:'royal'},
 {key:'food_stew',label:'Guisos',city:'Caerleon',test:byId(/^T[1-8]_MEAL_STEW(?:_|@|$)/),market:'royal'},
 {key:'food_sandwich',label:'Bocadillos',city:'Caerleon',test:byId(/^T[1-8]_MEAL_SANDWICH(?:_|@|$)/),market:'royal'},
 {key:'food_roast',label:'Asados',city:'Caerleon',test:byId(/^T[1-8]_MEAL_ROAST(?:_|@|$)/),market:'royal'},
 {key:'food_fish',label:'Platos de pescado',city:'Caerleon',test:byId(/^T[1-8]_MEAL_(?:.*_FISH(?:@|$)|GRILLEDFISH(?:@|$))/),market:'royal'},
 {key:'food_avalon',label:'Comidas avalonianas',city:'Caerleon',test:byId(/^T[1-8]_MEAL_.*_AVALON(?:@|$)/),market:'royal'}
);

