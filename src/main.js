import {GROUPS,BRANCHES,BRANCH_BY_KEY,MARKETS,itemImage,catalogPage,variant} from './branches.js';
import {marketFetch,summarizeHistory,rankEntries,quoteMap,utcRange} from './market.js';
import {DEFAULTS,settings,returnRate,buildCandidates,allocatePlan,simulateItem,estimatedFame,journalEstimate} from './planner.js';
import {batchCalculate,variantChoices} from './batch-calculator.js';
import {markedItemsForPlanner,transferPlanRows} from './planner-transfer.js';
import {catalogItemMatches,catalogFamilies,expandSelectedFamilies,familyKey,reconcileMarketEvidence,observedWindow,trafficSignal} from './market-intelligence.js';
import {REFINING_TYPES,referenceRefiningRecipes,refinedId} from './refining.js';
import {FLIP_DEFAULTS,flipSettings,scanFlipRoutes,allocateFlips} from './flipping.js';

const $=selector=>document.querySelector(selector);
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const compact=n=>Number(n||0).toLocaleString('es-ES',{maximumFractionDigits:1});
const silver=n=>Math.round(Number(n||0)).toLocaleString('es-ES');
const small=n=>{const x=Number(n||0);return Math.abs(x)>=1e9?(x/1e9).toLocaleString('es-ES',{maximumFractionDigits:2})+'B':Math.abs(x)>=1e6?(x/1e6).toLocaleString('es-ES',{maximumFractionDigits:2})+'M':Math.abs(x)>=1e3?(x/1e3).toLocaleString('es-ES',{maximumFractionDigits:1})+'K':compact(x);};
const formatTime=s=>s?new Date(s).toLocaleString('es-ES',{timeZone:'UTC',dateStyle:'short',timeStyle:'short'})+' UTC':'Sin hora';
const specialGroups=new Set(['mounts','potions','foods','gathering','kits','siege']);
const ROYAL_MARKETS=MARKETS.filter(m=>m!=='Black Market');
const FLIP_CITY_OPTIONS=['Bridgewatch','Fort Sterling','Lymhurst','Martlock','Thetford','Caerleon','Brecilien','Black Market'];
const REFINE_DEFAULT={type:'METALBAR',tiers:[4,5,6,7,8],enchants:[0,1,2,3],saleMarkets:['Thetford'],budget:10000000,style:'balanced',goal:'silver',diversify:true,minRoiPct:5,buyBufferPct:8,sellHaircutPct:2,stationFee:0,deliveryCostPerUnit:0,dailyBonus:0,focus:false,focusPerCraft:0,focusAvailable:0};
const persisted=(()=>{try{return JSON.parse(localStorage.getItem('gildem_market_standalone_settings')||'{}');}catch{return {};}})();
const state={mobileCards:persisted.mobileCards!==false,page:'top',recipes:{},names:{},catalogStatus:'Cargando…',catalogError:null,specialLoaded:false,specialWarning:'',specialAttempted:false,
 selectedBranches:new Set(Array.isArray(persisted.branches)?persisted.branches:['axe']),markets:new Set(Array.isArray(persisted.markets)?persisted.markets:['Black Market']),
 saleMarkets:new Set(Array.isArray(persisted.saleMarkets)?persisted.saleMarkets:['Black Market']),openedGroups:new Set(),
 days:Number(persisted.days)||7,sort:persisted.sort||'silver',catalogMode:persisted.catalogMode==='selected'?'selected':'all',catalogSearch:'',catalogOnlySelected:false,catalogPicked:new Set(Array.isArray(persisted.catalogPicked)?persisted.catalogPicked.slice(0,150).map(x=>familyKey(x)||x):[]),customBudget:Number(persisted.customBudget)||12500000,forceFresh:persisted.forceFresh!==false,top:[],coverage:null,scannedIds:new Set(),pageOffset:0,tableLimit:65,
 marked:new Set(),plannerSignals:Array.isArray(persisted.plannerSignals)?persisted.plannerSignals.slice(0,300):[],plannerItems:Array.isArray(persisted.plannerItems)?[...new Set(persisted.plannerItems.filter(id=>typeof id==='string'&&/^[A-Z0-9_@-]{3,100}$/.test(id)))].slice(0,150):[],planTransferSummary:[],refine:{...REFINE_DEFAULT,...(persisted.refine||{})},refineResult:null,refineNotes:[],refineRunning:false,refineRecipeVerified:0,flip:{...FLIP_DEFAULTS,...(persisted.flip||{})},flipItems:Array.isArray(persisted.flipItems)?persisted.flipItems.filter(id=>/^[A-Z0-9_@-]{3,100}$/.test(id)).slice(0,150):[],flipResult:null,flipRunning:false,flipErrors:[],flipFetchedAt:null,batchItems:Array.isArray(persisted.batchItems)?persisted.batchItems.filter(x=>x&&/^[A-Z0-9_@-]+$/.test(x.id)&&Number(x.qty)>=1).slice(0,150).map(x=>({id:x.id,qty:Math.min(100000,Math.round(x.qty)),noBonus:x.noBonus===true})):[],batchOverrides:persisted.batchOverrides||{buy:{},sellBM:{},sellRoyal:{}},batchResult:null,batchQuotes:null,batchBusy:false,batchSearch:'',filters: {...DEFAULTS,...(persisted.filters||{})},result:null,resultDiagnostics:null,scanLimit:150,lastQuote:null,singleItem:'',singleQty:1,singleResult:null,singleLoading:false,queryActive:false,planActive:false};
if(state.selectedBranches.size>6)state.selectedBranches=new Set([...state.selectedBranches].slice(0,6));
for(const key of [...state.selectedBranches])if(!BRANCH_BY_KEY.has(key))state.selectedBranches.delete(key);
for(const name of [...state.markets])if(!MARKETS.includes(name))state.markets.delete(name);
for(const name of [...state.saleMarkets])if(!MARKETS.includes(name))state.saleMarkets.delete(name);
if(Number(persisted.schemaVersion||0)<5)state.filters.diversify=true; // activar variedad al migrar desde v1.4
const save=()=>{try{localStorage.setItem('gildem_market_standalone_settings',JSON.stringify({schemaVersion:10,mobileCards:state.mobileCards,refine:state.refine,flip:state.flip,flipItems:state.flipItems,forceFresh:state.forceFresh,catalogMode:state.catalogMode,catalogPicked:[...state.catalogPicked],plannerSignals:state.plannerSignals,branches:[...state.selectedBranches],markets:[...state.markets],saleMarkets:[...state.saleMarkets],plannerItems:state.plannerItems,days:state.days,sort:state.sort,filters:state.filters,customBudget:state.customBudget,batchItems:state.batchItems,batchOverrides:state.batchOverrides}));}catch{}};
const name=id=>state.names[id]||id;
let toastTimer;function toast(msg){const element=$('#toast');element.textContent=msg;element.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>element.classList.remove('show'),4600);}
function marketImage(id){if(!/^[A-Z0-9_@-]+$/.test(id))return '';return itemImage(id);}
function img(id){return `<img src="${marketImage(id)}" width="39" height="39" alt="" loading="lazy" onerror="this.style.opacity='.13'">`;}
// City branding is presentational only: data and quote selection stay unchanged.
const CITY_KEYS={'Black Market':'black-market',Caerleon:'caerleon',Bridgewatch:'bridgewatch','Fort Sterling':'fort-sterling',Lymhurst:'lymhurst',Martlock:'martlock',Thetford:'thetford',Brecilien:'brecilien'};
const cityDisplay=city=>city==='Black Market'?'Mercado Negro':city;
function cityBadge(city,extra=''){
 const key=CITY_KEYS[city];
 if(!key)return `<span class="city-unverified">${escape(city||'Sin cotización')}</span>`;
 return `<span class="city-label city--${key} ${extra}"><span class="city-gem" aria-hidden="true">◆</span><span>${escape(cityDisplay(city))}</span></span>`;
}
function copyNameButton(id,kind='item',override=null){
 const label=escape(override||name(id));
 return `<button type="button" class="copy-name-btn" data-copy-name="${label}" data-copy-id="${escape(id)}" aria-label="Copiar nombre de ${label}" title="Copiar nombre · Shift + clic para copiar ID"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none"><rect x="8" y="8" width="11" height="12" rx="2" stroke="currentColor" stroke-width="1.6"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h2" stroke="currentColor" stroke-width="1.6"/></svg></button>`;
}
function tierBadge(id){const v=variant(id);if(!v)return '';return `<span class="tier-badge tier-ench-${Math.min(4,v.ench)}">T${v.tier}.${v.ench}</span>`;}
function displayedInt(n){return Number.isFinite(Number(n))?silver(n):'—';}
function itemWithCopy(id,{showId=false,label=null}={}){
 return `<div class="item-cell game-item-cell">${img(id)}<div class="item-text"><div class="item-primary"><strong>${escape(label||name(id))}</strong>${copyNameButton(id,'item',label)}${tierBadge(id)}</div>${showId?`<small class="item-id">${escape(id)}</small>`:''}</div></div>`;
}

function hero(which){
 const pages={flip:['ARBITRAJE DE WEST','Flips · ciudades y BM','Encuentra diferencias de compra/venta entre ciudades con datos West, presupuestos, costes y cupos de actividad.','royal-market.webp','Royal → Royal · Royal → BM'],refine:['REFINADO DE RECURSOS','Refinamiento','Calcula lingotes, tablas, tela, cuero y piedra con recetas, historial Q1 y precios observados de West.','royal-market.webp','5 recursos · retorno por ciudad'],top:['EXPLORADOR DE MERCADO','Top Mercado','Consulta el ranking, marca los artículos que te interesan y envíalos a Craft Planner o directamente a la calculadora.','top-market.webp','History · calidades 1–5'],planner:['PLANIFICACIÓN INTELIGENTE','Craft Planner','Decide dónde vender, cuánto invertir y qué fabricar. El plan se basa únicamente en los artículos que enviaste desde Top Mercado.','planning.webp','Historial Q1 · diversidad por tiers'],calc:['TALLER DE CRAFTING','Calculadora de Craft','Trabaja con lotes, cantidades y materiales. Compara BM y Royal o revisa los objetos enviados desde Craft Planner.','forge.webp','Lotes, recursos y diarios']};
 const [label,title,desc,scene,pill]=pages[which]||pages.top;
 return `<section class="hero hero--${which}"><div class="hero-copy"><span class="kicker">${label}</span><h1>${title}</h1><p>${desc}</p><div class="chips"><span class="chip">AODP · América / West</span><span class="chip">${pill}</span><span class="chip">Caché 1 hora · precios con fecha</span></div></div><img class="hero-game-scene" src="/assets/scenes/${scene}" alt="" aria-hidden="true"></section>`;
}
function heading(title,desc,actions=''){return `<div class="panel-heading"><div><h2>${title}</h2>${desc?`<p>${desc}</p>`:''}</div>${actions}</div>`;}
function branchGroups(){return GROUPS.map(g=>{const count=g.items.filter(i=>state.selectedBranches.has(i.key)).length;
 return `<details class="branch-group ${count?'has-selection':''}" data-group="${g.key}" ${state.openedGroups.has(g.key)?'open':''}><summary><span class="group-art" aria-hidden="true">${img(g.items[0].iconId)}</span><span class="group-name"><strong>${escape(g.title)}</strong><small>${count} de ${g.items.length}</small></span>${count?`<span class="branch-count">${count}</span>`:''}<span class="group-carret">⌄</span></summary><div class="branch-inside"><div class="group-controls"><span class="hint">${g.items.length} ramas disponibles · máximo 6 en total</span><div><button type="button" data-group-all="${g.key}">Seleccionar todo</button><button type="button" data-group-clear="${g.key}">Borrar</button></div></div><div class="branch-items">${g.items.map(b=>`<button type="button" data-branch="${b.key}" aria-pressed="${state.selectedBranches.has(b.key)}" class="branch-choice ${state.selectedBranches.has(b.key)?'selected':''}">${img(b.iconId)}<span>${escape(b.label)}</span>${state.selectedBranches.has(b.key)?'<span class="choice-check">✓</span>':''}</button>`).join('')}</div></div></details>`;}).join('');}
function selectedBranchPills(){return `<div class="selected-branches" aria-label="Ramas seleccionadas">${[...state.selectedBranches].map(key=>{const branch=BRANCH_BY_KEY.get(key);return branch?`<button type="button" class="selected-branch-pill" data-branch="${key}" title="Quitar ${escape(branch.label)}">${img(branch.iconId)}<span>${escape(branch.label)}</span><b>×</b></button>`:'';}).join('')||'<span class="hint">Sin ramas seleccionadas</span>'}</div>`;}

