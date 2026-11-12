import {GROUPS,BRANCHES,BRANCH_BY_KEY,MARKETS,itemImage,catalogPage,variant} from './branches.js';
import {marketFetch,summarizeHistory,rankEntries,quoteMap,utcRange} from './market.js';
import {DEFAULTS,settings,returnRate,buildCandidates,allocatePlan,simulateItem} from './planner.js';
import {batchCalculate,variantChoices} from './batch-calculator.js';

const $=selector=>document.querySelector(selector);
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const compact=n=>Number(n||0).toLocaleString('es-ES',{maximumFractionDigits:1});
const silver=n=>Math.round(Number(n||0)).toLocaleString('es-ES');
const small=n=>{const x=Number(n||0);return Math.abs(x)>=1e9?(x/1e9).toLocaleString('es-ES',{maximumFractionDigits:2})+'B':Math.abs(x)>=1e6?(x/1e6).toLocaleString('es-ES',{maximumFractionDigits:2})+'M':Math.abs(x)>=1e3?(x/1e3).toLocaleString('es-ES',{maximumFractionDigits:1})+'K':compact(x);};
const formatTime=s=>s?new Date(s).toLocaleString('es-ES',{timeZone:'UTC',dateStyle:'short',timeStyle:'short'})+' UTC':'Sin hora';
const specialGroups=new Set(['mounts','potions','foods','gathering','kits','siege']);
const persisted=(()=>{try{return JSON.parse(localStorage.getItem('gildem_market_standalone_settings')||'{}');}catch{return {};}})();
const state={page:'top',recipes:{},names:{},catalogStatus:'Cargando…',catalogError:null,specialLoaded:false,specialWarning:'',specialAttempted:false,
 selectedBranches:new Set(Array.isArray(persisted.branches)?persisted.branches:['axe']),markets:new Set(Array.isArray(persisted.markets)?persisted.markets:['Black Market']),
 saleMarkets:new Set(Array.isArray(persisted.saleMarkets)?persisted.saleMarkets:['Black Market']),openedGroups:new Set(),
 days:Number(persisted.days)||7,sort:persisted.sort||'silver',forceFresh:false,top:[],coverage:null,scannedIds:new Set(),pageOffset:0,tableLimit:65,
 marked:new Set(),batchItems:Array.isArray(persisted.batchItems)?persisted.batchItems.filter(x=>x&&/^[A-Z0-9_@-]+$/.test(x.id)&&Number(x.qty)>=1).slice(0,30).map(x=>({id:x.id,qty:Math.min(100000,Math.round(x.qty)),noBonus:x.noBonus===true})):[],batchOverrides:persisted.batchOverrides||{buy:{},sellBM:{},sellRoyal:{}},batchResult:null,batchQuotes:null,batchBusy:false,batchSearch:'',planDrawerOpen:persisted.planDrawerOpen!==false,filters: {...DEFAULTS,...(persisted.filters||{})},result:null,resultDiagnostics:null,scanLimit:150,lastQuote:null,singleItem:'',singleQty:1,singleResult:null,singleLoading:false,queryActive:false,planActive:false};
if(state.selectedBranches.size>6)state.selectedBranches=new Set([...state.selectedBranches].slice(0,6));
for(const key of [...state.selectedBranches])if(!BRANCH_BY_KEY.has(key))state.selectedBranches.delete(key);
for(const name of [...state.markets])if(!MARKETS.includes(name))state.markets.delete(name);
for(const name of [...state.saleMarkets])if(!MARKETS.includes(name))state.saleMarkets.delete(name);
const save=()=>{try{localStorage.setItem('gildem_market_standalone_settings',JSON.stringify({branches:[...state.selectedBranches],markets:[...state.markets],saleMarkets:[...state.saleMarkets],days:state.days,sort:state.sort,planDrawerOpen:state.planDrawerOpen,filters:state.filters,batchItems:state.batchItems,batchOverrides:state.batchOverrides}));}catch{}};
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
function copyNameButton(id,kind='item'){
 const label=escape(name(id));
 return `<button type="button" class="copy-name-btn" data-copy-name="${label}" data-copy-id="${escape(id)}" aria-label="Copiar nombre de ${label}" title="Copiar nombre · Shift + clic para copiar ID"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none"><rect x="8" y="8" width="11" height="12" rx="2" stroke="currentColor" stroke-width="1.6"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h2" stroke="currentColor" stroke-width="1.6"/></svg></button>`;
}
function tierBadge(id){const v=variant(id);if(!v)return '';return `<span class="tier-badge tier-ench-${Math.min(4,v.ench)}">T${v.tier}.${v.ench}</span>`;}
function displayedInt(n){return Number.isFinite(Number(n))?silver(n):'—';}
function itemWithCopy(id,{showId=false}={}){
 return `<div class="item-cell game-item-cell">${img(id)}<div class="item-text"><div class="item-primary"><strong>${escape(name(id))}</strong>${copyNameButton(id)}${tierBadge(id)}</div>${showId?`<small class="item-id">${escape(id)}</small>`:''}</div></div>`;
}

function hero(which){const top=which==='top';return `<section class="hero"><div class="hero-copy"><span class="kicker">${top?'INTELIGENCIA DE MERCADO':'MOTOR DE PLANIFICACIÓN'}</span><h1>${top?'Top del mercado':'Calculadora de Craft'}</h1><p>${top?'Explora la actividad por rama y mercado, elige ciudades de venta y genera un plan prudente de crafting sin salir de esta pestaña.':'Calcula objetos y lotes manuales: variantes, compras, retornos, beneficio BM/Royal y diarios orientativos.'}</p><div class="chips"><span class="chip">AODP · América / West</span><span class="chip">${top?'Calidades 1–5 · días UTC completos':'Calculadora manual + planes rentables'}</span><span class="chip">Caché de consulta · 1 hora</span></div></div><img src="/assets/scenes/${top?'top-market.webp':'craft-cal.webp'}" alt="" aria-hidden="true"></section>`;}
function heading(title,desc,actions=''){return `<div class="panel-heading"><div><h2>${title}</h2>${desc?`<p>${desc}</p>`:''}</div>${actions}</div>`;}
function branchGroups(){return GROUPS.map(g=>{const count=g.items.filter(i=>state.selectedBranches.has(i.key)).length;
 return `<details class="branch-group ${count?'has-selection':''}" data-group="${g.key}" ${state.openedGroups.has(g.key)?'open':''}><summary><span class="group-icon">${g.icon}</span><span class="group-name"><strong>${escape(g.title)}</strong><small>${count} de ${g.items.length}</small></span>${count?`<span class="branch-count">${count}</span>`:''}<span class="group-carret">⌄</span></summary><div class="branch-inside"><div class="group-controls"><span class="hint">${g.items.length} ramas disponibles · máximo 6 en total</span><div><button type="button" data-group-all="${g.key}">Seleccionar todo</button><button type="button" data-group-clear="${g.key}">Borrar</button></div></div><div class="branch-items">${g.items.map(b=>`<button type="button" data-branch="${b.key}" aria-pressed="${state.selectedBranches.has(b.key)}" class="branch-choice ${state.selectedBranches.has(b.key)?'selected':''}">${img(b.iconId)}<span>${escape(b.label)}</span>${state.selectedBranches.has(b.key)?'<span class="choice-check">✓</span>':''}</button>`).join('')}</div></div></details>`;}).join('');}
