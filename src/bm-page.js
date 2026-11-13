// Pestaña «Plan Mercado Negro» (v3.1): plan diversificado para vender al Mercado Negro en pocos días.
import {BM_DEFAULTS,bmSettings,parseBlackMarketTable,demandFromAodp,planBlackMarket} from './bm-plan.js';
import {GROUPS,variant} from './branches.js';
import {blackMarketEligible} from './recipe-extractor.js';
import {premiumTax} from './economics.js';
import {createPortfolio,lotsFromBmPlan} from './business-store.js';

const ROYALS=['Bridgewatch','Fort Sterling','Lymhurst','Martlock','Thetford'];
const BM_GROUPS=['weapons','armor','offhand','accessories'];
const BUDGETS=[5,10,20,50];
const MAX_PASTE=400_000;

export function createBmPage(ctx){
 const {escape,silver,small,compact,itemWithCopy,heading,hero,toast,progress,marketFetch,summarizeHistory,quoteMap,save,rerender}=ctx;
 const saved=ctx.persisted?.bm||{};
 const st={cfg:bmSettings({...BM_DEFAULTS,...(saved.cfg||{})}),paste:String(saved.paste||'').slice(0,MAX_PASTE),
  demand:null,demandInfo:null,quotes:null,result:null,busy:false,error:null,fetchedFor:null};
 const groups=GROUPS.filter(g=>BM_GROUPS.includes(g.key));
 const opt=(v,cur,label)=>`<option value="${escape(String(v))}" ${String(cur)===String(v)?'selected':''}>${escape(label)}</option>`;
 const chips=(list,field,label=x=>x)=>`<div class="pill-choices">${list.map(x=>{const on=st.cfg[field].includes(x);return `<label class="toggle-chip ${on?'active':''}"><input type="checkbox" data-bm-list="${field}" data-value="${escape(String(x))}" ${on?'checked':''}>${escape(label(x))}</label>`;}).join('')}</div>`;
 const pct=x=>`${compact(x)} %`;

 function sourcePanel(){const c=st.cfg;
  const parsed=c.source==='paste'&&st.paste?parseBlackMarketTable(st.paste):null;
  return `<section class="panel">${heading('1 · ¿De dónde sale la demanda?','Las ventas diarias del Mercado Negro deciden cuánto fabricar de cada artículo.')}
  <div class="config-grid">
   <div class="config-section config-half"><h3>Fuente</h3>
    <label class="checkline"><input type="radio" name="bm-source" data-bm="source" value="aodp" ${c.source==='aodp'?'checked':''}> AODP West (historial del Mercado Negro, 7 días)</label>
    <label class="checkline"><input type="radio" name="bm-source" data-bm="source" value="paste" ${c.source==='paste'?'checked':''}> Pegar una tabla de ventas (p. ej. «top selling items»)</label>
    <p>AODP solo ve el Mercado Negro cuando alguien con el cliente de datos lo abre; una tabla de otra web suele tener más ventas registradas.</p></div>
   ${c.source==='aodp'?`<div class="config-section config-half"><h3>Ramas</h3>${groups.map(g=>`<details class="bm-branch-group" ${g.items.some(i=>c.branches.includes(i.key))?'open':''}><summary>${escape(g.icon||'')} ${escape(g.title)} <small>${g.items.filter(i=>c.branches.includes(i.key)).length}/${g.items.length}</small></summary><div class="pill-choices">${g.items.map(i=>{const on=c.branches.includes(i.key);return `<label class="toggle-chip ${on?'active':''}"><input type="checkbox" data-bm-branch="${escape(i.key)}" ${on?'checked':''}>${escape(i.label)}</label>`;}).join('')}</div></details>`).join('')}<p>${c.branches.length} ramas elegidas.</p></div>`
   :`<div class="config-section config-half"><h3>Tabla de ventas</h3><textarea id="bm-paste" rows="7" placeholder="Copia la tabla completa (ID, nombre, ciudad, cantidad diaria, silver diario, precio medio) y pégala aquí." style="width:100%">${escape(st.paste)}</textarea>
    <p>${parsed?`<b>${parsed.rows.length}</b> artículos leídos${parsed.skipped.length?` · ${parsed.skipped.length} ignorados (otra ciudad o sin cifras)`:''}.`:'Admite cifras como 584, 5,1M u 8,7K. Solo se usan las filas del Mercado Negro.'}</p></div>`}
  </div></section>`;}

 function configPanel(){const c=st.cfg;
  return `<section class="panel">${heading('2 · Configuración','Presupuesto, plazo de venta y cuánto del mercado tomar.')}
  <div class="config-grid">
   <div class="config-section budget-section"><h3>Presupuesto</h3><div class="budget-presets">${BUDGETS.map(m=>`<label class="budget-choice ${c.budget===m*1e6?'active':''}"><input type="radio" name="bm-budget" data-bm-budget="${m*1e6}" ${c.budget===m*1e6?'checked':''}><span class="budget-check">✓</span>${m}M</label>`).join('')}</div>
    <label class="field"><span class="small-print">Otro importe (silver)</span><input data-bm="budget" type="number" min="10000" step="100000" value="${c.budget}"></label></div>
   <div class="config-section"><h3>Venta</h3><select data-bm="saleDays">${[1,2,3,5,7,14].map(d=>opt(d,c.saleDays,d+(d===1?' día':' días')+' para vender')).join('')}</select>
    <div class="multifield"><label>% máx. del volumen<input data-bm="maxSharePct" type="number" min="1" max="50" step="0.5" value="${c.maxSharePct}"></label><label>Mín. ventas/día<input data-bm="minDailyUnits" type="number" min="0" step="1" value="${c.minDailyUnits}"></label></div>
    <p>Cada artículo toma como mucho el ${pct(c.maxSharePct)} de lo que el Mercado Negro compra en ${c.saleDays} ${c.saleDays===1?'día':'días'}: así no hundes el precio aunque haya más crafteadores.</p></div>
   <div class="config-section"><h3>Diversidad</h3><div class="multifield"><label>Artículos distintos<input data-bm="maxItems" type="number" min="1" max="40" value="${c.maxItems}"></label><label>Tope por artículo %<input data-bm="maxItemBudgetPct" type="number" min="5" max="100" value="${c.maxItemBudgetPct}"></label></div>
    <p>El plan se reparte entre tiers y familias; ningún artículo se lleva más del ${pct(c.maxItemBudgetPct)} del presupuesto.</p></div>
   <div class="config-section"><h3>Tiers</h3>${chips([4,5,6,7,8],'tiers',x=>'T'+x)}<h3 style="margin-top:10px">Encantamiento</h3>${chips([0,1,2,3,4],'enchants',x=>'.'+x)}</div>
   <div class="config-section"><h3>Margen</h3><div class="multifield"><label>Margen mínimo %<input data-bm="targetMarginPct" type="number" min="0" max="300" value="${c.targetMarginPct}"></label><label>Margen supuesto %<input data-bm="assumedMarginPct" type="number" min="0" max="300" value="${c.assumedMarginPct}"></label></div>
    <p>El supuesto solo se usa cuando falta el precio de algún material. El mínimo define el precio máximo de compra de cada material.</p></div>
   <div class="config-section"><h3>Crafteo</h3><label class="checkline"><input type="checkbox" data-bm="bonusCity" ${c.bonusCity?'checked':''}> Fabricar en la ciudad de bono</label>
    <select data-bm="dailyBonus">${[0,10,20].map(d=>opt(d,c.dailyBonus,d?`Bono diario +${d} %`:'Sin bono diario')).join('')}</select>
    <label class="checkline"><input type="checkbox" data-bm="premium" ${c.premium?'checked':''}> Tengo Premium <span class="small-print">(impuesto ${premiumTax(c.premium)} %)</span></label></div>
   <div class="config-section"><h3>Filtros</h3><label class="checkline"><input type="checkbox" data-bm="excludeArtifacts" ${c.excludeArtifacts?'checked':''}> Sin artefactos</label>
    <label class="checkline"><input type="checkbox" data-bm="useAodpMaterials" ${c.useAodpMaterials?'checked':''}> Precios de materiales de AODP</label>
    <label class="field"><span class="small-print">Valor mínimo por material frente a lo mejor del mismo nivel (%)</span><input data-bm="minValuePct" type="number" min="0" max="100" value="${c.minValuePct}"></label>
    <p>Descarta variantes (casi siempre encantadas) que pagan mucho menos por material que otra del mismo nivel de poder.</p></div>
  </div>
  <div class="toolbar"><p class="muted">Mercado Negro · West · ${escape(c.source==='aodp'?'AODP':'tabla pegada')}</p><button type="button" class="btn btn-gold" id="bm-run" ${st.busy?'disabled':''}>${st.busy?'Calculando…':'Generar plan Mercado Negro'}</button></div>
  <div id="bm-progress"></div></section>`;}

 function resultPanel(){const r=st.result;
  if(st.error)return `<section class="panel"><div class="warning">${escape(st.error)}</div></section>`;
  if(!r)return `<section class="panel">${heading('Plan Mercado Negro','Qué fabricar, cuántas unidades, qué materiales comprar y a qué precio máximo.')}<div class="empty"><h3>Configura y genera tu plan</h3><p>Con la demanda real del Mercado Negro y tope por artículo para venderlo todo en el plazo.</p></div></section>`;
  const m=r.summary,c=r.config,roi=m.capital?100*m.profit/m.capital:0;
  let h=`<section class="panel" id="bm-results">${heading('Plan Mercado Negro',`${m.items} artículos · ${silver(m.units)} unidades · venta en ${c.saleDays} ${c.saleDays===1?'día':'días'} · máx. ${pct(c.maxSharePct)} del volumen`,`<div class="actions"><button type="button" class="btn" id="bm-copy">Copiar lista de compra</button><button type="button" class="btn" id="bm-csv">CSV</button><button type="button" class="btn" id="bm-business">Registrar en Mi negocio</button></div>`)}`;
  if(st.demandInfo)h+=`<p class="hint">${escape(st.demandInfo)}</p>`;
  h+=`<div class="metric-strip"><div class="metric"><small>Inversión</small><strong>${small(m.capital)}</strong></div><div class="metric"><small>Venta neta</small><strong>${small(m.revenue)}</strong></div><div class="metric"><small>Ganancia ${m.assumed?'(con supuestos)':'estimada'}</small><strong class="${m.profit>=0?'green':'red'}">${m.profit>=0?'+':''}${small(m.profit)}</strong></div><div class="metric"><small>ROI · sin usar</small><strong>${compact(roi)} % · ${small(m.left)}</strong></div></div>`;
  if(!r.rows.length)h+=`<div class="warning">No hay artículos que cumplan las reglas. Revisa los motivos abajo: baja el mínimo de ventas/día, sube el % del volumen o permite más tiers.</div>`;
  else{
   h+=`<div class="section-heading"><h3>1 · Fabricar</h3><span>lo más caro primero · ${c.bonusCity?'en la ciudad de bono':'sin bono de ciudad'}</span></div><div class="result-table"><table><thead><tr><th>Artículo</th><th class="numeric">Unidades</th><th class="numeric">Por día</th><th class="numeric">Paga el MN</th><th class="numeric">Ventas/día</th><th class="numeric">% del plazo</th><th class="numeric">Capital</th><th class="numeric">Ganancia</th><th class="numeric">Máx. material</th><th class="numeric">Con Focus</th></tr></thead><tbody>${r.rows.map(x=>`<tr><td>${itemWithCopy(x.id)}<small class="rank-sub">${escape(x.priceSource)} · costo ${escape(x.costSource)}${x.relValue<.999?` · ${Math.round(x.relValue*100)} % del mejor valor por material`:''}</small></td><td class="numeric"><strong>${silver(x.units)}</strong></td><td class="numeric">${silver(x.perDay)}</td><td class="numeric">${silver(x.price)}</td><td class="numeric">${compact(x.dailyUnits)}</td><td class="numeric">${pct(x.sharePct)}</td><td class="numeric">${silver(x.capital)}</td><td class="numeric ${x.profit>=0?'green':'red'}">${x.profit>=0?'+':''}${silver(x.profit)}<small class="rank-sub">${compact(x.margin*100)} %</small></td><td class="numeric">${silver(x.maxMatNoFocus)}</td><td class="numeric">${silver(x.maxMatFocus)}</td></tr>`).join('')}</tbody></table></div>
   <p class="hint">«Máx. material» = precio medio por material (lingote, cuero, tela, tablas) al que ese artículo aún deja el ${pct(c.targetMarginPct)} de margen tras el impuesto del ${c.tax} %.</p>`;
   h+=`<div class="section-heading"><h3>2 · Órdenes de compra</h3><span>cantidad neta del retorno (${compact(r.rows[0].rr*100)} % sin Focus) crafteando en tandas · escribe tu precio para recalcular</span></div><div class="result-table"><table><thead><tr><th>Material</th><th class="numeric">Comprar</th><th class="numeric">Receta total</th><th class="numeric">Precio máx. de la orden</th><th class="numeric">AODP</th><th class="numeric">Tu precio</th><th class="numeric">Costo máx.</th></tr></thead><tbody>${r.shopping.map(s=>`<tr class="${s.overMax?'row-risky':''}"><td>${itemWithCopy(s.id)}${s.artifact?'<small class="rank-sub">artefacto · no tiene retorno</small>':''}</td><td class="numeric"><strong>${silver(s.buyUnits)}</strong></td><td class="numeric">${silver(s.recipeUnits)}</td><td class="numeric">${s.maxPrice!=null?silver(s.maxPrice):'—'}</td><td class="numeric ${s.overMax?'red':''}">${s.quote!=null&&s.quoteSource!=='tuyo'?silver(s.quote)+`<small class="rank-sub">${escape(s.quoteSource)}</small>`:'—'}</td><td class="numeric"><input type="number" min="0" step="1" data-bm-mat-price="${escape(s.id)}" value="${c.matPrices[s.id]??''}" placeholder="—" style="max-width:110px"></td><td class="numeric">${s.maxCost!=null?silver(s.maxCost):'—'}</td></tr>`).join('')}</tbody></table></div>`;
   h+=`<div class="section-heading"><h3>3 · Vender</h3><span>al instante a las órdenes del Mercado Negro (solo impuesto)</span></div><ul class="bm-tips">
    <li>Vende en ${c.saleDays} ${c.saleDays===1?'tanda':'tandas'}, una por día (columna «Por día»), empezando por lo más caro.</li>
    <li>Antes de cada tanda mira la orden de compra del Mercado Negro: si un artículo bajó más de un 10–15 % de su precio, guárdalo un día y vende otro.</li>
    <li>Fila en rojo en la lista de compra = el precio de AODP supera el máximo: compra con orden por debajo o quita ese artículo.</li></ul>`;
  }
  if(r.warnings.length)h+=`<div class="warning">${r.warnings.map(escape).join(' · ')}</div>`;
  if(r.rejected.length){const counts=new Map();for(const x of r.rejected){const k=x.reason.replace(/[\d.,]+/g,'#').replace(/que .*\(/,'que … (');counts.set(k,(counts.get(k)||0)+1);}
   h+=`<details class="plan-diagnostics" ${r.rows.length?'':'open'}><summary>¿Por qué quedaron fuera algunos artículos? · ${r.rejected.length}</summary><div class="diagnostic-list">${r.rejected.slice(0,80).map(x=>`<div class="diagnostic-item">${ctx.img(x.id)}<div><strong>${escape(ctx.name(x.id))}</strong><small>${escape(x.id)}</small><small>${escape(x.reason)}</small></div></div>`).join('')}</div></details>`;}
  h+=`<p class="hint">Estimación: la venta usa ${c.source==='aodp'?'la puja actual del Mercado Negro (o la media de 7 días −3 %)':'el precio medio de la tabla pegada'}. Comprueba las órdenes del Mercado Negro antes de fabricar. No se garantiza la venta.</p></section>`;
  return h;}

 function compute(){if(!st.demand){st.result=null;return;}
  st.result=planBlackMarket({demand:st.demand,recipes:ctx.recipes(),quotes:st.quotes,config:st.cfg,names:ctx.names()});
  if(st.quoteWarning)st.result.warnings.push(st.quoteWarning);}

 async function run(){if(st.busy)return;
  const recipes=ctx.recipes();if(Object.keys(recipes).length<50){toast('El catálogo de recetas aún se está cargando. Prueba en unos segundos.');return;}
  st.busy=true;st.error=null;st.quoteWarning=null;rerender();
  try{const c=st.cfg;
   if(c.source==='paste'){
    const p=parseBlackMarketTable(st.paste);if(!p.rows.length)throw Error('No se encontraron artículos en la tabla. Copia la tabla completa, con los IDs (T4_MAIN_SWORD…) y las cifras.');
    st.demand=p.rows;st.demandInfo=`${p.rows.length} artículos de la tabla pegada${p.skipped.length?` · ${p.skipped.length} ignorados`:''}.`;
   }else{
    if(!c.branches.length)throw Error('Elige al menos una rama.');
    const tests=groups.flatMap(g=>g.items).filter(i=>c.branches.includes(i.key));
    const ids=Object.keys(recipes).filter(id=>{const v=variant(id);return v&&v.tier>=4&&blackMarketEligible(id)&&tests.some(t=>t.test(id));});
    if(!ids.length)throw Error('Las ramas elegidas no tienen recetas en el catálogo.');
    progress('bm-progress',`Ventas del Mercado Negro (${ids.length} artículos)…`,8);
    const hist=await marketFetch('history',ids,{cities:['Black Market'],qualities:'1,2,3,4,5',days:7,onProgress:p=>progress('bm-progress',`Ventas del Mercado Negro: lote ${p.finished}/${p.total}`,8+45*p.finished/p.total)});
    progress('bm-progress','Pujas actuales del Mercado Negro…',55);
    const bids=await marketFetch('prices',ids,{cities:['Black Market'],qualities:'1',onProgress:p=>progress('bm-progress',`Pujas del Mercado Negro: lote ${p.finished}/${p.total}`,55+15*p.finished/p.total)});
    st.demand=demandFromAodp(summarizeHistory(hist.rows,{days:7}),quoteMap(bids.rows));
    st.demandInfo=`${st.demand.length} artículos con ventas en el Mercado Negro (AODP, 7 días)${hist.errors.length?' · historial parcial':''}.`;
    if(!st.demand.length)throw Error('AODP no tiene ventas del Mercado Negro para estas ramas. Prueba otras ramas o pega una tabla de ventas.');
   }
   st.quotes=null;
   if(c.useAodpMaterials){
    const mats=new Set();for(const d of st.demand){if(d.dailyUnits<c.minDailyUnits)continue;for(const m of recipes[d.id]?.materials||[])if(m.id)mats.add(m.id);}
    if(mats.size){progress('bm-progress',`Precios de ${mats.size} materiales en las ciudades Royal…`,75);
     try{const pr=await marketFetch('prices',[...mats],{cities:ROYALS,qualities:'1',onProgress:p=>progress('bm-progress',`Materiales: lote ${p.finished}/${p.total}`,75+20*p.finished/p.total)});
      st.quotes=quoteMap(pr.rows);if(pr.errors.length)st.quoteWarning='Algunos precios de materiales no se pudieron leer de AODP.';}
     catch(e){st.quoteWarning='Sin precios de materiales de AODP ('+e.message+'): se usa el margen supuesto.';}}
   }
   compute();
   toast(st.result.rows.length?`Plan listo: ${st.result.rows.length} artículos, ${small(st.result.summary.capital)} de inversión.`:'Ningún artículo cumple las reglas con esta configuración.');
  }catch(e){st.error=e.message;st.result=null;toast(e.message);}
  finally{st.busy=false;rerender();requestAnimationFrame(()=>document.getElementById('bm-results')?.scrollIntoView({block:'start',behavior:'smooth'}));}}

 function shoppingText(){const r=st.result;if(!r?.shopping.length)return '';
  return 'ÓRDENES DE COMPRA · PLAN MERCADO NEGRO · WEST\n'+r.shopping.map(s=>`${ctx.name(s.id)} (${s.id}) x${silver(s.buyUnits)}${s.maxPrice!=null?` · máx. ${silver(s.maxPrice)}/u.`:''}`).join('\n')+
   '\n\nFABRICAR\n'+r.rows.map(x=>`${x.name} (${x.id}) x${x.units} · ${x.perDay}/día`).join('\n');}
 function exportCsv(){const r=st.result;if(!r?.rows.length)return toast('No hay un plan para exportar.');
  const esc=x=>'"'+String(x??'').replaceAll('"','""')+'"';
  const rows=[['tipo','id','nombre','unidades','por_dia','precio_mn','ventas_dia','pct_plazo','capital','ganancia','max_material','max_material_focus'],
   ...r.rows.map(x=>['fabricar',x.id,x.name,x.units,x.perDay,Math.round(x.price),x.dailyUnits.toFixed(1),x.sharePct.toFixed(1),Math.round(x.capital),Math.round(x.profit),Math.round(x.maxMatNoFocus),Math.round(x.maxMatFocus)]),
   ...r.shopping.map(s=>['comprar',s.id,ctx.name(s.id),s.buyUnits,'','','','','',s.maxCost!=null?Math.round(s.maxCost):'','',s.maxPrice!=null?Math.round(s.maxPrice):''])];
  const url=URL.createObjectURL(new Blob(['﻿'+rows.map(r=>r.map(esc).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}));
  const a=document.createElement('a');a.href=url;a.download='gildem-plan-mercado-negro.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),500);}
 // El evento change puede llegar desde un blur: se redibuja en el siguiente ciclo para no borrar el nodo en uso.
 const later=()=>setTimeout(rerender,0);
 function setCfg(patch,{recompute=true}={}){st.cfg=bmSettings({...st.cfg,...patch});save();if(recompute)compute();later();}
 return {
  render:()=>`<div id="bm-root">${hero('bm')}${sourcePanel()}${configPanel()}${resultPanel()}</div>`,
  saveState:()=>({cfg:st.cfg,paste:st.paste.slice(0,MAX_PASTE)}),
  onClick(b){
   if(b.id==='bm-run'){void run();return true;}
   if(b.id==='bm-csv'){exportCsv();return true;}
   if(b.id==='bm-business'){try{if(!st.result?.rows.length)throw Error('No hay un plan para registrar.');ctx.addToBusiness(createPortfolio({title:`Plan Mercado Negro · ${new Date().toLocaleDateString('es-ES')}`,source:'plan-mercado-negro',lots:lotsFromBmPlan(st.result)}));}catch(e){toast(e.message);}return true;}
   if(b.id==='bm-copy'){const t=shoppingText();if(!t){toast('No hay lista de compra.');return true;}
    if(navigator.clipboard?.writeText)navigator.clipboard.writeText(t).then(()=>toast('Lista de compra copiada.')).catch(()=>toast('No se pudo copiar la lista.'));else toast('Portapapeles no disponible: usa CSV.');return true;}
   return false;},
  onChange(x){
   if(x.id==='bm-paste'){st.paste=String(x.value||'').slice(0,MAX_PASTE);if(st.cfg.source==='paste'){st.demand=null;st.result=null;}save();later();return true;}
   if(x.dataset.bmMatPrice){const id=x.dataset.bmMatPrice,v=Number(x.value),mp={...st.cfg.matPrices};if(v>0)mp[id]=v;else delete mp[id];setCfg({matPrices:mp});return true;}
   if(x.dataset.bmBranch){const set=new Set(st.cfg.branches);x.checked?set.add(x.dataset.bmBranch):set.delete(x.dataset.bmBranch);st.demand=null;st.result=null;setCfg({branches:[...set]},{recompute:false});return true;}
   if(x.dataset.bmList){const f=x.dataset.bmList,v=Number(x.dataset.value),set=new Set(st.cfg[f]);x.checked?set.add(v):set.delete(v);
    if(!set.size){toast('Deja al menos una opción marcada.');later();return true;}setCfg({[f]:[...set].sort((a,b)=>a-b)});return true;}
   if(x.dataset.bmBudget){setCfg({budget:Number(x.dataset.bmBudget)});return true;}
   if(x.dataset.bm){const k=x.dataset.bm;let v=x.type==='checkbox'?x.checked:x.value;
    if(k==='source'){if(!x.checked)return true;st.demand=null;st.result=null;setCfg({source:v},{recompute:false});return true;}
    if(!['premium','bonusCity','excludeArtifacts','useAodpMaterials'].includes(k))v=Number(v);
    if(k==='useAodpMaterials'&&v&&st.demand&&!st.quotes)toast('Pulsa «Generar» para leer los precios de AODP.');
    setCfg({[k]:v});return true;}
   return false;}
 };
}