function catalogSearchMatches(){return catalogFamilies({ids:pool(),names:state.names,branchKeys:[...state.selectedBranches],search:state.catalogSearch,selectedOnly:state.catalogOnlySelected,selectedFamilies:[...state.catalogPicked],maxResults:64});}
function catalogSelectionRows(){const data=catalogSearchMatches();
 return `<div class="catalog-list-header"><strong>${silver(data.total)} tipos de objeto</strong><small>${silver(data.showing)} visibles · una selección incluye todos los tiers y encantamientos disponibles</small></div><div class="catalog-item-grid catalog-families">${data.families.map(f=>`<button type="button" class="catalog-item ${f.selected?'picked':''}" data-catalog-family="${escape(f.key)}" aria-pressed="${f.selected}">${img(f.id)}<span><strong>${escape(f.label)}</strong><small>${silver(f.variants)} variantes en el catálogo</small></span><em>${f.selected?'✓':'+'}</em></button>`).join('')||'<div class="empty tiny-empty">No se encontraron tipos de objeto en estas ramas.</div>'}</div>${data.total>data.showing?'<p class="hint">Usa el buscador para filtrar tipos. Los tiers se muestran después en Top Mercado.</p>':''}`;
}
function catalogSelectionPanel(){const selected=state.catalogPicked.size;
 return `<div class="catalog-selector"><div class="catalog-selector-heading"><div><span class="eyebrow">SELECCIÓN DE OBJETOS</span><h3>Objetos individuales</h3><p>Elige cada tipo una sola vez (por ejemplo, Maza o Maza pesada). <strong>Los tiers y encantamientos se muestran en el Top Mercado</strong>, no aquí.</p></div><span class="counter">${selected} tipos</span></div>
 <div class="catalog-controls"><div class="mode-switch" role="radiogroup" aria-label="Cobertura de objetos"><label class="mode-option ${state.catalogMode==='all'?'active':''}"><input type="radio" name="catalog-mode" value="all" ${state.catalogMode==='all'?'checked':''}> Todos los objetos</label><label class="mode-option ${state.catalogMode==='selected'?'active':''}"><input type="radio" name="catalog-mode" value="selected" ${state.catalogMode==='selected'?'checked':''}> Solo mis objetos (${selected})</label></div><label class="catalog-search-label"><span>Buscar tipo de objeto</span><input id="catalog-search" placeholder="Ej. maza, mangual, bastón…" autocomplete="off" value="${escape(state.catalogSearch)}"></label><label class="checkline"><input type="checkbox" id="catalog-only-selected" ${state.catalogOnlySelected?'checked':''}> Mostrar seleccionados</label></div>
 <div id="catalog-search-results">${catalogSelectionRows()}</div>
 <div class="catalog-actions"><span class="hint">Seleccionas familias, no variantes. Si marcas «Maza», consultarás sus T4–T8 y encantamientos que existan en el catálogo.</span><div class="btn-group"><button class="btn btn-ghost btn-small" id="catalog-select-visible">Marcar visibles</button><button class="btn btn-ghost btn-small" id="catalog-clear">Borrar objetos</button></div></div></div>`;
}
function marketChips(values,field){return `<div class="market-chips">${MARKETS.map(c=>`<label class="market-toggle city-control city--${CITY_KEYS[c]} ${values.has(c)?'active':''}"><input type="checkbox" data-market-${field}="${escape(c)}" ${values.has(c)?'checked':''}><span class="city-gem" aria-hidden="true">◆</span><span>${escape(cityDisplay(c))}</span></label>`).join('')}</div>`;}
function topPanel(){const count=state.selectedBranches.size,st=state.coverage;
 return hero('top')+`<section class="panel branch-picker-panel">${heading('Ramas del mercado','Elige hasta seis ramas. Despliega solo la categoría que necesites.',`<span class="counter">${count} / 6 ramas</span>`)}<div class="branch-picker-top"><span class="hint">${escape(state.catalogStatus)}</span><div class="btn-group"><button class="btn btn-ghost btn-small" id="close-groups">Contraer todo</button><button class="btn btn-ghost btn-small" id="clear-branches">Borrar selección</button></div></div>${selectedBranchPills()}<div class="selector-grid">${branchGroups()}</div>${catalogSelectionPanel()}</section>
 <section class="panel">${heading('Mercados y período','Compara la actividad total con calidad 1. Craft Planner dimensiona sus lotes con Q1; nunca mezcla las demás calidades.')}
 <div class="filters-row"><div class="field"><label for="top-days">Ventana</label><select id="top-days">${[1,3,7,14].map(d=>`<option value="${d}" ${state.days===d?'selected':''}>${d===1?'Último día':d+' días'}</option>`).join('')}</select></div><div class="field"><label for="top-sort">Ordenar por</label><select id="top-sort"><option value="silver" ${state.sort==='silver'?'selected':''}>Silver por día</option><option value="units" ${state.sort==='units'?'selected':''}>Unidades por día</option><option value="price" ${state.sort==='price'?'selected':''}>Precio por unidad</option></select></div></div>
 <div class="soft-line"></div><div class="sub-title">Ciudades de destino</div>${marketChips(state.markets,'top')}
 <div class="toolbar"><div class="inline-tools"><label class="checkline"><input type="checkbox" id="force-top" ${state.forceFresh?'checked':''}> Forzar datos frescos <span class="small-print">(activado por defecto)</span></label></div><div class="btn-group"><button class="btn btn-gold" id="run-top" ${state.queryActive?'disabled':''}>${state.queryActive?'Consultando…':'Consultar top'}</button><button class="btn btn-ghost" id="scan-more" ${!st||st.complete||state.queryActive?'disabled':''}>Ampliar cobertura</button></div></div>
 <div class="notice">Fuente única de mercado: <strong>AODP REST América (West), endpoint History</strong>. El historial se basa en órdenes de venta observadas, no en compras confirmadas. Los promedios pueden diferir del EMV de otras webs y no implican demanda ejecutable. Forzar datos frescos evita la caché de la herramienta y solicita a AODP de nuevo; los datos pueden no cambiar y AODP puede aplicar límites de consultas.</div>
 ${st?`<div class="hint">Cobertura del catálogo de la selección: ${silver(st.nextOffset)} / ${silver(st.total)} IDs considerados · ${silver(state.scannedIds.size)} IDs consultados · ${st.complete?'catálogo consultado':'cobertura parcial, puedes ampliar'} · ${state.coverage.errors?.length||0} lotes con errores.</div>`:''}
 <details class="west-data-source"><summary>¿De dónde salen los datos? · History, Prices y próximas fuentes West</summary><div class="west-data-source-body"><p><strong>En uso:</strong> AODP West History para actividad histórica y Prices para las cotizaciones de compra/venta. Las observaciones no equivalen a transacciones garantizadas.</p><p><strong>Disponible para ampliar:</strong> AODP West Orderbook (niveles de precio y profundidad) y el flujo NATS de West (órdenes deduplicadas). Requieren un módulo de validación y almacenamiento para no confundir órdenes observadas con volumen ejecutable.</p><p>Las páginas de terceros que reutilizan AODP no constituyen una segunda fuente independiente. Por ahora no se combinan precios de terceros sin comprobar su licencia, servidor, calidad y hora.</p><div class="source-links"><a href="https://west.albion-online-data.com/api-docs" target="_blank" rel="noopener noreferrer">Documentación AODP West</a><a href="https://west.albion-online-data.com/developer" target="_blank" rel="noopener noreferrer">NATS y herramientas de desarrollo</a></div></div></details>
 <div id="top-progress" role="status"></div></section>
 <section class="panel" id="top-results">${renderTopResults()}</section>`;
}
function visibleTop(){return rankEntries(state.top.filter(t=>state.markets.has(t.city)),state.sort);}
function renderTopResults(){
 if(!state.top.length)return `${heading('Resultados del mercado','Selecciona ramas y ciudades, pulsa «Consultar top» y verás los datos observados aquí.')}<div class="empty"><div class="loading-symbol">⌕</div><h3>Tu radar de mercado está listo</h3><p>Consulta las ramas que quieras analizar y añade objetos a la calculadora.</p></div>`;
 const rows=visibleTop(),shown=rows.slice(0,state.tableLimit),range=utcRange(state.days);
 const stats=`<div class="metric-strip"><div class="metric"><small>Registros en la muestra</small><strong>${silver(rows.length)}</strong></div><div class="metric"><small>Unidades observadas / día</small><strong>${small(rows.reduce((x,r)=>x+r.averageDailyUnits,0))}</strong></div><div class="metric"><small>Silver observado / día</small><strong>${small(rows.reduce((x,r)=>x+r.averageDailySilver,0))}</strong></div><div class="metric"><small>Seleccionados para plan</small><strong class="accent">${silver(state.marked.size)}</strong></div></div>`;
 return `${heading(`Ranking del mercado · ${escape(range.date)} a ${escape(new Date(range.end-86400000).toISOString().slice(0,10))} UTC`,'Ranking por '+(state.sort==='silver'?'silver/día':state.sort==='units'?'unidades/día':'precio medio')+'. El historial no representa ventas garantizadas.',`<span class="counter">${state.marked.size} marcas</span>`)}${stats}
 <div class="toolbar"><span class="hint">${silver(shown.length)} de ${silver(rows.length)} filas · unidades y precios redondeados al entero · Shift + clic en copiar = ID</span><div class="btn-group"><button class="btn btn-ghost btn-small" id="mark-first">Marcar primeros 50</button><button class="btn btn-ghost btn-small" id="clear-marked">Borrar marcas</button></div></div>
 <div class="top-transfer-bar"><div class="transfer-summary"><strong>◆ ${state.marked.size} filas marcadas · actividad diaria Q1 incluida</strong><small>La ficha conserva artículo, ciudad, ventana UTC, actividad total y Q1. Las marcas no sustituyen tu selección del Planner hasta pulsar Enviar.</small></div><div class="btn-group"><button class="btn btn-gold" id="send-marked-planner" ${!state.marked.size?'disabled':''}>Enviar marcados a Craft Planner (${state.marked.size})</button><button class="btn btn-outline" id="send-marked-flip" ${!state.marked.size?'disabled':''}>Enviar marcados a Flips</button><button class="btn btn-outline" id="send-marked-calc" ${!state.marked.size?'disabled':''}>Enviar marcados a Calculadora de Craft (${state.marked.size})</button></div></div>
 <div class="result-table market-ranking"><table><thead><tr><th class="ranking-col">#</th><th>Objeto</th><th>Mercado</th><th class="numeric">Todas/día</th><th class="numeric">Calidad 1/día</th><th class="numeric">Silver/día</th><th class="numeric">Precio unidad</th><th class="ranking-actions">Acciones</th></tr></thead><tbody>${shown.map((r,i)=>{const key=r.id+'|'+r.city;return `<tr><td class="rank-number">${i+1}</td><td>${itemWithCopy(r.id)}</td><td>${cityBadge(r.city)}</td><td class="numeric"><strong class="rank-metric">${displayedInt(r.averageDailyUnits)}</strong><span class="rank-sub">${silver(r.activeDays)} / ${silver(r.days)} días con actividad</span></td><td class="numeric"><strong class="rank-metric q1-rank">${displayedInt(r.quality1DailyUnits)}</strong><span class="activity-meter" aria-hidden="true"><i style="width:${Math.min(100,100*(r.quality1ActiveDays||0)/Math.max(1,r.days||7))}%"></i></span><span class="rank-sub">${silver(r.quality1ActiveDays)} días Q1 · ${escape(trafficSignal(r).label)}</span></td><td class="numeric"><strong class="rank-metric">${small(r.averageDailySilver)}</strong></td><td class="numeric"><strong class="rank-metric">${displayedInt(r.averageUnitPrice)}</strong></td><td><div class="rank-buttons"><button class="rank-mark ${state.marked.has(key)?'is-marked':''}" data-mark="${escape(key)}" title="${state.marked.has(key)?'Quitar marca':'Marcar artículo'}" aria-label="${state.marked.has(key)?'Quitar marca':'Marcar artículo'}">${state.marked.has(key)?'★':'☆'}</button><button class="btn btn-small btn-ghost rank-add" data-batch-add="${escape(r.id)}">Agregar a Calculadora</button></div></td></tr>`;}).join('')}</tbody></table></div>
 <div class="toolbar"><span class="small-print">AODP History · calidades 1–5 y columna Q1 separada · promedios UTC de actividad de órdenes de venta (no ventas confirmadas). El precio histórico no sustituye a la cotización de compraventa.</span>${state.tableLimit<rows.length?'<button class="btn btn-ghost" id="more-table">Mostrar 65 más</button>':''}</div>${state.coverage?.errors?.length?`<div class="warning">Consulta parcial: ${escape(state.coverage.errors.slice(0,2).join(' · '))}. No se estiman datos faltantes.</div>`:''}`;
}
function toggleChips(array,field){return `<div class="pill-choices">${array.map(x=>{const enabled=field==='tiers'?state.filters.tiers.includes(x):state.filters.enchants.includes(x);return `<label class="toggle-chip ${enabled?'active':''}"><input type="checkbox" data-${field}="${x}" ${enabled?'checked':''}>${field==='tiers'?'T'+x:'.'+x}</label>`;}).join('')}</div>`;}
function calcPage(){return hero('calc')+batchPanel();}
function plannerBasket(){
 const items=state.plannerItems;
 return `<section class="panel planner-basket" id="planner-basket">${heading('Artículos enviados desde Top Mercado','Cada ficha conserva los números del ranking por artículo y mercado. Otros destinos requieren su propio historial Q1.',`<span class="counter">${items.length} / 150 objetos</span>`)}
 ${items.length?`<div class="planner-basket-grid">${items.map(id=>{const signals=state.plannerSignals.filter(x=>x.id===id);return `<div class="planner-basket-item">${img(id)}<span><strong>${escape(name(id))}</strong><small>${signals.length?signals.map(x=>`${escape(cityDisplay(x.city))}: Q1 ${displayedInt(x.q1Daily)} / total ${displayedInt(x.allDaily)} u./día`).join(' · '):'Sin ficha de Top: se consultará Q1 por destino'}</small></span>${tierBadge(id)}<button class="basket-remove" data-planner-remove="${escape(id)}" aria-label="Quitar ${escape(name(id))}">×</button></div>`;}).join('')}</div><div class="planner-basket-footer"><span class="hint">Tu lista persiste aunque consultes otras ramas del mercado.</span><div class="btn-group"><button class="btn btn-ghost btn-small" id="planner-clear">Vaciar selección</button><button class="btn btn-outline btn-small" id="planner-to-top">Volver a Top Mercado</button></div></div>`
 :`<div class="empty"><h3>Tu selección está vacía</h3><p>Marca objetos en Top Mercado y pulsa «Enviar marcados a Craft Planner».</p><button class="btn btn-gold" id="planner-to-top">Explorar Top Mercado</button></div>`}
 </section>`;
}
function plannerPage(){return hero('planner')+`<div class="workflow-steps"><span>1 · Explorar mercado</span><span class="workflow-current">2 · Configurar y generar plan</span><span>3 · Calcular lote</span></div>`+plannerBasket()+planBuilderPanel();}
function planBuilderPanel(){const config=state.filters,rr=returnRate({...config,recipe:{city:'Martlock'}});
 return `<div class="planner-shell"><div class="drawer-content"><section class="panel">${heading('Destino de la inversión','Elige dónde vender los artículos que enviaste desde Top Mercado.',`<span class="counter">${state.saleMarkets.size} mercados</span>`)}
 ${state.plannerItems.length?`<div class="success"><strong>${silver(state.plannerItems.length)} artículos elegidos.</strong> Usará primero las fichas Q1 del Top y consultará solo los destinos adicionales.</div>`:'<div class="warning">Envía artículos desde Top Mercado antes de generar un plan.</div>'}
 <div class="plan-step-title"><b>01</b><span>Elige las ciudades donde quieres VENDER</span><small>${state.saleMarkets.size} / 8 seleccionadas</small></div>${marketChips(state.saleMarkets,'sale')}<div class="toolbar"><p class="muted">Independientes del filtro del ranking. El motor consulta History para cada destino adicional y no inventa actividad inexistente. Solo se evalúan los objetos de la cesta de Craft Planner en las ciudades de venta elegidas.</p><div class="btn-group"><button type="button" class="btn btn-ghost btn-small" id="plan-only-bm">Solo Mercado Negro</button><button type="button" class="btn btn-ghost btn-small" id="plan-all-royals">Todas las Royal</button></div></div></section>
 <section class="panel">${heading('02 · Configuración del plan','Objetivo, nivel de riesgo, costes y controles de liquidez. El presupuesto siempre es un límite máximo.')}
 <div class="config-grid">
  <div class="config-section"><h3>Ciudad de fabricación</h3><label class="checkline"><input type="checkbox" data-cfg="bonusCity" ${config.bonusCity?'checked':''}> Fabricar en ciudad de bono</label><p>Se usa la especialidad declarada de cada receta; no obliga a fabricar todo en una sola ciudad.</p></div>
  <div class="config-section"><h3>Tiers</h3>${toggleChips([4,5,6,7,8],'tiers')}<p>Sin fabricar tiers fuera de tu selección.</p></div>
  <div class="config-section"><h3>Encantamiento</h3>${toggleChips([0,1,2,3,4],'enchants')}<p>Solo variantes con receta y observación.</p></div>
  <div class="config-section"><h3>Bono diario de producción</h3><select data-cfg="dailyBonus"><option value="0" ${config.dailyBonus==0?'selected':''}>Sin bono · 0%</option><option value="10" ${config.dailyBonus==10?'selected':''}>+10%</option><option value="20" ${config.dailyBonus==20?'selected':''}>+20%</option></select><p>El bono diario se suma a producción, no directamente al retorno.</p></div>
  <div class="config-section focus-section ${config.focus?'expanded':''}"><h3>Focus</h3><label class="checkline"><input type="checkbox" data-cfg="focus" ${config.focus?'checked':''}> Usar Focus</label><p>Solo con consumo por fabricación verificado.</p>${config.focus?`<div class="multifield" style="margin-top:12px"><label>Focus/craft verificado<input data-cfg="focusPerCraft" type="number" min="1" value="${config.focusPerCraft}"></label><label>Focus disponible<input data-cfg="focusAvailable" type="number" min="1" value="${config.focusAvailable}"></label><label>Bono Focus (%)<input data-cfg="focusBonus" type="number" min="0" value="${config.focusBonus}"></label></div>`:''}</div>
  <div class="config-section budget-section"><h3>Presupuesto de silver</h3><div class="budget-presets" role="radiogroup" aria-label="Presupuesto máximo">${[5,10,15,20].map(m=>`<label class="budget-choice ${config.budget===m*1000000?'active':''}"><input type="radio" name="budget-preset" data-budget-preset="${m*1000000}" ${config.budget===m*1000000?'checked':''}><span class="budget-check">✓</span>${m}M</label>`).join('')}<label class="budget-choice ${![5,10,15,20].some(m=>config.budget===m*1000000)?'active':''}"><input type="radio" name="budget-preset" data-budget-preset="other" ${![5,10,15,20].some(m=>config.budget===m*1000000)?'checked':''}><span class="budget-check">✓</span>Otro</label></div><label class="field budget-custom" ${[5,10,15,20].some(m=>config.budget===m*1000000)?'hidden':''}><span class="small-print">Presupuesto personalizado (silver)</span><input data-cfg="budget" type="number" min="1000" max="1000000000000" step="1000" value="${config.budget}"></label><p>Máximo disponible, sin obligación de gastarlo.</p></div>
  <div class="config-section"><h3>Días para vender el lote</h3><select data-cfg="saleDays">${[1,3,7,14,30].map(x=>`<option value="${x}" ${config.saleDays==x?'selected':''}>${x} días</option>`).join('')}</select><p>Plazo hasta tu siguiente craft; es una proyección, no una garantía.</p></div>
  <div class="config-section"><h3>Estilo del plan</h3><select data-cfg="style"><option value="prudent" ${config.style==='prudent'?'selected':''}>Prudente · lotes pequeños</option><option value="balanced" ${config.style==='balanced'?'selected':''}>Equilibrado · lotes medios</option><option value="dynamic" ${config.style==='dynamic'?'selected':''}>Dinámico · más volumen</option></select><p>Se estima cuánto afecta al precio tu propio volumen de venta.</p></div>
  <div class="config-section fame-config"><h3>Objetivo del plan</h3><select data-cfg="goal"><option value="silver" ${config.goal==='silver'?'selected':''}>Más silver · sin pérdidas</option><option value="balanced" ${config.goal==='balanced'?'selected':''}>Silver y fama · sin pérdidas</option><option value="fame" ${config.goal==='fame'?'selected':''}>Fama por silver · admite pérdidas limitadas</option></select><p>${config.goal==='fame'?'Prioriza fama/silver y muestras variadas, incluyendo T8 si hay evidencia. Puede cerrar con profit negativo.':'Fama estimada si la receta carece de valor confirmado. Se rechazan rutas con pérdida esperada.'}</p>${config.goal==='fame'?`<label class="fame-loss-input">Máximo de pérdidas estimadas: <input data-cfg="fameLossBudgetPct" type="number" min="0" max="30" step="1" value="${config.fameLossBudgetPct}"> % del presupuesto</label><small class="risk-explain">La pérdida máxima es ${silver(config.budget*config.fameLossBudgetPct/100)} silver. Además ninguna ruta puede perder más de 25% de su capital.</small>`:''}</div>
  <div class="config-section config-half"><h3>Distribución entre tiers y encantamientos</h3><label class="checkline"><input type="checkbox" data-cfg="diversify" ${config.diversify?'checked':''}> <strong>Repartir entre artículos, tiers y encantamientos</strong></label><p>Reserva muestras pequeñas de tiers altos y encantamientos con historial Q1; después reparte cantidades en rondas. El objetivo Fama puede admitir pérdidas limitadas; los otros objetivos no.</p></div>
  <div class="config-section"><h3>Uso del presupuesto</h3><label class="checkline"><input type="checkbox" data-cfg="useBudget" ${config.useBudget?'checked':''}> Usar todo lo posible</label><p>Solo opciones con margen calculable y cupo estimado.</p></div>
  <div class="config-section"><h3>Crafting de volumen</h3><label class="checkline"><input type="checkbox" data-cfg="volume" ${config.volume?'checked':''}> Permitir más volumen prudente</label><p>Sin reserva automática. La actividad histórica limita los lotes.</p></div>
  <div class="config-section"><h3>Costes y cotizaciones</h3><div class="multifield"><label>Impuesto venta %<input type="number" data-cfg="tax" min="0" max="30" step=".1" value="${config.tax}"></label><label>Publicación Royal %<input type="number" data-cfg="listingFee" min="0" max="30" step=".1" value="${config.listingFee}"></label><label>Estación / craft<input type="number" data-cfg="stationFee" min="0" step="1" value="${config.stationFee}"></label></div><p>Máximo de antigüedad de precios: <input aria-label="Antigüedad máxima de precios (horas)" type="number" data-cfg="maxQuoteHours" min="1" max="168" value="${config.maxQuoteHours}" style="width:65px;display:inline-block;padding:3px;height:30px"> horas.</p></div>
  <div class="config-section risk-section config-half" id="profit-protection"><h3>Protección del beneficio · ¿qué significan estos controles?</h3><p>Son ajustes de seguridad para que el plan no parezca rentable solo porque los precios cambien un poco. Son <strong>simulaciones</strong>, no órdenes verificadas.</p><div class="profit-help"><span><strong>Compra +%:</strong> imagina que los materiales cuestan más al comprarlos.</span><span><strong>Venta -%:</strong> calcula cuánto ganarías vendiendo algo más barato.</span><span><strong>ROI mínimo:</strong> ganancia mínima por cada 100 silver invertidos.</span><span><strong>Capital por objeto:</strong> limita cuánto gastar en un solo artículo para diversificar.</span></div><div class="multifield"><label>Colchón compra %<input data-cfg="buyBufferPct" type="number" min="0" max="50" step="1" value="${config.buyBufferPct}"></label><label>Descuento venta %<input data-cfg="sellHaircutPct" type="number" min="0" max="30" step="1" value="${config.sellHaircutPct}"></label><label>ROI mínimo %<input data-cfg="minRoiPct" type="number" min="0" max="100" step="1" value="${config.minRoiPct}"></label><label>Máx. capital / objeto %<input data-cfg="maxCapitalSharePct" type="number" min="5" max="100" step="5" value="${config.maxCapitalSharePct}"></label></div><label class="checkline" style="margin-top:12px"><input data-cfg="stressGuard" type="checkbox" ${config.stressGuard?'checked':''}> Probar si el plan aguanta una caída adicional del 10% en el precio de venta (con las excepciones de diversidad indicadas)</label></div>
  <div class="config-section"><h3>Logística y precio atípico</h3><div class="multifield"><label>Transporte por unidad de salida<input data-cfg="deliveryCostPerUnit" type="number" min="0" step="1" value="${config.deliveryCostPerUnit}"></label><label>Precio máximo vs. media histórica calidad 1 (+%)<input data-cfg="historyPriceCapPct" type="number" min="0" max="100" value="${config.historyPriceCapPct}"></label></div><p>El precio usado es el menor entre la cotización observada y el límite derivado del historial Q1. Transporte: estimación manual, no calculada por ruta.</p></div>
 </div>
 <div class="callout"><strong>${rr.returnPct.toFixed(2)}% de retorno de referencia</strong><div class="hint">Producción con especialidad ilustrativa: ${rr.productionBonus}% = Royal 18% + especialidad 15% + diario ${config.dailyBonus}% + Focus ${config.focus?config.focusBonus:0}%. Cada receta recalcula el retorno según sus condiciones.</div></div>
 <div class="toolbar"><div class="hint">Venta BM: puja; Royal: oferta mínima publicada, no necesariamente una orden ejecutable. Se descuentan impuestos, impacto, colchón de compra y descuento de venta.</div><button class="btn btn-gold" id="run-plan" ${state.planActive||!state.plannerItems.length||!state.saleMarkets.size?'disabled':''}>${state.planActive?'Calculando…':'✧ Generar plan por ciudades'}</button></div>
 <div id="plan-progress" role="status"></div></section>
 <section id="plan-results">${renderPlanResult()}</section></div></div>`;
}
function batchSearchMatches(query){const term=String(query||'').trim().toLocaleLowerCase();if(term.length<2)return [];
 const matches=[];const ids=Object.keys(state.recipes);
 for(const id of ids){if(!state.recipes[id]?.materials?.length||!variant(id))continue;
  const label=name(id);if(!id.toLowerCase().includes(term)&&!label.toLocaleLowerCase().includes(term))continue;
  matches.push(id);if(matches.length>=36)break;
 }
 return matches;}