function selectedBranchPills(){return `<div class="selected-branches" aria-label="Ramas seleccionadas">${[...state.selectedBranches].map(key=>{const branch=BRANCH_BY_KEY.get(key);return branch?`<button type="button" class="selected-branch-pill" data-branch="${key}" title="Quitar ${escape(branch.label)}">${img(branch.iconId)}<span>${escape(branch.label)}</span><b>×</b></button>`:'';}).join('')||'<span class="hint">Sin ramas seleccionadas</span>'}</div>`;}

function marketChips(values,field){return `<div class="market-chips">${MARKETS.map(c=>`<label class="market-toggle city-control city--${CITY_KEYS[c]} ${values.has(c)?'active':''}"><input type="checkbox" data-market-${field}="${escape(c)}" ${values.has(c)?'checked':''}><span class="city-gem" aria-hidden="true">◆</span><span>${escape(cityDisplay(c))}</span></label>`).join('')}</div>`;}
function topPanel(){const count=state.selectedBranches.size,st=state.coverage;
 return hero('top')+`<section class="panel branch-picker-panel">${heading('Ramas del mercado','Elige hasta seis ramas. Despliega solo la categoría que necesites.',`<span class="counter">${count} / 6 ramas</span>`)}<div class="branch-picker-top"><span class="hint">${escape(state.catalogStatus)}</span><div class="btn-group"><button class="btn btn-ghost btn-small" id="close-groups">Contraer todo</button><button class="btn btn-ghost btn-small" id="clear-branches">Borrar selección</button></div></div>${selectedBranchPills()}<div class="selector-grid">${branchGroups()}</div></section>
 <section class="panel">${heading('Mercados y período','La actividad suma las calidades 1–5 de cada artículo, en días UTC completos.')}
 <div class="filters-row"><div class="field"><label for="top-days">Ventana</label><select id="top-days">${[1,3,7,14].map(d=>`<option value="${d}" ${state.days===d?'selected':''}>${d===1?'Último día':d+' días'}</option>`).join('')}</select></div><div class="field"><label for="top-sort">Ordenar por</label><select id="top-sort"><option value="silver" ${state.sort==='silver'?'selected':''}>Silver por día</option><option value="units" ${state.sort==='units'?'selected':''}>Unidades por día</option><option value="price" ${state.sort==='price'?'selected':''}>Precio por unidad</option></select></div></div>
 <div class="soft-line"></div><div class="sub-title">Ciudades de destino</div>${marketChips(state.markets,'top')}
 <div class="toolbar"><div class="inline-tools"><label class="checkline"><input type="checkbox" id="force-top" ${state.forceFresh?'checked':''}> Forzar datos frescos</label></div><div class="btn-group"><button class="btn btn-gold" id="run-top" ${state.queryActive?'disabled':''}>${state.queryActive?'Consultando…':'Consultar top'}</button><button class="btn btn-ghost" id="scan-more" ${!st||st.complete||state.queryActive?'disabled':''}>Ampliar cobertura</button></div></div>
 <div class="notice">Fuente única de mercado: <strong>AODP REST América (West), endpoint History</strong>. El historial se basa en órdenes de venta observadas, no en compras confirmadas. Los promedios pueden diferir del EMV de otras webs y no implican demanda ejecutable. Un refresco fuerza la solicitud, pero no garantiza una observación nueva.</div>
 ${st?`<div class="hint">Cobertura del catálogo de la selección: ${silver(st.nextOffset)} / ${silver(st.total)} IDs considerados · ${silver(state.scannedIds.size)} IDs consultados · ${st.complete?'catálogo consultado':'cobertura parcial, puedes ampliar'} · ${state.coverage.errors?.length||0} lotes con errores.</div>`:''}
 <div id="top-progress" role="status"></div></section>
 <section class="panel" id="top-results">${renderTopResults()}</section>${planBuilderPanel()}`;
}
function visibleTop(){return rankEntries(state.top.filter(t=>state.markets.has(t.city)),state.sort);}
function renderTopResults(){
 if(!state.top.length)return `${heading('Resultados del mercado','Selecciona ramas y ciudades, pulsa «Consultar top» y verás los datos observados aquí.')}<div class="empty"><div class="loading-symbol">⌕</div><h3>Tu radar de mercado está listo</h3><p>Consulta las ramas que quieras analizar y añade objetos a la calculadora.</p></div>`;
 const rows=visibleTop(),shown=rows.slice(0,state.tableLimit),range=utcRange(state.days);
 const stats=`<div class="metric-strip"><div class="metric"><small>Registros en la muestra</small><strong>${silver(rows.length)}</strong></div><div class="metric"><small>Unidades observadas / día</small><strong>${small(rows.reduce((x,r)=>x+r.averageDailyUnits,0))}</strong></div><div class="metric"><small>Silver observado / día</small><strong>${small(rows.reduce((x,r)=>x+r.averageDailySilver,0))}</strong></div><div class="metric"><small>Seleccionados para plan</small><strong class="accent">${silver(state.marked.size)}</strong></div></div>`;
 return `${heading(`Ranking del mercado · ${escape(range.date)} a ${escape(new Date(range.end-86400000).toISOString().slice(0,10))} UTC`,'Ranking por '+(state.sort==='silver'?'silver/día':state.sort==='units'?'unidades/día':'precio medio')+'. El historial no representa ventas garantizadas.',`<div class="btn-group"><button class="btn btn-ghost" id="send-marked" ${!state.marked.size?'disabled':''}>Enviar marcados (${state.marked.size})</button><button class="btn btn-gold" id="jump-plan">✧ Configurar plan</button><button class="btn btn-ghost" id="go-calc">Calculadora manual ↗</button></div>`)}${stats}
 <div class="toolbar"><span class="hint">${silver(shown.length)} de ${silver(rows.length)} filas · unidades y precios redondeados al entero · Shift + clic en copiar = ID</span><div class="btn-group"><button class="btn btn-ghost btn-small" id="mark-first">Marcar primeros 50</button><button class="btn btn-ghost btn-small" id="clear-marked">Borrar marcas</button></div></div>
 <div class="result-table market-ranking"><table><thead><tr><th class="ranking-col">#</th><th>Objeto</th><th>Mercado</th><th class="numeric">Unidades/día</th><th class="numeric">Silver/día</th><th class="numeric">Precio unidad</th><th class="ranking-actions">Acciones</th></tr></thead><tbody>${shown.map((r,i)=>{const key=r.id+'|'+r.city;return `<tr><td class="rank-number">${i+1}</td><td>${itemWithCopy(r.id)}</td><td>${cityBadge(r.city)}</td><td class="numeric"><strong class="rank-metric">${displayedInt(r.averageDailyUnits)}</strong><span class="rank-sub">${silver(r.activeDays)} de ${silver(r.days)} días activos</span></td><td class="numeric"><strong class="rank-metric">${small(r.averageDailySilver)}</strong></td><td class="numeric"><strong class="rank-metric">${displayedInt(r.averageUnitPrice)}</strong></td><td><div class="rank-buttons"><button class="rank-mark ${state.marked.has(key)?'is-marked':''}" data-mark="${escape(key)}" title="${state.marked.has(key)?'Quitar del plan':'Marcar para plan'}" aria-label="${state.marked.has(key)?'Quitar del plan':'Marcar para plan'}">${state.marked.has(key)?'★':'☆'}</button><button class="btn btn-small btn-ghost rank-add" data-batch-add="${escape(r.id)}">Agregar a Calculadora</button></div></td></tr>`;}).join('')}</tbody></table></div>
 <div class="toolbar"><span class="small-print">AODP History · calidades 1–5 · promedios diarios UTC. El precio histórico no sustituye a la cotización de compraventa.</span>${state.tableLimit<rows.length?'<button class="btn btn-ghost" id="more-table">Mostrar 65 más</button>':''}</div>${state.coverage?.errors?.length?`<div class="warning">Consulta parcial: ${escape(state.coverage.errors.slice(0,2).join(' · '))}. No se estiman datos faltantes.</div>`:''}`;
}
function toggleChips(array,field){return `<div class="pill-choices">${array.map(x=>{const enabled=field==='tiers'?state.filters.tiers.includes(x):state.filters.enchants.includes(x);return `<label class="toggle-chip ${enabled?'active':''}"><input type="checkbox" data-${field}="${x}" ${enabled?'checked':''}>${field==='tiers'?'T'+x:'.'+x}</label>`;}).join('')}</div>`;}
function calcPage(){return hero('calc')+batchPanel();}
function planBuilderPanel(){const config=state.filters,rr=returnRate({...config,recipe:{city:'Martlock'}});
 return `<details class="plan-drawer" id="plan-drawer" ${state.planDrawerOpen?'open':''}><summary><span class="drawer-symbol">✧</span><span><strong>Mi plan desde Top Mercado</strong><small>Ciudades de venta, presupuesto, riesgo, retorno y reparto de cantidades</small></span><span class="drawer-arrow">⌄</span></summary><div class="drawer-content"><section class="panel">${heading('Origen de la información','Los candidatos salen de tu Top; la demanda se verifica de nuevo en cada ciudad de venta que elijas.',`<button class="btn btn-ghost btn-small" id="edit-top">↑ Volver al ranking</button>`)}
 ${state.top.length?`<div class="success"><strong>${silver(state.top.length)} registros históricos</strong> disponibles; ${state.marked.size?`${new Set([...state.marked].map(x=>x.split('|')[0])).size} artículos marcados`:'se analizarán los mejores artículos consultados'}. Los filtros y las cotizaciones actuales decidirán qué se puede fabricar con ganancia.</div>`:'<div class="warning">Todavía no has consultado Top Mercado. Ve a esa pestaña y realiza una consulta para crear planes respaldados por datos.</div>'}
 <div class="plan-step-title"><b>01</b><span>Elige las ciudades donde quieres VENDER</span><small>${state.saleMarkets.size} / 8 seleccionadas</small></div>${marketChips(state.saleMarkets,'sale')}<div class="toolbar"><p class="muted">Independientes del filtro del ranking. El motor consulta History para cada destino adicional y no inventa actividad inexistente. Si marcas objetos con ★, se buscan esos objetos en todas las ciudades de venta elegidas.</p><div class="btn-group"><button type="button" class="btn btn-ghost btn-small" id="plan-only-bm">Solo Mercado Negro</button><button type="button" class="btn btn-ghost btn-small" id="plan-all-royals">Todas las Royal</button></div></div></section>
 <section class="panel">${heading('02 · Configuración del plan','Objetivo, nivel de riesgo, costes y controles de liquidez. El presupuesto siempre es un límite máximo.')}
 <div class="config-grid">
  <div class="config-section"><h3>Ciudad de fabricación</h3><label class="checkline"><input type="checkbox" data-cfg="bonusCity" ${config.bonusCity?'checked':''}> Fabricar en ciudad de bono</label><p>Se usa la especialidad declarada de cada receta; no obliga a fabricar todo en una sola ciudad.</p></div>
  <div class="config-section"><h3>Tiers</h3>${toggleChips([4,5,6,7,8],'tiers')}<p>Sin fabricar tiers fuera de tu selección.</p></div>
  <div class="config-section"><h3>Encantamiento</h3>${toggleChips([0,1,2,3,4],'enchants')}<p>Solo variantes con receta y observación.</p></div>
  <div class="config-section"><h3>Bono diario de producción</h3><select data-cfg="dailyBonus"><option value="0" ${config.dailyBonus==0?'selected':''}>Sin bono · 0%</option><option value="10" ${config.dailyBonus==10?'selected':''}>+10%</option><option value="20" ${config.dailyBonus==20?'selected':''}>+20%</option></select><p>El bono diario se suma a producción, no directamente al retorno.</p></div>
  <div class="config-section"><h3>Focus</h3><label class="checkline"><input type="checkbox" data-cfg="focus" ${config.focus?'checked':''}> Usar Focus</label><p>Solo con consumo por fabricación verificado.</p>${config.focus?`<div class="multifield" style="margin-top:12px"><label>Focus/craft verificado<input data-cfg="focusPerCraft" type="number" min="1" value="${config.focusPerCraft}"></label><label>Focus disponible<input data-cfg="focusAvailable" type="number" min="1" value="${config.focusAvailable}"></label><label>Bono Focus (%)<input data-cfg="focusBonus" type="number" min="0" value="${config.focusBonus}"></label></div>`:''}</div>
  <div class="config-section"><h3>Presupuesto de silver</h3><label class="field"><span class="small-print">Otra cantidad (silver)</span><input data-cfg="budget" type="number" min="1000" max="1000000000000" step="1000" value="${config.budget}"></label><p>Máximo absoluto: no se rellena con objetos de bajo margen o demanda inventada.</p></div>
  <div class="config-section"><h3>Días para vender el lote</h3><select data-cfg="saleDays">${[1,3,7,14,30].map(x=>`<option value="${x}" ${config.saleDays==x?'selected':''}>${x} días</option>`).join('')}</select><p>Plazo hasta tu siguiente craft; es una proyección, no una garantía.</p></div>
  <div class="config-section"><h3>Estilo del plan</h3><select data-cfg="style"><option value="prudent" ${config.style==='prudent'?'selected':''}>Prudente · lotes pequeños</option><option value="balanced" ${config.style==='balanced'?'selected':''}>Equilibrado · lotes medios</option><option value="dynamic" ${config.style==='dynamic'?'selected':''}>Dinámico · más volumen</option></select><p>Se estima cuánto afecta al precio tu propio volumen de venta.</p></div>
  <div class="config-section"><h3>Objetivo del plan</h3><select data-cfg="goal"><option value="silver" ${config.goal==='silver'?'selected':''}>Más silver</option><option value="balanced" ${config.goal==='balanced'?'selected':''}>Silver y fama</option><option value="fame" ${config.goal==='fame'?'selected':''}>Fama por silver</option></select><p>Fama derivada de materiales cuando la receta no trae una cifra confirmada.</p></div>
  <div class="config-section config-half"><h3>Distribución entre tiers y encantamientos</h3><label class="checkline"><input type="checkbox" data-cfg="diversify" ${config.diversify?'checked':''}> <strong>Forzar diversidad (priorizar T6, T7 y T8)</strong></label><p>Intenta reservar primero un craft por cada tier viable, con la selección de encantamientos vigente. Puede admitir un escenario de estrés negativo, pero NUNCA una pérdida neta esperada ni demanda inexistente.</p></div>
  <div class="config-section"><h3>Uso del presupuesto</h3><label class="checkline"><input type="checkbox" data-cfg="useBudget" ${config.useBudget?'checked':''}> Usar todo lo posible</label><p>Solo opciones con margen calculable y cupo estimado.</p></div>
  <div class="config-section"><h3>Crafting de volumen</h3><label class="checkline"><input type="checkbox" data-cfg="volume" ${config.volume?'checked':''}> Permitir más volumen prudente</label><p>Sin reserva automática. La actividad histórica limita los lotes.</p></div>
  <div class="config-section"><h3>Costes y cotizaciones</h3><div class="multifield"><label>Impuesto venta %<input type="number" data-cfg="tax" min="0" max="30" step=".1" value="${config.tax}"></label><label>Publicación Royal %<input type="number" data-cfg="listingFee" min="0" max="30" step=".1" value="${config.listingFee}"></label><label>Estación / craft<input type="number" data-cfg="stationFee" min="0" step="1" value="${config.stationFee}"></label></div><p>Máximo de antigüedad de precios: <input aria-label="Antigüedad máxima de precios (horas)" type="number" data-cfg="maxQuoteHours" min="1" max="168" value="${config.maxQuoteHours}" style="width:65px;display:inline-block;padding:3px;height:30px"> horas.</p></div>
  <div class="config-section risk-section config-half"><h3>Escudo de rentabilidad · filtros mejorados</h3><p>Evita llenar el presupuesto con márgenes frágiles. Los colchones son SUPUESTOS conservadores, no profundidad real del mercado.</p><div class="multifield"><label>Colchón compra %<input data-cfg="buyBufferPct" type="number" min="0" max="50" step="1" value="${config.buyBufferPct}"></label><label>Descuento venta %<input data-cfg="sellHaircutPct" type="number" min="0" max="30" step="1" value="${config.sellHaircutPct}"></label><label>ROI mínimo %<input data-cfg="minRoiPct" type="number" min="0" max="100" step="1" value="${config.minRoiPct}"></label><label>Máx. capital / objeto %<input data-cfg="maxCapitalSharePct" type="number" min="5" max="100" step="5" value="${config.maxCapitalSharePct}"></label></div><label class="checkline" style="margin-top:12px"><input data-cfg="stressGuard" type="checkbox" ${config.stressGuard?'checked':''}> Exigir beneficio en estrés (-10% precio de venta), excepto diversidad T6–T8</label></div>
  <div class="config-section"><h3>Logística y precio atípico</h3><div class="multifield"><label>Transporte por unidad de salida<input data-cfg="deliveryCostPerUnit" type="number" min="0" step="1" value="${config.deliveryCostPerUnit}"></label><label>Precio máximo vs. media histórica calidad 1 (+%)<input data-cfg="historyPriceCapPct" type="number" min="0" max="100" value="${config.historyPriceCapPct}"></label></div><p>El precio usado es el menor entre la cotización observada y el límite derivado del historial Q1. Transporte: estimación manual, no calculada por ruta.</p></div>
 </div>
 <div class="callout"><strong>${rr.returnPct.toFixed(2)}% de retorno de referencia</strong><div class="hint">Producción con especialidad ilustrativa: ${rr.productionBonus}% = Royal 18% + especialidad 15% + diario ${config.dailyBonus}% + Focus ${config.focus?config.focusBonus:0}%. Cada receta recalcula el retorno según sus condiciones.</div></div>
 <div class="toolbar"><div class="hint">Venta BM: puja; Royal: oferta mínima publicada, no necesariamente una orden ejecutable. Se descuentan impuestos, impacto, colchón de compra y descuento de venta.</div><button class="btn btn-gold" id="run-plan" ${state.planActive||!state.top.length||!state.saleMarkets.size?'disabled':''}>${state.planActive?'Calculando…':'✧ Generar plan por ciudades'}</button></div>
 <div id="plan-progress" role="status"></div></section>
 <section id="plan-results">${renderPlanResult()}</section></div></details>`;
}
function batchSearchMatches(query){const term=String(query||'').trim().toLocaleLowerCase();if(term.length<2)return [];
 const matches=[];const ids=Object.keys(state.recipes);
 for(const id of ids){if(!state.recipes[id]?.materials?.length||!variant(id))continue;
  const label=name(id);if(!id.toLowerCase().includes(term)&&!label.toLocaleLowerCase().includes(term))continue;
  matches.push(id);if(matches.length>=36)break;
 }
 return matches;}
