// Pestaña «Encantar» (v4.0): compra barato, encanta con runas/almas/reliquias y vende al Mercado Negro.
import {enchantOpportunities,enchantQueryIds,ENCHANT_ES,ENCHANT_RES,tierOf} from './enchant.js';
import {GROUPS} from './branches.js';
import {premiumTax} from './economics.js';
import {createPortfolio,makeLot} from './business-store.js';

const BUY=['Caerleon','Bridgewatch','Fort Sterling','Lymhurst','Martlock','Thetford'];
const ES={'Black Market':'Mercado Negro'};
let gameExtra=null;
export async function loadGameExtra(){if(gameExtra)return gameExtra;const r=await fetch('/assets/data/game-extra.json',{headers:{Accept:'application/json'}});if(!r.ok)throw Error('No se pudieron cargar los datos del juego ('+r.status+').');gameExtra=await r.json();return gameExtra;}

export function createEnchantPage(ctx){
 const {escape,silver,small,compact,itemWithCopy,heading,hero,toast,progress,marketFetch,summarizeHistory,quoteMap,name,save,rerender}=ctx;
 const saved=ctx.persisted?.enchant||{};
 const st={cfg:{branches:['sword'],tiers:[4,5,6,7,8],premium:true,saleDays:3,sharePct:6,minMarginPct:10,...(saved.cfg||{})},result:null,busy:false,error:null};
 const groups=GROUPS.filter(g=>['weapons','armor','offhand','accessories'].includes(g.key));
 const later=()=>setTimeout(rerender,0);
 const setCfg=p=>{st.cfg={...st.cfg,...p};save();later();};

 function configPanel(){const c=st.cfg;
  return `<section class="panel">${heading('Encantar para el Mercado Negro','Compra el objeto en el nivel más barato, encántalo y véndelo al Mercado Negro. Cantidades de runas, almas y reliquias exactas del juego.')}
  <div class="config-grid">
   <div class="config-section config-half"><h3>Ramas</h3>${groups.map(g=>`<details class="bm-branch-group" ${g.items.some(i=>c.branches.includes(i.key))?'open':''}><summary>${escape(g.icon||'')} ${escape(g.title)} <small>${g.items.filter(i=>c.branches.includes(i.key)).length}/${g.items.length}</small></summary><div class="pill-choices">${g.items.map(i=>{const on=c.branches.includes(i.key);return `<label class="toggle-chip ${on?'active':''}"><input type="checkbox" data-en-branch="${escape(i.key)}" ${on?'checked':''}>${escape(i.label)}</label>`;}).join('')}</div></details>`).join('')}</div>
   <div class="config-section"><h3>Tiers</h3><div class="pill-choices">${[4,5,6,7,8].map(t=>{const on=c.tiers.includes(t);return `<label class="toggle-chip ${on?'active':''}"><input type="checkbox" data-en-tier="${t}" ${on?'checked':''}>T${t}</label>`;}).join('')}</div>
    <p>.0→.1 con ${ENCHANT_ES.RUNE}, .1→.2 con ${ENCHANT_ES.SOUL}, .2→.3 con ${ENCHANT_ES.RELIC}.</p></div>
   <div class="config-section"><h3>Venta</h3><div class="multifield"><label>Días para vender<input data-en="saleDays" type="number" min="1" max="14" value="${c.saleDays}"></label><label>% máx. del volumen<input data-en="sharePct" type="number" min="1" max="50" value="${c.sharePct}"></label></div>
    <div class="multifield"><label>Margen mínimo %<input data-en="minMarginPct" type="number" min="0" max="300" value="${c.minMarginPct}"></label></div>
    <label class="checkline"><input type="checkbox" data-en="premium" ${c.premium?'checked':''}> Premium (impuesto ${premiumTax(c.premium)} %)</label></div>
  </div><div class="toolbar"><p class="muted">Compra en Caerleon y ciudades Royal · venta instantánea al Mercado Negro · West</p><button type="button" class="btn btn-gold" id="en-run" ${st.busy?'disabled':''}>${st.busy?'Buscando…':'Buscar oportunidades'}</button></div><div id="en-progress"></div></section>`;}

 function resultPanel(){const r=st.result;
  if(st.error)return `<section class="panel"><div class="warning">${escape(st.error)}</div></section>`;
  if(!r)return '';
  const c=st.cfg;
  return `<section class="panel" id="en-results">${heading('Oportunidades de encantamiento',`${r.rows.length} con margen ≥ ${c.minMarginPct} % · cantidades limitadas al ${c.sharePct} % de lo que el Mercado Negro compra en ${c.saleDays} días`,r.rows.some(x=>x.units>0)?'<button type="button" class="btn btn-small" id="en-business">Registrar en Mi negocio</button>':'')}
  ${r.rows.length?`<div class="result-table"><table><thead><tr><th>Vender</th><th>Comprar</th><th>Encantar con</th><th class="numeric">Coste</th><th class="numeric">Paga el MN</th><th class="numeric">Beneficio/u.</th><th class="numeric">Ventas/día</th><th class="numeric">Unidades</th><th class="numeric">Beneficio</th></tr></thead><tbody>${r.rows.slice(0,80).map(x=>`<tr><td>${itemWithCopy(x.id)}</td><td>${escape(x.from?'.'+x.from:'.0')} en ${escape(x.buyCity)}<small class="rank-sub">${silver(x.buyPrice)}</small></td><td>${x.mats.map(m=>`${silver(m.count)} × ${escape(name(m.id))} <small class="rank-sub">${silver(m.price)} · ${escape(m.city)}</small>`).join('')}</td><td class="numeric">${silver(x.cost)}</td><td class="numeric">${silver(x.sell)}<small class="rank-sub">hace ${compact(x.sellAgeH)} h</small></td><td class="numeric green">+${silver(x.profit)}<small class="rank-sub">${compact(x.margin*100)} %</small></td><td class="numeric">${compact(x.daily)}</td><td class="numeric"><strong>${silver(x.units)}</strong></td><td class="numeric">${x.units?'+'+small(x.totalProfit):'—'}</td></tr>`).join('')}</tbody></table></div>`:'<div class="warning">Nada supera el margen mínimo con los precios actuales de AODP.</div>'}
  <p class="hint">Precios de compra = orden de venta más barata reciente (≤24 h) en Caerleon y ciudades Royal; el Mercado Negro paga su orden de compra (venta instantánea, solo impuesto). Encantar no tiene coste extra de estación. Comprueba precios en el juego antes de comprar.</p>
  ${r.skipped.length?`<details class="plan-diagnostics"><summary>Sin oportunidad · ${r.skipped.length}</summary><div class="diagnostic-list">${r.skipped.slice(0,60).map(x=>`<div class="diagnostic-item"><div><strong>${escape(name(x.id))}</strong><small>${escape(x.id)} · ${escape(x.reason)}</small></div></div>`).join('')}</div></details>`:''}</section>`;}

 async function run(){if(st.busy)return;st.busy=true;st.error=null;rerender();
  try{const extra=await loadGameExtra();const counts=extra.enchant||{};const c=st.cfg;
   const tests=groups.flatMap(g=>g.items).filter(i=>c.branches.includes(i.key));if(!tests.length)throw Error('Elige al menos una rama.');
   const bases=Object.keys(counts).filter(b=>c.tiers.includes(tierOf(b))&&tests.some(t=>t.test(b)));
   if(!bases.length)throw Error('Las ramas elegidas no tienen objetos encantables en esos tiers.');
   const {items,mats}=enchantQueryIds(bases,counts);
   progress('en-progress',`Precios de ${items.length} objetos…`,10);
   const p1=await marketFetch('prices',items,{cities:[...BUY,'Black Market'],qualities:'1',onProgress:p=>progress('en-progress',`Objetos: lote ${p.finished}/${p.total}`,10+45*p.finished/p.total)});
   progress('en-progress','Runas, almas y reliquias…',58);
   const p2=await marketFetch('prices',mats,{cities:BUY,qualities:'1'});
   const targets=items.filter(id=>/@[1-3]$/.test(id));
   progress('en-progress','Ventas del Mercado Negro…',70);
   const h=await marketFetch('history',targets,{cities:['Black Market'],qualities:'1,2,3,4,5',days:7,onProgress:p=>progress('en-progress',`Ventas: lote ${p.finished}/${p.total}`,70+25*p.finished/p.total)}).catch(()=>({rows:[]}));
   const demand=new Map(summarizeHistory(h.rows,{days:7}).filter(x=>x.city==='Black Market').map(x=>[x.id,x.averageDailyUnits]));
   st.result=enchantOpportunities({bases,counts,quotes:quoteMap([...p1.rows,...p2.rows]),demand,config:{tax:premiumTax(c.premium),saleDays:c.saleDays,sharePct:c.sharePct,minMarginPct:c.minMarginPct}});
   toast(st.result.rows.length?`${st.result.rows.length} oportunidades de encantamiento.`:'Sin oportunidades con el margen pedido.');}
  catch(e){st.error=e.message;st.result=null;}
  finally{st.busy=false;rerender();}}

 return {
  render:()=>`<div id="enchant-root">${hero('enchant')}${configPanel()}${resultPanel()}</div>`,
  saveState:()=>({cfg:st.cfg}),
  onClick(b){if(b.id==='en-run'){void run();return true;}
   if(b.id==='en-business'){try{const rows=st.result.rows.filter(x=>x.units>0);const lots=rows.map((x,i)=>makeLot({id:x.id,market:'Black Market',units:x.units,unitCost:x.cost,expectedPrice:x.sell,tax:premiumTax(st.cfg.premium),listingFee:0,costSource:'compra + encantamiento'},i));ctx.addToBusiness(createPortfolio({title:'Encantar para el Mercado Negro',source:'encantar',lots}));}catch(e){toast(e.message);}return true;}
   return false;},
  onChange(x){
   if(x.dataset.enBranch){const s=new Set(st.cfg.branches);x.checked?s.add(x.dataset.enBranch):s.delete(x.dataset.enBranch);setCfg({branches:[...s]});return true;}
   if(x.dataset.enTier){const s=new Set(st.cfg.tiers);const t=Number(x.dataset.enTier);x.checked?s.add(t):s.delete(t);if(!s.size){toast('Deja al menos un tier.');later();return true;}setCfg({tiers:[...s].sort()});return true;}
   if(x.dataset.en){const k=x.dataset.en;setCfg({[k]:x.type==='checkbox'?x.checked:Math.max(0,Number(x.value)||0)});return true;}
   return false;}
 };
}
