import {GROUPS,BRANCHES,BRANCH_BY_KEY,MARKETS,itemImage,catalogPage,variant} from './branches.js';
import {marketFetch,summarizeHistory,rankEntries,quoteMap,utcRange} from './market.js';
import {DEFAULTS,settings,returnRate,buildCandidates,allocatePlan,simulateItem} from './planner.js';

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
 saleMarkets:new Set(Array.isArray(persisted.saleMarkets)?persisted.saleMarkets:['Black Market']),openedGroups:new Set(['weapons']),
 days:Number(persisted.days)||7,sort:persisted.sort||'silver',forceFresh:false,top:[],coverage:null,scannedIds:new Set(),pageOffset:0,tableLimit:65,
 marked:new Set(),filters: {...DEFAULTS,...(persisted.filters||{})},result:null,resultDiagnostics:null,scanLimit:150,lastQuote:null,singleItem:'',singleQty:1,singleResult:null,singleLoading:false,queryActive:false,planActive:false};
if(state.selectedBranches.size>6)state.selectedBranches=new Set([...state.selectedBranches].slice(0,6));
for(const key of [...state.selectedBranches])if(!BRANCH_BY_KEY.has(key))state.selectedBranches.delete(key);
for(const name of [...state.markets])if(!MARKETS.includes(name))state.markets.delete(name);
for(const name of [...state.saleMarkets])if(!MARKETS.includes(name))state.saleMarkets.delete(name);
const save=()=>{try{localStorage.setItem('gildem_market_standalone_settings',JSON.stringify({branches:[...state.selectedBranches],markets:[...state.markets],saleMarkets:[...state.saleMarkets],days:state.days,sort:state.sort,filters:state.filters}));}catch{}};
const name=id=>state.names[id]||id;
let toastTimer;function toast(msg){const element=$('#toast');element.textContent=msg;element.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>element.classList.remove('show'),4600);}
function marketImage(id){if(!/^[A-Z0-9_@-]+$/.test(id))return '';return itemImage(id);}
function img(id){return `<img src="${marketImage(id)}" width="39" height="39" alt="" loading="lazy" onerror="this.style.opacity='.13'">`;}
function hero(which){const top=which==='top';return `<section class="hero"><div class="hero-copy"><span class="kicker">${top?'INTELIGENCIA DE MERCADO':'MOTOR DE PLANIFICACIÓN'}</span><h1>${top?'Top del mercado':'Calculadora de Craft'}</h1><p>${top?'Explora actividad observada por rama, ciudad y tier. Después, elige qué artículos entran a tu plan.':'Convierte el Top Mercado en lotes calculados: compras, retorno, impacto de tus ventas, beneficio y diarios orientativos.'}</p><div class="chips"><span class="chip">AODP · América / West</span><span class="chip">${top?'Calidades 1–5 · días UTC completos':'Solo oportunidades con beneficio esperado positivo'}</span><span class="chip">Caché de consulta · 1 hora</span></div></div><img src="/assets/scenes/${top?'top-market.webp':'craft-cal.webp'}" alt="" aria-hidden="true"></section>`;}
function heading(title,desc,actions=''){return `<div class="panel-heading"><div><h2>${title}</h2>${desc?`<p>${desc}</p>`:''}</div>${actions}</div>`;}
function branchGroups(){return GROUPS.map(g=>{const count=g.items.filter(i=>state.selectedBranches.has(i.key)).length;
 return `<details class="branch-group" data-group="${g.key}" ${state.openedGroups.has(g.key)?'open':''}><summary><span class="group-icon">${g.icon}</span><span class="group-name"><strong>${escape(g.title)}</strong><small>${count}/${g.items.length} seleccionadas</small></span><span class="group-carret">⌄</span></summary><div class="group-controls"><button data-group-all="${g.key}">Seleccionar todo</button><button data-group-clear="${g.key}">Borrar</button></div><div class="branch-items">${g.items.map(b=>`<button type="button" data-branch="${b.key}" aria-pressed="${state.selectedBranches.has(b.key)}" class="branch-choice ${state.selectedBranches.has(b.key)?'selected':''}">${img(b.iconId)}<span>${escape(b.label)}</span>${state.selectedBranches.has(b.key)?'<span class="choice-check">✓</span>':''}</button>`).join('')}</div></details>`;}).join('');}
