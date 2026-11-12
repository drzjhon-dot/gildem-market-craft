import {GROUPS,BRANCHES,BRANCH_BY_KEY,MARKETS,itemImage,catalogPage,variant} from './branches.js';
import {marketFetch,summarizeHistory,rankEntries,sortRowsByTier,quoteMap,utcRange} from './market.js';
import {DEFAULTS,settings,returnRate,simulateItem,estimatedFame,journalEstimate} from './planner.js';
import {buildRoutesV3,planV3,settingsV3,PRIORITIES} from './engine-v3.js';
import {createRefinePage} from './refine-page.js';
import {createBmPage} from './bm-page.js';
import {batchCalculate,variantChoices} from './batch-calculator.js';
import {markedItemsForPlanner,transferPlanRows} from './planner-transfer.js';
import {demandSignals,sparkLevels} from './demand-signals.js';
import {premiumTax,fullJournalId,qualityBids} from './economics.js';
import {loadOrderbook} from './orderbook.js';
import {planAdvice} from './plan-advisor.js';
import {createPlanLogEntry,verifyPlanEntry,planLogWindow,sanitizePlanLog} from './plan-log.js';
import {applyTopFilters,sanitizeTopFilter,activeFilterCount,tiersInRows,enchantsInRows,SILVER_PRESETS,SIGNAL_OPTIONS} from './top-filters.js';
import {catalogItemMatches,catalogFamilies,expandSelectedFamilies,familyKey,reconcileMarketEvidence,observedWindow,trafficSignal} from './market-intelligence.js';
import {REFINING_TYPES,referenceRefiningRecipes} from './refining.js';
import {enrichTrends} from './market-trends.js';

const $=selector=>document.querySelector(selector);
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const compact=n=>Number(n||0).toLocaleString('es-ES',{maximumFractionDigits:1});
const silver=n=>Math.round(Number(n||0)).toLocaleString('es-ES');
const small=n=>{const x=Number(n||0);return Math.abs(x)>=1e9?(x/1e9).toLocaleString('es-ES',{maximumFractionDigits:2})+'B':Math.abs(x)>=1e6?(x/1e6).toLocaleString('es-ES',{maximumFractionDigits:2})+'M':Math.abs(x)>=1e3?(x/1e3).toLocaleString('es-ES',{maximumFractionDigits:1})+'K':compact(x);};
const formatTime=s=>s?new Date(s).toLocaleString('es-ES',{timeZone:'UTC',dateStyle:'short',timeStyle:'short'})+' UTC':'Sin hora';
const specialGroups=new Set(['mounts','potions','foods','gathering','kits','siege']);
const ROYAL_MARKETS=MARKETS.filter(m=>m!=='Black Market');
// v3.0: el refinado tiene su propia pestaña; Top Mercado queda para crafteo Royal / Mercado Negro.
const TOP_GROUPS=GROUPS.filter(g=>g.key!=='refining');const REFINING_BRANCH=new Set((GROUPS.find(g=>g.key==='refining')?.items||[]).map(i=>i.key));
const persisted=(()=>{try{return JSON.parse(localStorage.getItem('gildem_market_standalone_settings')||'{}');}catch{return {};}})();
const state={mobileCards:persisted.mobileCards!==false,page:'top',recipes:{},names:{},catalogStatus:'Cargando…',catalogError:null,specialLoaded:false,specialWarning:'',specialAttempted:false,
 selectedBranches:new Set(Array.isArray(persisted.branches)?persisted.branches:['axe']),markets:new Set(Array.isArray(persisted.markets)?persisted.markets:['Black Market']),
 saleMarkets:new Set(Array.isArray(persisted.saleMarkets)?persisted.saleMarkets:['Black Market']),openedGroups:new Set(),
 days:Number(persisted.days)||7,sort:['silver','units','price','tier-asc','tier-desc'].includes(persisted.sort)?persisted.sort:'silver',planResultSort:['engine','tier-asc','tier-desc'].includes(persisted.planResultSort)?persisted.planResultSort:'engine',catalogMode:persisted.catalogMode==='selected'?'selected':'all',catalogSearch:'',catalogOnlySelected:false,catalogPicked:new Set(Array.isArray(persisted.catalogPicked)?persisted.catalogPicked.slice(0,150).map(x=>familyKey(x)||x):[]),customBudget:Number(persisted.customBudget)||12500000,forceFresh:persisted.forceFresh!==false,top:[],coverage:null,scannedIds:new Set(),pageOffset:0,tableLimit:65,
 marked:new Set(),plannerSignals:Array.isArray(persisted.plannerSignals)?persisted.plannerSignals.slice(0,300):[],plannerItems:Array.isArray(persisted.plannerItems)?[...new Set(persisted.plannerItems.filter(id=>typeof id==='string'&&/^[A-Z0-9_@-]{3,100}$/.test(id)))].slice(0,150):[],planTransferSummary:[],batchItems:Array.isArray(persisted.batchItems)?persisted.batchItems.filter(x=>x&&/^[A-Z0-9_@-]+$/.test(x.id)&&Number(x.qty)>=1).slice(0,150).map(x=>({id:x.id,qty:Math.min(100000,Math.round(x.qty)),noBonus:x.noBonus===true,...(Number(x.focusQty)>0?{focusQty:Math.round(x.focusQty)}:{})})):[],batchOverrides:persisted.batchOverrides||{buy:{},sellBM:{},sellRoyal:{}},batchResult:null,batchQuotes:null,batchBusy:false,batchSearch:'',filters: {...DEFAULTS,...(persisted.filters||{})},result:null,resultDiagnostics:null,scanLimit:150,lastQuote:null,singleItem:'',singleQty:1,singleResult:null,singleLoading:false,queryActive:false,planActive:false,topFilter:sanitizeTopFilter(persisted.topFilter),topDetailed:persisted.topDetailed===true,planLog:sanitizePlanLog(persisted.planLog),advancedOpen:false,planLogBusy:null,orderbookStatus:null,batchOrderbook:null};
let refinePage=null,bmPage=null;
for(const key of [...state.selectedBranches])if(!BRANCH_BY_KEY.has(key)||REFINING_BRANCH.has(key))state.selectedBranches.delete(key);
if(!state.selectedBranches.size)state.selectedBranches.add('axe');
if(Number(persisted.schemaVersion||0)<12){if(Number(state.filters.buyBufferPct)===8&&Number(state.filters.sellHaircutPct)===2){state.filters.buyBufferPct=2;state.filters.sellHaircutPct=0;}if(!PRIORITIES[state.filters.priority])state.filters.priority='fast-buy';}
for(const name of [...state.markets])if(!MARKETS.includes(name))state.markets.delete(name);
for(const name of [...state.saleMarkets])if(!MARKETS.includes(name))state.saleMarkets.delete(name);
if(Number(persisted.schemaVersion||0)<5)state.filters.diversify=true;
if(state.filters.premium===false&&Number(state.filters.tax)===4)state.filters.tax=8; // activar variedad al migrar desde v1.4
const save=()=>{try{localStorage.setItem('gildem_market_standalone_settings',JSON.stringify({schemaVersion:12,refine:refinePage?.saveState?.(),bm:bmPage?.saveState?.(),mobileCards:state.mobileCards,forceFresh:state.forceFresh,catalogMode:state.catalogMode,catalogPicked:[...state.catalogPicked],plannerSignals:state.plannerSignals,branches:[...state.selectedBranches],markets:[...state.markets],saleMarkets:[...state.saleMarkets],plannerItems:state.plannerItems,days:state.days,sort:state.sort,planResultSort:state.planResultSort,filters:state.filters,customBudget:state.customBudget,batchItems:state.batchItems,batchOverrides:state.batchOverrides,topFilter:state.topFilter,topDetailed:state.topDetailed,planLog:state.planLog}));}catch{}};
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
 const pages={top:['EXPLORADOR DE MERCADO','Top Mercado','Ranking de crafteo para ciudades Royal y Mercado Negro: marca los artículos y envíalos a Craft Planner o Calculadora.','top-market.webp','History · calidades 1–5'],planner:['PLANIFICACIÓN INTELIGENTE','Craft Planner','Optimiza capital y beneficio entre ciudades, objetos, tiers y encantamientos con demanda Q1 observada.','planning.webp','Beneficio marginal · West Q1'],calc:['TALLER DE CRAFTING','Calculadora de Craft','Calcula lotes y refinamientos, materiales, costes y diarios cuando correspondan.','forge.webp','Materiales · retornos · diarios'],bm:['MERCADO NEGRO','Plan Mercado Negro','Plan diversificado para vender al Mercado Negro en pocos días: tope por artículo según sus ventas diarias, valor por material y precio máximo de cada material.','royal-market.webp','Ventas diarias · tope por artículo'],refine:['REFINAMIENTO INTELIGENTE','Refinamiento','Compra, transmuta, refina y vende: el motor busca el plan de refinado con más silver para tu presupuesto, montura, Focus y ciudades.','craft-cal.webp','Refinado · transmutación · rutas']};
 const [label,title,desc,scene,pill]=pages[which]||pages.top;
 return `<section class="hero hero--${which}"><div class="hero-copy"><span class="kicker">${label}</span><h1>${title}</h1><p>${desc}</p><div class="chips"><span class="chip">AODP · América / West</span><span class="chip">${pill}</span><span class="chip">Caché 1 hora · precios con fecha</span></div></div><img class="hero-game-scene" src="/assets/scenes/${scene}" alt="" aria-hidden="true"></section>`;
}
function heading(title,desc,actions=''){return `<div class="panel-heading"><div><h2>${title}</h2>${desc?`<p>${desc}</p>`:''}</div>${actions}</div>`;}
function branchGroups(){return TOP_GROUPS.map(g=>{const count=g.items.filter(i=>state.selectedBranches.has(i.key)).length;
 return `<details class="branch-group ${count?'has-selection':''}" data-group="${g.key}" ${state.openedGroups.has(g.key)?'open':''}><summary><span class="group-art" aria-hidden="true">${img(g.items[0].iconId)}</span><span class="group-name"><strong>${escape(g.title)}</strong><small>${count} de ${g.items.length}</small></span>${count?`<span class="branch-count">${count}</span>`:''}<span class="group-carret">⌄</span></summary><div class="branch-inside"><div class="group-controls"><span class="hint">${g.items.length} ramas disponibles · sin límite de ramas</span><div><button type="button" data-group-all="${g.key}">Seleccionar todo</button><button type="button" data-group-clear="${g.key}">Borrar</button></div></div><div class="branch-items">${g.items.map(b=>`<button type="button" data-branch="${b.key}" aria-pressed="${state.selectedBranches.has(b.key)}" class="branch-choice ${state.selectedBranches.has(b.key)?'selected':''}">${img(b.iconId)}<span>${escape(b.label)}</span>${state.selectedBranches.has(b.key)?'<span class="choice-check">✓</span>':''}</button>`).join('')}</div></div></details>`;}).join('');}
function selectedBranchPills(){return `<div class="selected-branches" aria-label="Ramas seleccionadas">${[...state.selectedBranches].map(key=>{const branch=BRANCH_BY_KEY.get(key);return branch?`<button type="button" class="selected-branch-pill" data-branch="${key}" title="Quitar ${escape(branch.label)}">${img(branch.iconId)}<span>${escape(branch.label)}</span><b>×</b></button>`:'';}).join('')||'<span class="hint">Sin ramas seleccionadas</span>'}</div>`;}