function batchSearchResults(query){const ids=batchSearchMatches(query);return ids.length?ids.map(id=>`<button type="button" class="batch-search-hit" data-batch-add="${escape(id)}">${img(id)}<span><strong>${escape(name(id))}</strong><small>${escape(id)}</small></span><b>+</b></button>`).join(''):'<div class="hint" style="padding:12px">Escribe al menos 2 caracteres. Solo se muestran artículos con receta cargada.</div>';}
function batchPanel(){return `<section class="panel manual-calculator" id="manual-calculator">${heading('Calculadora de Craft · por lotes','Añade objetos, ajusta cantidades y variantes, compara Mercado Negro y Royal y consulta materiales. Los precios son observaciones, no ventas garantizadas.',`<span class="counter">${state.batchItems.length} / 30 objetos</span>`)}
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
 html+=`<div class="section-heading materials-heading"><h3>Materiales necesarios</h3><button class="btn btn-ghost btn-small" id="batch-copy-secondary" ${!result.materials.length?'disabled':''}>▣ Copiar lista</button></div><div class="batch-table-wrap"><table class="batch-table materials-table game-materials-table"><thead><tr><th>Material</th><th>Para</th><th>Comprar en</th><th class="numeric">A comprar</th><th class="numeric">Precio unidad</th><th class="numeric">Total</th></tr></thead><tbody>`;
 html+=result.materials.map(m=>`<tr class="${m.missing?'material-missing':m.pending?'material-pending':''}"><td>${itemWithCopy(m.id)}${m.missing?'<span class="unverified material-warning">Sin cotización verificable</span>':m.pending?'<span class="unverified material-warning">Lote pendiente de precio</span>':''}</td><td><div class="used-by-items">${m.usedBy.slice(0,4).map(id=>`<img src="${marketImage(id)}" width="30" height="30" title="${escape(name(id))}" alt="${escape(name(id))}" loading="lazy">`).join('')}</div></td><td>${cityBadge(m.city)}</td><td class="numeric"><strong>${silver(m.buy)}</strong><small class="batch-subtext">${m.returned>0?'reutilizas ≈ '+displayedInt(m.returned):'sin retorno'}</small></td><td class="numeric"><input class="material-price ${m.missing?'quote-missing':''}" type="number" min="0" step="1" data-batch-buy="${escape(m.id)}" value="${state.batchOverrides.buy?.[m.id]??m.unitPrice??''}" placeholder="Precio" aria-label="Precio de ${escape(name(m.id))}" title="${m.missing?'Falta cotización: escribe precio manual para recalcular':'Editar precio de compra'}">${m.missing?'<small class="price-hint">Escribe precio</small>':m.manual?'<small class="batch-subtext">Precio manual</small>':''}</td><td class="numeric"><strong>${m.pending?'—':silver(m.total)}</strong></td></tr>`).join('')||'<tr><td colspan="6">No hay materiales para mostrar.</td></tr>';
 html+='</tbody></table></div>';
 if(result.journals.length)html+=`<details class="batch-journals" open><summary>Diarios orientativos <span class="journal-count">${silver(result.journals.length)} tipos</span></summary><p class="muted">Solo estimaciones de fama. No están incluidos en el coste ni se verificó su disponibilidad en el mercado.</p><div class="journal-grid">${result.journals.map(j=>`<div class="journal-card"><img src="${marketImage(j.id)}" width="36" height="36" alt="" loading="lazy"><div><strong>${escape(j.name)} T${variant(j.forId)?.tier||'?'}</strong><small>${escape(name(j.forId))}</small></div>${copyNameButton(j.id)}<span class="journal-amount">≈ ${silver(j.estimatedQty)}</span></div>`).join('')}</div></details>`;
 if(result.warnings.length)html+=`<div class="warning">${result.warnings.map(escape).join(' · ')}</div>`;
 html+='<p class="batch-caption">El capital bruto puede superar la compra neta calculada con reutilización. Comprueba profundidad de órdenes, antigüedad de los precios y costes reales antes de invertir.</p>';
 return html;
}
function batchRefreshResult(){if(!state.batchItems.length){state.batchResult=null;return updatePage();}if(!state.batchQuotes)return runBatch(false);try{state.batchResult=batchCalculate({items:state.batchItems,recipes:state.recipes,quotes:state.batchQuotes,history:state.top,config:state.filters,overrides:state.batchOverrides});const out=$('#batch-result');if(out)out.innerHTML=batchResultHTML();}catch(e){state.batchResult=null;const out=$('#batch-result');if(out)out.innerHTML=`<div class="warning">${escape(e.message)}</div>`;toast(e.message);}}
function batchAdd(id){if(!state.recipes[id]?.materials?.length)return toast('Este artículo no tiene receta cargada.');const entry=state.batchItems.find(x=>x.id===id);
 if(entry)entry.qty=Math.min(100000,entry.qty+1);else{if(state.batchItems.length>=30)return toast('Máximo 30 objetos.');state.batchItems.push({id,qty:1,noBonus:false});}
 state.batchSearch='';save();state.batchResult=null;state.batchQuotes=null;if(state.page!=='calc')nav('calc');else updatePage();void runBatch();}
async function runBatch(force=false){if(state.batchBusy||!state.batchItems.length)return;state.batchBusy=true;state.batchResult=null;
 const out=$('#batch-result');if(out)out.innerHTML='<div class="notice">Consultando cotizaciones de AODP West y calculando el lote…</div>';
 try{const ids=[...new Set(state.batchItems.flatMap(item=>[item.id,...(state.recipes[item.id]?.materials||[]).map(m=>m.id)]))];
  const response=await marketFetch('prices',ids,{cities:MARKETS,qualities:'1',force});if(!response.coverage)throw Error(response.errors.slice(0,3).join(' · ')||'No fue posible consultar precios.');
  state.batchQuotes=quoteMap(response.rows);state.batchResult=batchCalculate({items:state.batchItems,recipes:state.recipes,quotes:state.batchQuotes,history:state.top,config:state.filters,overrides:state.batchOverrides});
  if(response.errors.length)state.batchResult.warnings.push(`${response.errors.length} lotes incompletos: hay precios sin verificar.`);
 }catch(e){toast(e.message);state.batchResult=null;if($('#batch-result'))$('#batch-result').innerHTML=`<div class="warning">${escape(e.message)}</div>`;}
 finally{state.batchBusy=false;if(state.page==='calc'&&$('#batch-result')&&state.batchResult){$('#batch-result').innerHTML=batchResultHTML();const b=$('#batch-run');if(b)b.disabled=false;const r=$('#batch-refresh');if(r)r.disabled=false;}}}
function sendMarked(){const ids=[...new Set(state.top.filter(r=>state.marked.has(r.id+'|'+r.city)).map(r=>r.id))].filter(id=>state.recipes[id]?.materials?.length);if(!ids.length)return toast('Ningún marcado tiene receta verificable.');let added=0;for(const id of ids){if(state.batchItems.some(x=>x.id===id))continue;if(state.batchItems.length>=30)break;state.batchItems.push({id,qty:1,noBonus:false});added++;}save();state.batchResult=null;state.batchQuotes=null;nav('calc');toast(`${added} objetos añadidos a la calculadora.`);void runBatch();}
function exportBatch(){const r=state.batchResult;if(!r?.rows.length)return toast('Recalcula primero.');const lines=[['TIPO','ITEM','ID','CANTIDAD','CIUDAD','PRECIO','TOTAL'],...r.rows.filter(x=>!x.reason).map(x=>['CRAFT',name(x.id),x.id,x.qty,x.craftCity,0,x.cost]),...r.materials.map(x=>['COMPRAR',name(x.id),x.id,x.buy,x.city,x.unitPrice,x.total])];const csv=lines.map(row=>row.map(value=>'"'+String(value??'').replaceAll('"','""')+'"').join(',')).join('\r\n');const url=URL.createObjectURL(new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'}));const link=document.createElement('a');link.href=url;link.download='gildem-calculadora-lote.csv';link.click();setTimeout(()=>URL.revokeObjectURL(url),500);}
function quickCalcPanel(){
 const available=rankEntries(state.top,'silver').filter(r=>state.saleMarkets.has(r.city)&&state.recipes[r.id]?.materials?.length).slice(0,400);
 const pick=available.find(x=>x.id+'|'+x.city===state.singleItem)||available[0];
 if(!state.singleItem&&pick)state.singleItem=pick.id+'|'+pick.city;
 return `<section class="panel">${heading('Cálculo rápido de un artículo','Simula cualquier cantidad de una pieza del Top, incluso cuando producirla suponga una pérdida. No cambia el plan automático.')}<div class="filters-row"><div class="field" style="flex:3;min-width:225px"><label for="single-item">Artículo y ciudad de venta</label><select id="single-item">${available.map(r=>`<option value="${escape(r.id+'|'+r.city)}" ${state.singleItem===r.id+'|'+r.city?'selected':''}>${escape(name(r.id))} · ${escape(r.city)} · ${escape(r.id)}</option>`).join('')}</select></div><div class="field"><label for="single-qty">Crafts</label><input id="single-qty" type="number" min="1" max="100000" value="${state.singleQty}"></div><div><button class="btn btn-gold" id="single-run" ${!available.length||state.singleLoading?'disabled':''}>${state.singleLoading?'Calculando…':'Simular lote'}</button></div></div><div class="small-print" style="margin-top:12px">Coste de materiales e impacto estimado. No confirma profundidad del libro de órdenes ni descuenta transporte.</div><div id="single-result">${singleResultHTML()}</div></section>`;
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

function renderPlanResult(){const r=state.result;if(!r)return `<section class="panel">${heading('Mi plan de crafting','El motor mostrará artículos viables, inversión, distribución por ciudades y lista de materiales.')}<div class="empty"><h3>Tu próximo lote empieza en el Top</h3><p>Selecciona productos, define tu presupuesto y genera un plan basado en las observaciones de AODP West.</p></div></section>`;
 const m=r.summary,details=state.resultDiagnostics,notes=state.resultNotes||[];
 let html=`<section class="panel">${heading('Plan calculado','Solo rutas con margen esperado positivo, dentro del presupuesto y con historial observado.',`<div class="btn-group"><button class="btn btn-ghost btn-small" id="copy-plan-purchases">Copiar compras</button><button class="btn btn-ghost btn-small" id="export-plan">Exportar CSV</button></div>`)}
 <div class="metric-strip"><div class="metric"><small>Inversión bruta reservada</small><strong>${small(m.capitalReserved)}</strong></div><div class="metric"><small>Beneficio estimado neto</small><strong class="accent">${small(m.totalProfit)}</strong></div><div class="metric"><small>Presupuesto sin utilizar</small><strong>${small(m.remaining)}</strong></div><div class="metric"><small>Crafts / Artículos de salida</small><strong>${silver(m.crafts)} / ${silver(m.units)}</strong></div></div>
 <div class="hint">ROI sobre capital bruto reservado: ${m.roiOnCapital.toFixed(1)}% · Fama estimada: ${silver(m.totalFame)} · Precios observados con calidad 1. El cálculo incluye colchón, descuento de venta y transporte manual si está configurado; NO verifica órdenes suficientes. Los diarios son opcionales.</div>`;
 if(r.rows.length){
  const citySummary=new Map();
  for(const line of r.rows){const prev=citySummary.get(line.city)||{city:line.city,profit:0,capital:0,units:0,routes:0};
   prev.profit+=line.totalProfit;prev.capital+=line.qty*line.grossCapitalPerCraft;prev.units+=line.qty*line.craftAmount;prev.routes++;citySummary.set(line.city,prev);}
  html+=`<div class="section-heading"><h3>Distribución por ciudad de venta</h3><span>${citySummary.size} destinos activos</span></div><div class="plan-city-summary">${[...citySummary.values()].sort((a,b)=>b.profit-a.profit).map(city=>`<div class="plan-city-card">${cityBadge(city.city)}<div class="plan-city-stats"><span><small>Capital bruto</small><strong>${small(city.capital)}</strong></span><span><small>Beneficio estimado</small><strong class="green">+${small(city.profit)}</strong></span><span><small>Unidades</small><strong>${silver(city.units)}</strong></span></div></div>`).join('')}</div>`;
  html+=`<div class="toolbar"><strong>Plan por artículo y ciudad</strong><span class="counter">${r.rows.length} rutas</span></div><div class="result-table"><table><thead><tr><th>Artículo</th><th>Fabricar → vender</th><th class="numeric">Crafts / salida</th><th class="numeric">Capital</th><th class="numeric">Beneficio estimado</th><th class="numeric">Impacto</th><th class="numeric">Estrés -10%</th></tr></thead><tbody>${r.rows.map(row=>`<tr><td>${itemWithCopy(row.id)}<small class="rank-sub">Retorno ${row.returnPct.toFixed(1)}% · Q1 ${silver(row.history.quality1DailyUnits??row.history.averageDailyUnits)} u./día · precio observado ${silver(row.marketQuote)} · usado ${silver(row.planningPrice)}</small></td><td><span class="city-stack">${cityBadge(row.craftCity,'city-small')}<small>↓ vender en</small>${cityBadge(row.city,'city-small')}</span></td><td class="numeric">${silver(row.qty)} / ${silver(row.qty*row.craftAmount)}</td><td class="numeric">${silver(row.qty*row.grossCapitalPerCraft)}</td><td class="numeric green">+${silver(row.totalProfit)}</td><td class="numeric">${row.finalImpactPct.toFixed(1)}%</td><td class="numeric ${row.stressProfit>=0?'green':'red'}">${row.stressProfit>=0?'+':''}${silver(row.stressProfit)}</td></tr>`).join('')}</tbody></table></div>`;}
 else html+=`<div class="warning">No se encontró un lote con beneficio esperado positivo dentro del presupuesto y los límites de volumen observados. No se asignarán artículos artificiales para gastar el silver.</div>`;
 html+=`<div class="soft-line"></div><div class="sub-title">Lista de compras de materiales</div><p class="muted">Compra neta estimada con retornos y reutilización. La última columna incluye colchón de compra configurado. El capital bruto reservado considera todos los recursos antes del retorno; no se conoce la profundidad de órdenes de AODP Prices.</p>`;
 html+=r.materials.length?`<div class="result-table"><table><thead><tr><th>Recurso</th><th>Ciudad con precio observado</th><th class="numeric">Para comprar</th><th class="numeric">Bruto</th><th class="numeric">Reutilizado (estim.)</th><th class="numeric">Precio/u.</th><th class="numeric">Compra estimada + colchón</th></tr></thead><tbody>${r.materials.map(a=>`<tr><td>${itemWithCopy(a.id,{showId:true})}</td><td>${cityBadge(a.city)}</td><td class="numeric gold">${silver(a.buy)}</td><td class="numeric">${silver(a.gross)}</td><td class="numeric">${silver(a.reuse)}</td><td class="numeric">${silver(a.unitPrice)}</td><td class="numeric">${silver(a.buyWithBuffer)}</td></tr>`).join('')}</tbody></table></div>`:'<div class="empty-narrow">Sin materiales verificados.</div>';
 html+=`<div class="soft-line"></div><div class="sub-title">Diarios para llenar (orientativos)</div>`;
 html+=r.journals.length?`<div class="notice">Estas cantidades de diarios son una <strong>estimación</strong> a partir de fama de materiales y capacidades de referencia; no están verificadas individualmente por el juego. Son compras opcionales, no se incluyen en costes, capital ni beneficios.</div><div class="result-table"><table><thead><tr><th>Diario estimado</th><th class="numeric">Unidades vacías estimadas</th><th>Fuente</th></tr></thead><tbody>${r.journals.map(j=>`<tr><td>${escape(j.name)} <small class="muted">${escape(j.id)}</small></td><td class="numeric gold">${j.estimatedQty}</td><td class="hint">${escape(j.source)}</td></tr>`).join('')}</tbody></table></div>`:`<p class="muted">No hay una relación verificable de diario y fama para los artículos seleccionados. No se inventan cantidades.</p>`;
 if(r.warnings.length)html+=`<div class="warning">${r.warnings.map(w=>escape(w)).join(' · ')}</div>`;
 if(notes.length)html+=`<div class="notice">${notes.map(w=>escape(w)).join(' · ')}</div>`;
 if(details)html+=`<div class="soft-line"></div><div class="sub-title">Diagnóstico del motor</div><div class="hint">Rutas posibles antes de asignar: ${silver(details.candidates)}. Filtros aplicados: ${Object.entries(details.rejected).map(([key,val])=>`${escape(key)}: ${val}`).join(' · ')}</div>`;
 html+=`<div class="warning">Comprueba manualmente profundidad del libro, comisiones, coste de estación, disponibilidad de insumos y tiempos reales antes de invertir. La tarifa de transporte y el deslizamiento de compras no están verificados ni descontados. No se promete venta.</div></section>`;
 return html;
}
function updatePage(){const drawer=$('#plan-drawer');if(drawer)state.planDrawerOpen=drawer.open;document.querySelectorAll('[data-route]').forEach(b=>{const active=b.dataset.route===state.page;b.classList.toggle('is-active',active);b.setAttribute('aria-current',active?'page':'false');});
 $('#page-name').textContent=state.page==='top'?'Top Mercado':'Calculadora de Craft';
 $('#main').innerHTML=state.page==='top'?topPanel():calcPage();}
function nav(which){state.page=which;document.querySelector('.sidebar')?.classList.remove('mobile-open');window.scrollTo({top:0,behavior:'instant'});updatePage();}
function resetMarket(){state.top=[];state.scannedIds=new Set();state.pageOffset=0;state.marked.clear();state.coverage=null;state.result=null;state.tableLimit=65;}
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
  const page=catalogPage(pool(),[...state.selectedBranches],{offset:state.pageOffset,limit:240});
  if(!page.ids.length)throw Error('No se encontraron IDs reales en el catálogo para esas ramas. Comprueba la fuente de recetas o selecciona otras ramas.');
  const response=await marketFetch('history',page.ids,{cities:[...state.markets],qualities:'1,2,3,4,5',days:state.days,force:state.forceFresh,onProgress:p=>progress('top-progress',`Historial West: lote ${p.finished} de ${p.total} · ${p.rows} observaciones · ${p.errors} errores`,100*p.finished/p.total)});
  if(!response.coverage)throw Error('No hubo lotes de historial válidos: '+response.errors.slice(0,2).join(' · '));
  const extracted=summarizeHistory(response.rows,{days:state.days});
  const unique=new Map(state.top.map(e=>[e.id+'|'+e.city,e]));for(const rec of extracted)unique.set(rec.id+'|'+rec.city,rec);
  state.top=[...unique.values()];page.ids.forEach(id=>state.scannedIds.add(id));state.pageOffset=page.nextOffset;
  state.coverage={...page,errors:[...(state.coverage?.errors||[]),...response.errors],fromCache:response.fromCache,fetchedAt:response.fetchedAt};
  state.result=null;setStatus(`${state.top.length} registros · West · ${response.fromCache?'caché':'consultado'}`);
  toast(`${extracted.length} registros observados en ${page.ids.length} IDs · ${response.errors.length?'consulta parcial':'consulta completa por lote'}.`);
 }catch(e){state.coverage={...(state.coverage||{}),errors:[...(state.coverage?.errors||[]),e.message],complete:true,total:0,nextOffset:0};toast(e.message);}
 finally{state.queryActive=false;updatePage();}
}
async function makePlan(){if(state.planActive||!state.top.length)return;
 state.planActive=true;state.result=null;state.resultNotes=[];updatePage();
 try{
  const c=settings(state.filters);
  if(!state.saleMarkets.size)throw Error('Elige al menos una ciudad donde vender.');
  const markedIds=new Set([...state.marked].map(x=>x.split('|')[0]));
  const chosen=state.top.filter(x=>!markedIds.size||markedIds.has(x.id))
   .filter(x=>{const v=variant(x.id);return v&&c.tiers.map(Number).includes(v.tier)&&c.enchants.map(Number).includes(v.ench);})
   .filter(x=>Array.isArray(state.recipes[x.id]?.materials)&&state.recipes[x.id].materials.length>0);
  // Rank IDs by observed activity from the original top, then check every selling city.
  const rank=rankEntries(chosen,'silver').filter((r,i,a)=>a.findIndex(o=>o.id===r.id)===i).slice(0,state.scanLimit);
  if(!rank.length)throw Error('Consulta el Top con artículos compatibles con tus tiers y encantamientos.');
  const idsToPlan=rank.map(r=>r.id),allowedIds=new Set(idsToPlan),sales=[...state.saleMarkets];
  let saleHistory=state.top.filter(h=>allowedIds.has(h.id)&&state.markets.has(h.city)&&state.saleMarkets.has(h.city));
  const unqueried=sales.filter(city=>!state.markets.has(city));
  let supplementaryErrors=[];
  if(unqueried.length){
   progress('plan-progress',`Consultando historial de calidad 1 a 5 en ${unqueried.join(', ')}…`,3);
   const dest=await marketFetch('history',idsToPlan,{cities:unqueried,qualities:'1,2,3,4,5',days:state.days,
     onProgress:v=>progress('plan-progress',`Demanda en destinos: lote ${v.finished}/${v.total} · ${v.rows} registros · ${v.errors} errores`,Math.min(30,30*v.finished/v.total))});
   saleHistory=saleHistory.concat(summarizeHistory(dest.rows,{days:state.days}));
   supplementaryErrors=dest.errors;
  }
  // Only source records with quality1 activity may fund a quality1 crafting plan.
  saleHistory=saleHistory.filter(h=>allowedIds.has(h.id)&&state.saleMarkets.has(h.city));
  if(!saleHistory.length)throw Error('Los destinos seleccionados no tienen historial AODP para estos artículos. No se inventa demanda.');
  progress('plan-progress','Preparando recetas y materias primas verificables…',7);
  await addSpecialCatalog();
  const candidates=saleHistory.filter(h=>Array.isArray(state.recipes[h.id]?.materials)&&state.recipes[h.id].materials.length);
  if(!candidates.length)throw Error('Los artículos del Top seleccionado no tienen recetas verificadas. Prueba otra rama o vuelve a cargar el catálogo.');
  const ids=[...new Set([...candidates.map(x=>x.id),...candidates.flatMap(x=>state.recipes[x.id].materials.map(m=>m.id))])];
  const quotes=await marketFetch('prices',ids,{cities:MARKETS,qualities:'1',onProgress:p=>progress('plan-progress',`Cotizaciones West: lote ${p.finished}/${p.total} · ${p.rows} registros recibidos · ${p.errors} errores`,100*p.finished/p.total)});
  if(!quotes.coverage)throw Error('No se pudieron verificar precios de compra y venta con AODP West. '+quotes.errors.slice(0,2).join(' · '));
  const map=quoteMap(quotes.rows),data=buildCandidates({top:candidates,recipes:state.recipes,quotes:map,config:c,
   selectedIds:[],selectedMarkets:[...state.saleMarkets]});
  state.result=allocatePlan({...data,recipes:state.recipes});
  state.resultDiagnostics={candidates:data.candidates.length,rejected:data.rejected};
  state.resultNotes=[];
  if(new Set(chosen.map(x=>x.id)).size>rank.length)state.resultNotes.push(`Se analizaron ${rank.length} artículos distintos de la consulta inicial; amplía cobertura para más candidatos.`);
  if(supplementaryErrors.length)state.resultNotes.push(`Historial de destinos parcialmente disponible: ${supplementaryErrors.slice(0,3).join(' · ')}`);
  state.resultNotes.push(`Destinos consultados: ${sales.join(', ')}. Se evaluaron ${saleHistory.length} pares objeto/ciudad; el cálculo usa solamente demanda Q1.`);
  if(quotes.errors.length)state.resultNotes.push(`Cotizaciones parciales: ${quotes.errors.length} lotes incompletos. No se inventaron precios faltantes.`);
  if(state.specialWarning)state.resultNotes.push(state.specialWarning);
  if(!state.result.rows.length)toast('La búsqueda terminó, pero no hay lotes rentables con las cotizaciones y límites actuales.');
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
 if(b.id==='mobile-nav'){document.querySelector('.sidebar').classList.toggle('mobile-open');return;}
 if(b.id==='close-groups'){state.openedGroups.clear();return updatePage();}
 if(b.id==='clear-branches'){state.selectedBranches.clear();resetMarket();save();return updatePage();}
 if(b.dataset.branch){const key=b.dataset.branch;if(state.selectedBranches.has(key))state.selectedBranches.delete(key);
  else if(state.selectedBranches.size>=6)return toast('Máximo 6 ramas por consulta.');else state.selectedBranches.add(key);
  resetMarket();save();return updatePage();}
 if(b.dataset.groupAll){const category=GROUPS.find(x=>x.key===b.dataset.groupAll);let added=0;for(const i of category?.items||[]){if(state.selectedBranches.size===6)break;if(!state.selectedBranches.has(i.key)){state.selectedBranches.add(i.key);added++;}}
  resetMarket();save();if(!added)toast('Solo puedes consultar hasta 6 ramas.');return updatePage();}
 if(b.dataset.groupClear){for(const i of GROUPS.find(g=>g.key===b.dataset.groupClear)?.items||[])state.selectedBranches.delete(i.key);resetMarket();save();return updatePage();}
 if(b.id==='run-top')return scanTop(true);
 if(b.id==='scan-more')return scanTop(false);
 if(b.id==='go-calc')return nav('calc');
 if(b.id==='jump-plan'){state.planDrawerOpen=true;updatePage();requestAnimationFrame(()=>$('#plan-drawer')?.scrollIntoView({behavior:'smooth',block:'start'}));return;}
 if(b.id==='edit-top'){document.querySelector('#top-results')?.scrollIntoView({behavior:'smooth',block:'start'});return;}
 if(b.id==='plan-only-bm'){state.saleMarkets=new Set(['Black Market']);state.result=null;save();return updatePage();}
 if(b.id==='plan-all-royals'){state.saleMarkets=new Set(MARKETS.filter(m=>m!=='Black Market'));state.result=null;save();return updatePage();}
 if(b.id==='send-marked')return sendMarked();
 if(b.dataset.batchAdd)return batchAdd(b.dataset.batchAdd);
 if(b.dataset.batchRemove){state.batchItems=state.batchItems.filter(x=>x.id!==b.dataset.batchRemove);state.batchResult=null;state.batchQuotes=null;save();updatePage();if(state.batchItems.length)void runBatch();return;}
 if(b.id==='batch-run')return runBatch();
 if(b.id==='batch-refresh')return runBatch(true);
 if(b.id==='batch-clear'){state.batchItems=[];state.batchResult=null;state.batchQuotes=null;save();return updatePage();}
 if(b.id==='batch-export')return exportBatch();
 if(b.id==='batch-copy'||b.id==='batch-copy-secondary'){const r=state.batchResult;if(!r?.materials?.length)return toast('No hay lista de compras.');const text=r.materials.map(m=>`${name(m.id)}: ${silver(m.buy)} · ${m.city}`).join('\n');if(!navigator.clipboard?.writeText)return toast('Portapapeles no disponible en este navegador. Usa CSV.');navigator.clipboard.writeText(text).then(()=>toast('Lista de compras copiada.')).catch(()=>toast('No se pudo copiar la lista.'));return;}
 if(b.id==='go-top')return nav('top');
 if(b.dataset.mark){if(state.marked.has(b.dataset.mark))state.marked.delete(b.dataset.mark);else state.marked.add(b.dataset.mark);return updatePage();}
 if(b.id==='mark-first'){visibleTop().slice(0,50).forEach(r=>state.marked.add(r.id+'|'+r.city));return updatePage();}
 if(b.id==='clear-marked'){state.marked.clear();return updatePage();}
 if(b.id==='more-table'){state.tableLimit+=65;return updatePage();}
 if(b.id==='run-plan')return makePlan();
 if(b.id==='single-run')return runSingle();
 if(b.id==='export-plan')return exportCsv();
 if(b.id==='copy-plan-purchases'){if(!state.result?.materials?.length)return toast('No hay materiales para copiar.');
  const lines=state.result.materials.map(m=>`${name(m.id)} x${silver(m.buy)} · ${m.city} · ${silver(m.unitPrice)} silver/u. (sin colchón)`);
  const message='LISTA DE COMPRA · GILDEM WEST\n'+lines.join('\n')+'\nVerifica profundidad de órdenes y precios antes de comprar.';
  if(navigator.clipboard?.writeText)navigator.clipboard.writeText(message).then(()=>toast('Lista de compras copiada.')).catch(()=>toast('No se pudo copiar la lista.'));
  else toast('Portapapeles no disponible en este navegador. Usa Exportar CSV.');return;}
});
document.addEventListener('toggle',e=>{if(e.target.id==='plan-drawer'){state.planDrawerOpen=e.target.open;save();return;}if(e.target.matches('details[data-group]')){if(e.target.open)state.openedGroups.add(e.target.dataset.group);else state.openedGroups.delete(e.target.dataset.group);} },true);
document.addEventListener('change',e=>{const x=e.target;
 if(x.dataset.batchQty){const item=state.batchItems.find(i=>i.id===x.dataset.batchQty);if(!item)return;const qty=Math.round(Number(x.value));if(!Number.isSafeInteger(qty)||qty<1||qty>100000){toast('Cantidad permitida: 1 a 100.000');return;}item.qty=qty;save();return batchRefreshResult();}
 if(x.dataset.batchNobonus){const item=state.batchItems.find(i=>i.id===x.dataset.batchNobonus);if(item){item.noBonus=x.checked;save();batchRefreshResult();}return;}
 if(x.dataset.batchTier||x.dataset.batchEnch){const id=x.dataset.batchTier||x.dataset.batchEnch,options=variantChoices(Object.keys(state.recipes),id),old=variant(id);if(!old)return;
  const tier=x.dataset.batchTier?Number(x.value):old.tier,ench=x.dataset.batchEnch?Number(x.value):old.ench;
  const available=options.filter(i=>variant(i).tier===tier);const chosen=available.find(i=>variant(i).ench===ench)||available.sort((a,b)=>variant(a).ench-variant(b).ench)[0];
  if(!chosen)return toast('Esta variante no tiene receta disponible.');const item=state.batchItems.find(i=>i.id===id);if(!item)return;
  const duplicate=state.batchItems.find(i=>i.id===chosen);if(duplicate&&duplicate!==item){duplicate.qty=Math.min(100000,duplicate.qty+item.qty);state.batchItems=state.batchItems.filter(i=>i!==item);}else item.id=chosen;
  state.batchResult=null;state.batchQuotes=null;save();updatePage();return runBatch();}
 if(x.dataset.batchPriceBm||x.dataset.batchPriceRoyal||x.dataset.batchBuy){const key=x.dataset.batchBuy?'buy':x.dataset.batchPriceBm?'sellBM':'sellRoyal';const id=x.dataset.batchBuy||x.dataset.batchPriceBm||x.dataset.batchPriceRoyal;const val=Number(x.value);state.batchOverrides[key]??={};if(Number.isFinite(val)&&val>0)state.batchOverrides[key][id]=val;else delete state.batchOverrides[key][id];save();return batchRefreshResult();}
 if(x.id==='top-days'){state.days=Number(x.value);resetMarket();save();return updatePage();}
 if(x.id==='top-sort'){state.sort=x.value;save();return updatePage();}
 if(x.id==='force-top'){state.forceFresh=x.checked;return;}
 if(x.hasAttribute('data-market-top')){const c=x.dataset.marketTop;if(x.checked)state.markets.add(c);else state.markets.delete(c);resetMarket();save();return updatePage();}
 if(x.hasAttribute('data-market-sale')){const c=x.dataset.marketSale;if(x.checked)state.saleMarkets.add(c);else state.saleMarkets.delete(c);state.result=null;save();return updatePage();}
 if(x.dataset.tiers||x.hasAttribute('data-tiers')){const tier=Number(x.dataset.tiers),old=state.filters.tiers;state.filters.tiers=x.checked?[...new Set([...old,tier])]:old.filter(v=>v!==tier);state.result=null;save();return updatePage();}
 if(x.dataset.enchants||x.hasAttribute('data-enchants')){const value=Number(x.dataset.enchants),old=state.filters.enchants;state.filters.enchants=x.checked?[...new Set([...old,value])]:old.filter(v=>v!==value);state.result=null;save();return updatePage();}
 if(x.id==='single-item'){state.singleItem=x.value;state.singleResult=null;const el=$('#single-result');if(el)el.innerHTML=singleResultHTML();return;}
 if(x.id==='single-qty'){state.singleQty=Number(x.value)||1;state.singleResult=null;return;}
 if(x.dataset.cfg){const key=x.dataset.cfg;const bool=x.type==='checkbox';state.filters[key]=bool?x.checked:x.type==='number'?Number(x.value):['dailyBonus','saleDays'].includes(key)?Number(x.value):x.value;state.result=null;save();if(['bonusCity','dailyBonus','focus','focusBonus','diversify'].includes(key)){batchRefreshResult();return updatePage();}if(state.batchResult)batchRefreshResult();}
});
document.addEventListener('input',e=>{const field=e.target;if(field.id!=='batch-search')return;state.batchSearch=field.value;const results=$('#batch-search-results');if(results){results.hidden=state.batchSearch.trim().length<2;results.innerHTML=batchSearchResults(state.batchSearch);}});
// Mostrar ambos tabs sin bloquear por solicitudes externas.
updatePage();loadCatalog().catch(e=>{state.catalogStatus='Error de catálogo: '+e.message;updatePage();});
