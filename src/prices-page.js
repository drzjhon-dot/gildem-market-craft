// Pestaña «Precios y alertas» (v4.0): precio del oro en West, buscador de precios por mercado
// con historial de 14 días y alertas locales (se comprueban mientras la web está abierta).
import {MARKETS,searchItems,withEnchant,priceBoard,historySeries,goldSummary,sparkline,ALERT_KINDS,makeAlert,checkAlerts} from './price-tools.js';

const KEY='gildem-alerts-v1';const CHECK_MS=15*60_000;
const ES={'Black Market':'Mercado Negro'};
export function createPricesPage(ctx){
 const {escape,silver,small,compact,itemWithCopy,heading,hero,toast,marketFetch,quoteMap,name,img,rerender}=ctx;
 const load=()=>{try{const x=JSON.parse(localStorage.getItem(KEY)||'[]');return Array.isArray(x)?x:[];}catch{return [];}};
 const st={gold:null,goldError:null,goldLoading:false,query:'',matches:[],base:null,ench:0,quotes:null,history:null,loading:false,error:null,alerts:load(),hits:[],checking:false,lastCheck:null};
 const persist=()=>{try{localStorage.setItem(KEY,JSON.stringify(st.alerts));}catch{}};
 const later=()=>setTimeout(rerender,0);
 const city=c=>escape(ES[c]||c);
 const id=()=>st.base?withEnchant(st.base,st.ench):null;

 async function loadGold(){if(st.goldLoading)return;st.goldLoading=true;
  try{const r=await fetch('/api/gold?count=168',{headers:{Accept:'application/json'},signal:AbortSignal.timeout(20000)});
   const body=await r.json().catch(()=>null);if(!r.ok||!Array.isArray(body))throw Error(body?.error||'HTTP '+r.status);
   st.gold=goldSummary(body);st.goldError=null;}
  catch(e){st.goldError=e.message;}
  finally{st.goldLoading=false;later();}}
 async function loadItem(){const target=id();if(!target)return;st.loading=true;st.error=null;later();
  try{const [p,h]=await Promise.all([marketFetch('prices',[target],{cities:MARKETS,qualities:'1'}),marketFetch('history',[target],{cities:MARKETS,qualities:'1',days:14}).catch(()=>({rows:[]}))]);
   st.quotes=quoteMap(p.rows);st.history=historySeries(h.rows,target);if(p.errors?.length)st.error=p.errors[0];}
  catch(e){st.error=e.message;st.quotes=null;st.history=null;}
  finally{st.loading=false;later();}}
 async function runChecks(report=false){const active=st.alerts.filter(a=>a.active);if(!active.length){if(report)toast('No hay alertas activas.');return;}
  if(st.checking)return;st.checking=true;
  try{const ids=[...new Set(active.map(a=>a.itemId))],cities=[...new Set(active.map(a=>a.city))];
   const p=await marketFetch('prices',ids,{cities,qualities:'1',force:report});const q=quoteMap(p.rows);
   st.hits=checkAlerts(st.alerts,q);st.lastCheck=Date.now();
   for(const a of st.alerts){const qq=q.get(a.itemId+'|'+a.city);const side=a.kind==='bidAtLeast'?qq?.bid:qq?.ask;if(side)a.lastSeen={price:side.price,time:side.time};}
   for(const h of st.hits){const a=st.alerts.find(x=>x.id===h.alert.id);const fresh=!a.lastHit||Date.now()-Date.parse(a.lastHit)>6*3600e3;a.lastHit=new Date().toISOString();
    if(fresh&&globalThis.Notification?.permission==='granted'){try{new Notification('Gildem · alerta de precio',{body:`${name(a.itemId)} · ${ES[a.city]||a.city}: ${silver(h.price)}`});}catch{}}}
   persist();if(report||st.hits.length)toast(st.hits.length?`${st.hits.length} alerta(s) se cumplen. Comprueba el precio en el juego.`:'Ninguna alerta se cumple ahora.');}
  catch(e){if(report)toast('No se pudieron revisar las alertas: '+e.message);}
  finally{st.checking=false;later();}}
 setInterval(()=>{if(document.visibilityState==='visible')void runChecks(false);},CHECK_MS);
 setTimeout(()=>void runChecks(false),4000);

 function goldPanel(){const g=st.gold;
  return `<section class="panel">${heading('Oro en West','Precio del oro en silver según AODP (Americas). Útil para valorar Premium y comparar tu beneficio en oro.',`<button type="button" class="btn btn-small" id="gold-refresh">${st.goldLoading?'Cargando…':'Actualizar'}</button>`)}
  ${g?`<div class="metric-strip"><div class="metric"><small>1 oro</small><strong>${silver(g.latest)} silver</strong></div><div class="metric"><small>Cambio ~24 h</small><strong class="${g.change24h>=0?'green':'red'}">${g.change24h>=0?'+':''}${silver(g.change24h)} (${compact(g.changePct)} %)</strong></div><div class="metric"><small>Rango 7 días</small><strong>${silver(g.min)} – ${silver(g.max)}</strong></div><div class="metric"><small>Tendencia</small><strong class="gold-spark">${sparkline(g.points.map(p=>p.price),{width:150,height:30})}</strong></div></div><p class="hint">Último dato hace ${compact(g.ageH)} h.</p>`
   :st.goldError?`<div class="warning">No se pudo leer el oro de AODP: ${escape(st.goldError)}</div>`:`<p class="muted">${st.goldLoading?'Leyendo el precio del oro…':'Pulsa «Actualizar» para leer el precio del oro.'}</p>`}</section>`;}

 function searchPanel(){const target=id();
  return `<section class="panel">${heading('Buscar precios','Escribe el nombre en español (p. ej. «claymore experto») o el ID del juego.')}
  <div class="config-grid"><div class="config-section config-half"><h3>Objeto</h3><input id="price-q" type="search" value="${escape(st.query)}" placeholder="Buscar objeto…" autocomplete="off" style="width:100%">
   ${st.matches.length?`<div class="price-matches">${st.matches.map(m=>`<button type="button" class="price-match ${st.base===m.id?'active':''}" data-price-pick="${escape(m.id)}">${img(m.id)}<span>${escape(m.name)}<small>${escape(m.id)}</small></span></button>`).join('')}</div>`:st.query.length>=2&&!(st.base&&st.query===name(st.base))?'<p class="muted">Sin coincidencias.</p>':''}</div>
   <div class="config-section"><h3>Encantamiento</h3><div class="pill-choices">${[0,1,2,3,4].map(e=>`<label class="toggle-chip ${st.ench===e?'active':''}"><input type="radio" name="price-ench" data-price-ench="${e}" ${st.ench===e?'checked':''}>.${e}</label>`).join('')}</div><p>Calidad normal (Q1), que es la que usan los planes.</p></div></div>
  ${target?boardHTML(target):''}</section>`;}

 function boardHTML(target){
  if(st.loading)return `<p class="muted">Consultando ${escape(name(target))} en los 8 mercados…</p>`;
  if(!st.quotes)return st.error?`<div class="warning">${escape(st.error)}</div>`:'';
  const b=priceBoard(st.quotes,target),h=st.history||{};
  return `<div class="section-heading"><h3>${itemWithCopy(target)}</h3><span>${b.bestBuy?`comprar más barato: ${city(b.bestBuy.city)} ${silver(b.bestBuy.ask.price)}`:'sin ventas recientes'}${b.bestInstantSell?` · vender al instante: ${city(b.bestInstantSell.city)} ${silver(b.bestInstantSell.bid.price)}`:''}</span></div>
  <div class="result-table"><table><thead><tr><th>Mercado</th><th class="numeric">Orden de venta (mín.)</th><th class="numeric">Orden de compra (máx.)</th><th class="numeric">Media 14 d</th><th class="numeric">Ventas/día</th><th>14 días</th><th></th></tr></thead><tbody>${b.rows.map(r=>{const hs=h[r.city];
   return `<tr class="${b.bestBuy?.city===r.city||b.bestInstantSell?.city===r.city?'row-best':''}"><td>${city(r.city)}</td><td class="numeric">${r.ask?`${silver(r.ask.price)}<small class="rank-sub ${r.askFresh?'':'red'}">hace ${compact(r.ask.ageH)} h</small>`:'—'}</td><td class="numeric">${r.bid?`${silver(r.bid.price)}<small class="rank-sub ${r.bidFresh?'':'red'}">hace ${compact(r.bid.ageH)} h</small>`:'—'}</td><td class="numeric">${hs?.avgPrice?silver(hs.avgPrice):'—'}</td><td class="numeric">${hs?compact(hs.dailyUnits):'—'}</td><td>${hs?sparkline(hs.days.map(d=>d.price)):''}</td><td><button type="button" class="btn btn-ghost btn-small" data-price-watch="${escape(r.city)}">Vigilar</button></td></tr>`;}).join('')}</tbody></table></div>
  <p class="hint">Rojo = dato con más de 24 h. AODP solo ve lo que suben los jugadores con el cliente de datos; comprueba en el juego antes de comprar.</p>`;}

 function alertsPanel(){
  return `<section class="panel">${heading('Mis alertas','Se revisan cada 15 minutos mientras la web está abierta (y al abrirla). No avisan con la página cerrada.',`<div class="actions"><button type="button" class="btn btn-small" id="alerts-check">${st.checking?'Revisando…':'Revisar ahora'}</button><button type="button" class="btn btn-ghost btn-small" id="alerts-notify">Activar avisos del navegador</button></div>`)}
  <div class="config-grid"><div class="config-section"><h3>Nueva alerta</h3>
   <p>${id()?`Objeto: <b>${escape(name(id()))}</b>`:'Elige primero un objeto en el buscador.'}</p>
   <select id="alert-city">${MARKETS.map(c=>`<option value="${escape(c)}">${city(c)}</option>`).join('')}</select>
   <select id="alert-kind">${Object.entries(ALERT_KINDS).map(([k,v])=>`<option value="${k}">${escape(v)}</option>`).join('')}</select>
   <div class="multifield"><label>Precio<input id="alert-price" type="number" min="1" step="1"></label></div>
   <button type="button" class="btn btn-gold" id="alert-add" ${id()?'':'disabled'}>Crear alerta</button></div></div>
  ${st.alerts.length?`<div class="result-table"><table><thead><tr><th>Objeto</th><th>Mercado</th><th>Condición</th><th class="numeric">Último visto</th><th>Estado</th><th></th></tr></thead><tbody>${st.alerts.map(a=>{const hit=st.hits.some(h=>h.alert.id===a.id);
   return `<tr class="${hit?'row-best':''}"><td>${itemWithCopy(a.itemId)}</td><td>${city(a.city)}</td><td>${escape(ALERT_KINDS[a.kind])} ${silver(a.price)}</td><td class="numeric">${a.lastSeen?silver(a.lastSeen.price):'—'}</td><td>${!a.active?'<span class="muted">Pausada</span>':hit?'<b class="green">¡Se cumple!</b>':'Vigilando'}</td><td><button type="button" class="btn btn-ghost btn-small" data-alert-toggle="${escape(a.id)}">${a.active?'Pausar':'Activar'}</button><button type="button" class="btn btn-ghost btn-small" data-alert-delete="${escape(a.id)}">Borrar</button></td></tr>`;}).join('')}</tbody></table></div>`:'<p class="muted">Sin alertas todavía.</p>'}
  ${st.lastCheck?`<p class="hint">Última revisión: ${escape(new Date(st.lastCheck).toLocaleTimeString('es-ES'))}.</p>`:''}</section>`;}

 let goldAsked=false;
 return {
  render:()=>{if(!goldAsked){goldAsked=true;setTimeout(()=>void loadGold(),0);}return `<div id="prices-root">${hero('prices')}${goldPanel()}${searchPanel()}${alertsPanel()}</div>`;},
  onClick(b){
   if(b.id==='gold-refresh'){void loadGold();return true;}
   if(b.dataset.pricePick){st.base=b.dataset.pricePick;st.matches=[];st.query=name(st.base);void loadItem();return true;}
   if(b.dataset.priceWatch){const sel=document.getElementById('alert-city');if(sel)sel.value=b.dataset.priceWatch;const k=document.getElementById('alert-kind');if(k)k.value=b.dataset.priceWatch==='Black Market'?'bidAtLeast':'askAtMost';document.getElementById('alert-price')?.focus();return true;}
   if(b.id==='alert-add'){try{const a=makeAlert({itemId:id(),city:document.getElementById('alert-city').value,kind:document.getElementById('alert-kind').value,price:document.getElementById('alert-price').value});st.alerts.push(a);persist();toast('Alerta creada.');void runChecks(false);later();}catch(e){toast(e.message);}return true;}
   if(b.id==='alerts-check'){void runChecks(true);return true;}
   if(b.id==='alerts-notify'){if(!globalThis.Notification)toast('Este navegador no permite avisos.');else Notification.requestPermission().then(p=>toast(p==='granted'?'Avisos activados.':'Avisos no permitidos.'));return true;}
   if(b.dataset.alertToggle){const a=st.alerts.find(x=>x.id===b.dataset.alertToggle);if(a){a.active=!a.active;persist();later();}return true;}
   if(b.dataset.alertDelete){st.alerts=st.alerts.filter(x=>x.id!==b.dataset.alertDelete);persist();later();return true;}
   return false;},
  onInput(x){if(x.id==='price-q'){st.query=x.value;st.matches=searchItems(ctx.names(),x.value);
    const box=document.querySelector('#prices-root .price-matches');const html=st.matches.map(m=>`<button type="button" class="price-match" data-price-pick="${escape(m.id)}">${img(m.id)}<span>${escape(m.name)}<small>${escape(m.id)}</small></span></button>`).join('');
    if(box)box.innerHTML=html;else if(st.matches.length){x.insertAdjacentHTML('afterend',`<div class="price-matches">${html}</div>`);}
    return true;}return false;},
  onChange(x){if(x.dataset.priceEnch!==undefined){st.ench=Number(x.dataset.priceEnch);if(st.base)void loadItem();else later();return true;}return false;}
 };
}