function catalogSearchMatches(){return catalogFamilies({ids:pool(),names:state.names,branchKeys:[...state.selectedBranches],search:state.catalogSearch,selectedOnly:state.catalogOnlySelected,selectedFamilies:[...state.catalogPicked],maxResults:64});}
function catalogSelectionRows(){const data=catalogSearchMatches();
 return `<div class="catalog-list-header"><strong>${silver(data.total)} tipos de objeto</strong><small>${silver(data.showing)} visibles · una selección incluye todos los tiers y encantamientos disponibles</small></div><div class="catalog-item-grid catalog-families">${data.families.map(f=>`<button type="button" class="catalog-item ${f.selected?'picked':''}" data-catalog-family="${escape(f.key)}" aria-pressed="${f.selected}">${img(f.id)}<span><strong>${escape(f.label)}</strong><small>${silver(f.variants)} variantes en el catálogo</small></span><em>${f.selected?'✓':'+'}</em></button>`).join('')||'<div class="empty tiny-empty">No se encontraron tipos de objeto en estas ramas.</div>'}</div>${data.total>data.showing?'<p class="hint">Usa el buscador para filtrar tipos. Los tiers se muestran después en Top Mercado.</p>':''}`;
}
function catalogSelectionPanel(){const selected=state.catalogPicked.size;
 return `<details class="catalog-selector catalog-collapsible" ${selected||state.catalogSearch?'open':''}><summary><span><strong>Objetos concretos</strong> <small>opcional · ${selected?selected+' tipos elegidos':'consulta toda la rama'}</small></span><span class="drawer-arrow">⌄</span></summary><div class="catalog-selector-heading"><div><span class="eyebrow">SELECCIÓN DE OBJETOS</span><h3>Objetos individuales</h3><p>Opcional: limita la consulta a tipos concretos (Maza, Maza pesada…). Los tiers se filtran después, en el ranking.</p></div><span class="counter">${selected} tipos</span></div>
 <div class="catalog-controls"><div class="mode-switch" role="radiogroup" aria-label="Cobertura de objetos"><label class="mode-option ${state.catalogMode==='all'?'active':''}"><input type="radio" name="catalog-mode" value="all" ${state.catalogMode==='all'?'checked':''}> Todos los objetos</label><label class="mode-option ${state.catalogMode==='selected'?'active':''}"><input type="radio" name="catalog-mode" value="selected" ${state.catalogMode==='selected'?'checked':''}> Solo mis objetos (${selected})</label></div><label class="catalog-search-label"><span>Buscar tipo de objeto</span><input id="catalog-search" placeholder="Ej. maza, mangual, bastón…" autocomplete="off" value="${escape(state.catalogSearch)}"></label><label class="checkline"><input type="checkbox" id="catalog-only-selected" ${state.catalogOnlySelected?'checked':''}> Mostrar seleccionados</label></div>
 <div id="catalog-search-results">${catalogSelectionRows()}</div>
 <div class="catalog-actions"><span class="hint">Marcar «Maza» consulta todos sus tiers y encantamientos.</span><div class="btn-group"><button class="btn btn-ghost btn-small" id="catalog-select-visible">Marcar visibles</button><button class="btn btn-ghost btn-small" id="catalog-clear">Borrar objetos</button></div></div></details>`;
}
function marketChips(values,field){return `<div class="market-chips">${MARKETS.map(c=>`<label class="market-toggle city-control city--${CITY_KEYS[c]} ${values.has(c)?'active':''}"><input type="checkbox" data-market-${field}="${escape(c)}" ${values.has(c)?'checked':''}><span class="city-gem" aria-hidden="true">◆</span><span>${escape(cityDisplay(c))}</span></label>`).join('')}</div>`;}
function topPanel(){const count=state.selectedBranches.size,st=state.coverage;
 return hero('top')+`<section class="panel branch-picker-panel">${heading('1 · ¿Qué quieres analizar?','Elige una o varias ramas u objetos concretos. El refinado tiene su propia pestaña.',`<span class="counter">${count} ramas</span>`)}<div class="branch-picker-top"><span class="hint">${escape(state.catalogStatus)}</span><div class="btn-group"><button class="btn btn-ghost btn-small" id="close-groups">Contraer todo</button><button class="btn btn-ghost btn-small" id="clear-branches">Borrar selección</button></div></div>${selectedBranchPills()}<div class="selector-grid">${branchGroups()}</div>${catalogSelectionPanel()}</section>
 <section class="panel">${heading('2 · ¿Dónde y en qué periodo?','Elige las ciudades donde quieres vender y la ventana de historial.')}
 <div class="top-query-row"><div class="field top-days-field"><label for="top-days">Ventana</label><select id="top-days">${[1,3,7,14].map(d=>`<option value="${d}" ${state.days===d?'selected':''}>${d===1?'Último día':d+' días'}</option>`).join('')}</select></div><div class="top-cities">${marketChips(state.markets,'top')}</div></div>
 <div class="toolbar"><label class="checkline"><input type="checkbox" id="force-top" ${state.forceFresh?'checked':''}> Forzar datos frescos</label><div class="btn-group"><button class="btn btn-gold" id="run-top" ${state.queryActive?'disabled':''}>${state.queryActive?'Consultando…':'Consultar top'}</button><button class="btn btn-ghost" id="scan-more" ${!st||st.complete||state.queryActive?'disabled':''} title="Consulta más IDs del catálogo de tu selección">Ampliar cobertura</button></div></div>
 ${st?`<div class="hint">${silver(state.scannedIds.size)} de ${silver(st.total)} artículos del catálogo consultados${st.complete?'':' · puedes ampliar la cobertura'}${state.coverage.errors?.length?` · ${state.coverage.errors.length} lotes con errores`:''}.</div>`:''}
 <details class="west-data-source"><summary>ℹ Sobre los datos</summary><div class="west-data-source-body"><p><strong>Fuente:</strong> AODP REST América (West). <em>History</em> da la actividad diaria por calidad; <em>Prices</em>, las cotizaciones. Son órdenes observadas por jugadores con el cliente de datos, no ventas garantizadas, y pueden diferir de otras webs.</p><p><strong>Vendidos Q1/día:</strong> unidades de calidad 1 por día; es lo que usa Craft Planner para dimensionar lotes. La mini-gráfica muestra cada día de la ventana (los 3 últimos en dorado).</p><p><strong>Forzar datos frescos</strong> evita la caché de la herramienta; AODP puede no tener datos nuevos y limita las consultas (si ves un error 429, espera un minuto).</p><div class="source-links"><a href="https://west.albion-online-data.com/api-docs" target="_blank" rel="noopener noreferrer">Documentación AODP West</a></div></div></details>
 <div id="top-progress" role="status"></div></section>
 <section class="panel top-results-panel" id="top-results">${renderTopResults()}</section>`;
}
function visibleTop(){return rankEntries(state.top.filter(t=>state.markets.has(t.city)),state.sort);}
function topRows(){return applyTopFilters(visibleTop(),state.topFilter,{names:state.names,marked:state.marked});}
function topFilterBar(){const f=state.topFilter,all=state.top.filter(t=>state.markets.has(t.city)),active=activeFilterCount(f);
 const chip=(kind,value,label,on)=>`<label class="toggle-chip ${on?'active':''}"><input type="checkbox" data-top-${kind}="${value}" ${on?'checked':''}>${label}</label>`;
 return `<div class="top-filters" id="top-filters">
  <div class="top-filter-group"><span class="top-filter-label">Tier</span><div class="pill-choices">${tiersInRows(all).map(t=>chip('tier',t,'T'+t,f.tiers.includes(t))).join('')}</div></div>
  <div class="top-filter-group"><span class="top-filter-label">Encantamiento</span><div class="pill-choices">${enchantsInRows(all).map(e=>chip('ench',e,'.'+e,f.enchants.includes(e))).join('')}</div></div>
  <div class="top-filter-fields">
   <label class="top-field top-field-search"><span>Buscar</span><input id="top-search" type="search" placeholder="Nombre o ID…" value="${escape(f.search)}" autocomplete="off"></label>
   <label class="top-field"><span>Vendidos Q1/día mín.</span><input id="top-min-q1" type="number" min="0" step="1" value="${f.minQ1||''}" placeholder="0"></label>
   <label class="top-field"><span>Silver/día mín.</span><select id="top-min-silver">${SILVER_PRESETS.map(v=>`<option value="${v}" ${f.minSilver===v?'selected':''}>${v?small(v):'Cualquiera'}</option>`).join('')}</select></label>
   <label class="top-field"><span>Señal Q1</span><select id="top-signal">${SIGNAL_OPTIONS.map(([k,l])=>`<option value="${k}" ${f.signal===k?'selected':''}>${l}</option>`).join('')}</select></label>
   <label class="top-field"><span>Ordenar</span><select id="top-sort-inline"><option value="silver" ${state.sort==='silver'?'selected':''}>Silver/día</option><option value="units" ${state.sort==='units'?'selected':''}>Unidades/día</option><option value="price" ${state.sort==='price'?'selected':''}>Precio</option><option value="tier-asc" ${state.sort==='tier-asc'?'selected':''}>Tier ↑</option><option value="tier-desc" ${state.sort==='tier-desc'?'selected':''}>Tier ↓</option></select></label>
  </div>
  <div class="top-filter-footer"><label class="checkline"><input type="checkbox" id="top-only-marked" ${f.onlyMarked?'checked':''}> Solo marcados</label><label class="checkline"><input type="checkbox" id="top-detailed" ${state.topDetailed?'checked':''}> Vista detallada</label>${active?`<button class="btn btn-ghost btn-small" id="top-clear-filters">Quitar filtros (${active})</button>`:''}</div>
 </div>`;}
function topTable(){const rows=topRows(),shown=rows.slice(0,state.tableLimit),detail=state.topDetailed,total=state.top.filter(t=>state.markets.has(t.city)).length;
 if(!rows.length)return `<div class="empty compact-empty"><h3>Ningún artículo cumple los filtros</h3><p>${total} artículos consultados. Afloja algún filtro o pulsa «Quitar filtros».</p></div>`;
 return `<div class="top-table-meta"><span><strong>${silver(rows.length)}</strong> de ${silver(total)} artículos · ${small(rows.reduce((x,r)=>x+r.averageDailySilver,0))} silver/día</span><button class="btn btn-ghost btn-small" id="mark-first">☆ Marcar ${Math.min(50,rows.length)} primeros</button></div>
 <div class="result-table market-ranking ${detail?'is-detailed':'is-simple'}"><table><thead><tr><th class="mark-col" aria-label="Marcar"></th>${detail?'<th class="ranking-col">#</th>':''}<th>Objeto</th><th>Mercado</th>${detail?'<th class="numeric">Todas/día</th>':''}<th class="numeric">Vendidos Q1/día</th><th class="numeric">Silver/día</th><th class="numeric">Precio</th><th class="ranking-actions"></th></tr></thead><tbody>${shown.map((r,i)=>{const key=r.id+'|'+r.city,on=state.marked.has(key),sig=demandSignals(r);
  return `<tr class="${on?'is-marked-row':''}"><td class="mark-col"><button class="rank-mark ${on?'is-marked':''}" data-mark="${escape(key)}" title="${on?'Quitar marca':'Marcar para el Planner'}" aria-label="${on?'Quitar marca':'Marcar'}">${on?'★':'☆'}</button></td>${detail?`<td class="rank-number">${i+1}</td>`:''}<td>${itemWithCopy(r.id)}</td><td>${cityBadge(r.city)}</td>${detail?`<td class="numeric"><strong class="rank-metric">${displayedInt(r.averageDailyUnits)}</strong><span class="rank-sub">${silver(r.activeDays)} / ${silver(r.days)} días con actividad</span></td>`:''}<td class="numeric"><strong class="rank-metric q1-rank">${displayedInt(r.quality1DailyUnits)}</strong>${sig?`<span class="rank-sub q1-signal-line">${sparkHTML(sig)}${signalBadge(sig)}</span>`:''}${detail?`<span class="rank-sub">${silver(r.quality1ActiveDays)} días Q1 · ${escape(trafficSignal(r).label)}${sig?` · sin pico ${compact(sig.robustDaily)} · últimos 3 días ${compact(sig.recent3)}`:''}</span>`:''}</td><td class="numeric"><strong class="rank-metric">${small(r.averageDailySilver)}</strong></td><td class="numeric"><strong class="rank-metric">${displayedInt(r.averageUnitPrice)}</strong></td><td class="ranking-actions"><button class="btn btn-small btn-ghost rank-add" data-batch-add="${escape(r.id)}" title="Agregar a Calculadora de Craft">+ Calc.</button></td></tr>`;}).join('')}</tbody></table></div>
 ${state.tableLimit<rows.length?`<div class="toolbar"><span></span><button class="btn btn-ghost" id="more-table">Mostrar 65 más (${silver(rows.length-shown.length)} restantes)</button></div>`:''}`;}
function topTransferBar(){const n=state.marked.size;
 if(!n)return `<div class="top-transfer-bar is-empty"><span class="hint">Marca con ☆ los artículos que quieras planificar y envíalos al Craft Planner o a la Calculadora.</span></div>`;
 return `<div class="top-transfer-bar is-sticky"><strong>★ ${n} ${n===1?'marcado':'marcados'}</strong><div class="btn-group"><button class="btn btn-ghost btn-small" id="clear-marked">Quitar marcas</button><button class="btn btn-outline btn-small" id="send-marked-calc">A Calculadora</button><button class="btn btn-gold btn-small" id="send-marked-planner">Enviar a Craft Planner</button></div></div>`;}
function renderTopResults(){
 if(!state.top.length)return `${heading('Resultados del mercado','Elige ramas y ciudades y pulsa «Consultar top».')}<div class="empty"><div class="loading-symbol">⌕</div><h3>Tu radar de mercado está listo</h3><p>Aquí verás qué se vende, cuánto y a qué precio, con filtros por tier, unidades y silver.</p></div>`;
 const range=utcRange(state.days);
 return `${heading('Ranking del mercado',`${escape(range.date)} a ${escape(new Date(range.end-86400000).toISOString().slice(0,10))} UTC · actividad observada, no ventas garantizadas`)}
 ${topFilterBar()}<div id="top-table">${topTable()}</div>${topTransferBar()}
 ${state.coverage?.errors?.length?`<div class="warning">Consulta parcial: ${escape(state.coverage.errors.slice(0,2).join(' · '))}. No se estiman datos faltantes.</div>`:''}`;
}
function refreshTopResults({full=true}={}){state.tableLimit=65;
 if(full){const el=$('#top-results');if(el){el.innerHTML=renderTopResults();labelPhoneTables();}}
 else{const el=$('#top-table');if(el){el.innerHTML=topTable();labelPhoneTables();}}
 save();}