function batchSearchResults(query){const ids=batchSearchMatches(query);return ids.length?ids.map(id=>`<button type="button" class="batch-search-hit" data-batch-add="${escape(id)}">${img(id)}<span><strong>${escape(name(id))}</strong></span><b>+</b></button>`).join(''):'<div class="hint" style="padding:12px">Escribe al menos 2 caracteres. Solo se muestran artículos con receta cargada.</div>';}
function batchPanel(){return `<section class="panel manual-calculator" id="manual-calculator">${heading('Calculadora de Craft · por lotes','Añade objetos, ajusta cantidades y variantes, compara Mercado Negro y Royal y consulta materiales. Los precios son observaciones, no ventas garantizadas.',`<span class="counter">${state.batchItems.length} / 150 objetos</span>`)}
  ${state.planTransferSummary.length?`<div class="plan-import-notice"><strong>✓ Lote importado desde Craft Planner</strong><p>Se copiaron las cantidades de <strong>fabricaciones</strong>. Esta calculadora compara precios BM/Royal de forma independiente; el profit y las rutas por ciudad permanecen en Craft Planner.</p><div class="plan-import-routes">${state.planTransferSummary.slice(0,18).map(x=>`<span>${escape(name(x.id))} ×${silver(x.qty)} · ${x.cities.map(city=>escape(cityDisplay(city))).join(', ')}</span>`).join('')}</div></div>`:''}
  <div class="batch-toolbar"><div class="batch-search"><label for="batch-search">Añadir objeto</label><input type="search" id="batch-search" autocomplete="off" placeholder="Busca arco, espada, bolsa, T6_…" value="${escape(state.batchSearch)}"><div id="batch-search-results" class="batch-search-results" ${state.batchSearch.length<2?'hidden':''}>${batchSearchResults(state.batchSearch)}</div></div>
  <label class="batch-inline-control"><input type="checkbox" data-cfg="focus" ${state.filters.focus?'checked':''}> Usar Focus</label>
  <label class="batch-inline-select">Bono diario <select data-cfg="dailyBonus"><option value="0" ${state.filters.dailyBonus==0?'selected':''}>Sin bono</option><option value="10" ${state.filters.dailyBonus==10?'selected':''}>+10 %</option><option value="20" ${state.filters.dailyBonus==20?'selected':''}>+20 %</option></select></label>
  <div class="btn-group"><button class="btn btn-gold btn-small" id="batch-run" ${state.batchBusy?'disabled':''}>${state.batchBusy?'Consultando…':'Recalcular'}</button><button class="btn btn-ghost btn-small" id="batch-refresh" ${state.batchBusy?'disabled':''}>Precios frescos</button><button class="btn btn-ghost btn-small" id="batch-copy" ${!state.batchResult?.materials?.length?'disabled':''}>Copiar compras</button><button class="btn btn-ghost btn-small" id="batch-export" ${!state.batchResult?.rows?.length?'disabled':''}>CSV</button><button class="btn btn-ghost btn-small" id="batch-clear" ${!state.batchItems.length?'disabled':''}>Vaciar</button></div></div>
  ${state.filters.focus&&!(state.filters.focusPerCraft>0&&state.filters.focusAvailable>0)?'<div class="warning">Focus activado: para calcularlo configura consumo por craft y Focus disponible dentro de «Generador automático de planes». No se asumirá Focus gratis.</div>':''}
  <div id="batch-result">${batchResultHTML()}</div></section>`;}
function batchResultHTML(){
 const result=state.batchResult;
 if(!state.batchItems.length)return `<div class="empty compact-empty"><h3>Tu mesa de crafting está vacía</h3><p>Busca un objeto o añádelo desde Top Mercado. No necesitas generar un plan automático.</p></div>`;
 if(!result)return `<div class="notice">${state.batchBusy?'Consultando cotizaciones y recetas de AODP West…':'Has añadido objetos. Pulsa «Recalcular» para consultar el lote.'}</div>`;
 const t=result.totals;
 const kpi=(title,value,subtitle,cls='')=>`<div class="metric batch-kpi"><small>${title}</small><strong class="${cls}">${value}</strong><span>${subtitle}</span></div>`;
 let html=`<div class="batch-kpis">${kpi('Capital de compra',t.incomplete?'Pendiente':silver(t.buyCapital),'Compra neta estimada')}${kpi('Profit Mercado Negro',t.profitBM===null?'Sin calcular':(t.profitBM>=0?'+':'')+silver(t.profitBM),'Puja observada · impuestos',t.profitBM===null?'':t.profitBM>=0?'green':'red')}${kpi('Profit Royal',t.profitRoyal===null?'Sin calcular':(t.profitRoyal>=0?'+':'')+silver(t.profitRoyal),'Cotización Royal más favorable',t.profitRoyal===null?'':t.profitRoyal>=0?'green':'red')}${kpi('Fama de crafting',silver(t.fame),`${silver(t.crafts)} crafts · ${silver(t.units)} unidades`)}</div>`;
 html+=`<div class="section-heading"><h3>Objetos para fabricar</h3><span>${silver(result.rows.length)} variantes</span></div><div class="batch-table-wrap"><table class="batch-table game-craft-table"><thead><tr><th>Objeto</th><th>Cantidad</th><th>Fabricar en</th><th class="numeric">Coste</th><th class="numeric">Profit M. Negro</th><th class="numeric">Profit Royal</th><th class="numeric">Fama</th><th aria-label="Quitar objeto"></th></tr></thead><tbody>`;
 for(const r of result.rows){
  const all=variantChoices(Object.keys(state.recipes),r.id),tiers=[...new Set(all.map(id=>variant(id)?.tier))].filter(Boolean).sort((a,b)=>a-b),v=variant(r.id)||{tier:4,ench:0};
  const enchants=[...new Set(all.filter(id=>variant(id)?.tier===v.tier).map(id=>variant(id)?.ench))].sort((a,b)=>a-b);
  const option=(values,current,kind)=>`<select aria-label="${kind==='tier'?'Tier':'Encantamiento'} de ${escape(name(r.id))}" data-batch-${kind}="${escape(r.id)}">${values.map(num=>`<option value="${num}" ${num===current?'selected':''}>${kind==='tier'?'T'+num:'.'+num}</option>`).join('')}</select>`;
  const profit=(value,price,market)=>`<div class="profit-cell"><strong class="${value==null?'unverified':value>=0?'green':'red'}">${value==null?`<span class="missing-profit">${r.reason?'Faltan precios':'Sin cotización'}</span>`:(value>=0?'+':'')+silver(value)}</strong>${market==='royal'&&r.royalCity?cityBadge(r.royalCity,'city-small'):''}<div class="batch-price"><input type="number" min="0" step="1" aria-label="Precio manual ${market==='bm'?'Mercado Negro':'Royal'} de ${escape(name(r.id))}" placeholder="${market==='bm'?'Puja BM':'Venta Royal'}" data-batch-price-${market}="${escape(r.id)}" value="${state.batchOverrides[market==='bm'?'sellBM':'sellRoyal']?.[r.id]??price??''}"></div></div>`;
  html+=`<tr class="${r.reason?'batch-invalid':''}"><td><div class="craft-object">${itemWithCopy(r.id)}<div class="variant-row">${option(tiers,v.tier,'tier')}${option(enchants,v.ench,'ench')}</div></div></td><td><input type="number" class="batch-qty" data-batch-qty="${escape(r.id)}" min="1" max="100000" value="${r.qty}" aria-label="Fabricaciones de ${escape(name(r.id))}"></td><td><div class="city-stack">${cityBadge(r.craftCity)}<small>${Number(r.returnPct||0).toFixed(1)} % retorno</small></div><label class="batch-no-bonus"><input data-batch-nobonus="${escape(r.id)}" type="checkbox" ${state.batchItems.find(i=>i.id===r.id)?.noBonus?'checked':''}> Fuera de ciudad de bono</label></td><td class="numeric"><strong>${r.reason?'Faltan precios':silver(r.cost)}</strong><small class="batch-subtext">${r.reason?escape(r.reason):'Capital bruto '+silver(r.capital)}</small></td><td class="numeric">${profit(r.profitBM,r.bmPrice,'bm')}</td><td class="numeric">${profit(r.profitRoyal,r.royalPrice,'royal')}</td><td class="numeric"><strong>${displayedInt(r.fame)}${r.fameEstimated?' ≈':''}</strong></td><td><button class="remove-object" data-batch-remove="${escape(r.id)}" aria-label="Quitar ${escape(name(r.id))}" title="Quitar objeto">×</button></td></tr>`;
 }
 html+='</tbody></table></div><p class="batch-caption">Los precios introducidos manualmente sustituyen las observaciones. Un beneficio sin cotización completa se muestra como no calculable, nunca como ganancia.</p>';
 html+=`<div class="section-heading materials-heading"><h3>Lista de compras · materiales y diarios</h3><button class="btn btn-ghost btn-small" id="batch-copy-secondary" ${!result.materials.length?'disabled':''}>▣ Copiar lista</button></div><div class="batch-table-wrap"><table class="batch-table materials-table game-materials-table"><thead><tr><th>Material / diario</th><th>Para</th><th>Comprar en</th><th class="numeric">A comprar</th><th class="numeric">Precio unidad</th><th class="numeric">Total</th></tr></thead><tbody>`;
 let lastJournalTier=null;
 for(const m of result.materials){
  if(m.journal&&m.tier!==lastJournalTier){html+=`<tr class="journal-tier-group"><td colspan="6">▣ Diarios T${m.tier} · compras opcionales, cantidad agrupada y estimada</td></tr>`;lastJournalTier=m.tier;}
  html+=`<tr class="${m.journal?'journal-material-row':''} ${m.missing?'material-missing':m.pending?'material-pending':''}"><td>${itemWithCopy(m.id,{label:m.displayName})}${m.journal?'<span class="estimated-journal-badge">DIARIO ESTIMADO · OPCIONAL</span>':''}${m.missing?`<span class="unverified material-warning">${m.journal?'Diario sin precio (opcional)':'Sin cotización verificable'}</span>`:m.pending?'<span class="unverified material-warning">Lote pendiente de precio</span>':''}</td><td><div class="used-by-items">${m.usedBy.slice(0,4).map(id=>`<img src="${marketImage(id)}" width="34" height="34" title="${escape(name(id))}" alt="${escape(name(id))}" loading="lazy">`).join('')}</div></td><td>${cityBadge(m.city)}</td><td class="numeric"><strong>${silver(m.buy)}</strong><small class="batch-subtext">${m.journal?'estimación · no obligatorio':m.returned>0?'reutilizas ≈ '+displayedInt(m.returned):'sin retorno'}</small></td><td class="numeric"><input class="material-price ${m.missing?'quote-missing':''}" type="number" min="0" step="1" data-batch-buy="${escape(m.id)}" value="${state.batchOverrides.buy?.[m.id]??m.unitPrice??''}" placeholder="Precio" aria-label="Precio de ${escape(name(m.id))}" title="${m.missing?'Sin cotización: introduce precio manual si deseas incluirlo en la estimación':'Editar precio observado'}">${m.missing?'<small class="price-hint">Sin precio</small>':m.manual?'<small class="batch-subtext">Precio manual</small>':''}</td><td class="numeric"><strong>${m.pending?'—':silver(m.total)}</strong></td></tr>`;
 }
 if(!result.materials.length)html+='<tr><td colspan="6">No hay materiales para mostrar.</td></tr>';
 html+='</tbody></table></div>';
 if(result.journals.length)html+=`<div class="journal-ledger-notice"><strong>${result.journals.length} tipos de diarios agrupados por tier.</strong> Compra adicional estimada de diarios con precios disponibles: <b>${silver(t.journalCost)}</b> silver${t.journalsUnpriced?' · '+silver(t.journalsUnpriced)+' tipos sin precio':''}. <strong>No se incluye en capital de crafting ni en profit</strong>: son opcionales, su consumo depende de cómo los llenes y las cantidades son estimaciones.</div>`;
 if(result.warnings.length)html+=`<div class="warning">${result.warnings.map(escape).join(' · ')}</div>`;
 html+='<p class="batch-caption">El capital bruto puede superar la compra neta calculada con reutilización. Comprueba profundidad de órdenes, antigüedad de los precios y costes reales antes de invertir.</p>';
 return html;
}
function batchRefreshResult(){if(!state.batchItems.length){state.batchResult=null;return updatePage();}if(!state.batchQuotes)return runBatch(false);try{state.batchResult=batchCalculate({items:state.batchItems,recipes:state.recipes,quotes:state.batchQuotes,history:state.top,config:state.filters,overrides:state.batchOverrides});const out=$('#batch-result');if(out){out.innerHTML=batchResultHTML();labelPhoneTables();}}catch(e){state.batchResult=null;const out=$('#batch-result');if(out)out.innerHTML=`<div class="warning">${escape(e.message)}</div>`;toast(e.message);}}
function batchAdd(id){if(!state.recipes[id]?.materials?.length)return toast('Este artículo no tiene receta cargada.');const entry=state.batchItems.find(x=>x.id===id);
 if(entry)entry.qty=Math.min(100000,entry.qty+1);else{if(state.batchItems.length>=150)return toast('Máximo 150 objetos.');state.batchItems.push({id,qty:1,noBonus:false});}
 state.batchSearch='';save();state.batchResult=null;state.batchQuotes=null;if(state.page!=='calc')nav('calc');else updatePage();void runBatch();}
