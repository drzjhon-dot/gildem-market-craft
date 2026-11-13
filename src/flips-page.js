// Pestaña «Flips Mercado Negro» (v4.1): compra en Caerleon y vende al instante al Mercado Negro.
import {blackMarketFlips,FLIP_DEFAULTS} from './flips.js';
import {GROUPS,variant} from './branches.js';
import {blackMarketEligible} from './recipe-extractor.js';
import {premiumTax} from './economics.js';
import {createPortfolio,makeLot} from './business-store.js';

const ROYALS=['Bridgewatch','Fort Sterling','Lymhurst','Martlock','Thetford'];
export function createFlipsPage(ctx){
 const {escape,silver,small,compact,itemWithCopy,heading,hero,toast,progress,marketFetch,summarizeHistory,quoteMap,save,rerender}=ctx;
 const saved=ctx.persisted?.flips||{};
 const st={cfg:{branches:['sword','axe','bow','chests_plate','chests_leather','chests_cloth'],tiers:[4,5,6,7,8],enchants:[0,1,2,3],royals:false,premium:true,maxAgeHours:FLIP_DEFAULTS.maxAgeHours,minMarginPct:FLIP_DEFAULTS.minMarginPct,minProfit:FLIP_DEFAULTS.minProfit,sharePct:FLIP_DEFAULTS.sharePct,transportPct:FLIP_DEFAULTS.transportPct,...(saved.cfg||{})},quotes:null,demand:null,ids:null,busy:false,error:null,fetchedAt:null};
 const groups=GROUPS.filter(g=>['weapons','armor','offhand','accessories'].includes(g.key));
 const later=()=>setTimeout(rerender,0);
 const setCfg=(p,refetch=false)=>{st.cfg={...st.cfg,...p};if(refetch){st.quotes=null;}save();later();};
 const chips=(list,field,label)=>`<div class="pill-choices">${list.map(x=>{const on=st.cfg[field].includes(x);return `<label class="toggle-chip ${on?'active':''}"><input type="checkbox" data-fl-list="${field}" data-value="${x}" ${on?'checked':''}>${escape(label(x))}</label>`;}).join('')}</div>`;
 const result=()=>st.quotes?blackMarketFlips({ids:st.ids,quotes:st.quotes,demand:st.demand,config:{buyCities:st.cfg.royals?['Caerleon',...ROYALS]:['Caerleon'],tax:premiumTax(st.cfg.premium),maxAgeHours:st.cfg.maxAgeHours,minMarginPct:st.cfg.minMarginPct,minProfit:st.cfg.minProfit,sharePct:st.cfg.sharePct,transportPct:st.cfg.transportPct}}):null;

 function configPanel(){const c=st.cfg;
  return `<section class="panel">${heading('Flips al Mercado Negro','El Mercado Negro está en Caerleon: compras en su mercado y vendes al instante a la orden de compra del MN, sin transporte.')}
  <div class="config-grid">
   <div class="config-section config-half"><h3>Ramas</h3>${groups.map(g=>`<details class="bm-branch-group" ${g.items.some(i=>c.branches.includes(i.key))?'open':''}><summary>${escape(g.icon||'')} ${escape(g.title)} <small>${g.items.filter(i=>c.branches.includes(i.key)).length}/${g.items.length}</small></summary><div class="pill-choices">${g.items.map(i=>{const on=c.branches.includes(i.key);return `<label class="toggle-chip ${on?'active':''}"><input type="checkbox" data-fl-branch="${escape(i.key)}" ${on?'checked':''}>${escape(i.label)}</label>`;}).join('')}</div></details>`).join('')}</div>
   <div class="config-section"><h3>Tiers</h3>${chips([4,5,6,7,8],'tiers',x=>'T'+x)}<h3 style="margin-top:10px">Encantamiento</h3>${chips([0,1,2,3],'enchants',x=>'.'+x)}</div>
   <div class="config-section"><h3>Filtros</h3><div class="multifield"><label>Margen mín. %<input data-fl="minMarginPct" type="number" min="0" max="300" value="${c.minMarginPct}"></label><label>Beneficio mín./u.<input data-fl="minProfit" type="number" min="0" step="500" value="${c.minProfit}"></label></div>
    <div class="multifield"><label>Edad máx. del precio (h)<input data-fl="maxAgeHours" type="number" min="1" max="48" value="${c.maxAgeHours}"></label><label>% máx. de ventas/día<input data-fl="sharePct" type="number" min="1" max="50" value="${c.sharePct}"></label></div>
    <label class="checkline"><input type="checkbox" data-fl="premium" ${c.premium?'checked':''}> Premium (impuesto ${premiumTax(c.premium)} %)</label>
    <label class="checkline"><input type="checkbox" data-fl="royals" ${c.royals?'checked':''}> Comprar también en ciudades Royal</label>
    ${c.royals?`<div class="multifield"><label>Transporte a Caerleon %<input data-fl="transportPct" type="number" min="0" max="50" step="0.5" value="${c.transportPct}"></label></div><p class="red">Llevar objetos a Caerleon cruza zona roja: puedes perderlos.</p>`:''}</div>
  </div><div class="toolbar"><p class="muted">Precios con edad ≤ ${c.maxAgeHours} h · los flips desaparecen rápido: compruébalos en el juego.</p><button type="button" class="btn btn-gold" id="fl-run" ${st.busy?'disabled':''}>${st.busy?'Buscando…':'Buscar flips'}</button></div><div id="fl-progress"></div></section>`;}

 function resultPanel(){if(st.error)return `<section class="panel"><div class="warning">${escape(st.error)}</div></section>`;const r=result();if(!r)return '';
  const top=r.rows.slice(0,120),tot=r.rows.reduce((a,x)=>({profit:a.profit+x.totalProfit,capital:a.capital+x.capital}),{profit:0,capital:0});
  return `<section class="panel" id="fl-results">${heading('Flips encontrados',`${r.rows.length} con margen ≥ ${st.cfg.minMarginPct} % · datos de ${st.fetchedAt?new Date(st.fetchedAt).toLocaleTimeString('es-ES'):'—'}`,`<div class="actions"><button type="button" class="btn btn-small" id="fl-refresh">Actualizar precios</button>${r.rows.some(x=>x.units)?'<button type="button" class="btn btn-small" id="fl-business">Registrar en Mi negocio</button>':''}</div>`)}
  ${r.rows.length?`<div class="metric-strip"><div class="metric"><small>Capital para las unidades sugeridas</small><strong>${small(tot.capital)}</strong></div><div class="metric"><small>Beneficio si se venden</small><strong class="green">+${small(tot.profit)}</strong></div><div class="metric"><small>Sin puja del MN</small><strong>${silver(r.skipped.noBid)}</strong></div><div class="metric"><small>Sin margen</small><strong>${silver(r.skipped.noMargin)}</strong></div></div>
  <div class="result-table"><table><thead><tr><th>Objeto</th><th>Comprar</th><th class="numeric">Precio</th><th class="numeric">Paga el MN</th><th class="numeric">Beneficio/u.</th><th class="numeric">Con orden de compra</th><th class="numeric">Ventas MN/día</th><th class="numeric">Unidades</th><th class="numeric">Total</th></tr></thead><tbody>${top.map(x=>`<tr class="${x.risky?'row-risky':''}"><td>${itemWithCopy(x.id)}</td><td>${escape(x.city)}${x.risky?'<small class="rank-sub red">transporte por zona roja</small>':''}<small class="rank-sub">${x.mode==='instant'?'compra al instante':'orden de compra'}</small></td><td class="numeric">${silver(x.buy)}<small class="rank-sub">hace ${compact(x.buyAgeH)} h</small></td><td class="numeric">${silver(x.sell)}<small class="rank-sub">hace ${compact(x.sellAgeH)} h</small></td><td class="numeric green">+${silver(x.profit)}<small class="rank-sub">${compact(x.margin*100)} %</small></td><td class="numeric">${x.order&&x.mode==='instant'?`${x.order.profit>=0?'+':''}${silver(x.order.profit)}<small class="rank-sub">orden a ${silver(x.order.buy)}</small>`:'—'}</td><td class="numeric">${compact(x.daily)}</td><td class="numeric"><strong>${silver(x.units)}</strong></td><td class="numeric">${x.units?'+'+small(x.totalProfit):'—'}</td></tr>`).join('')}</tbody></table></div>`:'<div class="warning">No hay flips con estos filtros ahora mismo. Sube la edad máxima del precio o baja el margen.</div>'}
  <p class="hint">Compra al instante = la orden de venta más barata de Caerleon. «Con orden de compra» = pones tu orden 1 silver por encima de la mejor (pagas la tasa de 2,5 %); es más barato pero tarda. El MN solo cobra el impuesto de venta. Unidades = ${st.cfg.sharePct} % de lo que el MN compra al día.</p></section>`;}

 async function run(force=false){if(st.busy)return;st.busy=true;st.error=null;rerender();
  try{const c=st.cfg;const tests=groups.flatMap(g=>g.items).filter(i=>c.branches.includes(i.key));if(!tests.length)throw Error('Elige al menos una rama.');
   const recipes=ctx.recipes();const ids=Object.keys(recipes).filter(id=>{const v=variant(id);return v&&c.tiers.includes(v.tier)&&c.enchants.includes(v.ench)&&blackMarketEligible(id)&&tests.some(t=>t.test(id));});
   if(!ids.length)throw Error('No hay objetos para esas ramas (¿el catálogo aún carga?).');
   const cities=['Black Market','Caerleon',...(c.royals?ROYALS:[])];
   progress('fl-progress',`Precios de ${ids.length} objetos…`,5);
   const p=await marketFetch('prices',ids,{cities,qualities:'1',force,onProgress:x=>progress('fl-progress',`Precios: lote ${x.finished}/${x.total}`,5+60*x.finished/x.total)});
   st.quotes=quoteMap(p.rows);st.ids=ids;st.fetchedAt=Date.now();
   const pre=blackMarketFlips({ids,quotes:st.quotes,config:{buyCities:c.royals?['Caerleon',...ROYALS]:['Caerleon'],tax:premiumTax(c.premium),maxAgeHours:c.maxAgeHours,minMarginPct:c.minMarginPct,minProfit:c.minProfit}});
   const hids=pre.rows.map(x=>x.id);st.demand=new Map();
   if(hids.length){progress('fl-progress',`Ventas del MN de ${hids.length} candidatos…`,70);
    const h=await marketFetch('history',hids,{cities:['Black Market'],qualities:'1,2,3,4,5',days:7}).catch(()=>({rows:[]}));
    st.demand=new Map(summarizeHistory(h.rows,{days:7}).filter(x=>x.city==='Black Market').map(x=>[x.id,x.averageDailyUnits]));}
   const r=result();toast(r.rows.length?`${r.rows.length} flips al Mercado Negro.`:'Sin flips con estos filtros.');}
  catch(e){st.error=e.message;}finally{st.busy=false;rerender();}}
 return {
  render:()=>`<div id="flips-root">${hero('flips')}${configPanel()}${resultPanel()}</div>`,
  saveState:()=>({cfg:st.cfg}),
  onClick(b){if(b.id==='fl-run'){void run(false);return true;}if(b.id==='fl-refresh'){void run(true);return true;}
   if(b.id==='fl-business'){try{const rows=result().rows.filter(x=>x.units>0);ctx.addToBusiness(createPortfolio({title:'Flips al Mercado Negro',source:'flips',lots:rows.map((x,i)=>makeLot({id:x.id,market:'Black Market',units:x.units,unitCost:x.cost,expectedPrice:x.sell,tax:premiumTax(st.cfg.premium),listingFee:0,costSource:'compra en '+x.city},i))}));}catch(e){toast(e.message);}return true;}
   return false;},
  onChange(x){
   if(x.dataset.flBranch){const s=new Set(st.cfg.branches);x.checked?s.add(x.dataset.flBranch):s.delete(x.dataset.flBranch);setCfg({branches:[...s]},true);return true;}
   if(x.dataset.flList){const f=x.dataset.flList,v=Number(x.dataset.value),s=new Set(st.cfg[f]);x.checked?s.add(v):s.delete(v);if(!s.size){toast('Deja al menos una opción.');later();return true;}setCfg({[f]:[...s].sort((a,b)=>a-b)},true);return true;}
   if(x.dataset.fl){const k=x.dataset.fl;const v=x.type==='checkbox'?x.checked:Math.max(0,Number(x.value)||0);setCfg({[k]:v},k==='royals');return true;}
   return false;}
 };
}