function signalBadge(sig){if(!sig)return '';return `<span class="q1-signal q1-signal-${sig.level}" title="Media ${compact(sig.windowMean)} · sin día pico ${compact(sig.robustDaily)} · últimos 3 días ${compact(sig.recent3)} u./día">${escape(sig.label)}</span>`;}
function sparkHTML(sig){if(!sig)return '';return `<span class="q1-spark" aria-hidden="true">${sparkLevels(sig.units).map(h=>`<i style="height:${Math.max(1,h*2)}px"></i>`).join('')}</span>`;}
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
 <div class="plan-step-title"><b>01</b><span>Elige las ciudades donde quieres VENDER</span><small>${state.saleMarkets.size} / 8 seleccionadas</small></div>${marketChips(state.saleMarkets,'sale')}<div class="toolbar"><p class="muted">Solo se evalúan los artículos de tu cesta en estas ciudades.</p><div class="btn-group"><button type="button" class="btn btn-ghost btn-small" id="plan-only-bm">Solo Mercado Negro</button><button type="button" class="btn btn-ghost btn-small" id="plan-all-royals">Todas las Royal</button></div></div></section>
 <section class="panel">${heading('02 · Configuración del plan','Lo esencial aquí; el resto en «Opciones avanzadas».')}
 <div class="config-grid">
  <div class="config-section budget-section"><h3>Presupuesto de silver</h3><div class="budget-presets" role="radiogroup" aria-label="Presupuesto máximo">${[5,10,15,20].map(m=>`<label class="budget-choice ${config.budget===m*1000000?'active':''}"><input type="radio" name="budget-preset" data-budget-preset="${m*1000000}" ${config.budget===m*1000000?'checked':''}><span class="budget-check">✓</span>${m}M</label>`).join('')}<label class="budget-choice ${![5,10,15,20].some(m=>config.budget===m*1000000)?'active':''}"><input type="radio" name="budget-preset" data-budget-preset="other" ${![5,10,15,20].some(m=>config.budget===m*1000000)?'checked':''}><span class="budget-check">✓</span>Otro</label></div><label class="field budget-custom" ${[5,10,15,20].some(m=>config.budget===m*1000000)?'hidden':''}><span class="small-print">Presupuesto personalizado (silver)</span><input data-cfg="budget" type="number" min="1000" max="1000000000000" step="1000" value="${config.budget}"></label><p>Máximo disponible, sin obligación de gastarlo.</p></div>
  <div class="config-section fame-config"><h3>Objetivo del plan</h3><select data-cfg="goal"><option value="silver" ${config.goal==='silver'?'selected':''}>Más silver · sin pérdidas</option><option value="balanced" ${config.goal==='balanced'?'selected':''}>Silver y fama · sin pérdidas</option><option value="fame" ${config.goal==='fame'?'selected':''}>Fama por silver · admite pérdidas limitadas</option></select><p>${config.goal==='fame'?'Prioriza fama/silver y muestras variadas, incluyendo T8 si hay evidencia. Puede cerrar con profit negativo.':config.goal==='balanced'?'Cada ruta debe dar beneficio; entre las rentables, prefiere las que más fama dan (cada punto de fama cuenta como 0,6 silver al decidir).':'Solo cuenta el beneficio. Se rechazan rutas con pérdida esperada.'}</p>${config.goal==='fame'?`<label class="fame-loss-input">Máximo de pérdidas estimadas: <input data-cfg="fameLossBudgetPct" type="number" min="0" max="30" step="1" value="${config.fameLossBudgetPct}"> % del presupuesto</label><small class="risk-explain">La pérdida máxima es ${silver(config.budget*config.fameLossBudgetPct/100)} silver. Además ninguna ruta puede perder más de 25% de su capital.</small>`:''}</div>
  <div class="config-section"><h3>Estilo del plan</h3><select data-cfg="style"><option value="prudent" ${config.style==='prudent'?'selected':''}>Prudente · lotes pequeños</option><option value="balanced" ${config.style==='balanced'?'selected':''}>Equilibrado · lotes medios</option><option value="dynamic" ${config.style==='dynamic'?'selected':''}>Dinámico · más volumen</option></select><p>Parte de lo vendido (Q1) en cada destino que tus órdenes pueden captar: Prudente 20 %, Equilibrado 30 %, Dinámico 45 %. Sin máximo de rutas: el motor para cuando el siguiente lote deja de compensar.</p></div>
  <div class="config-section"><h3>Prioridad de compra y venta</h3><select data-cfg="priority">${Object.entries(PRIORITIES).map(([k,p])=>`<option value="${k}" ${(config.priority||'fast-buy')===k?'selected':''}>${p.label}</option>`).join('')}</select><p>${escape(PRIORITIES[config.priority||'fast-buy']?.hint||'')}. El Mercado Negro siempre se vende al instante a sus pujas.</p></div>
  <div class="config-section"><h3>Días para vender el lote</h3><select data-cfg="saleDays">${[1,3,7,14,30].map(x=>`<option value="${x}" ${config.saleDays==x?'selected':''}>${x} días</option>`).join('')}</select><p>Plazo hasta tu siguiente craft.</p></div>
  <div class="config-section"><h3>Tiers</h3>${toggleChips([4,5,6,7,8],'tiers')}</div>
  <div class="config-section"><h3>Encantamiento</h3>${toggleChips([0,1,2,3,4],'enchants')}</div>
  <div class="config-section"><h3>Cuenta y ganancias extra</h3><label class="checkline"><input type="checkbox" data-cfg="premium" ${config.premium!==false?'checked':''}> Tengo Premium <span class="small-print">(impuesto ${config.premium!==false?4:8} %)</span></label><label class="checkline"><input type="checkbox" data-cfg="journalProfit" ${config.journalProfit!==false?'checked':''}> Contar diarios llenos como ganancia</label><p>Suma lo que ganas vendiendo llenos los diarios que llenas al fabricar (lleno − vacío). Estimación por fama.</p></div>
  <div class="config-section focus-section ${config.focus?'expanded':''}"><h3>Focus</h3><label class="checkline"><input type="checkbox" data-cfg="focus" ${config.focus?'checked':''}> Usar Focus donde más rinda</label><p>El motor gasta tu Focus en los crafts que más silver ahorran por punto; el resto se fabrica sin Focus. El coste por artículo sale del juego.</p>${config.focus?`<div class="multifield" style="margin-top:12px"><label>Focus disponible<input data-cfg="focusAvailable" type="number" min="1" value="${config.focusAvailable}"></label><label>Eficiencia de Focus (FCE)<input data-cfg="focusEfficiency" type="number" min="0" max="100000" step="100" value="${config.focusEfficiency||0}"></label><label>Bono Focus (%)<input data-cfg="focusBonus" type="number" min="0" value="${config.focusBonus}"></label></div><p class="small-print">FCE: la «eficiencia de coste de Focus» de tu especialización en el tablero de destino; cada 10.000 puntos reduce el coste a la mitad. Si una receta no trae su coste, se usa «Focus/craft»: <input aria-label="Focus por craft de respaldo" data-cfg="focusPerCraft" type="number" min="0" value="${config.focusPerCraft}" style="width:80px;display:inline-block;padding:3px;height:28px"></p>`:''}</div>
 </div>
 <details class="advanced-config" ${state.advancedOpen?'open':''}><summary><span><strong>Opciones avanzadas</strong> <small>fabricación, compras, riesgo, diversidad, costes, calidades</small></span><span class="drawer-arrow">⌄</span></summary>
 <div class="config-grid">
  <div class="config-section"><h3>Ciudad de fabricación</h3><label class="checkline"><input type="checkbox" data-cfg="bonusCity" ${config.bonusCity?'checked':''}> Fabricar en ciudad de bono</label><p>Se usa la especialidad declarada de cada receta; no obliga a fabricar todo en una sola ciudad.</p></div>
  <div class="config-section"><h3>Bono diario de producción</h3><select data-cfg="dailyBonus"><option value="0" ${config.dailyBonus==0?'selected':''}>Sin bono · 0%</option><option value="10" ${config.dailyBonus==10?'selected':''}>+10%</option><option value="20" ${config.dailyBonus==20?'selected':''}>+20%</option></select><p>El bono diario se suma a producción, no directamente al retorno.</p></div>
  <div class="config-section config-half royal-purchase-section"><h3>Compras de materiales y diarios · ciudades Royal</h3>
    <div class="multifield"><label>¿Dónde comprar?<select data-cfg="purchaseMode"><option value="best-royal" ${config.purchaseMode==='best-royal'?'selected':''}>Mejor coste entre ciudades Royal</option><option value="craft-city" ${config.purchaseMode==='craft-city'?'selected':''}>Solo en la ciudad de fabricación</option></select></label>
    <label>Coste de traslado por material / diario (silver/u.)<input data-cfg="inboundTransportPerUnit" type="number" min="0" step="1" value="${config.inboundTransportPerUnit}"></label>
    <label>Ciudad donde fabricar SIN bono<select data-cfg="craftFallbackCity">${['Bridgewatch','Fort Sterling','Lymhurst','Martlock','Thetford','Caerleon'].map(city=>`<option value="${city}" ${config.craftFallbackCity===city?'selected':''}>${city}</option>`).join('')}</select></label></div>
    <label class="checkline"><input type="checkbox" data-cfg="includeCaerleonPurchases" ${config.includeCaerleonPurchases?'checked':''}> Incluir Caerleon en compras externas (riesgo de zonas rojas)</label>
    <p>Compara precio observado + traslado estimado. Las cinco ciudades Royal principales están incluidas; Caerleon es opcional para compras externas. Si fabricas en Caerleon, también se consulta allí el precio local. Las cotizaciones no aseguran volumen disponible.</p>
  </div>
  <div class="config-section config-half"><h3>Distribución entre tiers y encantamientos</h3><label class="checkline"><input type="checkbox" data-cfg="diversify" ${config.diversify?'checked':''}> <strong>Repartir entre artículos, tiers y encantamientos</strong></label><p>Reserva muestras pequeñas de tiers altos y encantamientos con historial Q1; después reparte cantidades en rondas. El objetivo Fama puede admitir pérdidas limitadas; los otros objetivos no.</p></div>
  <div class="config-section"><h3>Uso del presupuesto</h3><label class="checkline"><input type="checkbox" data-cfg="useBudget" ${config.useBudget?'checked':''}> Usar todo lo posible</label><p><b>Sin marcar:</b> cada lote adicional debe rendir al menos tu ROI mínimo. <b>Marcado:</b> se sigue invirtiendo mientras el lote adicional deje beneficio, aunque sea poco.</p></div>
  <div class="config-section"><h3>Tendencia de mercado</h3><label class="checkline"><input type="checkbox" data-cfg="trendAnalysis" ${config.trendAnalysis?'checked':''}> Comparar actividad de 7/14 días (cuando corresponda)</label><p>Evita ampliar el lote por un pico reciente de actividad. No convierte historial en ventas garantizadas.</p></div>
  <div class="config-section"><h3>Lectura diaria Q1</h3><label class="checkline"><input type="checkbox" data-cfg="marketSignals" ${config.marketSignals!==false?'checked':''}> Ajustar demanda y precio con la serie diaria</label><p>Descarta el día pico aislado y, si los últimos 3 días venden menos, acerca la demanda a ellos. Si el precio Q1 reciente es menor, planifica con él. Nunca aumenta lo observado.</p></div>
  <div class="config-section"><h3>Crafting de volumen</h3><label class="checkline"><input type="checkbox" data-cfg="volume" ${config.volume?'checked':''}> Permitir más volumen prudente</label><p>Permite más unidades donde el historial Q1 y el beneficio marginal lo justifiquen. No inventa liquidez.</p></div>
  <div class="config-section"><h3>Costes y cotizaciones</h3><div class="multifield"><label>Impuesto venta %<input type="number" data-cfg="tax" min="0" max="30" step=".1" value="${config.tax}"></label><label>Publicación Royal %<input type="number" data-cfg="listingFee" min="0" max="30" step=".1" value="${config.listingFee}"></label><label>Estación / craft<input type="number" data-cfg="stationFee" min="0" step="1" value="${config.stationFee}"></label></div><p>Máximo de antigüedad de precios: <input aria-label="Antigüedad máxima de precios (horas)" type="number" data-cfg="maxQuoteHours" min="1" max="168" value="${config.maxQuoteHours}" style="width:65px;display:inline-block;padding:3px;height:30px"> horas.</p></div>
  <div class="config-section risk-section config-half" id="profit-protection"><h3>Protección del beneficio · ¿qué significan estos controles?</h3><p>Son ajustes de seguridad para que el plan no parezca rentable solo porque los precios cambien un poco. Son <strong>simulaciones</strong>, no órdenes verificadas.</p><div class="profit-help"><span><strong>Compra +%:</strong> margen por si los materiales suben antes de comprarlos (recomendado 2 %).</span><span><strong>Venta -%:</strong> rebaja extra del precio de venta (recomendado 0 %: el motor ya calcula la caída por volumen).</span><span><strong>ROI mínimo:</strong> rentabilidad mínima de cada lote adicional.</span><span><strong>Capital por objeto:</strong> máximo del capital del plan en un solo artículo (con margen de un craft).</span></div><div class="multifield"><label>Colchón compra %<input data-cfg="buyBufferPct" type="number" min="0" max="50" step="1" value="${config.buyBufferPct}"></label><label>Descuento venta %<input data-cfg="sellHaircutPct" type="number" min="0" max="30" step="1" value="${config.sellHaircutPct}"></label><label>ROI mínimo %<input data-cfg="minRoiPct" type="number" min="0" max="100" step="1" value="${config.minRoiPct}"></label><label>Máx. capital / objeto %<input data-cfg="maxCapitalSharePct" type="number" min="5" max="100" step="5" value="${config.maxCapitalSharePct}"></label></div><p class="small-print" style="margin-top:12px">El Motor 3.0 ya descuenta la bajada de precio por volumen y el encarecimiento de materiales; estos márgenes son seguridad extra. La columna «Estrés −10 %» muestra cada ruta con el precio un 10 % más bajo.</p></div>
  <div class="config-section config-half"><h3>Distribución máxima del capital</h3><p>Porcentaje máximo del capital para un mismo tier, encantamiento o familia (sobre tu presupuesto, o sobre lo que el mercado admite si es menor). Se aplica con «Repartir…» activado. Si el límite es imposible (p. ej. 20 % con 3 tiers), se usa 100/N + 5 %.</p><div class="multifield"><label>Máx. por tier %<input data-cfg="maxTierSharePct" type="number" min="10" max="100" step="1" value="${config.maxTierSharePct}"></label><label>Máx. por encantamiento %<input data-cfg="maxEnchantSharePct" type="number" min="10" max="100" value="${config.maxEnchantSharePct}"></label><label>Máx. por familia %<input data-cfg="maxFamilySharePct" type="number" min="10" max="100" value="${config.maxFamilySharePct}"></label></div></div>
  <div class="config-section"><h3>Logística y precio atípico</h3><div class="multifield"><label>Transporte por unidad de salida<input data-cfg="deliveryCostPerUnit" type="number" min="0" step="1" value="${config.deliveryCostPerUnit}"></label><label>Precio máximo vs. media histórica calidad 1 (+%)<input data-cfg="historyPriceCapPct" type="number" min="0" max="100" value="${config.historyPriceCapPct}"></label></div><p>El precio usado es el menor entre la cotización observada y el límite derivado del historial Q1. Transporte: estimación manual, no calculada por ruta.</p></div>

  <div class="config-section config-half"><h3>Calidades superiores · Mercado Negro (experimental)</h3><label class="checkline"><input type="checkbox" data-cfg="qualityBonus" ${config.qualityBonus?'checked':''}> Sumar el extra esperado por piezas de calidad 2–5</label><p>Parte de lo que fabricas sale con mejor calidad y puede venderse a pujas más altas del Mercado Negro. Usa pujas reales por calidad; el extra nunca supera el 15 % del precio.</p>${config.qualityBonus?`<div class="multifield quality-probs">${['Normal','Buena','Notable','Excelente','Obra maestra'].map((label,i)=>`<label>${label} %<input data-quality-prob="${i}" type="number" min="0" max="100" step="0.1" value="${+((config.qualityProbs||[])[i]*100).toFixed(2)}"></label>`).join('')}</div><p class="small-print">Probabilidades aproximadas sin bono de calidad; ajústalas a tu especialización.</p>`:''}</div>
 </div></details>
 <div class="callout"><strong>${rr.returnPct.toFixed(2)}% de retorno de referencia</strong><div class="hint">Producción con especialidad ilustrativa: ${rr.productionBonus}% = Royal 18% + especialidad 15% + diario ${config.dailyBonus}% + Focus ${config.focus?config.focusBonus:0}%. Cada receta recalcula el retorno según sus condiciones.</div></div>
 ${orderbookBadge()}
 <div class="toolbar"><div class="hint">Venta BM: puja; Royal: oferta mínima publicada, no necesariamente una orden ejecutable. Se descuentan impuestos, impacto, colchón de compra y descuento de venta.</div><button class="btn btn-gold" id="run-plan" ${state.planActive||!state.plannerItems.length||!state.saleMarkets.size?'disabled':''}>${state.planActive?'Calculando…':'✧ Generar plan por ciudades'}</button></div>
 <div id="plan-progress" role="status"></div></section>
 <section id="plan-results">${renderPlanResult()}</section><section class="panel" id="plan-log">${planLogHTML()}</section></div></div>`;
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
  <label class="batch-inline-control"><input type="checkbox" data-cfg="focus" ${state.filters.focus?'checked':''}> Usar Focus</label>${state.filters.focus?`<label class="batch-inline-control">Focus disponible <input class="batch-focus-input" type="number" min="1" step="100" data-cfg="focusAvailable" value="${state.filters.focusAvailable||''}"></label><label class="batch-inline-control">FCE <input class="batch-focus-input" type="number" min="0" max="100000" step="100" data-cfg="focusEfficiency" value="${state.filters.focusEfficiency||0}"></label>`:''}<label class="batch-inline-control"><input type="checkbox" data-cfg="premium" ${state.filters.premium!==false?'checked':''}> Premium</label><label class="batch-inline-control"><input type="checkbox" data-cfg="journalProfit" ${state.filters.journalProfit!==false?'checked':''}> Diarios llenos</label>
  <label class="batch-inline-select">Bono diario <select data-cfg="dailyBonus"><option value="0" ${state.filters.dailyBonus==0?'selected':''}>Sin bono</option><option value="10" ${state.filters.dailyBonus==10?'selected':''}>+10 %</option><option value="20" ${state.filters.dailyBonus==20?'selected':''}>+20 %</option></select></label>
  <div class="btn-group"><button class="btn btn-gold btn-small" id="batch-run" ${state.batchBusy?'disabled':''}>${state.batchBusy?'Consultando…':'Recalcular'}</button><button class="btn btn-ghost btn-small" id="batch-refresh" ${state.batchBusy?'disabled':''}>Precios frescos</button><button class="btn btn-ghost btn-small" id="batch-copy" ${!state.batchResult?.materials?.length?'disabled':''}>Copiar compras</button><button class="btn btn-ghost btn-small" id="batch-export" ${!state.batchResult?.rows?.length?'disabled':''}>CSV</button><button class="btn btn-ghost btn-small" id="batch-clear" ${!state.batchItems.length?'disabled':''}>Vaciar</button></div></div>
  <div class="calculator-buy-settings"><label>Compras de materiales y diarios <select data-cfg="purchaseMode"><option value="best-royal" ${state.filters.purchaseMode==='best-royal'?'selected':''}>Mejor coste entre ciudades Royal</option><option value="craft-city" ${state.filters.purchaseMode==='craft-city'?'selected':''}>Solo ciudad de fabricación</option></select></label>
  <label>Transporte por unidad (silver)<input type="number" min="0" step="1" data-cfg="inboundTransportPerUnit" value="${state.filters.inboundTransportPerUnit}"></label>
  <label class="batch-inline-control"><input type="checkbox" data-cfg="includeCaerleonPurchases" ${state.filters.includeCaerleonPurchases?'checked':''}> Comprar en Caerleon externo</label>
  <span class="small-print">El coste efectivo de compra incluye el traslado introducido. Diarios opcionales y separados del profit.</span></div>
  ${state.filters.focus&&!(state.filters.focusPerCraft>0&&state.filters.focusAvailable>0)?'<div class="warning">Focus activado: para calcularlo configura consumo por craft y Focus disponible dentro de «Generador automático de planes». No se asumirá Focus gratis.</div>':''}
  <div id="batch-result">${batchResultHTML()}</div></section>`;}
