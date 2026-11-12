// Pestaña «Refinamiento» (v3.0): configuración, consulta AODP y plan del motor de refinado.
import {REFINE_DEFAULTS,REFINE_TYPES,refineSettings,refiningIds,productIds,planRefining} from './refining-engine.js';
import {PRIORITIES} from './engine-v3.js';
import {returnRate} from './planner.js';
import {premiumTax} from './economics.js';

const ROYALS=['Bridgewatch','Fort Sterling','Lymhurst','Martlock','Thetford'];
const BUDGETS=[5,10,20,50];
export function createRefinePage(ctx){
 const {escape,silver,small,compact,cityBadge,itemWithCopy,heading,hero,toast,progress,marketFetch,summarizeHistory,quoteMap,save,rerender}=ctx;
 const saved=ctx.persisted?.refine?.cfg||{};
 const st={cfg:sanitize({...REFINE_DEFAULTS,...saved}),result:null,busy:false,error:null,quotesAt:null};
 function sanitize(c){const out={...REFINE_DEFAULTS,...c};
  if(!REFINE_TYPES.some(t=>t.key===out.type))out.type='CLOTH';
  for(const k of ['tiers','enchants','buyCities','sellCities'])if(!Array.isArray(out[k])||!out[k].length)out[k]=[...REFINE_DEFAULTS[k]];
  out.buyCities=out.buyCities.filter(c=>[...ROYALS,'Caerleon'].includes(c));out.sellCities=out.sellCities.filter(c=>[...ROYALS,'Caerleon'].includes(c));
  if(!PRIORITIES[out.priority])out.priority='fast-buy';
  if(out.refineCity&&![...ROYALS,'Caerleon'].includes(out.refineCity))out.refineCity=null;
  return out;}
 const type=()=>REFINE_TYPES.find(t=>t.key===st.cfg.type);
 const refineCity=()=>st.cfg.refineCity||type().city;
 const rr=f=>returnRate({bonusCity:true,recipe:{city:refineCity()===type().city?type().city:null,specialtyBonus:40,dailyEnabled:true},dailyBonus:st.cfg.dailyBonus,focus:f,focusBonus:st.cfg.focusBonus}).returnPct;
 const chips=(list,field,label=x=>x)=>`<div class="pill-choices">${list.map(x=>{const on=st.cfg[field].includes(x);return `<label class="toggle-chip ${on?'active':''}"><input type="checkbox" data-ref-list="${field}" data-value="${escape(String(x))}" ${on?'checked':''}>${escape(label(x))}</label>`;}).join('')}</div>`;
 const opt=(v,cur,label)=>`<option value="${escape(String(v))}" ${String(cur)===String(v)?'selected':''}>${escape(label)}</option>`;

 function configPanel(){const c=st.cfg,t=type();
  return `<section class="panel">${heading('1 · ¿Qué quieres refinar?','Elige el recurso, los tiers y los encantamientos. El motor compara comprar, transmutar y refinar en cadena.')}
  <div class="refine-types">${REFINE_TYPES.map(x=>`<button type="button" class="refine-type ${x.key===c.type?'active':''}" data-ref-type="${x.key}">${ctx.img(`T5_${x.key}`)}<span><strong>${escape(x.label)}</strong><small>${escape(x.raw==='FIBER'?'Fibra':x.raw==='HIDE'?'Piel':x.raw==='ORE'?'Mineral':'Madera')} · bono en ${escape(x.city)}</small></span></button>`).join('')}</div>
  <div class="config-grid">
   <div class="config-section"><h3>Tiers</h3>${chips([4,5,6,7,8],'tiers',x=>'T'+x)}</div>
   <div class="config-section"><h3>Encantamiento</h3>${chips([0,1,2,3,4],'enchants',x=>'.'+x)}</div>
  </div></section>
  <section class="panel">${heading('2 · Configuración','Lo esencial arriba; ciudades y logística debajo.')}
  <div class="config-grid">
   <div class="config-section budget-section"><h3>Presupuesto de silver</h3><div class="budget-presets">${BUDGETS.map(m=>`<label class="budget-choice ${c.budget===m*1e6?'active':''}"><input type="radio" name="ref-budget" data-ref-budget="${m*1e6}" ${c.budget===m*1e6?'checked':''}><span class="budget-check">✓</span>${m}M</label>`).join('')}</div>
    <label class="field"><span class="small-print">Otro importe (silver)</span><input data-ref="budget" type="number" min="1000" step="100000" value="${c.budget}"></label>
    <label class="checkline"><input type="checkbox" data-ref="useBudget" ${c.useBudget?'checked':''}> Usar todo lo posible</label><p>Sin marcar, cada lote adicional debe rendir al menos el ROI mínimo (${c.minRoiPct} %).</p></div>
   <div class="config-section"><h3>Prioridad</h3><select data-ref="priority">${Object.entries(PRIORITIES).map(([k,p])=>opt(k,c.priority,p.label)).join('')}</select><p>${escape(PRIORITIES[c.priority].hint)}.</p></div>
   <div class="config-section"><h3>Estilo y plazo de venta</h3><select data-ref="style">${opt('prudent',c.style,'Prudente · 20 % del volumen')}${opt('balanced',c.style,'Equilibrado · 30 % del volumen')}${opt('dynamic',c.style,'Dinámico · 45 % del volumen')}</select>
    <select data-ref="saleDays" style="margin-top:8px">${[1,3,7,14].map(d=>opt(d,c.saleDays,d+' días para vender')).join('')}</select><p>Parte de las ventas Q1 de cada ciudad que tus órdenes pueden captar en ese plazo.</p></div>
   <div class="config-section"><h3>Ciudad de refinado</h3><select data-ref="refineCity">${[...ROYALS,'Caerleon'].map(x=>opt(x,refineCity(),x+(x===t.city?' · bono +40':''))).join('')}</select>
    <select data-ref="dailyBonus" style="margin-top:8px">${[0,10,20].map(d=>opt(d,c.dailyBonus,d?`Bono diario +${d} %`:'Sin bono diario')).join('')}</select>
    <p>Retorno: <b>${rr(false).toFixed(1)} %</b>${c.focus?` · con Focus <b>${rr(true).toFixed(1)} %</b>`:''}.</p></div>
   <div class="config-section focus-section ${c.focus?'expanded':''}"><h3>Focus</h3><label class="checkline"><input type="checkbox" data-ref="focus" ${c.focus?'checked':''}> Usar Focus donde más ahorre</label>
    ${c.focus?`<div class="multifield"><label>Focus disponible<input data-ref="focusAvailable" type="number" min="1" value="${c.focusAvailable}"></label><label>Eficiencia (FCE)<input data-ref="focusEfficiency" type="number" min="0" max="100000" step="100" value="${c.focusEfficiency}"></label></div>`:''}
    <p>Coste de Focus por refinado tomado del juego; cada 10.000 FCE lo reduce a la mitad.</p></div>
   <div class="config-section"><h3>Cuenta</h3><label class="checkline"><input type="checkbox" data-ref="premium" ${c.premium?'checked':''}> Tengo Premium <span class="small-print">(impuesto ${premiumTax(c.premium)} %)</span></label>
    <div class="multifield"><label>Publicación %<input data-ref="listingFee" type="number" min="0" max="10" step=".1" value="${c.listingFee}"></label><label>ROI mínimo %<input data-ref="minRoiPct" type="number" min="0" max="100" step="1" value="${c.minRoiPct}"></label></div></div>
  </div>
  <details class="advanced-config" open><summary><span><strong>Ciudades y logística</strong> <small>compra, venta, montura, saltos, divisiones, transmutación</small></span><span class="drawer-arrow">⌄</span></summary>
  <div class="config-grid">
   <div class="config-section config-half"><h3>Comprar en</h3>${chips([...ROYALS,'Caerleon'],'buyCities')}<p>Se elige la ciudad más barata para cada recurso, sumando el coste de los saltos hasta ${escape(refineCity())}.</p></div>
   <div class="config-section config-half"><h3>Vender en</h3>${chips([...ROYALS,'Caerleon'],'sellCities')}<p>La venta se reparte entre ciudades según su volumen Q1, el precio y los saltos desde ${escape(refineCity())}.</p></div>
   <div class="config-section"><h3>Montura</h3><div class="multifield"><label>Capacidad (kg, 0 = sin límite)<input data-ref="mountKg" type="number" min="0" step="100" value="${c.mountKg}"></label><label>Viajes<input data-ref="trips" type="number" min="1" max="20" value="${c.trips}"></label></div><p>Limita el peso que traes de otras ciudades (y el que llevas a vender).</p></div>
   <div class="config-section"><h3>Coste por salto</h3><label class="field"><span class="small-print">% del valor por cada ciudad de distancia</span><input data-ref="hopPct" type="number" min="0" max="20" step=".5" value="${c.hopPct}"></label><p>Anillo Royal: Fort Sterling · Thetford · Martlock · Bridgewatch · Lymhurst (Caerleon = 1 salto).</p></div>
   <div class="config-section"><h3>Divisiones</h3><select data-ref="divisions">${opt('auto',c.divisions,'Automático')}${[1,2,3,4,5].map(n=>opt(n,c.divisions,n+(n===1?' ciudad':' ciudades'))).join('')}</select><p>Número máximo de ciudades donde repartir la venta.</p></div>
   <div class="config-section"><h3>Opciones del motor</h3><label class="checkline"><input type="checkbox" data-ref="transmute" ${c.transmute?'checked':''}> Transmutar si sale más barato</label><label class="checkline"><input type="checkbox" data-ref="chain" ${c.chain?'checked':''}> Refinar en cadena (tier inferior) si sale más barato que comprarlo</label><p>Costes de transmutación base del juego (ao-bin-dumps): compruébalos en el laboratorio.</p></div>
  </div></details>
  <div class="toolbar"><p class="muted">${productIds({...c,typeInfo:t}).length} productos · ${c.sellCities.length} ciudades de venta · datos AODP West</p><button type="button" class="btn btn-gold" id="ref-run" ${st.busy?'disabled':''}>${st.busy?'Calculando…':'Generar plan de refinamiento'}</button></div>
  <div id="ref-progress"></div>
  </section>`;}

 function resultPanel(){const r=st.result;
  if(st.error)return `<section class="panel"><div class="warning">${escape(st.error)}</div></section>`;
  if(!r)return `<section class="panel">${heading('Plan de refinamiento','Aquí verás qué comprar, qué transmutar, en qué orden refinar y dónde vender.')}<div class="empty"><h3>Configura y genera tu plan</h3><p>El motor usa cotizaciones y ventas Q1 de AODP West.</p></div></section>`;
  const m=r.summary,c=r.config;
  let h=`<section class="panel">${heading('Plan de refinamiento',`${escape(type().label)} · refinado en ${escape(m.refineCity)} · retorno ${m.returnPct.toFixed(1)} %${c.focus?` (Focus ${m.returnPctFocus.toFixed(1)} %)`:''} · ${escape(PRIORITIES[c.priority].label)}`)}`;
  if(r.verdict==='risky')h+=`<div class="plan-verdict risky"><b>⚠ Plan arriesgado</b><span>Vendes ${silver(m.units)} unidades; lo recomendado son ${silver(m.recommendedUnits)} (ganancia estimada ${small(m.recommendedProfit)}). Puede tardar más en venderse o bajar el precio.</span></div>`;
  else if(r.verdict==='ok')h+=`<div class="plan-verdict ok"><b>✓ Plan dentro de lo recomendado</b><span>Cada ciudad recibe como mucho el 30 % de su volumen Q1 del plazo.</span></div>`;
  h+=`<div class="metric-strip"><div class="metric"><small>Inversión</small><strong>${small(m.capital)}</strong></div><div class="metric"><small>Ganancia estimada</small><strong class="${m.profit>=0?'green':'red'}">${m.profit>=0?'+':''}${small(m.profit)}</strong></div><div class="metric"><small>ROI</small><strong>${m.roi.toFixed(1)} %</strong></div><div class="metric"><small>Unidades a vender</small><strong>${silver(m.units)}</strong></div></div>
  <div class="plan-extras"><span class="extra-chip">⚖ Carga de compras ${silver(m.kgIn)} kg${c.mountKg?` / ${silver(c.mountKg*c.trips)} kg`:''}</span>${m.focus?`<span class="extra-chip">✦ Focus ${silver(m.focus)} puntos</span>`:''}<span class="extra-chip">◎ ${m.divisions.length} ${m.divisions.length===1?'ciudad':'ciudades'} de venta</span>${m.transmuteSilver?`<span class="extra-chip good">⇪ Transmutación ${small(m.transmuteSilver)} silver</span>`:''}<span class="extra-chip">Sin usar ${small(m.remaining)}</span></div>`;
  if(!r.sales.length){h+=`<div class="warning">No hay un plan rentable con esta configuración. Prueba otros tiers, más ciudades de venta, «Más silver» o activa Focus.</div>`;}
  else{
   h+=`<div class="section-heading"><h3>1 · Comprar</h3><span>${r.purchases.length} compras · incluye un 2 % extra por el retorno variable</span></div><div class="result-table"><table><thead><tr><th>Recurso</th><th>Ciudad</th><th class="numeric">Unidades</th><th class="numeric">Precio</th><th>Modo</th><th class="numeric">Saltos</th><th class="numeric">Total</th><th class="numeric">kg</th></tr></thead><tbody>${r.purchases.map(p=>`<tr><td>${itemWithCopy(p.id)}</td><td>${cityBadge(p.city,'city-small')}</td><td class="numeric"><strong>${silver(p.buy)}</strong></td><td class="numeric">${silver(p.unit)}</td><td>${p.mode==='order'?'Orden de compra':'Instantánea'}</td><td class="numeric">${p.hops}</td><td class="numeric">${silver(p.total)}</td><td class="numeric">${silver(p.kg)}</td></tr>`).join('')}</tbody></table></div>`;
   if(r.transmutations.length)h+=`<div class="section-heading"><h3>2 · Transmutar</h3><span>más barato que comprar el recurso directamente</span></div><div class="result-table"><table><thead><tr><th>Resultado</th><th>Desde</th><th class="numeric">Unidades</th><th class="numeric">Silver / u.</th><th class="numeric">Total</th></tr></thead><tbody>${r.transmutations.map(x=>`<tr><td>${itemWithCopy(x.id)}</td><td>${escape(ctx.name(x.from))}</td><td class="numeric">${silver(x.units)}</td><td class="numeric">${silver(x.silver)}</td><td class="numeric">${silver(x.totalSilver)}</td></tr>`).join('')}</tbody></table></div>`;
   h+=`<div class="section-heading"><h3>${r.transmutations.length?3:2} · Refinar en ${escape(m.refineCity)}</h3><span>en este orden; reutiliza lo que devuelve cada lote</span></div><ol class="refine-steps">${r.steps.map(x=>`<li>${itemWithCopy(x.id)}<span><b>${silver(x.units)}</b> u.${x.focusUnits?` · ${silver(Math.ceil(x.focusUnits))} con Focus`:''}</span></li>`).join('')}</ol>`;
   h+=`<div class="section-heading"><h3>${r.transmutations.length?4:3} · Vender</h3><span>${escape(PRIORITIES[c.priority].sell==='order'?'con orden de venta':'al instante a órdenes de compra')}</span></div><div class="result-table"><table><thead><tr><th>Producto</th><th>Ciudad</th><th class="numeric">Unidades</th><th class="numeric">Precio de lista</th><th class="numeric">Precio medio esperado</th><th class="numeric">Saltos</th><th class="numeric">Días aprox.</th><th class="numeric">Beneficio</th></tr></thead><tbody>${r.sales.map(s=>`<tr class="${s.risky?'row-risky':''}"><td>${itemWithCopy(s.id)}<small class="rank-sub">${compact(s.share)} % del volumen Q1 del plazo · confianza ${Math.round(s.confidence*100)} % · ${escape(s.priceSource)}${s.risky?` · <b class="red">recomendado ${silver(s.recommended)} u.</b>`:''}</small></td><td>${cityBadge(s.city,'city-small')}</td><td class="numeric"><strong>${silver(s.units)}</strong></td><td class="numeric">${silver(s.listPrice)}</td><td class="numeric">${silver(s.avgPrice)}</td><td class="numeric">${s.hops}</td><td class="numeric">${s.saleMode==='order'?compact(s.daysToSell):'al instante'}</td><td class="numeric ${s.profit>=0?'green':'red'}">${s.profit>=0?'+':''}${silver(s.profit)}</td></tr>`).join('')}</tbody></table></div>`;
  }
  if(r.warnings.length)h+=`<div class="warning">${r.warnings.map(escape).join(' · ')}</div>`;
  if(r.rejected.length)h+=`<details class="plan-diagnostics" ${r.sales.length?'':'open'}><summary>¿Por qué algunas combinaciones no entraron? · ${r.rejected.length}</summary><div class="diagnostic-list">${r.rejected.slice(0,40).map(x=>`<div class="diagnostic-item">${ctx.img(x.id)}<div><strong>${escape(ctx.name(x.id))}</strong>${x.city?`<small>${cityBadge(x.city,'city-small')}</small>`:''}<small>${escape(x.reason)}</small></div></div>`).join('')}</div></details>`;
  h+=`<p class="hint">Estimaciones con precios observados (calidad 1) y ventas Q1 de los últimos 7 días. El precio baja a medida que cubres más volumen; las compras grandes encarecen. No se garantiza la venta.</p></section>`;
  return h;}

 async function run(){if(st.busy)return;st.busy=true;st.error=null;rerender();
  try{const c=refineSettings(st.cfg);const t=c.typeInfo;
   const ids=refiningIds(c),products=productIds(c),cities=[...new Set([...c.buyCities,...c.sellCities,c.refineCity])];
   progress('ref-progress','Cotizaciones West…',10);
   const prices=await marketFetch('prices',ids,{cities,qualities:'1',onProgress:p=>progress('ref-progress',`Cotizaciones West: lote ${p.finished}/${p.total}`,10+40*p.finished/p.total)});
   if(!prices.coverage)throw Error('No se pudieron leer precios de AODP West. '+prices.errors.slice(0,2).join(' · '));
   progress('ref-progress','Ventas Q1 de los productos…',55);
   const hist=await marketFetch('history',products,{cities:c.sellCities,qualities:'1',days:7,onProgress:p=>progress('ref-progress',`Historial de venta: lote ${p.finished}/${p.total}`,55+20*p.finished/p.total)});
   progress('ref-progress','Volumen de los recursos en las ciudades de compra…',78);
   const buyIds=ids.filter(id=>!products.includes(id));
   const mh=await marketFetch('history',buyIds,{cities:c.buyCities,qualities:'1',days:7});
   progress('ref-progress','Motor 3.0 de refinado…',95);
   st.result=planRefining({quotes:quoteMap(prices.rows),history:summarizeHistory(hist.rows,{days:7}),materialHistory:summarizeHistory(mh.rows,{days:7}),config:st.cfg});
   if(hist.errors.length||mh.errors.length)st.result.warnings.push('Historial parcial: algunas consultas fallaron; el plan puede ser más pequeño de lo posible.');
   toast(st.result.sales.length?`Plan listo: ${small(st.result.summary.profit)} de ganancia estimada.`:'Sin plan rentable con esta configuración.');
  }catch(e){st.error=e.message;st.result=null;toast(e.message);}
  finally{st.busy=false;rerender();}}

 function setCfg(patch){st.cfg=sanitize({...st.cfg,...patch});save();rerender();}
 return {
  render:()=>`<div id="refine-root">${hero('refine')}${configPanel()}${resultPanel()}</div>`,
  saveState:()=>({cfg:st.cfg}),
  onClick(b){if(b.dataset.refType){setCfg({type:b.dataset.refType,refineCity:null});st.result=null;rerender();return true;}
   if(b.id==='ref-run'){void run();return true;}return false;},
  onChange(x){
   if(x.dataset.refList){const f=x.dataset.refList,raw=x.dataset.value,v=['tiers','enchants'].includes(f)?Number(raw):raw;
    const set=new Set(st.cfg[f]);x.checked?set.add(v):set.delete(v);if(!set.size){toast('Deja al menos una opción marcada.');rerender();return true;}
    setCfg({[f]:[...set].sort((a,b)=>typeof a==='number'?a-b:String(a).localeCompare(String(b)))});return true;}
   if(x.dataset.refBudget){setCfg({budget:Number(x.dataset.refBudget)});return true;}
   if(x.dataset.ref){const k=x.dataset.ref;let v=x.type==='checkbox'?x.checked:x.value;
    if(['budget','focusAvailable','focusEfficiency','listingFee','minRoiPct','mountKg','trips','hopPct','saleDays','dailyBonus'].includes(k))v=Math.max(0,Number(v)||0);
    if(k==='divisions')v=v==='auto'?'auto':Number(v);
    const patch={[k]:v};if(k==='premium')patch.tax=premiumTax(v);if(k==='trips')patch.trips=Math.max(1,v);
    setCfg(patch);return true;}
   return false;}
 };
}
