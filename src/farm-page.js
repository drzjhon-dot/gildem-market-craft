// Pestaña «Isla» (v4.1): cultivos y hierbas, animales y monturas, y cocina/alquimia con tu cosecha.
import {farmRows,SEEDS_PER_PLOT} from './farm.js';
import {animalRows,kitchenRows,ANIMALS_PER_PLOT} from './island.js';
import {loadGameExtra} from './enchant-page.js';
import {premiumTax} from './economics.js';

const CITIES=['Bridgewatch','Fort Sterling','Lymhurst','Martlock','Thetford','Caerleon','Brecilien'];
const VIEWS={crops:'Cultivos y hierbas',animals:'Animales y monturas',kitchen:'Cocina y alquimia'};
const RETURNS=[[15.2,'15,2 % · ciudad sin bono'],[24.8,'24,8 % · ciudad con bono'],[43.5,'43,5 % · con Focus'],[47.9,'47,9 % · bono + Focus']];
export function createFarmPage(ctx){
 const {escape,silver,small,compact,itemWithCopy,heading,hero,toast,marketFetch,quoteMap,save,rerender,name}=ctx;
 const saved=ctx.persisted?.farm||{};
 const st={cfg:{view:'crops',plots:3,premium:true,focus:true,sellCity:'Lymhurst',sellMode:'order',kinds:['farm','herbgarden'],focusSeedReturn:100,kitchenKinds:['food','potion'],returnPct:15.2,...(saved.cfg||{})},
  quotes:new Map(),fetched:new Set(),extra:null,busy:false,error:null};
 const later=()=>setTimeout(rerender,0);
 const tax=()=>premiumTax(st.cfg.premium);
 const common=()=>({premium:st.cfg.premium,plots:st.cfg.plots,sellCity:st.cfg.sellCity,sellMode:st.cfg.sellMode,tax:tax()});
 function result(){const e=st.extra;if(!e||!st.fetched.has(st.cfg.view))return null;const c=st.cfg;
  if(c.view==='crops')return farmRows({farm:e.farm,quotes:st.quotes,config:{...common(),kinds:c.kinds,focusSeedReturn:c.focusSeedReturn/100}});
  if(c.view==='animals')return animalRows({animals:e.animals,nutrition:e.nutrition,quotes:st.quotes,config:{...common(),focus:c.focus}});
  return kitchenRows({kitchen:e.kitchen,quotes:st.quotes,config:{...common(),kinds:c.kitchenKinds,returnPct:c.returnPct}});}
 function idsFor(view,e){const s=new Set();
  if(view==='crops')for(const f of e.farm){s.add(f.seed);s.add(f.crop);}
  if(view==='animals'){for(const a of e.animals){if(!['plants','meat'].includes(a.foodCategory))continue;s.add(a.baby);s.add(a.grown);if(a.product)s.add(a.product.id);for(const u of a.uses||[]){s.add(u.id);for(const m of u.mats||[])s.add(m.id);}}for(const id of Object.keys(e.nutrition))s.add(id);}
  if(view==='kitchen')for(const k of e.kitchen){s.add(k.id);for(const m of k.mats)s.add(m.id);}
  return [...s];}

 function configPanel(){const c=st.cfg;
  return `<section class="panel">${heading('Tu isla','Elige qué quieres calcular. Datos del juego y precios de AODP West.')}
  <div class="pill-choices island-tabs">${Object.entries(VIEWS).map(([k,v])=>`<label class="toggle-chip ${c.view===k?'active':''}"><input type="radio" name="isle-view" data-isle-view="${k}" ${c.view===k?'checked':''}>${escape(v)}</label>`).join('')}</div>
  <div class="config-grid">
   ${c.view!=='kitchen'?`<div class="config-section"><h3>Parcelas</h3><div class="multifield"><label>Parcelas (${c.view==='crops'?SEEDS_PER_PLOT+' semillas':ANIMALS_PER_PLOT+' animales'} c/u)<input data-farm="plots" type="number" min="1" max="60" value="${c.plots}"></label></div>
    <label class="checkline"><input type="checkbox" data-farm="premium" ${c.premium?'checked':''}> Premium (${c.view==='crops'?'+100 % de cosecha':'crecen el doble de rápido'}, impuesto ${tax()} %)</label>
    ${c.view==='animals'?`<label class="checkline"><input type="checkbox" data-farm="focus" ${c.focus?'checked':''}> Cuidar con Focus (más crías)</label>`:''}</div>`:''}
   ${c.view==='crops'?`<div class="config-section"><h3>Qué plantar</h3><label class="checkline"><input type="checkbox" data-farm-kind="farm" ${c.kinds.includes('farm')?'checked':''}> Cultivos (granja)</label><label class="checkline"><input type="checkbox" data-farm-kind="herbgarden" ${c.kinds.includes('herbgarden')?'checked':''}> Hierbas (jardín)</label>
    <div class="multifield"><label>Semilla devuelta con Focus %<input data-farm="focusSeedReturn" type="number" min="0" max="100" value="${c.focusSeedReturn}"></label></div></div>`:''}
   ${c.view==='kitchen'?`<div class="config-section"><h3>Qué cocinar</h3><label class="checkline"><input type="checkbox" data-kitchen-kind="food" ${c.kitchenKinds.includes('food')?'checked':''}> Comida</label><label class="checkline"><input type="checkbox" data-kitchen-kind="potion" ${c.kitchenKinds.includes('potion')?'checked':''}> Pociones</label>
    <select data-farm="returnPct">${RETURNS.map(([v,l])=>`<option value="${v}" ${Number(c.returnPct)===v?'selected':''}>Retorno ${escape(l)}</option>`).join('')}</select>
    <label class="checkline"><input type="checkbox" data-farm="premium" ${c.premium?'checked':''}> Premium (impuesto ${tax()} %)</label></div>`:''}
   <div class="config-section"><h3>Venta</h3><select data-farm="sellCity">${CITIES.map(x=>`<option ${x===c.sellCity?'selected':''}>${escape(x)}</option>`).join('')}</select>
    <select data-farm="sellMode"><option value="order" ${c.sellMode==='order'?'selected':''}>Con orden de venta (impuesto + 2,5 %)</option><option value="instant" ${c.sellMode==='instant'?'selected':''}>Al instante a la orden de compra</option></select></div>
  </div><div class="toolbar"><p class="muted">Compras: lo más barato de Caerleon, Brecilien y ciudades Royal (precios ≤ 48 h)</p><button type="button" class="btn btn-gold" id="farm-run" ${st.busy?'disabled':''}>${st.busy?'Consultando…':'Calcular '+VIEWS[c.view].toLowerCase()}</button></div></section>`;}

 const signed=v=>`<span class="${v>=0?'green':'red'}">${v>=0?'+':''}${small(v)}</span>`;
 function cropsTable(r){const c=st.cfg;
  return `<div class="result-table"><table><thead><tr><th>Cosecha</th><th class="numeric">Semilla</th><th class="numeric">Precio venta</th><th class="numeric">Cosecha</th><th class="numeric">Retorno semilla</th><th class="numeric">Sin Focus</th><th class="numeric">Con Focus</th><th class="numeric">Silver por Focus</th><th class="numeric">Para empezar</th></tr></thead><tbody>${r.rows.map(x=>`<tr><td>${itemWithCopy(x.crop)}<small class="rank-sub">T${x.tier} · ${x.kind==='farm'?'cultivo':'hierba'} · ${x.growHours} h</small></td><td class="numeric">${silver(x.seedPrice)}<small class="rank-sub">${escape(x.seedCity)}</small></td><td class="numeric">${silver(x.cropPrice)}</td><td class="numeric">${compact(x.harvest*c.plots)}</td><td class="numeric">${compact(x.seedReturn*100)} %</td><td class="numeric">${signed(x.profitNoFocus)}</td><td class="numeric"><strong>${signed(x.profitFocus)}</strong><small class="rank-sub">${silver(x.focusUsed)} Focus</small></td><td class="numeric">${compact(x.silverPerFocus)}</td><td class="numeric">${small(x.startCost)}</td></tr>`).join('')}</tbody></table></div>
  <p class="hint">Por cosecha (~22 h). Cosecha media 4,5 por semilla (3–6), el doble con Premium. Sin Focus se recompra la semilla que no vuelve. «Silver por Focus» compara regar contra no regar. No incluye lombrices.</p>`;}
 function animalsTable(r){const c=st.cfg;
  return `<div class="result-table"><table><thead><tr><th>Animal</th><th class="numeric">Cría</th><th>Comida</th><th>Mejor salida</th><th class="numeric">Por animal</th><th class="numeric">Por parcela</th><th class="numeric">Por día</th><th class="numeric">Días</th><th class="numeric">Para empezar</th></tr></thead><tbody>${r.rows.map(x=>`<tr><td>${itemWithCopy(x.baby)}<small class="rank-sub">cría vuelve ${compact(x.back*100)} %${x.focusUsed?` · ${silver(x.focusUsed)} Focus`:''}</small></td><td class="numeric">${silver(x.babyPrice)}<small class="rank-sub">${escape(x.babyCity)}</small></td><td>${silver(Math.ceil(x.nutritionNeeded/x.food.nutritionPerItem))} × ${escape(name(x.food.id))}<small class="rank-sub">${small(x.foodCost)} por animal</small></td><td>${escape(x.best.label)}<small class="rank-sub">${escape(name(x.best.id))} · ${silver(x.best.price)}${x.best.mats?` − material ${small(x.best.mats)}`:''}</small>${x.product?`<small class="rank-sub">adulto: ${compact(x.product.amount)} ${escape(name(x.product.id))}/día → ${x.product.perAdultDay>=0?'+':''}${small(x.product.perAdultDay)}</small>`:''}</td><td class="numeric">${signed(x.perAnimal)}</td><td class="numeric">${signed(x.perPlot)}</td><td class="numeric"><strong>${signed(x.perPlotDay)}</strong></td><td class="numeric">${compact(x.days)}</td><td class="numeric">${small(x.startCost)}</td></tr>`).join('')}</tbody></table></div>
  <p class="hint">${ANIMALS_PER_PLOT} animales por parcela de pasto. Coste = cría que no vuelve + comida de todo el crecimiento (la comida más barata por nutrición; el favorito rinde el doble). Con Premium crecen el doble de rápido; la comida se cuenta igual (estimación prudente). Ensillar descuenta el cuero, tablas o metal de la montura. La cría con Focus es una estimación con el bono del juego.</p>`;}
 function kitchenTable(r){
  return `<div class="result-table"><table><thead><tr><th>Producto</th><th>Ingredientes</th><th class="numeric">Coste/craft</th><th class="numeric">Venta</th><th class="numeric">Beneficio/craft</th><th class="numeric">Tu cosecha aquí</th></tr></thead><tbody>${r.rows.slice(0,100).map(x=>`<tr><td>${itemWithCopy(x.id)}<small class="rank-sub">${x.amount} por craft · ${x.kind==='potion'?'poción':'comida'}</small></td><td>${x.mats.map(m=>`<small class="rank-sub">${silver(m.count)} × ${escape(name(m.id))}${m.farm?' 🌱':''} · ${silver(m.price)}</small>`).join('')}</td><td class="numeric">${small(x.cost)}</td><td class="numeric">${silver(x.price)}<small class="rank-sub">×${x.amount} = ${small(x.revenue)}</small></td><td class="numeric"><strong>${signed(x.profit)}</strong><small class="rank-sub">${compact(x.margin*100)} %</small></td><td class="numeric">${x.upliftPct!=null?`<span class="${x.upliftPct>=0?'green':'red'}">${x.upliftPct>=0?'+':''}${compact(x.upliftPct)} %</span><small class="rank-sub">vs vender crudo</small>`:'—'}</td></tr>`).join('')}</tbody></table></div>
  <p class="hint">🌱 = producto de tu isla. «Tu cosecha aquí» compara lo que te pagan por tus cultivos, huevos, leche o carne al convertirlos en este producto frente a venderlos crudos en ${escape(st.cfg.sellCity)}. Retorno aplicado a todo menos los ingredientes raros. Antes de cocinar mucho, mira cuántas se venden en «Precios y alertas».</p>`;}
 function resultPanel(){if(st.error)return `<section class="panel"><div class="warning">${escape(st.error)}</div></section>`;const r=result();if(!r)return '';const c=st.cfg;
  const body=!r.rows.length?'<div class="warning">No hay precios recientes suficientes en AODP para este cálculo.</div>':c.view==='crops'?cropsTable(r):c.view==='animals'?animalsTable(r):kitchenTable(r);
  return `<section class="panel">${heading(VIEWS[c.view],`${c.view!=='kitchen'?`${c.plots} ${c.plots===1?'parcela':'parcelas'} · `:''}${c.premium?'Premium':'sin Premium'} · venta en ${escape(c.sellCity)}`)}${body}
  ${r.skipped.length?`<details class="plan-diagnostics"><summary>Sin calcular · ${r.skipped.length}</summary><div class="diagnostic-list">${r.skipped.slice(0,80).map(x=>`<div class="diagnostic-item"><div><strong>${escape(name(x.id))}</strong><small>${escape(x.reason)}</small></div></div>`).join('')}</div></details>`:''}</section>`;}

 async function run(){if(st.busy)return;st.busy=true;st.error=null;rerender();
  try{st.extra=await loadGameExtra();const view=st.cfg.view;const ids=idsFor(view,st.extra).filter(id=>![...st.quotes.keys()].some(k=>k.startsWith(id+'|')));
   if(ids.length){const p=await marketFetch('prices',ids,{cities:CITIES,qualities:'1'});for(const [k,v] of quoteMap(p.rows))st.quotes.set(k,v);}
   st.fetched.add(view);const r=result();
   toast(r?.rows.length?`Mejor opción: ${name(r.rows[0].crop||r.rows[0].baby||r.rows[0].id)}.`:'Sin precios suficientes.');}
  catch(e){st.error=e.message;}finally{st.busy=false;rerender();}}
 return {
  render:()=>`<div id="farm-root">${hero('farm')}${configPanel()}${resultPanel()}</div>`,
  saveState:()=>({cfg:st.cfg}),
  onClick(b){if(b.id==='farm-run'){void run();return true;}return false;},
  onChange(x){
   if(x.dataset.isleView){st.cfg={...st.cfg,view:x.dataset.isleView};save();later();return true;}
   if(x.dataset.farmKind||x.dataset.kitchenKind){const field=x.dataset.farmKind?'kinds':'kitchenKinds',v=x.dataset.farmKind||x.dataset.kitchenKind;const s=new Set(st.cfg[field]);x.checked?s.add(v):s.delete(v);if(!s.size){toast('Deja al menos un tipo.');later();return true;}st.cfg={...st.cfg,[field]:[...s]};save();later();return true;}
   if(x.dataset.farm){const k=x.dataset.farm;let v=x.type==='checkbox'?x.checked:x.value;
    if(k==='plots')v=Math.max(1,Math.min(60,Number(v)||1));if(k==='focusSeedReturn')v=Math.max(0,Math.min(100,Number(v)||0));if(k==='returnPct')v=Number(v)||15.2;
    st.cfg={...st.cfg,[k]:v};save();later();return true;}
   return false;}
 };
}