function purchaseBadge(m){
 if(m.journal)return m.fullNet?`<small class="journal-sale">Lleno: ${silver(m.fullNet)} neto en ${escape(m.fullCity||'—')}${m.journalValue>0?` · <b>+${silver(m.journalValue)}</b>`:''}</small>`:'<small class="journal-sale muted">Sin precio del diario lleno</small>';
 const p=m.purchase;if(!p)return '';const tags=[];
 if(p.book)tags.push(`<span class="buy-tag ${p.book.remaining?'mid':'good'}" title="Ofertas reales vistas en ${escape(m.city)}: ${silver(p.book.depth)} u.">libro: ${silver(p.book.covered)}/${silver(m.buy)} u. · medio ${silver(p.book.avgPrice)}</span>`);
 if(p.book&&!p.book.remaining){}else if(p.level==='hard')tags.push(`<span class="buy-tag warn" title="El mercado mueve ~${compact(p.marketDaily)} u./día en ${escape(m.city)}">${compact(p.daysOfMarket)} días de mercado · +${Math.round(p.slippagePct*100)} %</span>`);
 else if(p.level==='large')tags.push(`<span class="buy-tag mid" title="El mercado mueve ~${compact(p.marketDaily)} u./día en ${escape(m.city)}">${compact(p.daysOfMarket)} días de mercado · +${Math.round(p.slippagePct*100)} %</span>`);
 else if(p.level==='ok')tags.push(`<span class="buy-tag good" title="El mercado mueve ~${compact(p.marketDaily)} u./día">comprable hoy</span>`);
 else tags.push('<span class="buy-tag mid">sin historial</span>');
 if(p.inflated)tags.push(`<span class="buy-tag warn" title="Media reciente ${silver(p.historyAvgPrice)}">precio +${Math.round((p.priceRatio-1)*100)} % sobre su media</span>`);
 if(p.ageHours!=null)tags.push(`<span class="buy-tag ${p.ageHours>24?'mid':'plain'}">cotización de hace ${p.ageHours<1?'<1':Math.round(p.ageHours)} h</span>`);
 return `<div class="buy-tags">${tags.join('')}</div>`;}