async function runBatch(force=false){if(state.batchBusy||!state.batchItems.length)return;state.batchBusy=true;state.batchResult=null;
 const out=$('#batch-result');if(out)out.innerHTML='<div class="notice">Consultando cotizaciones de AODP West y calculando el lote…</div>';
 try{const ids=[...new Set(state.batchItems.flatMap(item=>{
    const recipe=state.recipes[item.id];const j=journalEstimate(item.id,estimatedFame(item.id,recipe,state.filters.premium),item.qty);
    return [item.id,...(recipe?.materials||[]).map(m=>m.id),...(j?[j.id]:[])];
   }))];
  const response=await marketFetch('prices',ids,{cities:MARKETS,qualities:'1',force});if(!response.coverage)throw Error(response.errors.slice(0,3).join(' · ')||'No fue posible consultar precios.');
  state.batchQuotes=quoteMap(response.rows);state.batchResult=batchCalculate({items:state.batchItems,recipes:state.recipes,quotes:state.batchQuotes,history:state.top,config:state.filters,overrides:state.batchOverrides});
  if(response.errors.length)state.batchResult.warnings.push(`${response.errors.length} lotes incompletos: hay precios sin verificar.`);
 }catch(e){toast(e.message);state.batchResult=null;if($('#batch-result'))$('#batch-result').innerHTML=`<div class="warning">${escape(e.message)}</div>`;}
 finally{state.batchBusy=false;if(state.page==='calc'&&$('#batch-result')&&state.batchResult){$('#batch-result').innerHTML=batchResultHTML();labelPhoneTables();const b=$('#batch-run');if(b)b.disabled=false;const r=$('#batch-refresh');if(r)r.disabled=false;}}}
