// Pestaña «Mi negocio» (v4.0): inversiones registradas desde los planes, ventas reales
// (a mano o desde el CSV de Trades del AFM Data Client) y resumen de lo que de verdad vendes.
import {loadBusiness,saveBusiness,sanitizeBusiness} from './business-store.js';
import {summarizePortfolio,recordSale,setLotCost,overallDashboard} from './ledger.js';
import {parseAfmTradesCsv,summarizeTrades,applyTradesToPortfolios} from './afm-trades.js';

const MARKET_ES={'Black Market':'Mercado Negro'};
export function createBusinessPage(ctx){
 const {escape,silver,small,compact,itemWithCopy,heading,hero,toast,rerender}=ctx;
 let biz=loadBusiness();let lastReport=null;
 const persist=()=>{if(!saveBusiness(biz))toast('No se pudo guardar en este navegador (almacenamiento lleno o bloqueado).');};
 const later=()=>setTimeout(rerender,0);
 const mk=m=>escape(MARKET_ES[m]||m||'—');
 const date=x=>{const t=Date.parse(x);return Number.isFinite(t)?new Date(t).toLocaleDateString('es-ES',{day:'2-digit',month:'short'}):'—';};

 function summaryPanel(){const d=overallDashboard(biz.portfolios.filter(p=>p.started));const planned=biz.portfolios.filter(p=>!p.started&&!p.closed).length;
  return `<section class="panel">${heading('Resumen de tu negocio','Solo cuenta las inversiones marcadas como compradas. Las cifras pendientes son estimaciones del plan.',`<div class="actions"><button type="button" class="btn" id="biz-export">Exportar copia</button><label class="btn" style="cursor:pointer">Importar copia<input type="file" id="biz-import" accept="application/json,.json" hidden></label></div>`)}
  <div class="metric-strip"><div class="metric"><small>Invertido (comprado)</small><strong>${small(d.spent)}</strong></div><div class="metric"><small>Vendido</small><strong>${silver(d.sold)} / ${silver(d.qty)} u.</strong></div><div class="metric"><small>Beneficio realizado</small><strong class="${d.realizedProfit>=0?'green':'red'}">${d.realizedProfit>=0?'+':''}${small(d.realizedProfit)}</strong></div><div class="metric"><small>Pendiente (estimado)</small><strong>${d.unrealizedEst>=0?'+':''}${small(d.unrealizedEst)}</strong></div></div>
  ${planned?`<p class="hint">${planned} ${planned===1?'plan registrado espera':'planes registrados esperan'} a que lo marques como comprado.</p>`:''}</section>`;}

 function importPanel(){const sum=summarizeTrades(biz.trades).filter(x=>x.op==='sell');
  return `<section class="panel">${heading('Ventas reales del AFM Data Client','En el AFM Data Client (AlbionDataAvalonia) ve a Trades → Export CSV y elige el archivo aquí.')}
  <div class="toolbar"><label class="btn btn-gold" style="cursor:pointer">Elegir CSV de Trades<input type="file" id="biz-afm" accept=".csv,text/csv,text/plain" hidden></label><p class="muted">Solo se usan operaciones de Americas (West). Cada operación se importa una vez.</p></div>
  ${lastReport?`<div class="${lastReport.error?'warning':'notice'}">${escape(lastReport.text)}</div>`:''}
  ${biz.lastImport?`<p class="hint">Última importación: ${escape(new Date(biz.lastImport).toLocaleString('es-ES'))} · ${silver(biz.trades.length)} operaciones guardadas.</p>`:''}
  ${sum.length?`<div class="section-heading"><h3>Lo que de verdad vendes</h3><span>por objeto y mercado</span></div><div class="result-table"><table><thead><tr><th>Objeto</th><th>Mercado</th><th class="numeric">Unidades</th><th class="numeric">Precio medio</th><th class="numeric">Silver</th><th class="numeric">Ritmo/día</th><th class="numeric">Órdenes llenadas</th><th class="numeric">Caducadas</th></tr></thead><tbody>${sum.slice(0,120).map(x=>`<tr><td>${itemWithCopy(x.id)}</td><td>${mk(x.market)}</td><td class="numeric">${silver(x.units)}</td><td class="numeric">${x.avgPrice!=null?silver(x.avgPrice):'—'}</td><td class="numeric">${small(x.silver)}</td><td class="numeric">${compact(x.units/x.days)}</td><td class="numeric">${x.fillRate!=null?compact(x.fillRate*100)+' %':'—'}</td><td class="numeric">${silver(x.expiredOrders)}</td></tr>`).join('')}</tbody></table></div>`:''}
  </section>`;}

 function lotRow(p,l){const sold=(l.sales||[]).reduce((s,x)=>s+x.qty,0),left=l.qty-sold,gross=(l.sales||[]).reduce((s,x)=>s+x.qty*x.price,0);
  return `<tr><td>${itemWithCopy(l.id)}<small class="rank-sub">${mk(l.market)}${l.craftCity?' · fabricar en '+escape(l.craftCity):''}</small></td><td class="numeric">${silver(l.qty)}</td><td class="numeric">${silver(sold)}${sold?`<small class="rank-sub">media ${silver(gross/sold)}</small>`:''}</td>
   <td class="numeric"><input type="number" min="0" step="1" value="${Math.round(l.unitCost)}" data-biz-cost="${escape(p.id)}|${escape(l.lotId)}" style="max-width:100px" title="Coste real por unidad"><small class="rank-sub">${escape(l.costSource)}</small></td><td class="numeric">${silver(l.expectedPrice)}</td>
   <td>${p.started&&left>0?`<div class="biz-sale"><input type="number" min="1" max="${left}" step="1" placeholder="u." data-biz-qty="${escape(l.lotId)}"><input type="number" min="1" step="1" placeholder="precio" data-biz-price="${escape(l.lotId)}"><button type="button" class="btn btn-small" data-biz-sale="${escape(p.id)}|${escape(l.lotId)}">Vender</button></div>`:left<=0?'<span class="green">Vendido</span>':'<span class="muted">Marca la inversión como comprada</span>'}</td></tr>`;}

 function portfoliosPanel(){
  if(!biz.portfolios.length)return `<section class="panel">${heading('Tus inversiones','Registra un plan desde Craft Planner o Plan Mercado Negro con «Registrar en Mi negocio».')}<div class="empty"><h3>Aún no hay inversiones</h3><p>Cuando compres los materiales de un plan, regístralo aquí y anota (o importa) lo que vendes. Así sabrás tu beneficio real.</p></div></section>`;
  const list=[...biz.portfolios].sort((a,b)=>(a.closed-b.closed)||String(b.createdAt).localeCompare(String(a.createdAt)));
  return `<section class="panel">${heading('Tus inversiones',`${list.length} registradas`)}${list.map(p=>{const s=summarizePortfolio(p);
   const state=p.closed?'Cerrada':p.started?'Comprada':'Planeada';
   return `<details class="biz-portfolio" ${p.closed?'':'open'}><summary><strong>${escape(p.title)}</strong> <span class="pill-mini">${state}</span> <small>${date(p.createdAt)} · ${silver(s.sold)}/${silver(s.qty)} u. vendidas · realizado ${s.realizedProfit>=0?'+':''}${small(s.realizedProfit)} · pendiente ${small(s.unrealizedEst)}</small></summary>
    <div class="actions" style="margin:8px 0">${!p.started&&!p.closed?`<button type="button" class="btn btn-gold btn-small" data-biz-start="${escape(p.id)}">Marcar como comprada</button>`:''}${!p.closed?`<button type="button" class="btn btn-small" data-biz-close="${escape(p.id)}">Cerrar</button>`:`<button type="button" class="btn btn-small" data-biz-reopen="${escape(p.id)}">Reabrir</button>`}<button type="button" class="btn btn-ghost btn-small" data-biz-delete="${escape(p.id)}">Eliminar</button></div>
    <div class="result-table"><table><thead><tr><th>Objeto</th><th class="numeric">Unidades</th><th class="numeric">Vendidas</th><th class="numeric">Coste/u.</th><th class="numeric">Precio plan</th><th>Registrar venta</th></tr></thead><tbody>${p.lots.map(l=>lotRow(p,l)).join('')}</tbody></table></div></details>`;}).join('')}</section>`;}

 async function importAfm(file){
  try{const text=await file.text();const {NAMES_EN}=await import('./names-en.js');
   const parsed=parseAfmTradesCsv(text,{namesEn:NAMES_EN});
   const west=parsed.trades.filter(t=>!t.server||/americ|west/i.test(t.server));
   const other=parsed.trades.length-west.length;
   const known=new Set(biz.trades.map(t=>t.signature));const fresh=west.filter(t=>!known.has(t.signature));
   biz.trades=[...biz.trades,...fresh].slice(-6000);
   const applied=applyTradesToPortfolios(biz.portfolios,west,{recordSale:(p,lotId,sale)=>{const n=recordSale(p,lotId,sale);const l=n.lots.find(x=>x.lotId===lotId);l.sales[l.sales.length-1].source='AFM';return n;}});
   biz.portfolios=applied.portfolios;biz.lastImport=new Date().toISOString();persist();
   const r=applied.report;
   lastReport={text:`${silver(fresh.length)} operaciones nuevas de West${other?` (${other} de otros servidores ignoradas)`:''}${parsed.skipped.length?` · ${parsed.skipped.length} filas no reconocidas`:''}. Ventas anotadas en tus inversiones: ${silver(r.units)} unidades en ${r.lots} lotes${r.unmatched?` · ${r.unmatched} ventas sin inversión comprada que coincida`:''}${r.duplicates?` · ${r.duplicates} ya importadas`:''}.`};
  }catch(e){lastReport={error:true,text:e.message};}
  later();}
 function find(pid){const p=biz.portfolios.find(x=>x.id===pid);if(!p)throw Error('Inversión no encontrada');return p;}
 function replace(p){biz.portfolios=biz.portfolios.map(x=>x.id===p.id?p:x);persist();}

 return {
  render:()=>`<div id="biz-root">${hero('business')}${summaryPanel()}${portfoliosPanel()}${importPanel()}</div>`,
  /** Lo usan Craft Planner y Plan Mercado Negro. */
  add(portfolio){biz=loadBusiness();biz.portfolios.push(portfolio);persist();toast(`«${portfolio.title}» registrado en Mi negocio (${portfolio.lots.length} lotes).`);},
  onClick(b){
   try{
    if(b.id==='biz-export'){const url=URL.createObjectURL(new Blob([JSON.stringify(biz,null,1)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='gildem-mi-negocio.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),500);return true;}
    if(b.dataset.bizStart){const p=find(b.dataset.bizStart);replace({...p,started:true,startedAt:new Date().toISOString()});toast('Inversión marcada como comprada.');later();return true;}
    if(b.dataset.bizClose){const p=find(b.dataset.bizClose);replace({...p,closed:true});later();return true;}
    if(b.dataset.bizReopen){const p=find(b.dataset.bizReopen);replace({...p,closed:false});later();return true;}
    if(b.dataset.bizDelete){const p=find(b.dataset.bizDelete);if(!confirm(`¿Eliminar «${p.title}» y sus ventas registradas?`))return true;biz.portfolios=biz.portfolios.filter(x=>x.id!==p.id);persist();later();return true;}
    if(b.dataset.bizSale){const [pid,lotId]=b.dataset.bizSale.split('|');const p=find(pid),l=p.lots.find(x=>x.lotId===lotId);
     const root=b.closest('tr');const qty=Number(root.querySelector(`[data-biz-qty="${lotId}"]`).value),price=Number(root.querySelector(`[data-biz-price="${lotId}"]`).value);
     const gross=qty*price,fees=Math.round(gross*(l.feesRate+l.setupRate));
     replace(recordSale(p,lotId,{qty,price,fees}));toast(`Venta anotada: ${qty} × ${silver(price)}.`);later();return true;}
   }catch(e){toast(e.message);return true;}
   return false;},
  onChange(x){
   try{
    if(x.id==='biz-afm'&&x.files?.[0]){void importAfm(x.files[0]);x.value='';return true;}
    if(x.id==='biz-import'&&x.files?.[0]){x.files[0].text().then(t=>{const next=sanitizeBusiness(JSON.parse(t));if(!confirm(`¿Reemplazar tus datos de Mi negocio por la copia (${next.portfolios.length} inversiones)?`))return;biz=next;persist();toast('Copia restaurada.');later();}).catch(()=>toast('El archivo no es una copia válida de Mi negocio.'));x.value='';return true;}
    if(x.dataset.bizCost){const [pid,lotId]=x.dataset.bizCost.split('|');replace(setLotCost(find(pid),lotId,Number(x.value)));later();return true;}
   }catch(e){toast(e.message);return true;}
   return false;}
 };
}