function batchResultHTML(){
 const result=state.batchResult;
 if(!state.batchItems.length)return `<div class="empty compact-empty"><h3>Tu mesa de crafting está vacía</h3><p>Busca un objeto o añádelo desde Top Mercado. No necesitas generar un plan automático.</p></div>`;
 if(!result)return `<div class="notice">${state.batchBusy?'Consultando cotizaciones y recetas de AODP West…':'Has añadido objetos. Pulsa «Recalcular» para consultar el lote.'}</div>`;
 const t=result.totals;
 const kpi=(title,value,subtitle,cls='')=>`<div class="metric batch-kpi"><small>${title}</small><strong class="${cls}">${value}</strong><span>${subtitle}</span></div>`;
 let html=`${t.purchaseExtraCost>0||t.purchaseInflated?`<div class="plan-extras">${t.purchaseExtraCost>0?`<span class="extra-chip warn">⚠ Compras grandes: sobrecoste estimado <b>−${small(t.purchaseExtraCost)}</b> (no incluido en el profit)</span>`:''}${t.purchaseInflated?`<span class="extra-chip warn">⚠ ${t.purchaseInflated} materiales con precio inflado</span>`:''}</div>`:''}<div class="batch-kpis">${kpi('Capital de compra',t.incomplete?'Pendiente':silver(t.buyCapital),'Compra neta estimada')}${kpi('Profit Mercado Negro',t.profitBM===null?'Sin calcular':(t.profitBM>=0?'+':'')+silver(t.profitBM),t.journalValue>0?`Incluye diarios llenos +${small(t.journalValue)}`:'Puja observada · impuestos',t.profitBM===null?'':t.profitBM>=0?'green':'red')}${kpi('Profit Royal',t.profitRoyal===null?'Sin calcular':(t.profitRoyal>=0?'+':'')+silver(t.profitRoyal),'Cotización Royal más favorable',t.profitRoyal===null?'':t.profitRoyal>=0?'green':'red')}${kpi('Fama de crafting',silver(t.fame),`${silver(t.crafts)} crafts · ${silver(t.units)} unidades`)}</div>`;
 html+=`<div class="section-heading"><h3>Objetos para fabricar</h3><span>${silver(result.rows.length)} variantes</span></div><div class="batch-table-wrap"><table class="batch-table game-craft-table"><thead><tr><th>Objeto</th><th>Cantidad</th><th>Fabricar en</th><th class="numeric">Coste</th><th class="numeric">Profit M. Negro</th><th class="numeric">Profit Royal</th><th class="numeric">Fama</th><th aria-label="Quitar objeto"></th></tr></thead><tbody>`;
 for(const r of result.rows){
  const all=variantChoices(Object.keys(state.recipes),r.id),tiers=[...new Set(all.map(id=>variant(id)?.tier))].filter(Boolean).sort((a,b)=>a-b),v=variant(r.id)||{tier:4,ench:0};
  const enchants=[...new Set(all.filter(id=>variant(id)?.tier===v.tier).map(id=>variant(id)?.ench))].sort((a,b)=>a-b);
  const option=(values,current,kind)=>`<select aria-label="${kind==='tier'?'Tier':'Encantamiento'} de ${escape(name(r.id))}" data-batch-${kind}="${escape(r.id)}">${values.map(num=>`<option value="${num}" ${num===current?'selected':''}>${kind==='tier'?'T'+num:'.'+num}</option>`).join('')}</select>`;
  const profit=(value,price,market)=>`<div class="profit-cell"><strong class="${value==null?'unverified':value>=0?'green':'red'}">${value==null?`<span class="missing-profit">${r.reason?'Faltan precios':'Sin cotización'}</span>`:(value>=0?'+':'')+silver(value)}</strong>${market==='royal'&&r.royalCity?cityBadge(r.royalCity,'city-small'):''}<div class="batch-price"><input type="number" min="0" step="1" aria-label="Precio manual ${market==='bm'?'Mercado Negro':'Royal'} de ${escape(name(r.id))}" placeholder="${market==='bm'?'Puja BM':'Venta Royal'}" data-batch-price-${market}="${escape(r.id)}" value="${state.batchOverrides[market==='bm'?'sellBM':'sellRoyal']?.[r.id]??price??''}"></div></div>`;
  html+=`<tr class="${r.reason?'batch-invalid':''}"><td><div class="craft-object">${itemWithCopy(r.id)}<div class="variant-row">${option(tiers,v.tier,'tier')}${option(enchants,v.ench,'ench')}</div></div></td><td><input type="number" class="batch-qty" data-batch-qty="${escape(r.id)}" min="1" max="100000" value="${r.qty}" aria-label="Fabricaciones de ${escape(name(r.id))}"></td><td><div class="city-stack">${cityBadge(r.craftCity)}<small>${Number(r.returnPct||0).toFixed(1)} % retorno${r.focusCrafts?` · Focus en ${silver(r.focusCrafts)}/${silver(r.qty)}`:''}${r.bmBookUnits?` · ${silver(r.bmBookUnits)} u. a pujas reales MN`:''}</small></div><label class="batch-no-bonus"><input data-batch-nobonus="${escape(r.id)}" type="checkbox" ${state.batchItems.find(i=>i.id===r.id)?.noBonus?'checked':''}> Fuera de ciudad de bono</label></td><td class="numeric"><strong>${r.reason?'Faltan precios':silver(r.cost)}</strong><small class="batch-subtext">${r.reason?escape(r.reason):'Capital bruto '+silver(r.capital)}</small></td><td class="numeric">${profit(r.profitBM,r.bmPrice,'bm')}</td><td class="numeric">${profit(r.profitRoyal,r.royalPrice,'royal')}</td><td class="numeric"><strong>${displayedInt(r.fame)}${r.fameEstimated?' ≈':''}</strong></td><td><button class="remove-object" data-batch-remove="${escape(r.id)}" aria-label="Quitar ${escape(name(r.id))}" title="Quitar objeto">×</button></td></tr>`;
 }
 html+='</tbody></table></div><p class="batch-caption">Los precios introducidos manualmente sustituyen las observaciones. Un beneficio sin cotización completa se muestra como no calculable, nunca como ganancia.</p>';
 html+=`<div class="section-heading materials-heading"><h3>Lista de compras · materiales y diarios</h3><button class="btn btn-ghost btn-small" id="batch-copy-secondary" ${!result.materials.length?'disabled':''}>▣ Copiar lista</button></div><div class="batch-table-wrap"><table class="batch-table materials-table game-materials-table"><thead><tr><th>Material / diario</th><th>Para</th><th>Comprar en</th><th class="numeric">A comprar</th><th class="numeric">Precio unidad</th><th class="numeric">Total</th></tr></thead><tbody>`;
 let lastJournalTier=null;
 for(const m of result.materials){
  if(m.journal&&m.tier!==lastJournalTier){html+=`<tr class="journal-tier-group"><td colspan="6">▣ Diarios T${m.tier} · compras opcionales, cantidad agrupada y estimada</td></tr>`;lastJournalTier=m.tier;}
  html+=`<tr class="${m.journal?'journal-material-row':''} ${m.missing?'material-missing':m.pending?'material-pending':''}"><td>${itemWithCopy(m.id,{label:m.displayName})}${m.journal?'<span class="estimated-journal-badge">DIARIO ESTIMADO · OPCIONAL</span>':''}${m.missing?`<span class="unverified material-warning">${m.journal?'Diario sin precio (opcional)':'Sin cotización verificable'}</span>`:m.pending?'<span class="unverified material-warning">Lote pendiente de precio</span>':''}</td><td><div class="used-by-items">${m.usedBy.slice(0,4).map(id=>`<img src="${marketImage(id)}" width="34" height="34" title="${escape(name(id))}" alt="${escape(name(id))}" loading="lazy">`).join('')}</div></td><td>${cityBadge(m.city)}${m.city&&m.craftCity&&m.city!==m.craftCity&&m.city!=='Manual'?`<small class="purchase-transfer-note">→ fabricar en ${escape(m.craftCity)} · traslado +${silver(m.transportPerUnit||0)}/u.</small>`:''}${Number(m.savingsVsCraftCity)>0?`<small class="purchase-savings">Ahorro estimado frente a compra local: ${silver(m.savingsVsCraftCity)} por unidad</small>`:''}</td><td class="numeric"><strong>${silver(m.buy)}</strong>${purchaseBadge(m)}<small class="batch-subtext">${m.journal?'estimación · no obligatorio':m.reuse>0?'reutilizas ≈ '+displayedInt(m.reuse)+' del retorno':'sin retorno aprovechable'}</small></td><td class="numeric"><input class="material-price ${m.missing?'quote-missing':''}" type="number" min="0" step="1" data-batch-buy="${escape(m.id)}" value="${state.batchOverrides.buy?.[m.id]??m.unitPrice??''}" placeholder="Precio" aria-label="Precio de ${escape(name(m.id))}" title="${m.missing?'Sin cotización: introduce precio manual si deseas incluirlo en la estimación':'Editar precio observado'}">${m.missing?'<small class="price-hint">Sin precio</small>':m.manual?'<small class="batch-subtext">Precio manual</small>':m.transportPerUnit?`<small class="batch-subtext">Efectivo: ${silver(m.landedUnitPrice)} / u.</small>`:''}</td><td class="numeric"><strong>${m.pending?'—':silver(m.total)}</strong></td></tr>`;
 }
 if(!result.materials.length)html+='<tr><td colspan="6">No hay materiales para mostrar.</td></tr>';
 html+='</tbody></table></div>';
 if(result.journals.length)html+=`<div class="journal-ledger-notice"><strong>${result.journals.length} tipos de diarios agrupados por tier.</strong> Compra adicional estimada de diarios con precios disponibles: <b>${silver(t.journalCost)}</b> silver${t.journalsUnpriced?' · '+silver(t.journalsUnpriced)+' tipos sin precio':''}. <strong>No se incluye en capital de crafting ni en profit</strong>: son opcionales, su consumo depende de cómo los llenes y las cantidades son estimaciones.</div>`;
 if(result.warnings.length)html+=`<div class="warning">${result.warnings.map(escape).join(' · ')}</div>`;
 html+='<p class="batch-caption">El capital bruto puede superar la compra neta calculada con reutilización. Comprueba profundidad de órdenes, antigüedad de los precios y costes reales antes de invertir.</p>';
 return html;
}
function batchRefreshResult(){if(!state.batchItems.length){state.batchResult=null;return updatePage();}if(!state.batchQuotes)return runBatch(false);try{state.batchResult=batchCalculate({items:state.batchItems,recipes:state.recipes,quotes:state.batchQuotes,history:state.top,materialHistory:state.batchMaterialHistory||[],orderbook:state.batchOrderbook||null,config:state.filters,overrides:state.batchOverrides});const out=$('#batch-result');if(out){out.innerHTML=batchResultHTML();labelPhoneTables();}}catch(e){state.batchResult=null;const out=$('#batch-result');if(out)out.innerHTML=`<div class="warning">${escape(e.message)}</div>`;toast(e.message);}}
function batchAdd(id){if(!state.recipes[id]?.materials?.length)return toast('Este artículo no tiene receta cargada.');const entry=state.batchItems.find(x=>x.id===id);
 if(entry)entry.qty=Math.min(100000,entry.qty+1);else{if(state.batchItems.length>=150)return toast('Máximo 150 objetos.');state.batchItems.push({id,qty:1,noBonus:false});}
 state.batchSearch='';save();state.batchResult=null;state.batchQuotes=null;if(state.page!=='calc')nav('calc');else updatePage();void runBatch();}