function sendMarkedToPlanner(){
 const transfer=markedItemsForPlanner(visibleTop(),state.marked,state.recipes,state.plannerItems,150,state.plannerSignals,true);
 if(!state.marked.size)return toast('Marca artículos antes de enviarlos.');
 if(!transfer.items.length)return toast('Marca artículos válidos para enviarlos al Planner.');
 state.plannerItems=transfer.items;state.plannerSignals=transfer.signals;const cities=new Set(state.plannerSignals.filter(x=>state.plannerItems.includes(x.id)).map(x=>x.city));if(cities.size)state.saleMarkets=cities;state.result=null;state.resultDiagnostics=null;save();nav('planner');
 toast(`${transfer.added} artículos añadidos al Planner${transfer.rejectedNoRecipe?` · ${transfer.rejectedNoRecipe} pendientes de verificar con el dump`:''}${transfer.skippedLimit?` · ${transfer.skippedLimit} fuera del límite`:''}.`);
}
function sendPlanToCalculator(){
 try{
  const transfer=transferPlanRows(state.result?.rows);
  state.batchItems=transfer.items.map(x=>({...x,noBonus:state.filters.bonusCity===false}));
  state.planTransferSummary=transfer.summary;state.batchResult=null;state.batchQuotes=null;state.batchSearch='';save();
  nav('calc');toast(`${transfer.items.length} variantes y ${silver(transfer.totalCrafts)} fabricaciones enviadas.`);void runBatch();
 }catch(e){toast(e.message);}
}
function sendMarked(){const ids=[...new Set(state.top.filter(r=>state.marked.has(r.id+'|'+r.city)).map(r=>r.id))].filter(id=>state.recipes[id]?.materials?.length);if(!ids.length)return toast('Ningún marcado tiene receta verificable.');let added=0;for(const id of ids){if(state.batchItems.some(x=>x.id===id))continue;if(state.batchItems.length>=150)break;state.batchItems.push({id,qty:1,noBonus:false});added++;}save();state.batchResult=null;state.batchQuotes=null;nav('calc');toast(`${added} objetos añadidos a la calculadora.`);void runBatch();}
function exportBatch(){const r=state.batchResult;if(!r?.rows.length)return toast('Recalcula primero.');const lines=[['TIPO','ITEM','ID','CANTIDAD','CIUDAD','PRECIO','TOTAL'],...r.rows.filter(x=>!x.reason).map(x=>['CRAFT',name(x.id),x.id,x.qty,x.craftCity,0,x.cost]),...r.materials.map(x=>[x.journal?'DIARIO_ESTIMADO_OPCIONAL':'COMPRAR',x.displayName||name(x.id),x.id,x.buy,x.city,x.unitPrice??'',x.total??''])];const csv=lines.map(row=>row.map(value=>'"'+String(value??'').replaceAll('"','""')+'"').join(',')).join('\r\n');const url=URL.createObjectURL(new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'}));const link=document.createElement('a');link.href=url;link.download='gildem-calculadora-lote.csv';link.click();setTimeout(()=>URL.revokeObjectURL(url),500);}
function quickCalcPanel(){
 const available=rankEntries(state.top,'silver').filter(r=>state.saleMarkets.has(r.city)&&state.recipes[r.id]?.materials?.length).slice(0,400);
 const pick=available.find(x=>x.id+'|'+x.city===state.singleItem)||available[0];
 if(!state.singleItem&&pick)state.singleItem=pick.id+'|'+pick.city;
 return `<section class="panel">${heading('Cálculo rápido de un artículo','Simula cualquier cantidad de una pieza del Top, incluso cuando producirla suponga una pérdida. No cambia el plan automático.')}<div class="filters-row"><div class="field" style="flex:3;min-width:225px"><label for="single-item">Artículo y ciudad de venta</label><select id="single-item">${available.map(r=>`<option value="${escape(r.id+'|'+r.city)}" ${state.singleItem===r.id+'|'+r.city?'selected':''}>${escape(name(r.id))} · ${escape(r.city)}</option>`).join('')}</select></div><div class="field"><label for="single-qty">Crafts</label><input id="single-qty" type="number" min="1" max="100000" value="${state.singleQty}"></div><div><button class="btn btn-gold" id="single-run" ${!available.length||state.singleLoading?'disabled':''}>${state.singleLoading?'Calculando…':'Simular lote'}</button></div></div><div class="small-print" style="margin-top:12px">Coste de materiales e impacto estimado. No confirma profundidad del libro de órdenes ni descuenta transporte.</div><div id="single-result">${singleResultHTML()}</div></section>`;
}
function singleResultHTML(){const r=state.singleResult;if(!r)return '<p class="muted">Elige un artículo del Top y calcula un lote de una o varias fabricaciones.</p>';
 return `<div class="metric-strip" style="margin-top:16px"><div class="metric"><small>Capital bruto</small><strong>${small(r.capital)}</strong></div><div class="metric"><small>Coste efectivo</small><strong>${small(r.cost)}</strong></div><div class="metric"><small>Venta estimada</small><strong>${small(r.grossRevenue)}</strong></div><div class="metric"><small>Profit / pérdida</small><strong class="${r.profit>=0?'green':'red'}">${r.profit>0?'+':''}${small(r.profit)}</strong></div></div><div class="hint">${silver(r.qty)} crafts → ${silver(r.units)} unidades · retorno ${r.returnPct.toFixed(2)}% · impacto de precio ${r.impactPercent.toFixed(2)}% · precio observado ${silver(r.price)} silver/u. · ${formatTime(r.observedAt)}.</div><div class="sub-title" style="margin-top:14px">Materiales de la receta por fabricación</div><div class="market-chips">${r.materials.map(m=>`<span class="mini-card">${escape(name(m.id))} ×${compact(m.count)} · ${escape(m.city)} ${silver(m.price)} silver/u.</span>`).join('')}</div>`;
}
async function runSingle(){if(state.singleLoading)return;
 const [id,city]=(state.singleItem||'').split('|'),rec=state.recipes[id];
 if(!id||!city||!rec)return toast('Selecciona un artículo con receta.');
 state.singleLoading=true;const button=$('#single-run');if(button)button.disabled=true;
 const div=$('#single-result');if(div)div.innerHTML='<p class="notice">Consultando cotizaciones para esta receta…</p>';
 try{const ids=[id,...rec.materials.map(m=>m.id)];
  const data=await marketFetch('prices',ids,{cities:MARKETS,qualities:'1'});
  if(!data.coverage)throw Error('No hay cotizaciones: '+data.errors.slice(0,2).join(' · '));
  const history=state.top.find(r=>r.id===id&&r.city===city);
  state.singleResult=simulateItem({id,city,qty:state.singleQty,recipes:state.recipes,quotes:quoteMap(data.rows),history,config:state.filters});
  if(div)div.innerHTML=singleResultHTML();
 }catch(e){state.singleResult=null;if(div)div.innerHTML=`<div class="warning">${escape(e.message)}</div>`;toast(e.message);}
 finally{state.singleLoading=false;if(button)button.disabled=false;}
}

function renderPlanResult(){const r=state.result;if(!r)return `<section class="panel">${heading('Mi plan de crafting','El motor mostrará artículos viables, inversión, distribución por ciudades y lista de materiales.')}<div class="empty"><h3>Tu siguiente lote empieza con una selección</h3><p>Envía artículos desde Top Mercado, configura las ciudades de venta y genera un lote basado en AODP West.</p></div></section>`;
 const m=r.summary,details=state.resultDiagnostics,notes=state.resultNotes||[];const fromTop=r.rows.filter(x=>x.history?.snapshotMatch).length;const destinations=new Set(r.rows.map(x=>x.city));
 let html=`<section class="panel">${heading('Plan calculado','En modo Fama se permiten pérdidas acotadas; en otros objetivos se exige margen esperado positivo. Siempre sujeto a datos observados.',`<div class="btn-group"><button class="btn btn-gold btn-small" id="send-plan-calc" ${!r.rows.length?'disabled':''}>Enviar lote a Calculadora de Craft (${new Set(r.rows.map(x=>x.id)).size})</button><button class="btn btn-ghost btn-small" id="export-plan">Exportar CSV</button></div>`)}
 <div class="metric-strip"><div class="metric"><small>Inversión bruta reservada</small><strong>${small(m.capitalReserved)}</strong></div><div class="metric"><small>Resultado neto estimado</small><strong class="${m.totalProfit>=0?'green':'red'}">${m.totalProfit>=0?'+':''}${small(m.totalProfit)}</strong></div><div class="metric"><small>Presupuesto sin utilizar</small><strong>${small(m.remaining)}</strong></div><div class="metric"><small>Crafts</small><strong>${silver(m.crafts)}</strong></div></div>
 <div class="variety-strip"><span>⚒ ${new Set(r.rows.map(x=>x.id)).size} variantes</span><span>▣ ${new Set(r.rows.map(x=>variant(x.id)?.tier).filter(Boolean)).size} tiers</span><span>✦ ${new Set(r.rows.map(x=>variant(x.id)?.ench).filter(x=>x!=null)).size} encantamientos</span><span>◎ ${new Set(r.rows.map(x=>x.city)).size} destinos</span></div>
 <div class="hint">ROI sobre capital bruto reservado: ${m.roiOnCapital.toFixed(1)}% · Fama estimada: ${silver(m.totalFame)} · Precios observados con calidad 1. El cálculo incluye colchón, descuento de venta y transporte manual si está configurado; NO verifica órdenes suficientes. Los diarios son opcionales.${state.filters.goal==='fame'?' <strong>Modo Fama:</strong> pérdidas estimadas permitidas hasta '+silver(m.allowedFameLoss||0)+' silver ('+state.filters.fameLossBudgetPct+'% del presupuesto), sin vender más que la fracción prudente de historial Q1.':''}</div>`;
 if(r.rows.length){
  html+=`<div class="evidence-chain"><div class="evidence-node"><small>01 · Ranking → Planner</small><strong>${fromTop} rutas</strong><p>Conservan la actividad Q1 y la ventana UTC del Top que seleccionaste</p></div><div class="evidence-node"><small>02 · Control de liquidez</small><strong>${new Set(r.rows.map(x=>x.id)).size} variantes</strong><p>Cuotas por mercado, días activos y límites de concentración</p></div><div class="evidence-node"><small>03 · Destinos confirmados en datos</small><strong>${destinations.size} mercados</strong><p>Precios Q1 observados y rentabilidad estimada por ciudad</p></div></div>`;
  const citySummary=new Map();
  for(const line of r.rows){const prev=citySummary.get(line.city)||{city:line.city,profit:0,capital:0,units:0,routes:0};
   prev.profit+=line.totalProfit;prev.capital+=line.qty*line.grossCapitalPerCraft;prev.units+=line.qty*line.craftAmount;prev.routes++;citySummary.set(line.city,prev);}
  html+=`<div class="section-heading"><h3>Distribución por ciudad de venta</h3><span>${citySummary.size} destinos activos</span></div><div class="plan-city-summary">${[...citySummary.values()].sort((a,b)=>b.profit-a.profit).map(city=>`<div class="plan-city-card">${cityBadge(city.city)}<div class="plan-city-stats"><span><small>Capital bruto</small><strong>${small(city.capital)}</strong></span><span><small>Beneficio estimado</small><strong class="${city.profit>=0?'green':'red'}">${city.profit>=0?'+':''}${small(city.profit)}</strong></span><span><small>Unidades</small><strong>${silver(city.units)}</strong></span></div></div>`).join('')}</div>`;
  html+=`<div class="toolbar"><strong>Plan por artículo y ciudad</strong><span class="counter">${r.rows.length} rutas</span></div><div class="result-table"><table><thead><tr><th>Artículo</th><th>Fabricar → vender</th><th class="numeric">Crafts</th><th class="numeric">Capital</th><th class="numeric">Beneficio estimado</th><th class="numeric">Impacto</th><th class="numeric">Estrés -10%</th></tr></thead><tbody>${r.rows.map(row=>`<tr><td>${itemWithCopy(row.id)}<small class="rank-sub">Retorno ${row.returnPct.toFixed(1)}% · <b>Q1 ${compact(row.history.quality1DailyUnits??row.history.averageDailyUnits)} u./día</b> · total ${compact(row.history.averageDailyUnits)} u./día · ${escape(row.evidenceSource)} · cuota del periodo ${row.coverageSharePct.toFixed(1)}% · precio observado ${silver(row.marketQuote)} · usado ${silver(row.planningPrice)}</small></td><td><span class="city-stack">${cityBadge(row.craftCity,'city-small')}<small>↓ vender en</small>${cityBadge(row.city,'city-small')}</span></td><td class="numeric"><strong>${silver(row.qty)}</strong></td><td class="numeric">${silver(row.qty*row.grossCapitalPerCraft)}</td><td class="numeric ${row.totalProfit>=0?'green':'red'}">${row.totalProfit>=0?'+':''}${silver(row.totalProfit)}</td><td class="numeric">${row.finalImpactPct.toFixed(1)}%</td><td class="numeric ${row.stressProfit>=0?'green':'red'}">${row.stressProfit>=0?'+':''}${silver(row.stressProfit)}</td></tr>`).join('')}</tbody></table></div>`;}
 else html+=`<div class="warning">No se encontró un lote con beneficio esperado positivo dentro del presupuesto y los límites de volumen observados. No se asignarán artículos artificiales para gastar el silver.</div>`;
 html+=`<p class="planner-shopping-notice">Para consultar materiales, diarios del mismo tier y compras consolidadas, pulsa <strong>Enviar lote a Calculadora de Craft</strong>. Los diarios son opcionales y su cantidad es una estimación.</p>`;
 if(r.warnings.length)html+=`<div class="warning">${r.warnings.map(w=>escape(w)).join(' · ')}</div>`;
 if(notes.length)html+=`<div class="notice">${notes.map(w=>escape(w)).join(' · ')}</div>`;
 if(details)html+=`<details class="plan-diagnostics" ${!r.rows.length?'open':''}><summary>¿Por qué algunos objetos no entraron? · ${silver(details.candidates)} rutas evaluables</summary><p class="hint">El ranking agrega calidades 1–5; Craft Planner exige historial Q1, receta y precios de venta/compra. No equivale a pedidos ejecutables.</p><div class="diagnostic-list">${(details.rejectedSamples||[]).slice(0,48).map(item=>`<div class="diagnostic-item">${img(item.id)}<div><strong>${escape(name(item.id))}</strong> ${tierBadge(item.id)}<small>${cityBadge(item.city,'city-small')} · ${escape(item.reason)}</small><small>Q1 ${silver(item.q1UnitsDaily)} u./día · todas las calidades ${silver(item.allQualitiesDaily)} u./día</small></div></div>`).join('')||'<p class="muted">Todos los artículos consultados pasaron la comprobación inicial.</p>'}</div><p class="hint">Otros límites de cartera, Focus y presupuesto pueden impedir seleccionar una ruta aprobada. Sin historial Q1 no se inventan cantidades.</p></details>`;
 html+=`<div class="warning">Comprueba manualmente profundidad del libro, comisiones, coste de estación, disponibilidad de insumos y tiempos reales antes de invertir. La tarifa de transporte y el deslizamiento de compras no están verificados ni descontados. No se promete venta.</div></section>`;
 return html;
}
function flipMarketChoices(kind){const c=flipSettings(state.flip),selected=new Set(c[kind]);return `<div class="market-chips flip-market-chips">${FLIP_CITY_OPTIONS.filter(city=>kind==='targets'||city!=='Black Market').map(city=>`<label class="market-toggle city-control city--${CITY_KEYS[city]} ${selected.has(city)?'active':''}"><input type="checkbox" data-flip-market="${kind}" value="${escape(city)}" ${selected.has(city)?'checked':''}><span class="city-gem" aria-hidden="true">◆</span>${escape(cityDisplay(city))}</label>`).join('')}</div>`;}
function flipPage(){const c=flipSettings(state.flip);
 const options=[5,10,15,20].map(m=>`<label class="budget-choice ${c.budget===m*1e6?'active':''}"><input type="radio" name="flip-budget" data-flip-budget="${m*1e6}" ${c.budget===m*1e6?'checked':''}>${m}M</label>`).join('');
 return hero('flip')+`<section class="panel flip-workbench">${heading('01 · Artículos para buscar Flips','Elige variantes desde Top Mercado. Se conserva el tier y encantamiento; las cotizaciones se consultan por ciudad en calidad 1.',`<span class="counter">${state.flipItems.length} variantes</span>`)}
 <div class="flip-intro"><div class="flip-intro-icon">↗</div><div><strong>Compra donde cuesta menos. Vende donde pagan más.</strong><p>Usamos la oferta mínima del origen y la puja máxima del destino para simular una venta inmediata. AODP no verifica si hay unidades suficientes en esos precios.</p></div></div>
 <div class="toolbar"><div class="btn-group"><button class="btn btn-outline" id="flip-from-marked">Añadir marcados de Top (${state.marked.size})</button><button class="btn btn-outline" id="flip-from-top">Usar primeros 50 del Top</button><button class="btn btn-ghost" id="flip-clear">Borrar lista</button></div><button class="btn btn-outline" id="flip-go-top">Abrir Top Mercado</button></div>
 <div class="flip-selected-items">${state.flipItems.length?state.flipItems.slice(0,75).map(id=>`<div class="flip-selected">${img(id)}<span>${escape(name(id))} ${tierBadge(id)}</span><button type="button" data-flip-remove="${escape(id)}" title="Quitar objeto">×</button></div>`).join(''):'<div class="empty tiny-empty">Marca artículos en Top Mercado y envíalos aquí, o usa «Primeros 50 del Top».</div>'}</div>
 </section><section class="panel flip-workbench">${heading('02 · Configuración de Flips','Los cálculos son conservadores y todas las cifras se pueden ajustar. El presupuesto es un máximo, nunca una obligación de gasto.')}
 <div class="flip-settings-grid">
 <div class="config-section flip-field"><h3>Presupuesto máximo</h3><div class="budget-options">${options}</div><label class="small-print">Otra cantidad (silver)<input type="number" min="1000" step="1000" data-flip-setting="budget" value="${c.budget}"></label></div>
 <div class="config-section flip-field"><h3>Tiempo y antigüedad</h3><div class="multifield"><label>Días para vender<select data-flip-setting="daysToSell">${[1,3,5,7,14].map(d=>`<option value="${d}" ${d===c.daysToSell?'selected':''}>${d} días</option>`).join('')}</select></label><label>Máx. antigüedad<select data-flip-setting="maxQuoteHours">${[6,12,24,48,72].map(d=>`<option value="${d}" ${d===c.maxQuoteHours?'selected':''}>${d} horas</option>`).join('')}</select></label></div></div>
 <div class="config-section flip-field"><h3>Costes de operación</h3><div class="multifield"><label>Impuesto venta %<input type="number" min="0" max="30" data-flip-setting="taxPct" value="${c.taxPct}"></label><label>Transporte/u.<input type="number" min="0" data-flip-setting="transportPerUnit" value="${c.transportPerUnit}"></label></div></div>
 <div class="config-section flip-field"><h3>Protección del precio</h3><div class="multifield"><label>Compra +%<input type="number" min="0" max="100" data-flip-setting="buyBufferPct" value="${c.buyBufferPct}"></label><label>Venta -%<input type="number" min="0" max="100" data-flip-setting="sellHaircutPct" value="${c.sellHaircutPct}"></label></div></div>
 <div class="config-section flip-field"><h3>Beneficio y participación</h3><div class="multifield"><label>ROI mínimo %<input type="number" min="0" max="100" data-flip-setting="minRoiPct" value="${c.minRoiPct}"></label><label>Máx. % actividad Q1<input type="number" min="1" max="100" data-flip-setting="demandSharePct" value="${c.demandSharePct}"></label></div></div>
 <div class="config-section flip-field"><h3>Concentración y estrés</h3><div class="multifield"><label>Máx. capital por item %<input type="number" min="1" max="100" data-flip-setting="maxSkuSharePct" value="${c.maxSkuSharePct}"></label><label>Caída simulada %<input type="number" min="0" max="100" data-flip-setting="stressPct" value="${c.stressPct}"></label></div><label class="checkline"><input type="checkbox" data-flip-setting="requireStressProfit" ${c.requireStressProfit?'checked':''}> Exigir ganancia incluso bajo estrés</label><label class="checkline"><input type="checkbox" data-flip-setting="diverse" ${c.diverse?'checked':''}> Diversificar primero artículos y destinos</label></div>
 </div><div class="flip-city-group"><h3>03 · Ciudades donde comprar</h3>${flipMarketChoices('sources')}<h3>04 · Ciudades donde vender</h3>${flipMarketChoices('targets')}</div>
 <div class="notice flip-note">No se usa el promedio del Top como precio de ejecución. Los precios vienen de AODP Prices Q1, y History solo limita el lote estimado. <b>La profundidad de las órdenes y el coste real del transporte no están verificados.</b> El cliente AFM puede contribuir cotizaciones a AODP mientras juegas, pero esta web no captura tráfico de red.</div>
 <div class="toolbar"><span class="hint">West · Calidad 1 · 7 días UTC completos · sin operaciones ficticias</span><button class="btn btn-gold" id="run-flips" ${state.flipRunning||!state.flipItems.length?'disabled':''}>${state.flipRunning?'Consultando…':'Buscar Flips rentables'}</button></div><div id="flip-progress" role="status"></div></section>
 <section class="panel flip-report">${flipResultHTML()}</section>`;
}
function flipResultHTML(){const result=state.flipResult;
 if(!result)return heading('05 · Oportunidades de arbitraje','Aparecerán las rutas de compra → venta y el coste completo del lote, con precios fechados y demanda limitada.')+`<div class="empty"><h3>Escanea mercados Royal y Mercado Negro</h3><p>Marca primero los artículos que quieres comparar. El motor no inventa precios ni obliga a gastar todo el presupuesto.</p></div>`;
 const sum=result.summary,rows=result.rows;
 let html=heading('05 · Flips analizados',`${rows.length} rutas seleccionadas · ${result.rejections.length} combinaciones descartadas`,rows.length?'<button class="btn btn-outline" id="flip-export">Exportar CSV</button>':'');
 html+=`<div class="metric-strip"><div class="metric"><small>Silver reservado</small><strong>${small(sum.capital)}</strong></div><div class="metric"><small>Beneficio proyectado</small><strong class="${sum.profit>=0?'green':'red'}">${sum.profit>=0?'+':''}${small(sum.profit)}</strong></div><div class="metric"><small>ROI conjunto</small><strong>${compact(sum.roi)}%</strong></div><div class="metric"><small>Unidades / Rutas</small><strong>${silver(sum.units)} / ${rows.length}</strong></div></div>`;
 if(rows.length)html+=`<div class="result-table flip-table"><table><thead><tr><th>Artículo</th><th>Comprar → vender</th><th class="numeric">Unidades</th><th class="numeric">Compra/u.</th><th class="numeric">Puja/u.</th><th class="numeric">Capital</th><th class="numeric">Beneficio</th><th class="numeric">ROI</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${itemWithCopy(r.id)}<small class="rank-sub">Q1 destino ${compact(r.q1Daily)} u./día · ${silver(r.q1ActiveDays)} días activos · impacto ${compact(r.impactPct)}%</small></td><td><span class="city-stack">${cityBadge(r.from,'city-small')}<small>↓</small>${cityBadge(r.to,'city-small')}</span></td><td class="numeric"><strong>${silver(r.qty)}</strong></td><td class="numeric">${silver(r.sourcePrice)}<small class="rank-sub">${formatTime(r.sourceObservedAt)}</small></td><td class="numeric">${silver(r.targetPrice)}<small class="rank-sub">${formatTime(r.targetObservedAt)}</small></td><td class="numeric">${silver(r.capital)}</td><td class="numeric green"><strong>+${silver(r.profit)}</strong><small class="rank-sub">Estrés ${silver(r.stressProfit)}</small></td><td class="numeric"><strong>${compact(r.roi)}%</strong></td></tr>`).join('')}</tbody></table></div>`;
 else html+=`<div class="warning">Ninguna ruta superó los filtros, presupuesto, antigüedad y actividad Q1. No se crean ganancias ficticias para llenar la tabla.</div>`;
 if(result.rejections.length)html+=`<details class="flip-rejected"><summary>Rutas descartadas · ${result.rejections.length} motivos observados</summary><div class="flip-reasons">${result.rejections.slice(0,35).map(v=>`<span>${escape(name(v.id))} · ${escape(v.from||'')} → ${escape(v.to||'?')}: ${escape(v.reason)}</span>`).join('')}</div></details>`;
 html+=`<div class="warning">${result.warnings.map(escape).join(' · ')}. Antes de transportar, confirma el libro de órdenes y las rutas seguras. Las diferencias observadas no garantizan poder comprar o vender estas unidades.</div>`;
 if(state.flipErrors.length)html+=`<div class="notice">${state.flipErrors.map(escape).join(' · ')}</div>`;
 return html;
}
function flipAdd(ids){const before=state.flipItems.length;state.flipItems=[...new Set([...state.flipItems,...ids.filter(id=>/^[A-Z0-9_@-]{3,100}$/.test(id))])].slice(0,150);state.flipResult=null;save();nav('flip');toast(`${state.flipItems.length-before} artículos añadidos a Flips.`);}
async function runFlips(){if(state.flipRunning)return;state.flipRunning=true;state.flipResult=null;state.flipErrors=[];updatePage();
 try{
  if(!state.flipItems.length)throw Error('Marca artículos desde Top Mercado.');
  const c=flipSettings(state.flip);if(!c.sources.length||!c.targets.length)throw Error('Selecciona ciudades de origen y destino.');
  const cities=[...new Set([...c.sources,...c.targets])];const ids=state.flipItems.slice(0,150);
  progress('flip-progress','Consultando precios Q1 West…',15);
  const prices=await marketFetch('prices',ids,{cities,qualities:'1',force:true,onProgress:p=>progress('flip-progress',`Precios ${p.finished}/${p.total}`,15+35*p.finished/p.total)});
  if(!prices.coverage)throw Error('No se recibieron cotizaciones válidas desde West: '+prices.errors.slice(0,2).join(' · '));
  const quotes=quoteMap(prices.rows);
  progress('flip-progress','Consultando 7 días UTC completos de actividad Q1…',52);
  const hist=await marketFetch('history',ids,{cities:c.targets,qualities:'1',days:7,force:true,onProgress:p=>progress('flip-progress',`Historial Q1 ${p.finished}/${p.total}`,55+38*p.finished/p.total)});
  if(!hist.coverage)throw Error('No se recibió historial Q1 de West: '+hist.errors.slice(0,2).join(' · '));
  const history=summarizeHistory(hist.rows,{days:7});
  const scanned=scanFlipRoutes({ids,quotes,history,config:c});
  state.flipResult=allocateFlips(scanned);state.flipErrors=[...prices.errors,...hist.errors].slice(0,5);
  state.flipFetchedAt=new Date().toISOString();toast(`${state.flipResult.rows.length} rutas estimadas · ${silver(state.flipResult.summary.profit)} silver de beneficio proyectado.`);
 }catch(err){state.flipResult=null;state.flipErrors=[String(err.message||err)];toast(state.flipErrors[0]);}
 finally{state.flipRunning=false;updatePage();}
}
function exportFlipCsv(){if(!state.flipResult?.rows.length)return toast('No hay rutas para exportar.');
 const lines=[['ARTICULO','ID','ORIGEN','DESTINO','UNIDADES','COMPRA_ASK','VENTA_BID','CAPITAL_CON_COSTES','BENEFICIO_ESTIMADO','ROI_PCT','ACTIVIDAD_Q1_DIA','FECHA_COMPRA','FECHA_VENTA'],...state.flipResult.rows.map(r=>[name(r.id),r.id,r.from,r.to,r.qty,r.sourcePrice,r.targetPrice,Math.round(r.capital),Math.round(r.profit),r.roi.toFixed(2),r.q1Daily,r.sourceObservedAt,r.targetObservedAt])];
 const csv=lines.map(row=>row.map(v=>'"'+String(v??'').replaceAll('"','""')+'"').join(',')).join('\r\n');const url=URL.createObjectURL(new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'}));const link=document.createElement('a');link.href=url;link.download='gildem-west-flips.csv';link.click();setTimeout(()=>URL.revokeObjectURL(url),600);
}
function refineConfig(){
 const r=state.refine;return settings({...DEFAULTS,...state.filters,...r,tiers:r.tiers.map(Number),enchants:r.enchants.map(Number),bonusCity:true,
  saleDays:7,focus:r.focus===true,focusPerCraft:Number(r.focusPerCraft)||0,focusAvailable:Number(r.focusAvailable)||0});
}
function refineChoices(values,key){return `<div class="pill-choices">${values.map(n=>`<label class="toggle-chip ${state.refine[key].includes(n)?'active':''}"><input type="checkbox" data-refine-list="${key}" value="${n}" ${state.refine[key].includes(n)?'checked':''}>${key==='tiers'?'T'+n:'.'+n}</label>`).join('')}</div>`;}
function refinePage(){const r=state.refine,t=REFINING_TYPES.find(x=>x.key===r.type),sales=new Set(r.saleMarkets.filter(m=>ROYAL_MARKETS.includes(m)));
 return hero('refine')+`<section class="panel refining-workbench">${heading('01 · Qué quieres refinar','Selecciona el recurso, tiers, encantamientos y el destino de venta. Las recetas proceden del juego cuando pueden verificarse.')}
 <div class="refining-type-grid">${REFINING_TYPES.map(x=>`<button type="button" class="refining-type ${r.type===x.key?'active':''}" data-refining-type="${x.key}">${img(x.icon)}<span><strong>${x.label}</strong><small>Especialidad: ${escape(x.city)}</small></span></button>`).join('')}</div>
 <div class="refining-control-grid"><div class="config-section"><h3>Tiers</h3>${refineChoices([4,5,6,7,8],'tiers')}</div><div class="config-section"><h3>Encantamientos</h3>${refineChoices(r.type==='STONEBLOCK'?[0]:[0,1,2,3,4],'enchants')}<p>La piedra se refina sin encantamientos del producto final.</p></div><div class="config-section"><h3>Presupuesto máximo</h3><div class="budget-options">${[5,10,15,20].map(v=>`<label class="budget-choice ${r.budget===v*1e6?'active':''}"><input type="radio" name="refine-budget" data-refine-budget="${v*1e6}" ${r.budget===v*1e6?'checked':''}>${v}M</label>`).join('')}</div><label class="small-print">Otra cantidad <input type="number" data-refine-cfg="budget" min="1000" value="${r.budget}"></label></div>
 <div class="config-section"><h3>Estilo de lote</h3><select data-refine-cfg="style"><option value="prudent" ${r.style==='prudent'?'selected':''}>Prudente · muestras pequeñas</option><option value="balanced" ${r.style==='balanced'?'selected':''}>Equilibrado</option><option value="dynamic" ${r.style==='dynamic'?'selected':''}>Dinámico · más volumen</option></select><label class="checkline"><input type="checkbox" data-refine-cfg="diversify" ${r.diversify?'checked':''}> Diversificar tiers y encantamientos</label></div>
 <div class="config-section"><h3>Protección</h3><div class="multifield"><label>ROI mínimo % <input type="number" data-refine-cfg="minRoiPct" min="0" max="100" value="${r.minRoiPct}"></label><label>Compra +% <input type="number" data-refine-cfg="buyBufferPct" min="0" max="50" value="${r.buyBufferPct}"></label><label>Venta -% <input type="number" data-refine-cfg="sellHaircutPct" min="0" max="30" value="${r.sellHaircutPct}"></label></div></div>
 <div class="config-section"><h3>Estación y Focus</h3><div class="multifield"><label>Plata por refinado <input type="number" data-refine-cfg="stationFee" min="0" value="${r.stationFee}"></label><label>Bono diario % <select data-refine-cfg="dailyBonus"><option value="0" ${r.dailyBonus==0?'selected':''}>0</option><option value="10" ${r.dailyBonus==10?'selected':''}>10</option><option value="20" ${r.dailyBonus==20?'selected':''}>20</option></select></label></div><label class="checkline"><input type="checkbox" data-refine-cfg="focus" ${r.focus?'checked':''}> Usar Focus verificado</label>${r.focus?`<div class="multifield"><label>Focus por unidad <input type="number" data-refine-cfg="focusPerCraft" value="${r.focusPerCraft}" min="1"></label><label>Focus disponible <input type="number" data-refine-cfg="focusAvailable" value="${r.focusAvailable}" min="1"></label></div>`:''}</div></div>
 <h3 class="refine-destination-heading">02 · Ciudades donde vender el material refinado</h3><div class="market-chips">${ROYAL_MARKETS.map(city=>`<label class="market-toggle city-control city--${CITY_KEYS[city]} ${sales.has(city)?'active':''}"><input type="checkbox" data-refine-market="${city}" ${sales.has(city)?'checked':''}><span class="city-gem">◆</span>${escape(city)}</label>`).join('')}</div>
 <div class="notice">Especialidad del recurso: <strong>${escape(t.city)}</strong> (bono de producción +40% sobre base Royal +18%, sin Focus). El coste por estación es un dato manual. AODP History mide actividad histórica y no garantiza ventas, y el precio puede cambiar al comprar grandes cantidades.</div>
 <div class="toolbar"><span class="hint">Recetas: ao-bin-dumps cuando está disponible; respaldo del manual oficial identificado.</span><button type="button" class="btn btn-gold" id="run-refining" ${state.refineRunning?'disabled':''}>${state.refineRunning?'Analizando…':'Analizar refinamiento West'}</button></div><div id="refine-progress" role="status"></div></section><section class="panel" id="refine-results">${refineResultHTML()}</section>`;
}
function refineResultHTML(){const r=state.refineResult;if(!r)return `${heading('03 · Plan de refinamiento','Se mostrarán los recursos a refinar, la actividad Q1 por ciudad, silver estimado y materiales de entrada.')}<div class="empty"><h3>Convierte materiales con datos de mercado</h3><p>Elige familia y ciudades; después pulsa «Analizar refinamiento West».</p></div>`;
 const s=r.summary||{},status=state.refineNotes||[];
 return `${heading('03 · Plan de refinamiento',`${r.rows?.length||0} rutas con precios e historial Q1 observados.`)}
 <div class="metric-strip"><div class="metric"><small>Capital reservado</small><strong>${small(s.capitalReserved)}</strong></div><div class="metric"><small>Beneficio estimado</small><strong class="${s.totalProfit>=0?'green':'red'}">${small(s.totalProfit)}</strong></div><div class="metric"><small>Presupuesto restante</small><strong>${small(s.remaining)}</strong></div><div class="metric"><small>Refinados</small><strong>${silver(s.crafts)}</strong></div></div>
 ${r.rows?.length?`<div class="result-table"><table><thead><tr><th>Producto refinado</th><th>Refinar → Vender</th><th class="numeric">Refinados</th><th class="numeric">Q1 por día</th><th class="numeric">Capital</th><th class="numeric">Beneficio</th><th class="numeric">Cuota 7 días</th></tr></thead><tbody>${r.rows.map(row=>`<tr><td>${itemWithCopy(row.id)}<small>${row.recipeSource==='ao-bin-dumps'?'Receta verificada con dump':'Receta de referencia oficial'}</small></td><td>${cityBadge(row.craftCity,'city-small')} → ${cityBadge(row.city,'city-small')}</td><td class="numeric">${silver(row.qty)}</td><td class="numeric">${compact(row.history.quality1DailyUnits)}</td><td class="numeric">${silver(row.qty*row.grossCapitalPerCraft)}</td><td class="numeric ${row.totalProfit>=0?'green':'red'}">${silver(row.totalProfit)}</td><td class="numeric">${row.coverageSharePct.toFixed(1)}%</td></tr>`).join('')}</tbody></table></div>
 <h3>Materiales necesarios para el lote</h3><div class="result-table"><table><thead><tr><th>Material</th><th>Comprar en</th><th class="numeric">Compra estimada</th><th class="numeric">Precio unidad</th></tr></thead><tbody>${r.materials.map(m=>`<tr><td>${itemWithCopy(m.id)}</td><td>${cityBadge(m.city,'city-small')}</td><td class="numeric">${silver(m.buy)}</td><td class="numeric">${silver(m.unitPrice)}</td></tr>`).join('')}</tbody></table></div>`:'<div class="warning">No hay un lote de refinamiento con receta, historial Q1, cotizaciones vigentes y rentabilidad suficientes. No se inventarán precios ni se gastará el presupuesto forzosamente.</div>'}
 ${status.map(x=>`<p class="hint">${escape(x)}</p>`).join('')}${r.warnings?.map(x=>`<p class="warning">${escape(x)}</p>`).join('')}
 <details class="plan-diagnostics"><summary>Diagnóstico de oportunidades excluidas (${(r.diagnostics?.length||0)})</summary><div class="diagnostic-list">${(r.diagnostics||[]).slice(0,50).map(e=>`<div class="diagnostic-item">${img(e.id)}<div><strong>${escape(name(e.id))}</strong><small>${escape(e.city)} · ${escape(e.reason)}</small></div></div>`).join('')||'<p>Sin descartes en los registros analizados.</p>'}</div></details><p class="hint">Los materiales se calculan con retorno esperado; puedes necesitar cantidades brutas para comenzar. La disponibilidad real y el deslizamiento de precios no están verificados. Compara las órdenes antes de invertir.</p>`;
}
async function runRefining(){if(state.refineRunning)return;state.refineRunning=true;state.refineResult=null;updatePage();
 try{
  const c=refineConfig(),kind=state.refine.type,markets=state.refine.saleMarkets.filter(m=>ROYAL_MARKETS.includes(m));
  if(!markets.length)throw Error('Elige al menos una ciudad donde vender.');
  const reference=referenceRefiningRecipes({type:kind,tiers:c.tiers,enchants:c.enchants});let recipes=reference,source='referencia oficial (sin contrastar dump)',verified=0;
  progress('refine-progress','Cargando recetas desde ao-bin-dumps…',8);
  try{const response=await fetch('/api/catalog?file=refining',{signal:AbortSignal.timeout(33000)});
   if(response.ok){const data=await response.json();recipes={...reference,...Object.fromEntries(Object.entries(data.recipes||{}).filter(([id])=>Object.hasOwn(reference,id)))};source=data.source||source;verified=Number(data.verified)||0;}
  }catch(err){state.refineNotes=['El dump no respondió; se usan las recetas oficiales de referencia. '+err.message];}
  for(const [id,recipe] of Object.entries(recipes)){
   state.recipes[id]=recipe;
   if(!state.names[id]){const v=variant(id),label=REFINING_TYPES.find(x=>x.key===kind)?.label||kind;state.names[id]=label+' T'+v?.tier+'.'+v?.ench;}
  }
  const ids=Object.keys(reference);
  if(!ids.length)throw Error('No hay variantes compatibles con la selección.');
  progress('refine-progress','Consultando historial Q1 de materiales refinados…',30);
  const history=await marketFetch('history',ids,{cities:markets,qualities:'1',days:7,force:true});
  if(!history.coverage)throw Error('No se obtuvo historial West Q1 para los recursos.');
  const stats=summarizeHistory(history.rows,{days:7});
  const materialIds=[...new Set([...ids,...Object.values(recipes).flatMap(r=>r.materials.map(m=>m.id))])];
  progress('refine-progress','Consultando cotizaciones de compra y venta…',60);
  const prices=await marketFetch('prices',materialIds,{cities:ROYAL_MARKETS,qualities:'1',force:true});
  if(!prices.coverage)throw Error('No se recibieron precios West verificables.');
  const candidates=buildCandidates({top:stats,recipes,quotes:quoteMap(prices.rows),config:c,selectedIds:ids,selectedMarkets:markets});
  const plan=allocatePlan({candidates:candidates.candidates,config:c,recipes});
  plan.rows.forEach(row=>row.recipeSource=recipes[row.id]?.recipeSource||'referencia');
  state.refineResult={...plan,diagnostics:[...candidates.rejectedSamples,...plan.allocationNotes]};
  state.refineNotes=[`Fuente de recetas: ${source}. ${verified} variantes extraídas del dump completo.`,
   `Configuración aplicada: ${silver(c.budget)} silver, estilo ${c.style}, ROI mínimo ${c.minRoiPct}%, retorno de especialidad +40%.`,
   `Actividad histórica: ${stats.length} artículo-ciudad; se limita a calidad 1. Si falta historial, la variante no se fuerza.`,
   ...(history.errors.length||prices.errors.length?[`Respuestas parciales: historial ${history.errors.length}, precios ${prices.errors.length}.`]:[])];
  save();
 }catch(e){state.refineResult={rows:[],materials:[],warnings:[e.message],summary:{capitalReserved:0,totalProfit:0,remaining:state.refine.budget,crafts:0},diagnostics:[]};state.refineNotes=[];toast(e.message);}
 finally{state.refineRunning=false;updatePage();}
}
// Los encabezados de cada tabla se transforman en etiquetas visibles en las tarjetas de teléfono.
// Solo cambia la presentación: no afecta el orden ni los datos numéricos usados por el motor.
function labelPhoneTables(){
 document.querySelectorAll('#main table').forEach(table=>{
  const headers=[...table.querySelectorAll('thead tr:first-child th')].map(th=>th.textContent.trim().replace(/\s+/g,' '));
  table.querySelectorAll('tbody tr').forEach(row=>{
   [...row.children].filter(cell=>cell.tagName==='TD').forEach((cell,index)=>{
    cell.dataset.mobileLabel=headers[index]||'';
   });
  });
 });
}
function syncPhoneMenu(open=false){
 const menu=$('.sidebar'),backdrop=$('#mobile-backdrop'),button=$('#mobile-nav');
 menu?.classList.toggle('mobile-open',open);
 if(backdrop)backdrop.hidden=!open;
 if(button)button.setAttribute('aria-expanded',String(open));
 document.body.classList.toggle('phone-menu-open',open);
}
function syncPhonePresentation(){
 document.documentElement.dataset.mobileCards=state.mobileCards?'1':'0';
 const control=$('#mobile-cards-switch');if(control)control.checked=state.mobileCards;
}
function updatePage(){
 document.querySelectorAll('[data-route]').forEach(b=>{const active=b.dataset.route===state.page;b.classList.toggle('is-active',active);b.setAttribute('aria-current',active?'page':'false');});
 $('#page-name').textContent={top:'Top Mercado',planner:'Craft Planner',calc:'Calculadora de Craft',refine:'Refinamiento',flip:'Flips'}[state.page]||'Top Mercado';
 $('#main').innerHTML=state.page==='top'?topPanel():state.page==='planner'?plannerPage():state.page==='refine'?refinePage():state.page==='flip'?flipPage():calcPage();
 syncPhonePresentation();labelPhoneTables();
}
function nav(which){state.page=which;syncPhoneMenu(false);window.scrollTo({top:0,behavior:'instant'});updatePage();}
function resetMarket(){state.top=[];state.scannedIds=new Set();state.pageOffset=0;state.marked.clear();state.coverage=null;state.tableLimit=65;}
function setStatus(message){$('#source-status').textContent=message;}
function progress(id,message,amount){const el=$('#'+id);if(!el)return;el.innerHTML=`<div class="notice">${escape(message)}<div class="progress-track"><span style="width:${Math.max(0,Math.min(100,amount))}%"></span></div></div>`;}
async function downloadCatalogFile(key){let last;
 const urls=[`/api/catalog?file=${key}`,`https://cdn.jsdelivr.net/gh/vkorne-web/albion-market@main/${key==='names'?'names_es':'recipes'}.json`];
 for(const url of urls){try{const r=await fetch(url,{signal:AbortSignal.timeout(26000),headers:{Accept:'application/json'}});
  if(!r.ok)throw Error('HTTP '+r.status);
  const data=await r.json();if(!data||typeof data!=='object'||Object.keys(data).length<100)throw Error('Archivo incompleto');return data;
 }catch(e){last=e;}}
 throw last||Error('Catálogo inaccesible');
}
async function loadCatalog(){const files=await Promise.allSettled([downloadCatalogFile('names'),downloadCatalogFile('recipes')]);
 if(files[0].status==='fulfilled')state.names=files[0].value;
 if(files[1].status==='fulfilled')state.recipes=files[1].value;
 state.catalogStatus=`${silver(Object.keys(state.names).length)} nombres · ${silver(Object.keys(state.recipes).length)} recetas`;
 state.catalogError=files.filter(f=>f.status==='rejected').map(f=>f.reason?.message).join('; ')||null;
 setStatus(state.catalogError?'Catálogo parcial · AODP West':'Catálogo disponible · AODP West');
 updatePage();if(state.page==='calc'&&state.batchItems.length)void runBatch();
}
async function addSpecialCatalog(){if(state.specialLoaded||state.specialAttempted)return;
 const requested=[...state.selectedBranches].some(k=>specialGroups.has(BRANCH_BY_KEY.get(k)?.group));if(!requested)return;
 state.specialAttempted=true;
 try{const r=await fetch('/api/catalog?file=special',{signal:AbortSignal.timeout(34000),headers:{Accept:'application/json'}});
  if(!r.ok)throw Error('Catálogo adicional HTTP '+r.status);
  const extra=await r.json();if(Object.keys(extra).length<15)throw Error('Recetas adicionales insuficientes');Object.assign(state.recipes,extra);state.specialLoaded=true;
  state.catalogStatus=`${silver(Object.keys(state.names).length)} nombres · ${silver(Object.keys(state.recipes).length)} recetas`;toast('Recetas adicionales del juego cargadas.');
 }catch(e){state.specialWarning='No se pudieron verificar recetas especiales del juego: '+e.message;toast('Algunas recetas especiales no están disponibles; el Top aún puede consultarse.');}
}
function pool(){return [...new Set([...Object.keys(state.recipes),...Object.keys(state.names),...BRANCHES.map(b=>b.iconId)])].filter(id=>/^[A-Z0-9_@-]+$/.test(id));}
async function scanTop(reset=true){if(state.queryActive)return;
 if(!state.selectedBranches.size)return toast('Selecciona al menos una rama.');
 if(!state.markets.size)return toast('Selecciona al menos un mercado.');
 state.queryActive=true;
 if(reset){resetMarket();}save();updatePage();
 try{progress('top-progress','Preparando catálogo y ventanas UTC…',5);await addSpecialCatalog();
  const page=state.catalogMode==='selected'?expandSelectedFamilies({ids:pool(),branchKeys:[...state.selectedBranches],selectedFamilies:[...state.catalogPicked],offset:state.pageOffset,limit:240}):catalogPage(pool(),[...state.selectedBranches],{offset:state.pageOffset,limit:240});
  if(!page.ids.length)throw Error(state.catalogMode==='selected'?'Modo individual: elige artículos pertenecientes a las ramas actuales.':'No se encontraron IDs reales en esas ramas; comprueba el catálogo.');
  const response=await marketFetch('history',page.ids,{cities:[...state.markets],qualities:'1,2,3,4,5',days:state.days,force:state.forceFresh,onProgress:p=>progress('top-progress',`Historial West: lote ${p.finished} de ${p.total} · ${p.rows} observaciones · ${p.errors} errores`,100*p.finished/p.total)});
  if(!response.coverage)throw Error('No hubo lotes de historial válidos: '+response.errors.slice(0,2).join(' · '));
  const extracted=summarizeHistory(response.rows,{days:state.days});
  const unique=new Map(state.top.map(e=>[e.id+'|'+e.city,e]));for(const rec of extracted)unique.set(rec.id+'|'+rec.city,rec);
  state.top=[...unique.values()];page.ids.forEach(id=>state.scannedIds.add(id));state.pageOffset=page.nextOffset;
  state.coverage={...page,errors:[...(state.coverage?.errors||[]),...response.errors],fromCache:response.fromCache,fetchedAt:response.fetchedAt};
  setStatus(`${state.top.length} registros · West · ${response.fromCache?'caché':'consultado'}`);
  toast(`${extracted.length} registros observados en ${page.ids.length} IDs · ${response.errors.length?'consulta parcial':'consulta completa por lote'}.`);
 }catch(e){state.coverage={...(state.coverage||{}),errors:[...(state.coverage?.errors||[]),e.message],complete:true,total:0,nextOffset:0};toast(e.message);}
 finally{state.queryActive=false;updatePage();}
}
async function makePlan(){if(state.planActive)return;
 state.planActive=true;state.result=null;state.resultNotes=[];updatePage();
 try{
  const c=settings(state.filters);
  if(!state.saleMarkets.size)throw Error('Elige al menos una ciudad donde vender.');
  if(!state.plannerItems.length)throw Error('Envía artículos desde Top Mercado al Craft Planner primero.');
  const eligibleIds=state.plannerItems.filter(id=>{const v=variant(id);return v&&c.tiers.map(Number).includes(v.tier)&&c.enchants.map(Number).includes(v.ench);}).slice(0,150);
  if(!eligibleIds.length)throw Error('No hay artículos que coincidan con tus tiers y encantamientos seleccionados.');
  let gameVerified=0,gameWarning='';
  try{
   progress('plan-progress','Contrastando recetas con ao-bin-dumps…',3);
   const response=await fetch('/api/catalog?file=verify&items='+encodeURIComponent(eligibleIds.join(',')),{signal:AbortSignal.timeout(30000)});
   if(!response.ok)throw Error('Dump HTTP '+response.status);
   const data=await response.json();gameVerified=Number(data.verified)||0;
   for(const [id,recipe] of Object.entries(data.recipes||{})){
    state.recipes[id]={...state.recipes[id],...recipe,city:state.recipes[id]?.city||recipe.city||null,specialtyEnabled:!!(state.recipes[id]?.city||recipe.city)};
   }
  }catch(err){gameWarning='No se pudo contrastar el dump: '+err.message+'; se usarán las recetas existentes, identificadas como tales.';}
  const idsToPlan=eligibleIds.filter(id=>Array.isArray(state.recipes[id]?.materials)&&state.recipes[id].materials.length);
  if(!idsToPlan.length)throw Error('Ninguna receta comprobable para los objetos y filtros elegidos.');
  const sales=[...state.saleMarkets];
  const expected=observedWindow(state.days),snapshots=state.plannerSignals.filter(x=>idsToPlan.includes(x.id)&&sales.includes(x.city));
  progress('plan-progress',`Reconciliando ${snapshots.length} fichas del Top con destinos Q1…`,4);
  // Query only destinations not covered by the exact selected UTC snapshot.
  const pre=reconcileMarketEvidence({snapshots,queried:[],ids:idsToPlan,markets:sales,days:state.days});
  let fetched=[],supplementaryErrors=[];
  if(pre.missing.length){
   const missingIds=[...new Set(pre.missing.map(x=>x.id))],missingMarkets=[...new Set(pre.missing.map(x=>x.city))];
   const hist=await marketFetch('history',missingIds,{cities:missingMarkets,qualities:'1',days:state.days,onProgress:v=>progress('plan-progress',`Otros destinos Q1: lote ${v.finished}/${v.total} · ${v.errors} errores`,Math.min(40,40*v.finished/v.total))});
   fetched=summarizeHistory(hist.rows,{days:state.days});supplementaryErrors=hist.errors;
  }
  const reconciled=reconcileMarketEvidence({snapshots,queried:fetched,ids:idsToPlan,markets:sales,days:state.days});
  const saleHistory=reconciled.rows;
  const historyNames=new Set(saleHistory.filter(h=>Number(h.quality1DailyUnits)>0).map(h=>h.id));
  const absentQ1=idsToPlan.filter(id=>!historyNames.has(id)).sort((a,b)=>(variant(b)?.tier||0)-(variant(a)?.tier||0))
    .map(id=>({id,city:sales.join(' / '),code:'sinHistorial',reason:'Sin actividad histórica Q1 en los destinos elegidos (actividad total no equivale a Q1)',q1UnitsDaily:0,allQualitiesDaily:snapshots.find(x=>x.id===id)?.allDaily||0}));
  if(!saleHistory.length){
    state.result=allocatePlan({candidates:[],config:c});
    state.resultDiagnostics={candidates:0,rejected:{sinHistorial:idsToPlan.length},rejectedSamples:absentQ1};
    state.resultNotes=['Sin registros de calidad 1 para la selección y las ciudades de venta. El ranking (calidades 1–5) no confirma compras ejecutables.'];
    return;
  }
  const candidates=saleHistory;
  if(!candidates.length)throw Error('La selección no tiene recetas verificables en estos mercados.');
  progress('plan-progress','Preparando materiales y cotizaciones…',45);
  const ids=[...new Set([...candidates.map(x=>x.id),...candidates.flatMap(x=>(state.recipes[x.id]?.materials||[]).map(m=>m.id))])];
  const quotes=await marketFetch('prices',ids,{cities:MARKETS,qualities:'1',onProgress:p=>progress('plan-progress',`Cotizaciones West: lote ${p.finished}/${p.total} · ${p.rows} registros recibidos · ${p.errors} errores`,100*p.finished/p.total)});
  if(!quotes.coverage)throw Error('No se pudieron verificar precios de compra y venta con AODP West. '+quotes.errors.slice(0,2).join(' · '));
  const map=quoteMap(quotes.rows),data=buildCandidates({top:candidates,recipes:state.recipes,quotes:map,config:c,
   selectedIds:[],selectedMarkets:[...state.saleMarkets]});
  state.result=allocatePlan({...data,recipes:state.recipes});
  state.resultDiagnostics={candidates:data.candidates.length,rejected:data.rejected,rejectedSamples:[...absentQ1,...data.rejectedSamples,...(state.result.allocationNotes||[])]};
  state.resultNotes=[`${gameVerified} recetas contrastadas con ao-bin-dumps; las restantes conservan su fuente anterior.`,...(gameWarning?[gameWarning]:[])];
  if(state.plannerItems.length>idsToPlan.length)state.resultNotes.push(`Se analizaron ${idsToPlan.length} objetos; los restantes no coinciden con tiers/encantamientos o no tienen receta.`);
  if(supplementaryErrors.length)state.resultNotes.push(`Historial de destinos parcialmente disponible: ${supplementaryErrors.slice(0,3).join(' · ')}`);
  state.resultNotes.push(`Evidencia reconciliada: ${reconciled.fromTop} pares del Top original, ${reconciled.fromAdditional} pares de otros destinos · ${expected.from} a ${expected.to} UTC. El volumen usado procede exclusivamente de calidad 1.`);
  if(reconciled.discrepancies.length)state.resultNotes.push(`Se detectaron ${reconciled.discrepancies.length} diferencias entre consultas; se priorizó la ficha que seleccionaste en Top.`);
  if(quotes.errors.length)state.resultNotes.push(`Cotizaciones parciales: ${quotes.errors.length} lotes incompletos. No se inventaron precios faltantes.`);
  if(state.specialWarning)state.resultNotes.push(state.specialWarning);
  if(!state.result.rows.length)toast('No hay lotes verificables dentro del presupuesto, historial Q1 y límites seleccionados.');
  else toast(`Plan generado: ${state.result.rows.length} rutas · beneficio estimado ${silver(state.result.summary.totalProfit)} silver.`);
 }catch(e){state.result={rows:[],materials:[],journals:[],warnings:[e.message],summary:{budget:state.filters.budget,capitalReserved:0,remaining:state.filters.budget,totalProfit:0,totalFame:0,crafts:0,units:0,roiOnCapital:0}};toast(e.message);}
 finally{state.planActive=false;updatePage();requestAnimationFrame(()=>$('#plan-results')?.scrollIntoView({block:'start',behavior:'smooth'}));}
}
function exportCsv(){if(!state.result?.rows.length)return toast('No hay un plan para exportar.');
 const head=['id','nombre','ciudad_fabricacion','ciudad_venta','crafts','unidades','capital_bruto_con_colchon','beneficio_estimado','impacto_pct','profit_estres','precio_q1_observado','precio_q1_usado','demanda_q1_diaria','fecha_cotizacion_utc'];
 const data=state.result.rows.map(r=>[r.id,name(r.id),r.craftCity,r.city,r.qty,r.qty*r.craftAmount,Math.round(r.qty*r.grossCapitalPerCraft),Math.round(r.totalProfit),r.finalImpactPct.toFixed(3),Math.round(r.stressProfit),Math.round(r.marketQuote),Math.round(r.planningPrice),Math.round(r.history.quality1DailyUnits??r.history.averageDailyUnits),r.saleObservedAt]);
 const escapeCsv=x=>'"'+String(x??'').replaceAll('"','""')+'"';const body=[head,...data].map(r=>r.map(escapeCsv).join(',')).join('\r\n');
 const url=URL.createObjectURL(new Blob(['\ufeff'+body],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='gildem-plan-west.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),500);
}
// Delegación: mantiene clics funcionales tras actualizar los paneles.
document.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;
 if(b.dataset.copyName!==undefined){
  const value=e.shiftKey?b.dataset.copyId:b.dataset.copyName;
  const message=e.shiftKey?'ID copiado':'Nombre copiado';
  if(navigator.clipboard?.writeText){navigator.clipboard.writeText(value).then(()=>toast(message)).catch(()=>toast('No se pudo copiar: revisa permisos del navegador.'));}
  else {const input=document.createElement('textarea');input.value=value;input.style.position='fixed';input.style.opacity='0';document.body.appendChild(input);input.select();try{const ok=document.execCommand('copy');toast(ok?message:'No se pudo copiar: revisa permisos del navegador.');}catch{toast('No se pudo copiar: revisa permisos del navegador.');}finally{input.remove();}}
  return;
 }
 if(b.dataset.route)return nav(b.dataset.route);
 if(b.id==='mobile-nav'){syncPhoneMenu(!document.querySelector('.sidebar')?.classList.contains('mobile-open'));return;}
 if(b.id==='mobile-backdrop'){syncPhoneMenu(false);return;}
 if(b.id==='close-groups'){state.openedGroups.clear();return updatePage();}
 if(b.id==='clear-branches'){state.selectedBranches.clear();resetMarket();save();return updatePage();}
 if(b.dataset.branch){const key=b.dataset.branch;if(state.selectedBranches.has(key))state.selectedBranches.delete(key);
  else if(state.selectedBranches.size>=6)return toast('Máximo 6 ramas por consulta.');else state.selectedBranches.add(key);
  resetMarket();save();return updatePage();}
 if(b.dataset.groupAll){const category=GROUPS.find(x=>x.key===b.dataset.groupAll);let added=0;for(const i of category?.items||[]){if(state.selectedBranches.size===6)break;if(!state.selectedBranches.has(i.key)){state.selectedBranches.add(i.key);added++;}}
  resetMarket();save();if(!added)toast('Solo puedes consultar hasta 6 ramas.');return updatePage();}
 if(b.dataset.groupClear){for(const i of GROUPS.find(g=>g.key===b.dataset.groupClear)?.items||[])state.selectedBranches.delete(i.key);resetMarket();save();return updatePage();}
 if(b.dataset.catalogFamily){const fam=b.dataset.catalogFamily;if(state.catalogPicked.has(fam))state.catalogPicked.delete(fam);else if(state.catalogPicked.size<150)state.catalogPicked.add(fam);else return toast('Máximo 150 tipos individuales.');state.catalogMode='selected';resetMarket();save();return updatePage();}
 if(b.id==='catalog-clear'){state.catalogPicked.clear();state.catalogMode='all';resetMarket();save();return updatePage();}
 if(b.id==='catalog-select-visible'){const families=catalogSearchMatches().families;for(const fam of families){if(state.catalogPicked.size>=150)break;state.catalogPicked.add(fam.key);}state.catalogMode='selected';resetMarket();save();return updatePage();}
 if(b.id==='run-top')return scanTop(true);
 if(b.id==='scan-more')return scanTop(false);
 if(b.id==='go-calc')return nav('calc');

 if(b.id==='planner-to-top')return nav('top');
 if(b.id==='planner-clear'){state.plannerSignals=[];state.plannerItems=[];state.result=null;state.resultDiagnostics=null;save();return updatePage();}
 if(b.dataset.plannerRemove){state.plannerSignals=state.plannerSignals.filter(x=>x.id!==b.dataset.plannerRemove);state.plannerItems=state.plannerItems.filter(id=>id!==b.dataset.plannerRemove);state.result=null;state.resultDiagnostics=null;save();return updatePage();}
 if(b.id==='plan-only-bm'){state.saleMarkets=new Set(['Black Market']);state.result=null;save();return updatePage();}
 if(b.id==='plan-all-royals'){state.saleMarkets=new Set(MARKETS.filter(m=>m!=='Black Market'));state.result=null;save();return updatePage();}
 if(b.id==='send-marked-planner')return sendMarkedToPlanner();
 if(b.id==='send-marked-calc')return sendMarked();
 if(b.id==='send-marked-flip')return flipAdd(state.top.filter(r=>state.marked.has(r.id+'|'+r.city)).map(r=>r.id));
 if(b.id==='send-plan-calc')return sendPlanToCalculator();
 if(b.dataset.batchAdd){state.planTransferSummary=[];return batchAdd(b.dataset.batchAdd);}
 if(b.dataset.batchRemove){state.planTransferSummary=[];state.batchItems=state.batchItems.filter(x=>x.id!==b.dataset.batchRemove);state.batchResult=null;state.batchQuotes=null;save();updatePage();if(state.batchItems.length)void runBatch();return;}
 if(b.id==='batch-run')return runBatch();
 if(b.id==='batch-refresh')return runBatch(true);
 if(b.id==='batch-clear'){state.planTransferSummary=[];state.batchItems=[];state.batchResult=null;state.batchQuotes=null;save();return updatePage();}
 if(b.id==='batch-export')return exportBatch();
 if(b.id==='batch-copy'||b.id==='batch-copy-secondary'){const r=state.batchResult;if(!r?.materials?.length)return toast('No hay lista de compras.');const text=r.materials.map(m=>`${m.journal?'[DIARIO ESTIMADO / OPCIONAL] ':''}${m.displayName||name(m.id)}: ${silver(m.buy)} · ${m.city||'Sin cotización'}`).join('\n');if(!navigator.clipboard?.writeText)return toast('Portapapeles no disponible en este navegador. Usa CSV.');navigator.clipboard.writeText(text).then(()=>toast('Lista de compras copiada.')).catch(()=>toast('No se pudo copiar la lista.'));return;}
 if(b.id==='go-top')return nav('top');
 if(b.dataset.mark){if(state.marked.has(b.dataset.mark))state.marked.delete(b.dataset.mark);else state.marked.add(b.dataset.mark);return updatePage();}
 if(b.id==='mark-first'){visibleTop().slice(0,50).forEach(r=>state.marked.add(r.id+'|'+r.city));return updatePage();}
 if(b.id==='clear-marked'){state.marked.clear();return updatePage();}
 if(b.id==='more-table'){state.tableLimit+=65;return updatePage();}
 if(b.id==='run-plan')return makePlan();
 if(b.id==='run-refining')return runRefining();
 if(b.id==='run-flips')return runFlips();
 if(b.id==='flip-from-marked')return flipAdd(state.top.filter(r=>state.marked.has(r.id+'|'+r.city)).map(r=>r.id));
 if(b.id==='flip-from-top')return flipAdd(visibleTop().slice(0,50).map(r=>r.id));
 if(b.id==='flip-go-top')return nav('top');
 if(b.id==='flip-clear'){state.flipItems=[];state.flipResult=null;save();return updatePage();}
 if(b.id==='flip-export')return exportFlipCsv();
 if(b.dataset.flipRemove){state.flipItems=state.flipItems.filter(id=>id!==b.dataset.flipRemove);state.flipResult=null;save();return updatePage();}
 if(b.dataset.refiningType){const previous=REFINING_TYPES.find(x=>x.key===state.refine.type)?.city;const next=REFINING_TYPES.find(x=>x.key===b.dataset.refiningType)?.city;if(state.refine.saleMarkets.length===1&&state.refine.saleMarkets[0]===previous&&next)state.refine.saleMarkets=[next];state.refine.type=b.dataset.refiningType;if(state.refine.type==='STONEBLOCK')state.refine.enchants=[0];state.refineResult=null;save();return updatePage();}
 if(b.id==='single-run')return runSingle();
 if(b.id==='export-plan')return exportCsv();
 if(b.id==='copy-plan-purchases'){if(!state.result?.materials?.length)return toast('No hay materiales para copiar.');
  const lines=state.result.materials.map(m=>`${name(m.id)} x${silver(m.buy)} · ${m.city} · ${silver(m.unitPrice)} silver/u. (sin colchón)`);
  const message='LISTA DE COMPRA · GILDEM WEST\n'+lines.join('\n')+'\nVerifica profundidad de órdenes y precios antes de comprar.';
  if(navigator.clipboard?.writeText)navigator.clipboard.writeText(message).then(()=>toast('Lista de compras copiada.')).catch(()=>toast('No se pudo copiar la lista.'));
  else toast('Portapapeles no disponible en este navegador. Usa Exportar CSV.');return;}
});
document.addEventListener('toggle',e=>{if(e.target.matches('details[data-group]')){if(e.target.open)state.openedGroups.add(e.target.dataset.group);else state.openedGroups.delete(e.target.dataset.group);} },true);
document.addEventListener('change',e=>{const x=e.target;
 if(x.id==='mobile-cards-switch'){state.mobileCards=x.checked;save();syncPhonePresentation();return;}
 if(x.dataset.flipMarket){const kind=x.dataset.flipMarket,old=new Set(state.flip[kind]);if(x.checked)old.add(x.value);else old.delete(x.value);state.flip[kind]=[...old];state.flipResult=null;save();return updatePage();}
 if(x.dataset.flipBudget){state.flip.budget=Number(x.dataset.flipBudget);state.flipResult=null;save();return updatePage();}
 if(x.dataset.flipSetting){const key=x.dataset.flipSetting;state.flip[key]=x.type==='checkbox'?x.checked:Number(x.value);state.flipResult=null;save();if(key==='diverse'||key==='requireStressProfit')return updatePage();return;}
 if(x.dataset.refineMarket){const city=x.dataset.refineMarket,old=new Set(state.refine.saleMarkets);if(x.checked)old.add(city);else old.delete(city);state.refine.saleMarkets=[...old];state.refineResult=null;save();return updatePage();}
 if(x.dataset.refineBudget){state.refine.budget=Number(x.dataset.refineBudget);state.refineResult=null;save();return updatePage();}
 if(x.dataset.refineList){const kind=x.dataset.refineList,v=Number(x.value),values=state.refine[kind];state.refine[kind]=x.checked?[...new Set([...values,v])]:values.filter(n=>n!==v);state.refineResult=null;save();return updatePage();}
 if(x.dataset.refineCfg){const key=x.dataset.refineCfg;state.refine[key]=x.type==='checkbox'?x.checked:['style','goal'].includes(key)?x.value:Number(x.value);state.refineResult=null;save();if(['focus','style','diversify'].includes(key))return updatePage();return;}

 if(x.dataset.budgetPreset!==undefined){const preset=x.dataset.budgetPreset;
  if(preset==='other'){const custom=Number(state.customBudget)||12500000;state.filters.budget=[5000000,10000000,15000000,20000000].includes(custom)?12500000:custom;}
  else state.filters.budget=Number(preset);
  state.result=null;save();return updatePage();}
 if(x.dataset.batchQty){state.planTransferSummary=[];const item=state.batchItems.find(i=>i.id===x.dataset.batchQty);if(!item)return;const qty=Math.round(Number(x.value));if(!Number.isSafeInteger(qty)||qty<1||qty>100000){toast('Cantidad permitida: 1 a 100.000');return;}item.qty=qty;save();return batchRefreshResult();}
 if(x.dataset.batchNobonus){state.planTransferSummary=[];const item=state.batchItems.find(i=>i.id===x.dataset.batchNobonus);if(item){item.noBonus=x.checked;save();batchRefreshResult();}return;}
 if(x.dataset.batchTier||x.dataset.batchEnch){state.planTransferSummary=[];const id=x.dataset.batchTier||x.dataset.batchEnch,options=variantChoices(Object.keys(state.recipes),id),old=variant(id);if(!old)return;
  const tier=x.dataset.batchTier?Number(x.value):old.tier,ench=x.dataset.batchEnch?Number(x.value):old.ench;
  const available=options.filter(i=>variant(i).tier===tier);const chosen=available.find(i=>variant(i).ench===ench)||available.sort((a,b)=>variant(a).ench-variant(b).ench)[0];
  if(!chosen)return toast('Esta variante no tiene receta disponible.');const item=state.batchItems.find(i=>i.id===id);if(!item)return;
  const duplicate=state.batchItems.find(i=>i.id===chosen);if(duplicate&&duplicate!==item){duplicate.qty=Math.min(100000,duplicate.qty+item.qty);state.batchItems=state.batchItems.filter(i=>i!==item);}else item.id=chosen;
  state.batchResult=null;state.batchQuotes=null;save();updatePage();return runBatch();}
 if(x.dataset.batchPriceBm||x.dataset.batchPriceRoyal||x.dataset.batchBuy){const key=x.dataset.batchBuy?'buy':x.dataset.batchPriceBm?'sellBM':'sellRoyal';const id=x.dataset.batchBuy||x.dataset.batchPriceBm||x.dataset.batchPriceRoyal;const val=Number(x.value);state.batchOverrides[key]??={};if(Number.isFinite(val)&&val>0)state.batchOverrides[key][id]=val;else delete state.batchOverrides[key][id];save();return batchRefreshResult();}
 if(x.name==='catalog-mode'){state.catalogMode=x.value;resetMarket();save();return updatePage();}
 if(x.id==='catalog-only-selected'){state.catalogOnlySelected=x.checked;return $('#catalog-search-results').innerHTML=catalogSelectionRows();}
 if(x.id==='top-days'){state.days=Number(x.value);resetMarket();state.result=null;save();return updatePage();}
 if(x.id==='top-sort'){state.sort=x.value;save();return updatePage();}
 if(x.id==='force-top'){state.forceFresh=x.checked;save();return;}
 if(x.hasAttribute('data-market-top')){const c=x.dataset.marketTop;if(x.checked)state.markets.add(c);else state.markets.delete(c);resetMarket();save();return updatePage();}
 if(x.hasAttribute('data-market-sale')){const c=x.dataset.marketSale;if(x.checked)state.saleMarkets.add(c);else state.saleMarkets.delete(c);state.result=null;save();return updatePage();}
 if(x.dataset.tiers||x.hasAttribute('data-tiers')){const tier=Number(x.dataset.tiers),old=state.filters.tiers;state.filters.tiers=x.checked?[...new Set([...old,tier])]:old.filter(v=>v!==tier);state.result=null;save();return updatePage();}
 if(x.dataset.enchants||x.hasAttribute('data-enchants')){const value=Number(x.dataset.enchants),old=state.filters.enchants;state.filters.enchants=x.checked?[...new Set([...old,value])]:old.filter(v=>v!==value);state.result=null;save();return updatePage();}
 if(x.id==='single-item'){state.singleItem=x.value;state.singleResult=null;const el=$('#single-result');if(el)el.innerHTML=singleResultHTML();return;}
 if(x.id==='single-qty'){state.singleQty=Number(x.value)||1;state.singleResult=null;return;}
 if(x.dataset.cfg){const key=x.dataset.cfg;const bool=x.type==='checkbox';state.filters[key]=bool?x.checked:x.type==='number'?Number(x.value):['dailyBonus','saleDays'].includes(key)?Number(x.value):x.value;if(key==='budget')state.customBudget=Number(x.value);state.result=null;save();if(['bonusCity','dailyBonus','focus','focusBonus','diversify','goal'].includes(key)){if(state.batchQuotes&&state.batchItems.length)batchRefreshResult();return updatePage();}if(state.batchResult)batchRefreshResult();}
});
document.addEventListener('input',e=>{const field=e.target;if(field.id==='catalog-search'){state.catalogSearch=field.value;const el=$('#catalog-search-results');if(el)el.innerHTML=catalogSelectionRows();return;}if(field.id!=='batch-search')return;state.batchSearch=field.value;const results=$('#batch-search-results');if(results){results.hidden=state.batchSearch.trim().length<2;results.innerHTML=batchSearchResults(state.batchSearch);}});
// Mostrar cinco herramientas independientes sin bloquear la interfaz por consultas de API.
updatePage();loadCatalog().catch(e=>{state.catalogStatus='Error de catálogo: '+e.message;updatePage();});

// Cerrar el menú de teléfono con Escape o al aumentar el ancho de pantalla.
document.addEventListener('keydown',e=>{if(e.key==='Escape')syncPhoneMenu(false);});
window.matchMedia('(min-width:801px)').addEventListener('change',e=>{if(e.matches)syncPhoneMenu(false);});

// Instalación opcional en teléfono. Solo se guarda la interfaz: nunca cotizaciones AODP.
if('serviceWorker' in navigator){
 window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js').catch(()=>{}));
}