function marketChips(values,field){return `<div class="market-chips">${MARKETS.map(c=>`<label class="market-toggle ${values.has(c)?'active':''}"><input type="checkbox" data-market-${field}="${escape(c)}" ${values.has(c)?'checked':''}><span>${escape(c)}</span></label>`).join('')}</div>`;}
function topPanel(){const count=state.selectedBranches.size,st=state.coverage;
 return hero('top')+`<section class="panel">${heading('Ramas del mercado','Hasta seis ramas por consulta. Toca una categoría para desplegar sus líneas.',`<span class="counter">${count} / 6 ramas</span>`)}<div class="toolbar"><span class="hint">Catálogo: ${escape(state.catalogStatus)}</span><button class="btn btn-ghost btn-small" id="clear-branches">Borrar selección</button></div><div class="selector-grid">${branchGroups()}</div></section>
 <section class="panel">${heading('Mercados y período','La actividad suma las calidades 1–5 de cada artículo, en días UTC completos.')}
 <div class="filters-row"><div class="field"><label for="top-days">Ventana</label><select id="top-days">${[1,3,7,14].map(d=>`<option value="${d}" ${state.days===d?'selected':''}>${d===1?'Último día':d+' días'}</option>`).join('')}</select></div><div class="field"><label for="top-sort">Ordenar por</label><select id="top-sort"><option value="silver" ${state.sort==='silver'?'selected':''}>Silver por día</option><option value="units" ${state.sort==='units'?'selected':''}>Unidades por día</option><option value="price" ${state.sort==='price'?'selected':''}>Precio por unidad</option></select></div></div>
 <div class="soft-line"></div><div class="sub-title">Ciudades de destino</div>${marketChips(state.markets,'top')}
 <div class="toolbar"><div class="inline-tools"><label class="checkline"><input type="checkbox" id="force-top" ${state.forceFresh?'checked':''}> Forzar datos frescos</label></div><div class="btn-group"><button class="btn btn-gold" id="run-top" ${state.queryActive?'disabled':''}>${state.queryActive?'Consultando…':'Consultar top'}</button><button class="btn btn-ghost" id="scan-more" ${!st||st.complete||state.queryActive?'disabled':''}>Ampliar cobertura</button></div></div>
 <div class="notice">Fuente única de mercado: <strong>AODP REST América (West), endpoint History</strong>. El historial se basa en órdenes de venta observadas, no en compras confirmadas. Los promedios pueden diferir del EMV de otras webs y no implican demanda ejecutable. Un refresco fuerza la solicitud, pero no garantiza una observación nueva.</div>
 ${st?`<div class="hint">Cobertura del catálogo de la selección: ${silver(st.nextOffset)} / ${silver(st.total)} IDs considerados · ${silver(state.scannedIds.size)} IDs consultados · ${st.complete?'catálogo consultado':'cobertura parcial, puedes ampliar'} · ${state.coverage.errors?.length||0} lotes con errores.</div>`:''}
 <div id="top-progress" role="status"></div></section>
 <section class="panel" id="top-results">${renderTopResults()}</section>`;
}
function visibleTop(){return rankEntries(state.top.filter(t=>state.markets.has(t.city)),state.sort);}
function renderTopResults(){if(!state.top.length)return `${heading('Resultados del mercado','Selecciona ramas y ciudades, pulsa «Consultar top» y verás los datos observados aquí.')}<div class="empty"><div class="loading-symbol">⌕</div><h3>Tu radar de mercado está listo</h3><p>Consulta las líneas que quieras analizar. Puedes elegir artículos específicos para el plan.</p></div>`;
 const rows=visibleTop(),shown=rows.slice(0,state.tableLimit),range=utcRange(state.days),stats=`<div class="metric-strip"><div class="metric"><small>Registros en la muestra</small><strong>${silver(rows.length)}</strong></div><div class="metric"><small>Volumen total observado/día</small><strong>${small(rows.reduce((x,r)=>x+r.averageDailyUnits,0))}</strong></div><div class="metric"><small>Silver observado/día</small><strong>${small(rows.reduce((x,r)=>x+r.averageDailySilver,0))}</strong></div><div class="metric"><small>Artículos marcados</small><strong class="accent">${silver(state.marked.size)}</strong></div></div>`;
 return `${heading('Top Mercado · ${escape(range.date)} a ${escape(new Date(range.end-86400000).toISOString().slice(0,10))} UTC','Ordenado por '+(state.sort==='silver'?'silver/día':state.sort==='units'?'unidades/día':'precio medio')+'. La calidad de cada compra o venta debe verificarse por separado.',`<button class="btn btn-gold" id="go-calc">Ir a la calculadora ↗</button>`)}${stats}<div class="toolbar"><span class="hint">${silver(shown.length)} de ${silver(rows.length)} resultados visibles · ${state.marked.size?'Solo marcados para calcular':'Sin artículos marcados: la calculadora examinará el Top completo'}</span><div class="btn-group"><button class="btn btn-ghost btn-small" id="mark-first">Marcar primeros 50</button><button class="btn btn-ghost btn-small" id="clear-marked">Borrar marcas</button></div></div>
 <div class="result-table"><table><thead><tr><th>Artículo</th><th>Ciudad</th><th class="numeric">Unidades/día</th><th class="numeric">Silver/día</th><th class="numeric">Precio medio/u.</th><th class="numeric responsive-hidden">Días activos</th><th>Plan</th></tr></thead><tbody>${shown.map((r,i)=>{const key=r.id+'|'+r.city;return `<tr><td><div class="item-cell">${img(r.id)}<div><strong>${escape(name(r.id))}</strong><small>${escape(r.id)}</small></div></div></td><td>${escape(r.city)}</td><td class="numeric">${compact(r.averageDailyUnits)}</td><td class="numeric gold">${silver(r.averageDailySilver)}</td><td class="numeric">${silver(r.averageUnitPrice)}</td><td class="numeric responsive-hidden">${r.activeDays}/${r.days}</td><td><button class="btn btn-small ${state.marked.has(key)?'btn-gold':'btn-ghost'}" data-mark="${escape(key)}">${state.marked.has(key)?'✓ En plan':'+ Añadir'}</button></td></tr>`;}).join('')}</tbody></table></div>
 <div class="toolbar"><span class="small-print">Historia de calidades 1–5 agregada. El precio medio histórico NO es el precio de venta usado por la calculadora.</span>${state.tableLimit<rows.length?'<button class="btn btn-ghost" id="more-table">Mostrar 65 más</button>':''}</div>${state.coverage?.errors?.length?`<div class="warning">Consultas parciales: ${escape(state.coverage.errors.slice(0,2).join(' · '))}. No se estiman los registros faltantes.</div>`:''}`;
}
function toggleChips(array,field){return `<div class="pill-choices">${array.map(x=>{const enabled=field==='tiers'?state.filters.tiers.includes(x):state.filters.enchants.includes(x);return `<label class="toggle-chip ${enabled?'active':''}"><input type="checkbox" data-${field}="${x}" ${enabled?'checked':''}>${field==='tiers'?'T'+x:'.'+x}</label>`;}).join('')}</div>`;}
function calcPage(){const config=state.filters,rr=returnRate({...config,recipe:{city:'Martlock'}});
 return hero('calc')+`<section class="panel">${heading('Origen de la información','Los productos y las ciudades provienen exclusivamente de la última consulta del Top Mercado.',`<button class="btn btn-ghost btn-small" id="go-top">← Editar Top Mercado</button>`)}
 ${state.top.length?`<div class="success"><strong>${silver(state.top.length)} registros históricos</strong> disponibles; ${state.marked.size?`${state.marked.size} artículos/ciudad seleccionados manualmente`:'todos los artículos consultados son candidatos'}. Los filtros y las cotizaciones actuales decidirán qué se puede fabricar con ganancia.</div>`:'<div class="warning">Todavía no has consultado Top Mercado. Ve a esa pestaña y realiza una consulta para crear planes respaldados por datos.</div>'}
 <div class="sub-title">Ciudades donde vender</div>${marketChips(state.saleMarkets,'sale')}<p class="muted">Solo se usan ciudades ya consultadas en Top Mercado. Si cambias los mercados del Top, debes volver a consultar.</p></section>
 <section class="panel">${heading('Configuración del plan','Controles automáticos de retorno, demanda y asignación. El presupuesto siempre es un límite máximo.')}
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
 </div>
 <div class="callout"><strong>${rr.returnPct.toFixed(2)}% de retorno de referencia</strong><div class="hint">Producción con especialidad ilustrativa: ${rr.productionBonus}% = Royal 18% + especialidad 15% + diario ${config.dailyBonus}% + Focus ${config.focus?config.focusBonus:0}%. Cada receta recalcula el retorno según sus condiciones.</div></div>
 <div class="toolbar"><div class="hint">La venta usa puja observada para Mercado Negro y mejor oferta observada para Royal. Se descuentan impuestos e impacto estimado.</div><button class="btn btn-gold" id="run-plan" ${state.planActive||!state.top.length?'disabled':''}>${state.planActive?'Calculando…':'✧ Generar mi plan'}</button></div>
 <div id="plan-progress" role="status"></div></section>
 ${quickCalcPanel()}<section id="plan-results">${renderPlanResult()}</section>`;
}
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
 let html=`<section class="panel">${heading('Plan calculado','Solo rutas con margen esperado positivo, dentro del presupuesto y con historial observado.',`<button class="btn btn-ghost btn-small" id="export-plan">Exportar CSV</button>`)}
 <div class="metric-strip"><div class="metric"><small>Inversión bruta reservada</small><strong>${small(m.capitalReserved)}</strong></div><div class="metric"><small>Beneficio estimado neto</small><strong class="accent">${small(m.totalProfit)}</strong></div><div class="metric"><small>Presupuesto sin utilizar</small><strong>${small(m.remaining)}</strong></div><div class="metric"><small>Crafts / Artículos de salida</small><strong>${silver(m.crafts)} / ${silver(m.units)}</strong></div></div>
 <div class="hint">ROI sobre capital bruto reservado: ${m.roiOnCapital.toFixed(1)}% · Fama estimada: ${silver(m.totalFame)} · Los precios son observaciones, no ventas confirmadas. La compra de diarios es opcional y no está incluida.</div>`;
 if(r.rows.length){html+=`<div class="toolbar"><strong>Plan por artículo y ciudad</strong><span class="counter">${r.rows.length} rutas</span></div><div class="result-table"><table><thead><tr><th>Artículo</th><th>Fabricar → vender</th><th class="numeric">Crafts / salida</th><th class="numeric">Capital</th><th class="numeric">Beneficio estimado</th><th class="numeric">Impacto</th><th class="numeric">Estrés -10%</th></tr></thead><tbody>${r.rows.map(row=>`<tr><td><div class="item-cell">${img(row.id)}<div><strong>${escape(name(row.id))}</strong><small>${escape(row.id)} · retorno ${row.returnPct.toFixed(1)}%</small></div></div></td><td>${escape(row.craftCity)}<small style="display:block;color:#849daf">→ ${escape(row.city)}</small></td><td class="numeric">${silver(row.qty)} / ${silver(row.qty*row.craftAmount)}</td><td class="numeric">${silver(row.qty*row.grossCapitalPerCraft)}</td><td class="numeric green">+${silver(row.totalProfit)}</td><td class="numeric">${row.finalImpactPct.toFixed(1)}%</td><td class="numeric ${row.stressProfit>=0?'green':'red'}">${row.stressProfit>=0?'+':''}${silver(row.stressProfit)}</td></tr>`).join('')}</tbody></table></div>`;}
 else html+=`<div class="warning">No se encontró un lote con beneficio esperado positivo dentro del presupuesto y los límites de volumen observados. No se asignarán artículos artificiales para gastar el silver.</div>`;
 html+=`<div class="soft-line"></div><div class="sub-title">Lista de compras de materiales</div><p class="muted">Compra neta orientativa considerando retorno y reutilización entre crafts; el capital bruto reservado es deliberadamente más conservador. La profundidad real de las órdenes no se garantiza con Prices.</p>`;
 html+=r.materials.length?`<div class="result-table"><table><thead><tr><th>Recurso</th><th>Ciudad con precio observado</th><th class="numeric">Para comprar</th><th class="numeric">Bruto</th><th class="numeric">Reutilizado (estim.)</th><th class="numeric">Precio/u.</th><th class="numeric">Compra estimada</th></tr></thead><tbody>${r.materials.map(a=>`<tr><td><div class="item-cell">${img(a.id)}<div><strong>${escape(name(a.id))}</strong><small>${escape(a.id)}</small></div></div></td><td>${escape(a.city)}</td><td class="numeric gold">${silver(a.buy)}</td><td class="numeric">${silver(a.gross)}</td><td class="numeric">${silver(a.reuse)}</td><td class="numeric">${silver(a.unitPrice)}</td><td class="numeric">${silver(a.buy*a.unitPrice)}</td></tr>`).join('')}</tbody></table></div>`:'<div class="empty-narrow">Sin materiales verificados.</div>';
 html+=`<div class="soft-line"></div><div class="sub-title">Diarios para llenar (orientativos)</div>`;
 html+=r.journals.length?`<div class="notice">Estas cantidades de diarios son una <strong>estimación</strong> a partir de fama de materiales y capacidades de referencia; no están verificadas individualmente por el juego. Son compras opcionales, no se incluyen en costes, capital ni beneficios.</div><div class="result-table"><table><thead><tr><th>Diario estimado</th><th class="numeric">Unidades vacías estimadas</th><th>Fuente</th></tr></thead><tbody>${r.journals.map(j=>`<tr><td>${escape(j.name)} <small class="muted">${escape(j.id)}</small></td><td class="numeric gold">${j.estimatedQty}</td><td class="hint">${escape(j.source)}</td></tr>`).join('')}</tbody></table></div>`:`<p class="muted">No hay una relación verificable de diario y fama para los artículos seleccionados. No se inventan cantidades.</p>`;
 if(r.warnings.length)html+=`<div class="warning">${r.warnings.map(w=>escape(w)).join(' · ')}</div>`;
 if(notes.length)html+=`<div class="notice">${notes.map(w=>escape(w)).join(' · ')}</div>`;
 if(details)html+=`<div class="soft-line"></div><div class="sub-title">Diagnóstico del motor</div><div class="hint">Rutas posibles antes de asignar: ${silver(details.candidates)}. Filtros aplicados: ${Object.entries(details.rejected).map(([key,val])=>`${escape(key)}: ${val}`).join(' · ')}</div>`;
 html+=`<div class="warning">Comprueba manualmente profundidad del libro, comisiones, coste de estación, disponibilidad de insumos y tiempos reales antes de invertir. La tarifa de transporte y el deslizamiento de compras no están verificados ni descontados. No se promete venta.</div></section>`;
 return html;
}
function updatePage(){document.querySelectorAll('[data-route]').forEach(b=>{const active=b.dataset.route===state.page;b.classList.toggle('is-active',active);b.setAttribute('aria-current',active?'page':'false');});
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
 if(state.page==='top')updatePage();
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
 if(reset){resetMarket();state.saleMarkets=new Set(state.markets);}save();updatePage();
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
  const chosen=state.top.filter(x=>state.saleMarkets.has(x.city)&&(!state.marked.size||state.marked.has(x.id+'|'+x.city)))
   .filter(x=>{const v=variant(x.id);return v&&c.tiers.map(Number).includes(v.tier)&&c.enchants.map(Number).includes(v.ench);});
  const rank=rankEntries(chosen,'silver').slice(0,state.scanLimit);if(!rank.length)throw Error('No hay artículos del Top en los mercados, tiers y encantamientos elegidos.');
  progress('plan-progress','Preparando recetas y materias primas verificables…',7);
  await addSpecialCatalog();
  const candidates=rank.filter(h=>Array.isArray(state.recipes[h.id]?.materials)&&state.recipes[h.id].materials.length);
  if(!candidates.length)throw Error('Los artículos del Top seleccionado no tienen recetas verificadas. Prueba otra rama o vuelve a cargar el catálogo.');
  const ids=[...new Set([...candidates.map(x=>x.id),...candidates.flatMap(x=>state.recipes[x.id].materials.map(m=>m.id))])];
  const quotes=await marketFetch('prices',ids,{cities:MARKETS,qualities:'1',onProgress:p=>progress('plan-progress',`Cotizaciones West: lote ${p.finished}/${p.total} · ${p.rows} registros recibidos · ${p.errors} errores`,100*p.finished/p.total)});
  if(!quotes.coverage)throw Error('No se pudieron verificar precios de compra y venta con AODP West. '+quotes.errors.slice(0,2).join(' · '));
  const map=quoteMap(quotes.rows),data=buildCandidates({top:rank,recipes:state.recipes,quotes:map,config:c,
   selectedIds:[],selectedMarkets:[...state.saleMarkets]});
  state.result=allocatePlan({...data,recipes:state.recipes});
  state.resultDiagnostics={candidates:data.candidates.length,rejected:data.rejected};
  state.resultNotes=[];
  if(chosen.length>rank.length)state.resultNotes.push(`Se analizaron ${rank.length} artículos de ${chosen.length} candidatos; amplía el universo si quieres cubrir más.`);
  if(quotes.errors.length)state.resultNotes.push(`Cotizaciones parciales: ${quotes.errors.length} lotes incompletos. No se inventaron precios faltantes.`);
  if(state.specialWarning)state.resultNotes.push(state.specialWarning);
  if(!state.result.rows.length)toast('La búsqueda terminó, pero no hay lotes rentables con las cotizaciones y límites actuales.');
  else toast(`Plan generado: ${state.result.rows.length} rutas · beneficio estimado ${silver(state.result.summary.totalProfit)} silver.`);
 }catch(e){state.result={rows:[],materials:[],journals:[],warnings:[e.message],summary:{budget:state.filters.budget,capitalReserved:0,remaining:state.filters.budget,totalProfit:0,totalFame:0,crafts:0,units:0,roiOnCapital:0}};toast(e.message);}
 finally{state.planActive=false;updatePage();requestAnimationFrame(()=>$('#plan-results')?.scrollIntoView({block:'start',behavior:'smooth'}));}
}
function exportCsv(){if(!state.result?.rows.length)return toast('No hay un plan para exportar.');
 const head=['id','nombre','ciudad_fabricacion','ciudad_venta','crafts','unidades','capital_bruto','beneficio_esperado','impacto_pct','profit_estres','fecha_cotizacion_utc'];
 const data=state.result.rows.map(r=>[r.id,name(r.id),r.craftCity,r.city,r.qty,r.qty*r.craftAmount,Math.round(r.qty*r.grossCapitalPerCraft),Math.round(r.totalProfit),r.finalImpactPct.toFixed(3),Math.round(r.stressProfit),r.saleObservedAt]);
 const escapeCsv=x=>'"'+String(x??'').replaceAll('"','""')+'"';const body=[head,...data].map(r=>r.map(escapeCsv).join(',')).join('\r\n');
 const url=URL.createObjectURL(new Blob(['\ufeff'+body],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='gildem-plan-west.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),500);
}
// Delegación: mantiene clics funcionales tras actualizar los paneles.
document.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;
 if(b.dataset.route)return nav(b.dataset.route);
 if(b.id==='mobile-nav'){document.querySelector('.sidebar').classList.toggle('mobile-open');return;}
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
 if(b.id==='go-top')return nav('top');
 if(b.dataset.mark){if(state.marked.has(b.dataset.mark))state.marked.delete(b.dataset.mark);else state.marked.add(b.dataset.mark);return updatePage();}
 if(b.id==='mark-first'){visibleTop().slice(0,50).forEach(r=>state.marked.add(r.id+'|'+r.city));return updatePage();}
 if(b.id==='clear-marked'){state.marked.clear();return updatePage();}
 if(b.id==='more-table'){state.tableLimit+=65;return updatePage();}
 if(b.id==='run-plan')return makePlan();
 if(b.id==='single-run')return runSingle();
 if(b.id==='export-plan')return exportCsv();
});
document.addEventListener('toggle',e=>{if(e.target.matches('details[data-group]')){if(e.target.open)state.openedGroups.add(e.target.dataset.group);else state.openedGroups.delete(e.target.dataset.group);} },true);
document.addEventListener('change',e=>{const x=e.target;
 if(x.id==='top-days'){state.days=Number(x.value);resetMarket();save();return updatePage();}
 if(x.id==='top-sort'){state.sort=x.value;save();return updatePage();}
 if(x.id==='force-top'){state.forceFresh=x.checked;return;}
 if(x.hasAttribute('data-market-top')){const c=x.dataset.marketTop;if(x.checked)state.markets.add(c);else state.markets.delete(c);resetMarket();save();return updatePage();}
 if(x.hasAttribute('data-market-sale')){const c=x.dataset.marketSale;if(x.checked)state.saleMarkets.add(c);else state.saleMarkets.delete(c);state.result=null;save();return updatePage();}
 if(x.dataset.tiers||x.hasAttribute('data-tiers')){const tier=Number(x.dataset.tiers),old=state.filters.tiers;state.filters.tiers=x.checked?[...new Set([...old,tier])]:old.filter(v=>v!==tier);state.result=null;save();return updatePage();}
 if(x.dataset.enchants||x.hasAttribute('data-enchants')){const value=Number(x.dataset.enchants),old=state.filters.enchants;state.filters.enchants=x.checked?[...new Set([...old,value])]:old.filter(v=>v!==value);state.result=null;save();return updatePage();}
 if(x.id==='single-item'){state.singleItem=x.value;state.singleResult=null;const el=$('#single-result');if(el)el.innerHTML=singleResultHTML();return;}
 if(x.id==='single-qty'){state.singleQty=Number(x.value)||1;state.singleResult=null;return;}
 if(x.dataset.cfg){const key=x.dataset.cfg;const bool=x.type==='checkbox';state.filters[key]=bool?x.checked:x.type==='number'?Number(x.value):['dailyBonus','saleDays'].includes(key)?Number(x.value):x.value;state.result=null;save();if(['bonusCity','dailyBonus','focus','focusBonus','diversify'].includes(key))return updatePage();}
});
// Mostrar ambos tabs sin bloquear por solicitudes externas.
updatePage();loadCatalog().catch(e=>{state.catalogStatus='Error de catálogo: '+e.message;updatePage();});