async function runBatch(force=false){if(state.batchBusy||!state.batchItems.length)return;state.batchBusy=true;state.batchResult=null;
 const out=$('#batch-result');if(out)out.innerHTML='<div class="notice">Consultando cotizaciones de AODP West y calculando el lote…</div>';
 try{const ids=[...new Set(state.batchItems.flatMap(item=>{
    const recipe=state.recipes[item.id];const j=journalEstimate(item.id,estimatedFame(item.id,recipe,state.filters.premium),item.qty);
    return [item.id,...(recipe?.materials||[]).map(m=>m.id),...(j?[j.id,fullJournalId(j.id)]:[])];
   }))];
  const response=await marketFetch('prices',ids,{cities:MARKETS,qualities:'1',force});if(!response.coverage)throw Error(response.errors.slice(0,3).join(' · ')||'No fue posible consultar precios.');
  state.batchQuotes=quoteMap(response.rows);
  const matIds=[...new Set(state.batchItems.flatMap(item=>(state.recipes[item.id]?.materials||[]).map(m=>m.id)))];
  const matCities=[...new Set([...ROYAL_MARKETS.filter(x=>x!=='Brecilien'),...(state.filters.includeCaerleonPurchases?['Caerleon']:[])])];
  const mh=matIds.length?await marketFetch('history',matIds,{cities:matCities,qualities:'1',days:7,force}):{rows:[]};state.batchMaterialHistory=summarizeHistory(mh.rows,{days:7});
  state.batchOrderbook=await loadOrderbook([...state.batchItems.map(i=>i.id),...matIds]);state.orderbookStatus=orderbookStatusOf(state.batchOrderbook);
  state.batchResult=batchCalculate({items:state.batchItems,recipes:state.recipes,quotes:state.batchQuotes,history:state.top,materialHistory:state.batchMaterialHistory,orderbook:state.batchOrderbook,config:state.filters,overrides:state.batchOverrides});
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
function exportBatch(){const r=state.batchResult;if(!r?.rows.length)return toast('Recalcula primero.');const lines=[['TIPO','ITEM','ID','CANTIDAD','COMPRAR_EN','FABRICAR_EN','PRECIO_OBSERVADO','TRANSPORTE_POR_UNIDAD','COSTO_EFECTIVO_POR_UNIDAD','TOTAL_ESTIMADO'],...r.rows.filter(x=>!x.reason).map(x=>['CRAFT',name(x.id),x.id,x.qty,'',x.craftCity,'','','',x.cost]),...r.materials.map(x=>[x.journal?'DIARIO_ESTIMADO_OPCIONAL':'COMPRAR',x.displayName||name(x.id),x.id,x.buy,x.city,x.craftCity||'',x.unitPrice??'',x.transportPerUnit??'',x.landedUnitPrice??'',x.total??''])];const csv=lines.map(row=>row.map(value=>'"'+String(value??'').replaceAll('"','""')+'"').join(',')).join('\r\n');const url=URL.createObjectURL(new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'}));const link=document.createElement('a');link.href=url;link.download='gildem-calculadora-lote.csv';link.click();setTimeout(()=>URL.revokeObjectURL(url),500);}
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

function orderbookStatusOf(ob){return ob?.available?{available:true,ageHours:ob.ageHours,entries:ob.meta?.entries||0,generatedAt:ob.meta?.generatedAt}:{available:false,reason:ob?.reason||'sin configurar'};}
function orderbookBadge(){const st=state.orderbookStatus;
 if(!st)return `<div class="ob-status ob-unknown">◇ <b>Libro de órdenes West</b> · se consulta al generar el plan</div>`;
 if(!st.available)return `<div class="ob-status ob-off">◇ <b>Libro de órdenes West</b> · ${st.reason==='sin configurar'?'sin activar: el motor usa solo AODP REST.':'no disponible ahora ('+escape(st.reason)+'): el motor usa solo AODP REST.'} <span class="hint">Actívalo con la guía ACTIVAR_LIBRO_DE_ORDENES.md del proyecto.</span></div>`;
 const old=st.ageHours>8;return `<div class="ob-status ${old?'ob-old':'ob-on'}">◆ <b>Libro de órdenes West</b> · actualizado hace ${st.ageHours<1?'menos de 1':Math.round(st.ageHours)} h · ${silver(st.entries)} artículos con órdenes${old?' · <span class="hint">el recolector lleva tiempo sin publicar; revisa GitHub Actions</span>':''}</div>`;}
function planExtrasHTML(m){const chips=[];
 if(m.materialSlip>0)chips.push(`<span class="extra-chip warn">⇡ Encarecimiento de materiales incluido <b>−${small(m.materialSlip)}</b></span>`);
 if(m.journalValue>0)chips.push(`<span class="extra-chip good">📜 Diarios llenos <b>+${small(m.journalValue)}</b></span>`);
 if(m.focusCrafts>0)chips.push(`<span class="extra-chip">✦ Focus en <b>${silver(m.focusCrafts)}</b> crafts · ${silver(m.focusSpent)} puntos</span>`);
 if(m.qualityExtra>0)chips.push(`<span class="extra-chip good">◆ Calidades 2–5 <b>+${small(m.qualityExtra)}</b></span>`);
 if(m.purchaseExtraCost>0)chips.push(`<span class="extra-chip warn">⚠ Compras grandes <b>−${small(m.purchaseExtraCost)}</b> → ajustado <b>${small(m.profitAfterPurchases)}</b></span>`);
 if(m.purchaseInflated)chips.push(`<span class="extra-chip warn">⚠ ${m.purchaseInflated} materiales con precio inflado</span>`);
 return chips.length?`<div class="plan-extras">${chips.join('')}</div>`:'';}
function planRowExtras(row){const out=[];
 if(row.bookBids)out.push(`libro MN: ${silver(row.bookDepth)} u. en pujas${row.bookUnitsSold?` · ${silver(row.bookUnitsSold)} de tu lote se venden a pujas reales`:''}${row.bookNote?` · lote ampliado de ${row.bookNote.raisedFrom} a ${row.bookNote.to} por pujas rentables`:''}${row.bookFills?.r?` · ventas vistas ${silver(row.bookFills.r)} u. en ${row.bookFills.d} días`:''}`);
 if(row.competitionUnits>0)out.push(`competencia: ${silver(row.competitionUnits)} u. publicadas a tu precio o menos`);
 if(row.focusQty>0)out.push(`Focus en ${silver(row.focusQty)}/${silver(row.qty)} crafts (${silver(row.focusPerCraft)} puntos c/u${row.focusFromGame?'':' · coste manual'})`);
 if(row.journal)out.push(`diarios +${silver(row.journalGainPerCraft)}/craft (lleno en ${escape(row.journal.fullCity)}${row.journal.capped?' · con tope del 25 %':''})`);
 if(row.qualityExtraPerUnit>0)out.push(`calidades 2–5 +${silver(row.qualityExtraPerUnit)}/u.`);
 return out.length?`<br><b class="row-extras">${out.join(' · ')}</b>`:'';}
function planLogHTML(){const log=state.planLog;
 if(!log.length)return `${heading('Diario de planes','Cada plan que generes se guarda aquí. Pasados unos días podrás comprobar si el mercado se comportó como esperaba.')}<p class="muted">Aún no hay planes guardados.</p>`;
 return `${heading('Diario de planes','Compara tus planes con lo que realmente se movió en AODP West y ajusta tu estilo con datos propios.',`<button class="btn btn-ghost btn-small" id="plan-log-clear">Borrar diario</button>`)}
 <div class="plan-log">${log.map(e=>{const w=planLogWindow(e),v=e.verification,busy=state.planLogBusy===e.id;
  return `<div class="plan-log-entry"><div class="plan-log-head"><div><strong>${formatTime(e.createdAt)}</strong><small>${e.rows.length} rutas · capital ${small(e.capital)} · previsto <span class="${e.profit>=0?'green':'red'}">${e.profit>=0?'+':''}${small(e.profit)}</span> · ${escape({prudent:'Prudente',balanced:'Equilibrado',dynamic:'Dinámico'}[e.style]||e.style)} · ${e.saleDays} días</small></div>
   <div class="btn-group">${w.ready?`<button class="btn btn-outline btn-small" data-plan-verify="${escape(e.id)}" ${busy?'disabled':''}>${busy?'Comprobando…':v?'Volver a comprobar':'Comprobar con el mercado'}</button>`:`<span class="hint">Podrás comprobarlo mañana (UTC)</span>`}<button class="btn btn-ghost btn-small" data-plan-remove="${escape(e.id)}" aria-label="Quitar del diario">×</button></div></div>
   ${v?`<div class="plan-log-result"><div class="plan-log-kpis"><span>Rutas cumplidas <b>${v.ok}/${v.total}</b></span><span>Demanda real vs. prevista <b class="${v.demandRatio>=.8?'green':'red'}">${v.demandRatio!=null?Math.round(v.demandRatio*100)+' %':'—'}</b></span><span>Precio real vs. planificado <b class="${v.priceRatio>=.95?'green':'red'}">${v.priceRatio!=null?Math.round(v.priceRatio*100)+' %':'—'}</b></span><span class="hint">ventana ${v.window} días · ${formatTime(v.checkedAt)}</span></div>
    ${v.advice.map(a=>`<div class="notice">${escape(a)}</div>`).join('')}
    <details><summary>Ver rutas</summary><div class="result-table"><table><thead><tr><th>Artículo</th><th>Destino</th><th class="numeric">Q1/día previsto</th><th class="numeric">Q1/día real</th><th class="numeric">Precio previsto</th><th class="numeric">Precio real</th><th>Resultado</th></tr></thead><tbody>${v.rows.map(r=>`<tr><td>${itemWithCopy(r.id)}</td><td>${cityBadge(r.city,'city-small')}</td><td class="numeric">${compact(r.usedDaily)}</td><td class="numeric">${compact(r.actualDaily)}</td><td class="numeric">${silver(r.price)}</td><td class="numeric">${r.actualPrice?silver(r.actualPrice):'—'}</td><td><span class="q1-signal q1-signal-${r.verdict==='cumplido'?'good':r.verdict==='sin datos'?'mid':'warn'}">${escape(r.verdict)}</span></td></tr>`).join('')}</tbody></table></div></details></div>`:''}
  </div>`;}).join('')}</div>`;}
async function verifyPlan(id){const e=state.planLog.find(x=>x.id===id);if(!e||state.planLogBusy)return;state.planLogBusy=id;refreshPlanLog();
 try{const w=planLogWindow(e),ids=[...new Set(e.rows.map(r=>r.id))],cities=[...new Set(e.rows.map(r=>r.city))];
  const h=await marketFetch('history',ids,{cities,qualities:'1',days:w.window});if(!h.coverage)throw Error('No se pudo consultar el historial: '+h.errors.slice(0,2).join(' · '));
  e.verification=verifyPlanEntry(e,summarizeHistory(h.rows,{days:w.window}));save();toast('Plan comprobado con el mercado.');}
 catch(err){toast(err.message);}finally{state.planLogBusy=null;refreshPlanLog();}}
function refreshPlanLog(){const el=$('#plan-log');if(el){el.innerHTML=planLogHTML();labelPhoneTables();}}
function planAdviceHTML(){const d=state.resultDiagnostics,r=state.result;if(!r&&!d)return '';
 const a=planAdvice({rejected:d?.rejected||{},candidates:d?.candidates||0,config:state.filters,summary:r?.summary,rows:r?.rows||[],shareTrim:r?.summary?.shareTrim});
 if(a.level==='ok'||!a.tips.length)return '';
 return `<div class="plan-advice plan-advice-${a.level}"><h3>${a.level==='empty'?'Por qué no salió ningún plan':a.level==='small'?'Por qué el plan es pequeño':'Ajustes aplicados a tu plan'}</h3>${a.tips.map(t=>`<div class="advice-tip"><b>${escape(t.title)}</b><span>${escape(t.detail)}</span>${t.action==='refining'?'<button class="btn btn-gold btn-small" data-route="refine">Abrir Refinamiento</button>':''}</div>`).join('')}</div>`;}
function renderPlanResult(){const r=state.result;if(!r)return `<section class="panel">${heading('Mi plan de crafting','El motor mostrará artículos viables, inversión, distribución por ciudades y lista de materiales.')}${planAdviceHTML()}<div class="empty"><h3>Tu siguiente lote empieza con una selección</h3><p>Envía artículos desde Top Mercado, configura las ciudades de venta y genera un lote basado en AODP West.</p></div></section>`;
 const m=r.summary,details=state.resultDiagnostics,notes=state.resultNotes||[];const fromTop=r.rows.filter(x=>x.history?.snapshotMatch).length;const destinations=new Set(r.rows.map(x=>x.city));
 let html=`<section class="panel">${heading('Plan calculado','En modo Fama se permiten pérdidas acotadas; en otros objetivos se exige margen esperado positivo. Siempre sujeto a datos observados.',`<div class="btn-group"><button class="btn btn-gold btn-small" id="send-plan-calc" ${!r.rows.length?'disabled':''}>Enviar lote a Calculadora de Craft (${new Set(r.rows.map(x=>x.id)).size})</button><button class="btn btn-ghost btn-small" id="export-plan">Exportar CSV</button></div>`)}
 ${planAdviceHTML()}
 ${r.verdict==='risky'?`<div class="plan-verdict risky"><b>⚠ Plan arriesgado</b><span>${silver(m.riskyRoutes)} rutas superan la cantidad recomendada (30 % del volumen Q1 del horizonte). Capital en esas rutas: ${small(m.riskyCapital)}. Vende más despacio o baja el estilo a Equilibrado.</span></div>`:r.rows.length?`<div class="plan-verdict ok"><b>✓ Plan dentro de lo recomendado</b><span>${escape(PRIORITIES[m.priority||'fast-buy']?.label||'')} · ${escape(PRIORITIES[m.priority||'fast-buy']?.hint||'')}.</span></div>`:''}
 <div class="metric-strip"><div class="metric"><small>Capital necesario</small><strong>${small(m.capitalReserved)}</strong></div><div class="metric"><small>Resultado neto estimado</small><strong class="${m.totalProfit>=0?'green':'red'}">${m.totalProfit>=0?'+':''}${small(m.totalProfit)}</strong></div><div class="metric"><small>Presupuesto sin utilizar</small><strong>${small(m.remaining)}</strong></div><div class="metric"><small>Crafts</small><strong>${silver(m.crafts)}</strong></div></div>
 <div class="variety-strip"><span>⚒ ${new Set(r.rows.map(x=>x.id)).size} variantes</span><span>▣ ${new Set(r.rows.map(x=>variant(x.id)?.tier).filter(Boolean)).size} tiers</span><span>✦ ${new Set(r.rows.map(x=>variant(x.id)?.ench).filter(x=>x!=null)).size} encantamientos</span><span>◎ ${new Set(r.rows.map(x=>x.city)).size} destinos</span></div>
 ${planExtrasHTML(m)}
 <div class="hint">Compras Royal: ${silver(m.royalPurchaseRoutes||0)} rutas entre ciudades · ahorro estimado vs. precio local: ${silver(m.estimatedPurchaseSavings||0)} · transporte de materiales reservado: ${silver(m.purchaseTransportEstimated||0)}. El ahorro solo se calcula donde existe cotización local válida.</div><div class="hint">ROI sobre el capital necesario: ${m.roiOnCapital.toFixed(1)}% · Fama estimada: ${silver(m.totalFame)} · Precios observados con calidad 1. Motor 3.0: precio que baja según tu cuota del volumen Q1, materiales que encarecen al comprar muchos días de mercado, capital neto del retorno y transporte manual si está configurado; NO verifica órdenes suficientes. Los diarios son opcionales.${state.filters.goal==='fame'?' <strong>Modo Fama:</strong> pérdidas estimadas permitidas hasta '+silver(m.allowedFameLoss||0)+' silver ('+state.filters.fameLossBudgetPct+'% del presupuesto), sin vender más que la fracción prudente de historial Q1.':''}</div>`;
 if(r.rows.length){
  if(r.scenarioComparisons?.length){html+=`<div class="section-heading"><h3>Comparativa de asignación · Motor 2.0</h3><span>3 simulaciones con tus filtros</span></div><div class="plan-city-summary">${r.scenarioComparisons.map(s=>`<div class="plan-city-card"><strong>${escape(({profit:'Prioridad profit',balanced:'Equilibrio',spread:'Diversidad'}[s.mode]||s.mode))}</strong><div class="plan-city-stats"><span><small>Profit estimado</small><strong>${small(s.profit)}</strong></span><span><small>Capital</small><strong>${small(s.capital)}</strong></span><span><small>Variantes</small><strong>${silver(s.diversity.variants)}</strong></span></div></div>`).join('')}</div><p class="hint">Se elige la asignación de mayor puntuación según tu objetivo. Las tres simulaciones respetan presupuesto, filtros de tiers, Focus y límites de actividad Q1.</p>`;}
  html+=`<div class="evidence-chain"><div class="evidence-node"><small>01 · Ranking → Planner</small><strong>${fromTop} rutas</strong><p>Conservan la actividad Q1 y la ventana UTC del Top que seleccionaste</p></div><div class="evidence-node"><small>02 · Control de liquidez</small><strong>${new Set(r.rows.map(x=>x.id)).size} variantes</strong><p>Cuotas por mercado, días activos y límites de concentración</p></div><div class="evidence-node"><small>03 · Destinos confirmados en datos</small><strong>${destinations.size} mercados</strong><p>Precios Q1 observados y rentabilidad estimada por ciudad</p></div></div>`;
  const citySummary=new Map();
  for(const line of r.rows){const prev=citySummary.get(line.city)||{city:line.city,profit:0,capital:0,units:0,routes:0};
   prev.profit+=line.totalProfit;prev.capital+=line.capital??line.qty*line.grossCapitalPerCraft;prev.units+=line.qty*line.craftAmount;prev.routes++;citySummary.set(line.city,prev);}
  html+=`<div class="section-heading"><h3>Distribución por ciudad de venta</h3><span>${citySummary.size} destinos activos</span></div><div class="plan-city-summary">${[...citySummary.values()].sort((a,b)=>b.profit-a.profit).map(city=>`<div class="plan-city-card">${cityBadge(city.city)}<div class="plan-city-stats"><span><small>Capital</small><strong>${small(city.capital)}</strong></span><span><small>Beneficio estimado</small><strong class="${city.profit>=0?'green':'red'}">${city.profit>=0?'+':''}${small(city.profit)}</strong></span><span><small>Unidades</small><strong>${silver(city.units)}</strong></span></div></div>`).join('')}</div>`;
  const sortedPlanRows=sortRowsByTier(r.rows,state.planResultSort,(a,b)=>b.totalProfit-a.totalProfit);
  html+=`<div class="toolbar plan-results-sortbar"><strong>Plan por artículo y ciudad</strong><div class="plan-results-sort-actions"><label class="results-sort-label" for="plan-result-sort">Ordenar resultados por <select id="plan-result-sort" aria-label="Ordenar plan por tier"><option value="engine" ${state.planResultSort==='engine'?'selected':''}>Orden original del plan</option><option value="tier-asc" ${state.planResultSort==='tier-asc'?'selected':''}>Tier: T4 → T8</option><option value="tier-desc" ${state.planResultSort==='tier-desc'?'selected':''}>Tier: T8 → T4</option></select></label><span class="counter">${r.rows.length} rutas</span></div></div><div class="result-table"><table><thead><tr><th>Artículo</th><th>Fabricar → vender</th><th class="numeric">Crafts</th><th class="numeric">Capital</th><th class="numeric">Beneficio estimado</th><th class="numeric">Impacto</th><th class="numeric">Estrés -10%</th></tr></thead><tbody>${sortedPlanRows.map(row=>`<tr><td>${itemWithCopy(row.id)}<small class="rank-sub">Retorno ${row.returnPct.toFixed(1)}% · <b>Q1 ${compact(row.history.quality1DailyUnits??row.history.averageDailyUnits)} u./día</b> · total ${compact(row.history.averageDailyUnits)} u./día · ${escape(row.evidenceSource)} · cuota del periodo ${row.coverageSharePct.toFixed(1)}% · ${row.saleMode==='order'?`<b>orden de venta</b> a ${silver(row.planningPrice)} (~${compact(row.daysToSell)} días)`:`<b>venta instantánea</b> a ${silver(row.planningPrice)}`} · precio observado ${row.marketQuote?silver(row.marketQuote):'sin órdenes'} (${escape(row.priceSource||'cotización')}) · confianza ${Math.round((row.confidence??1)*100)} %${row.risky?` · <b class="red">más que lo recomendado (${silver(row.recommendedCrafts)} crafts)</b>`:''} · tendencia ${escape(row.trend||'sin referencia')}${row.trendRatio!=null?' ('+row.trendRatio.toFixed(2)+'×)':''}${planRowExtras(row)}${row.demandSignals?`<br>${sparkHTML(row.demandSignals)}${signalBadge(row.demandSignals)} demanda usada <b>${compact(row.history.effectiveQuality1DailyUnits??row.history.quality1DailyUnits)} u./día</b> (media ${compact(row.demandSignals.windowMean)} · sin pico ${compact(row.demandSignals.robustDaily)} · últimos 3 días ${compact(row.demandSignals.recent3)})${row.demandSignals.priceFalling?` · precio Q1 reciente ${Math.round((1-row.demandSignals.priceRecentRatio)*100)} % por debajo de la ventana`:''}`:''}</small></td><td><span class="city-stack">${cityBadge(row.craftCity,'city-small')}<small>↓ vender en</small>${cityBadge(row.city,'city-small')}</span></td><td class="numeric"><strong>${silver(row.qty)}</strong></td><td class="numeric">${silver(row.capital??row.qty*row.grossCapitalPerCraft)}</td><td class="numeric ${row.totalProfit>=0?'green':'red'}">${row.totalProfit>=0?'+':''}${silver(row.totalProfit)}</td><td class="numeric">${row.finalImpactPct.toFixed(1)}%</td><td class="numeric ${row.stressProfit>=0?'green':'red'}">${row.stressProfit>=0?'+':''}${silver(row.stressProfit)}</td></tr>`).join('')}</tbody></table></div>`;}
 else html+=`<div class="warning">No se encontró un lote con beneficio esperado positivo dentro del presupuesto y los límites de volumen observados. No se asignarán artículos artificiales para gastar el silver.</div>`;
 html+=`<p class="planner-shopping-notice">Para consultar materiales, diarios del mismo tier y compras consolidadas, pulsa <strong>Enviar lote a Calculadora de Craft</strong>. Los diarios son opcionales y su cantidad es una estimación.</p>`;
 if(r.warnings.length)html+=`<div class="warning">${r.warnings.map(w=>escape(w)).join(' · ')}</div>`;
 if(notes.length)html+=`<div class="notice">${notes.map(w=>escape(w)).join(' · ')}</div>`;
 if(details)html+=`<details class="plan-diagnostics" ${!r.rows.length?'open':''}><summary>¿Por qué algunos objetos no entraron? · ${silver(details.candidates)} rutas evaluables</summary><p class="hint">El ranking agrega calidades 1–5; Craft Planner exige historial Q1, receta y precios de venta/compra. No equivale a pedidos ejecutables.</p><div class="diagnostic-list">${(details.rejectedSamples||[]).slice(0,48).map(item=>`<div class="diagnostic-item">${img(item.id)}<div><strong>${escape(name(item.id))}</strong> ${tierBadge(item.id)}<small>${cityBadge(item.city,'city-small')} · ${escape(item.reason)}</small><small>Q1 ${silver(item.q1UnitsDaily)} u./día · todas las calidades ${silver(item.allQualitiesDaily)} u./día</small></div></div>`).join('')||'<p class="muted">Todos los artículos consultados pasaron la comprobación inicial.</p>'}</div><p class="hint">Otros límites de cartera, Focus y presupuesto pueden impedir seleccionar una ruta aprobada. Sin historial Q1 no se inventan cantidades.</p></details>`;
 html+=`<div class="warning">Comprueba manualmente profundidad del libro, comisiones, coste de estación, disponibilidad de insumos y tiempos reales antes de invertir. El coste de transporte de compras solo se descuenta si lo configuraste; su valor y el deslizamiento real siguen sin verificar. No se promete venta.</div></section>`;
 return html;
}
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
 $('#page-name').textContent={top:'Top Mercado',planner:'Craft Planner',calc:'Calculadora de Craft',refine:'Refinamiento',bm:'Plan Mercado Negro'}[state.page]||'Top Mercado';
 $('#main').innerHTML=state.page==='top'?topPanel():state.page==='planner'?plannerPage():state.page==='refine'?refinePage.render():state.page==='bm'?bmPage.render():calcPage();
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
 Object.entries(referenceRefiningRecipes()).forEach(([id,recipe])=>{if(!state.recipes[id])state.recipes[id]=recipe;if(!state.names[id]){const kind=REFINING_TYPES.find(t=>id.includes('_'+t.key));const tier=id.match(/^T([2-8])_/)?.[1];const ench=id.match(/@([1-4])$/)?.[1]||'0';state.names[id]=`${kind?.label||'Refinado'} T${tier}.${ench}`;}});
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
  Object.entries(referenceRefiningRecipes()).forEach(([id,recipe])=>{if(!state.recipes[id])state.recipes[id]=recipe;if(!state.names[id]){const kind=REFINING_TYPES.find(t=>id.includes('_'+t.key));const tier=id.match(/^T([2-8])_/)?.[1];const ench=id.match(/@([1-4])$/)?.[1]||'0';state.names[id]=`${kind?.label||'Refinado'} T${tier}.${ench}`;}});
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
  const c=settingsV3(state.filters);
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
    state.result=planV3({candidates:[],config:c});
    state.resultDiagnostics={candidates:0,rejected:{sinHistorial:idsToPlan.length},rejectedSamples:absentQ1};
    state.resultNotes=['Sin registros de calidad 1 para la selección y las ciudades de venta. El ranking (calidades 1–5) no confirma compras ejecutables.'];
    return;
  }
  let candidates=saleHistory;
  let longTrend=null;
  if(c.trendAnalysis&&state.days<14){
   progress('plan-progress','Contrastando actividad Q1 con ventana de 14 días…',42);
   const trendResponse=await marketFetch('history',idsToPlan,{cities:sales,qualities:'1',days:14,onProgress:p=>progress('plan-progress',`Comparación 14 días: ${p.finished}/${p.total} lotes`,42)});
   if(trendResponse.coverage){longTrend=enrichTrends(saleHistory,summarizeHistory(trendResponse.rows,{days:14}));candidates=longTrend.rows;}
   else supplementaryErrors.push('No se recuperó la ventana Q1 de 14 días: se conserva el historial original.');
  }
  if(!candidates.length)throw Error('La selección no tiene recetas verificables en estos mercados.');
  progress('plan-progress','Preparando materiales y cotizaciones…',45);
  const journalIds=c.journalProfit===false?[]:candidates.flatMap(x=>{const j=journalEstimate(x.id,estimatedFame(x.id,state.recipes[x.id],c.premium),1);return j?[j.id,fullJournalId(j.id)]:[];});
  const materialIds=[...new Set(candidates.flatMap(x=>(state.recipes[x.id]?.materials||[]).map(m=>m.id)))];
  const ids=[...new Set([...candidates.map(x=>x.id),...materialIds,...journalIds])];
  const quotes=await marketFetch('prices',ids,{cities:MARKETS,qualities:'1',onProgress:p=>progress('plan-progress',`Cotizaciones West: lote ${p.finished}/${p.total} · ${p.rows} registros recibidos · ${p.errors} errores`,100*p.finished/p.total)});
  if(!quotes.coverage)throw Error('No se pudieron verificar precios de compra y venta con AODP West. '+quotes.errors.slice(0,2).join(' · '));
  // v2.5 (opcional): pujas del Mercado Negro por calidad 1–5.
  let bidsByQuality=null;
  if(c.qualityBonus&&sales.includes('Black Market')){progress('plan-progress','Pujas del Mercado Negro por calidad…',82);
   const qb=await marketFetch('prices',[...new Set(candidates.filter(x=>x.city==='Black Market').map(x=>x.id))],{cities:['Black Market'],qualities:'1,2,3,4,5'});
   bidsByQuality=qualityBids(qb.rows,'Black Market',Date.now(),c.maxQuoteHours);if(qb.errors.length)state.resultNotes=[`Pujas por calidad incompletas: ${qb.errors.length} lotes.`];}
  progress('plan-progress','Leyendo el libro de órdenes West…',86);
  const orderbook=await loadOrderbook([...candidates.map(x=>x.id),...materialIds]);state.orderbookStatus=orderbookStatusOf(orderbook);
  // Motor 3.0: el volumen diario de cada material entra en el reparto (comprar muchos días de mercado encarece).
  progress('plan-progress','Comprobando cuánto se mueve cada material…',90);
  const purchaseCities=[...new Set([...ROYAL_MARKETS.filter(x=>x!=='Brecilien'),...(c.includeCaerleonPurchases?['Caerleon']:[])])];
  const matHist=await marketFetch('history',materialIds,{cities:purchaseCities,qualities:'1',days:7});
  const materialHistory=summarizeHistory(matHist.rows,{days:7});
  progress('plan-progress','Motor 3.0: repartiendo el capital por beneficio marginal…',95);
  const map=quoteMap(quotes.rows),data=buildRoutesV3({top:candidates,recipes:state.recipes,quotes:map,config:c,
   selectedIds:[],selectedMarkets:[...state.saleMarkets],qualityBidMap:bidsByQuality,orderbook});
  state.result=planV3({...data,config:c,materialHistory,orderbook});
  if(matHist.errors.length)state.result.warnings.push('Historial de materiales incompleto: algunas compras no se pudieron comprobar.');
  state.resultDiagnostics={candidates:data.candidates.length,rejected:data.rejected,rejectedSamples:[...absentQ1,...data.rejectedSamples,...(state.result.allocationNotes||[])]};
  state.resultNotes=[...(state.resultNotes||[]).filter(n=>n.startsWith('Pujas por calidad')),`${gameVerified} recetas contrastadas con ao-bin-dumps; las restantes conservan su fuente anterior.`,...(longTrend?[`Tendencia de mercado Q1: ${longTrend.compared} pares comparados con 14 días; ${longTrend.falling} con actividad inferior y ${longTrend.fast} con aumento reciente.`]:[]),...(gameWarning?[gameWarning]:[])];
  if(state.plannerItems.length>idsToPlan.length)state.resultNotes.push(`Se analizaron ${idsToPlan.length} objetos; los restantes no coinciden con tiers/encantamientos o no tienen receta.`);
  if(supplementaryErrors.length)state.resultNotes.push(`Historial de destinos parcialmente disponible: ${supplementaryErrors.slice(0,3).join(' · ')}`);
  state.resultNotes.push(`Evidencia reconciliada: ${reconciled.fromTop} pares del Top original, ${reconciled.fromAdditional} pares de otros destinos · ${expected.from} a ${expected.to} UTC. El volumen usado procede exclusivamente de calidad 1.`);
  if(reconciled.discrepancies.length)state.resultNotes.push(`Se detectaron ${reconciled.discrepancies.length} diferencias entre consultas; se priorizó la ficha que seleccionaste en Top.`);
  if(quotes.errors.length)state.resultNotes.push(`Cotizaciones parciales: ${quotes.errors.length} lotes incompletos. No se inventaron precios faltantes.`);
  if(state.specialWarning)state.resultNotes.push(state.specialWarning);
  if(!state.result.rows.length)toast('No hay lotes verificables dentro del presupuesto, historial Q1 y límites seleccionados.');
  else {state.planLog=[createPlanLogEntry(state.result,c),...state.planLog].slice(0,20);save();
   toast(`Plan generado: ${state.result.rows.length} rutas · beneficio estimado ${silver(state.result.summary.totalProfit)} silver. Guardado en tu diario de planes.`);}
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
 if(b.closest('#refine-root')&&refinePage.onClick(b))return;
 if(b.closest('#bm-root')&&bmPage.onClick(b))return;
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
  else state.selectedBranches.add(key);
  resetMarket();save();return updatePage();}
 if(b.dataset.groupAll){const category=GROUPS.find(x=>x.key===b.dataset.groupAll);let added=0;for(const i of category?.items||[]){if(!state.selectedBranches.has(i.key)){state.selectedBranches.add(i.key);added++;}}
  resetMarket();save();if(!added)toast('Todas las ramas de esta categoría ya están seleccionadas.');return updatePage();}
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
  if(b.id==='send-plan-calc')return sendPlanToCalculator();
 if(b.dataset.batchAdd){state.planTransferSummary=[];return batchAdd(b.dataset.batchAdd);}
 if(b.dataset.batchRemove){state.planTransferSummary=[];state.batchItems=state.batchItems.filter(x=>x.id!==b.dataset.batchRemove);state.batchResult=null;state.batchQuotes=null;save();updatePage();if(state.batchItems.length)void runBatch();return;}
 if(b.id==='batch-run')return runBatch();
 if(b.id==='batch-refresh')return runBatch(true);
 if(b.id==='batch-clear'){state.planTransferSummary=[];state.batchItems=[];state.batchResult=null;state.batchQuotes=null;save();return updatePage();}
 if(b.id==='batch-export')return exportBatch();
 if(b.id==='batch-copy'||b.id==='batch-copy-secondary'){const r=state.batchResult;if(!r?.materials?.length)return toast('No hay lista de compras.');const text=r.materials.map(m=>`${m.journal?'[DIARIO ESTIMADO / OPCIONAL] ':''}${m.displayName||name(m.id)}: ${silver(m.buy)} · comprar ${m.city||'Sin cotización'} → fabricar ${m.craftCity||'sin definir'} · precio ${silver(m.unitPrice||0)}/u. · traslado estimado ${silver(m.transportPerUnit||0)}/u.`).join('\n');if(!navigator.clipboard?.writeText)return toast('Portapapeles no disponible en este navegador. Usa CSV.');navigator.clipboard.writeText(text).then(()=>toast('Lista de compras copiada.')).catch(()=>toast('No se pudo copiar la lista.'));return;}
 if(b.id==='go-top')return nav('top');
 if(b.dataset.mark){if(state.marked.has(b.dataset.mark))state.marked.delete(b.dataset.mark);else state.marked.add(b.dataset.mark);const keep=state.tableLimit,el=$('#top-results');if(el){el.innerHTML=renderTopResults();labelPhoneTables();}state.tableLimit=keep;return;}
 if(b.id==='mark-first'){topRows().slice(0,50).forEach(r=>state.marked.add(r.id+'|'+r.city));return refreshTopResults();}
 if(b.id==='clear-marked'){state.marked.clear();return refreshTopResults();}
 if(b.id==='top-clear-filters'){state.topFilter=sanitizeTopFilter({});return refreshTopResults();}
 if(b.id==='more-table'){state.tableLimit+=65;const el=$('#top-table');if(el){el.innerHTML=topTable();labelPhoneTables();}return;}
 if(b.id==='run-plan')return makePlan();
 if(b.dataset.planVerify)return verifyPlan(b.dataset.planVerify);
 if(b.dataset.planRemove){state.planLog=state.planLog.filter(x=>x.id!==b.dataset.planRemove);save();return refreshPlanLog();}
 if(b.id==='plan-log-clear'){state.planLog=[];save();return refreshPlanLog();}
   if(b.id==='single-run')return runSingle();
 if(b.id==='export-plan')return exportCsv();
 if(b.id==='copy-plan-purchases'){if(!state.result?.materials?.length)return toast('No hay materiales para copiar.');
  const lines=state.result.materials.map(m=>`${name(m.id)} x${silver(m.buy)} · ${m.city} · ${silver(m.unitPrice)} silver/u. (sin colchón)`);
  const message='LISTA DE COMPRA · GILDEM WEST\n'+lines.join('\n')+'\nVerifica profundidad de órdenes y precios antes de comprar.';
  if(navigator.clipboard?.writeText)navigator.clipboard.writeText(message).then(()=>toast('Lista de compras copiada.')).catch(()=>toast('No se pudo copiar la lista.'));
  else toast('Portapapeles no disponible en este navegador. Usa Exportar CSV.');return;}
});
document.addEventListener('toggle',e=>{if(e.target.matches?.('details.advanced-config'))state.advancedOpen=e.target.open;if(e.target.matches('details[data-group]')){if(e.target.open)state.openedGroups.add(e.target.dataset.group);else state.openedGroups.delete(e.target.dataset.group);} },true);
document.addEventListener('change',e=>{const x=e.target;
 if(x.closest?.('#refine-root')&&refinePage.onChange(x))return;
 if(x.closest?.('#bm-root')&&bmPage.onChange(x))return;
 if(x.id==='mobile-cards-switch'){state.mobileCards=x.checked;save();syncPhonePresentation();return;}
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
 if(x.id==='top-sort-inline'){state.sort=x.value;const other=$('#top-sort');if(other)other.value=x.value;return refreshTopResults({full:false});}
 if(x.dataset.topTier!==undefined||x.dataset.topEnch!==undefined){const field=x.dataset.topTier!==undefined?'tiers':'enchants',v=Number(x.dataset.topTier??x.dataset.topEnch),list=state.topFilter[field];
  state.topFilter=sanitizeTopFilter({...state.topFilter,[field]:x.checked?[...list,v]:list.filter(t=>t!==v)});return refreshTopResults();}
 if(x.id==='top-min-q1'){state.topFilter=sanitizeTopFilter({...state.topFilter,minQ1:x.value});return refreshTopResults();}
 if(x.id==='top-min-silver'){state.topFilter=sanitizeTopFilter({...state.topFilter,minSilver:x.value});return refreshTopResults();}
 if(x.id==='top-signal'){state.topFilter=sanitizeTopFilter({...state.topFilter,signal:x.value});return refreshTopResults();}
 if(x.id==='top-only-marked'){state.topFilter=sanitizeTopFilter({...state.topFilter,onlyMarked:x.checked});return refreshTopResults();}
 if(x.id==='top-detailed'){state.topDetailed=x.checked;return refreshTopResults({full:false});}
 if(x.id==='plan-result-sort'){state.planResultSort=x.value;save();const results=$('#plan-results');if(results){results.innerHTML=renderPlanResult();labelPhoneTables();}return;}
 if(x.id==='force-top'){state.forceFresh=x.checked;save();return;}
 if(x.hasAttribute('data-market-top')){const c=x.dataset.marketTop;if(x.checked)state.markets.add(c);else state.markets.delete(c);resetMarket();save();return updatePage();}
 if(x.hasAttribute('data-market-sale')){const c=x.dataset.marketSale;if(x.checked)state.saleMarkets.add(c);else state.saleMarkets.delete(c);state.result=null;save();return updatePage();}
 if(x.dataset.tiers||x.hasAttribute('data-tiers')){const tier=Number(x.dataset.tiers),old=state.filters.tiers;state.filters.tiers=x.checked?[...new Set([...old,tier])]:old.filter(v=>v!==tier);state.result=null;save();return updatePage();}
 if(x.dataset.enchants||x.hasAttribute('data-enchants')){const value=Number(x.dataset.enchants),old=state.filters.enchants;state.filters.enchants=x.checked?[...new Set([...old,value])]:old.filter(v=>v!==value);state.result=null;save();return updatePage();}
 if(x.id==='single-item'){state.singleItem=x.value;state.singleResult=null;const el=$('#single-result');if(el)el.innerHTML=singleResultHTML();return;}
 if(x.id==='single-qty'){state.singleQty=Number(x.value)||1;state.singleResult=null;return;}
 if(x.dataset.qualityProb!==undefined){const i=Number(x.dataset.qualityProb),probs=[...(state.filters.qualityProbs||DEFAULTS.qualityProbs)];probs[i]=Math.max(0,Math.min(100,Number(x.value)||0))/100;state.filters.qualityProbs=probs;state.result=null;save();return;}
 if(x.dataset.cfg){const key=x.dataset.cfg;const bool=x.type==='checkbox';state.filters[key]=bool?x.checked:x.type==='number'?Number(x.value):['dailyBonus','saleDays'].includes(key)?Number(x.value):x.value;if(key==='budget')state.customBudget=Number(x.value);if(key==='premium')state.filters.tax=premiumTax(x.checked);state.result=null;save();if(['premium','journalProfit','qualityBonus','focusAvailable','focusEfficiency','bonusCity','dailyBonus','focus','focusBonus','diversify','goal','purchaseMode','inboundTransportPerUnit','includeCaerleonPurchases','craftFallbackCity'].includes(key)){if(state.batchQuotes&&state.batchItems.length)batchRefreshResult();return updatePage();}if(state.batchResult)batchRefreshResult();}
});
let topSearchTimer=null;
document.addEventListener('input',e=>{const field=e.target;if(field.id==='top-search'){clearTimeout(topSearchTimer);topSearchTimer=setTimeout(()=>{state.topFilter=sanitizeTopFilter({...state.topFilter,search:field.value});refreshTopResults({full:false});},180);return;}if(field.id==='catalog-search'){state.catalogSearch=field.value;const el=$('#catalog-search-results');if(el)el.innerHTML=catalogSelectionRows();return;}if(field.id!=='batch-search')return;state.batchSearch=field.value;const results=$('#batch-search-results');if(results){results.hidden=state.batchSearch.trim().length<2;results.innerHTML=batchSearchResults(state.batchSearch);}});
// Cuatro herramientas: Top Mercado, Craft Planner, Refinamiento y Calculadora.
refinePage=createRefinePage({escape,silver,small,compact,cityBadge,itemWithCopy,img,heading,hero,toast,progress,marketFetch,summarizeHistory,quoteMap,name,save,persisted,rerender:()=>{if(state.page==='refine')updatePage();}});
bmPage=createBmPage({escape,silver,small,compact,itemWithCopy,img,heading,hero,toast,progress,marketFetch,summarizeHistory,quoteMap,name,save,persisted,recipes:()=>state.recipes,names:()=>state.names,rerender:()=>{if(state.page==='bm')updatePage();}});
updatePage();loadCatalog().catch(e=>{state.catalogStatus='Error de catálogo: '+e.message;updatePage();});

// Cerrar el menú de teléfono con Escape o al aumentar el ancho de pantalla.
document.addEventListener('keydown',e=>{if(e.key==='Escape')syncPhoneMenu(false);});
window.matchMedia('(min-width:801px)').addEventListener('change',e=>{if(e.matches)syncPhoneMenu(false);});

// Instalación opcional en teléfono. Solo se guarda la interfaz: nunca cotizaciones AODP.
if('serviceWorker' in navigator){
 window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js').catch(()=>{}));
}
