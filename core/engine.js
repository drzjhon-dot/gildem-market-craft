import {parsedTime} from './depth.js';
// Pure calculations. All prices must carry observation timestamps; no invented estimates.
export const CITIES = ['Bridgewatch','Fort Sterling','Lymhurst','Martlock','Thetford','Caerleon','Brecilien'];
export const ALL_CITIES = [...CITIES,'Black Market'];
export const CITY_COLORS = {'Bridgewatch':'#e5b76a','Fort Sterling':'#d4dbe8','Lymhurst':'#8bcf92','Martlock':'#9baddc','Thetford':'#b08ed4','Caerleon':'#e88993','Brecilien':'#b3dda0','Black Market':'#d9a26d'};
export const fmt = n => Number.isFinite(Number(n)) ? new Intl.NumberFormat('es-ES',{maximumFractionDigits:0}).format(Number(n)) : '—';
export const short = n => !Number.isFinite(n) ? '—' : Math.abs(n)>=1e9?(n/1e9).toFixed(2)+'B':Math.abs(n)>=1e6?(n/1e6).toFixed(2)+'M':Math.abs(n)>=1e3?(n/1e3).toFixed(1)+'K':fmt(n);
export function h(s=''){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
export function qualityQuote(row,side,maxAgeHours=24,now=Date.now()) {
  if(!row)return null;
  const price=Number(row[side]);const at=parsedTime(row[side+'_date']);
  if(!Number.isFinite(price)||price<=0||!Number.isFinite(at)||at<=0||at>now+60000)return null;
  const ageHours=Math.max(0,(now-at)/3600000);
  return {price,at,ageHours,fresh:ageHours<=maxAgeHours};
}
export function freshnessLabel(at,now=Date.now()){
  if(!at)return 'Sin registro'; const ms=Math.max(0,now-at);
  if(ms<3600000)return Math.floor(ms/60000)+' min';
  if(ms<86400000)return (ms/3600000).toFixed(1)+' h';
  return (ms/86400000).toFixed(1)+' d';
}
export function rowMap(rows){const m=new Map();for(const x of rows||[]){if(x?.item_id&&x?.city)m.set(x.item_id+'|'+x.city+'|'+x.quality,x);}return m;}
export function quote(map,item,city,side,limit=24,quality=1){const r=map.get(item+'|'+city+'|'+quality);const q=qualityQuote(r,side,limit);return q?.fresh?q:null;}
export function profitTrade({buyPrice,sellPrice,tax=0.04,setup=0.025,transport=0,mode='instant'}){
  if(!(buyPrice>0&&sellPrice>0))return null;
  const total=buyPrice+transport;const revenue=sellPrice*(1-tax-(mode==='listed'?setup:0));const profit=revenue-total;
  return {profit,cost:total,revenue,roi:total>0?profit/total*100:0};
}
export function topTrades(map, ids, options={}){
  const maxAge=options.maxAge??24,tax=options.tax??0.04,setup=options.setup??0.025,transport=options.transport??0;
  const targets=options.destinations||ALL_CITIES;const out=[];
  for(const id of ids){for(const from of CITIES){const buy=quote(map,id,from,'sell_price_min',maxAge);if(!buy)continue;
    for(const to of targets){if(from===to)continue;
      const instant=quote(map,id,to,'buy_price_max',maxAge);const listed=to==='Black Market'?null:quote(map,id,to,'sell_price_min',maxAge);
      for(const [mode,q] of [['instant',instant],['listed',listed]]){
        if(!q)continue;const p=profitTrade({buyPrice:buy.price,sellPrice:q.price,tax,setup,transport,mode});
        if(p&&p.profit>0)out.push({id,from,to,mode,buy,q,...p,ageHours:Math.max(buy.ageHours,q.ageHours)});
      }
    }
  }}
  return out.sort((a,b)=>b.profit-a.profit);
}
export function craftCost(recipe,findPrice,returnRate,stationFee=0){
  if(!recipe?.materials?.length)return null;let total=0,rawTotal=0;const materials=[];
  for(const m of recipe.materials){const data=findPrice(m.id);if(!data?.price||!Number.isFinite(m.count)||m.count<=0)return null;
    const refunded=m.ret===false?0:Math.min(m.count*returnRate/100,Number.isFinite(m.maxReturn)?m.maxReturn:Infinity);
    const used=m.count-refunded;const gross=m.count*(data.upfrontUnitPrice??data.price);const cost=used*data.price;
    total+=cost;rawTotal+=gross;materials.push({id:m.id,count:m.count,returned:refunded,used,unitPrice:data.price,cost,city:data.city,at:data.at,shippingPerUnit:data.shippingPerUnit||0,originalPrice:data.originalPrice||data.price,ret:m.ret!==false,maxReturn:m.maxReturn,refining:data.refining||null,upfrontUnitPrice:data.upfrontUnitPrice??data.price});
  }
  return {materials,materialCost:total,rawMaterials:rawTotal,total:total+stationFee,stationFee};
}
export function craftProfit(cost, sale, {tax=.04,setup=.025,mode='instant',transport=0,journalBonus=0}={}){
  if(!cost||!(sale>0))return null;
  const revenue=sale*(1-tax-(mode==='listed'?setup:0));const invested=cost.total+transport;
  return {cost:invested,profit:revenue+Number(journalBonus||0)-invested,roi:invested?((revenue+journalBonus-invested)/invested*100):0,revenue};
}
export function historyDaily(history,days=14,now=Date.now()){
  // Count only the last N COMPLETE UTC days. Timestamp may be ISO or integer.
  const today=Date.UTC(new Date(now).getUTCFullYear(),new Date(now).getUTCMonth(),new Date(now).getUTCDate());
  const start=today-days*86400000;
  let count=0,points=0;
  for(const r of history||[]){const t=typeof r.timestamp==='number'?(r.timestamp<1e12?r.timestamp*1000:r.timestamp):Date.parse(r.timestamp||'');if(Number.isFinite(t)&&t>=start&&t<today){count+=Math.max(0,Number(r.item_count)||0);points++;}}
  return points>0?{count,daily:count/days,observations:points}:null;
}
export function allocatePlan(candidates,budget,limitFraction=.05,unknownCap=2){
  const rows=[],materials=new Map();let remaining=Number(budget); if(!(remaining>0))return {rows,totalCost:0,totalProfit:0,remaining:0,materials:[]};
  const sorted=[...candidates].filter(x=>x.profit>0&&x.cost>0).sort((a,b)=> b.profit/b.cost-a.profit/a.cost);
  for(const x of sorted){
    const demandCap=Number.isFinite(x.dailySales)?Math.floor(x.dailySales*limitFraction):unknownCap;
    const maxItemBudget=Math.floor(budget*.25/x.cost);const qty=Math.max(0,Math.min(demandCap,maxItemBudget,Math.floor(remaining/x.cost)));
    if(!qty)continue;
    const use=qty*x.cost;remaining-=use; rows.push({...x,qty,allocation:use,totalProfit:qty*x.profit,risk:x.dailySales==null?'Sin volumen confirmado':'Límite '+Math.round(limitFraction*100)+'% demanda diaria'});
    for(const m of x.materials||[]){const old=materials.get(m.id)||{...m,qtyGross:0,qtyNet:0};old.qtyGross+=m.count*qty;old.qtyNet+=m.used*qty;materials.set(m.id,old);}
  }
  return {rows,totalCost:budget-remaining,totalProfit:rows.reduce((s,r)=>s+r.totalProfit,0),remaining,materials:[...materials.values()]};
}
export function itemTier(id=''){const m=String(id).match(/^T(\d+)_/);return m?Number(m[1]):null;}
export function itemEnch(id=''){return Number(String(id).split('@')[1]||0)||0;}
export function iconUrl(id,size=84){return 'https://render.albiononline.com/v1/item/'+encodeURIComponent(id)+'.png?size='+size+'&quality=1';}
export function normalized(s=''){return String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();}

// Albion daily production bonuses add to production bonus, NOT directly to resource returns.
// Royal stations: 18% base, +15% for that item's local specialty, +59% with focus.
export function craftingReturnRate({specialty=false,dailyBonus=0,focus=false,baseBonus=18}={}){
  const daily=Number(dailyBonus), base=Number(baseBonus);
  if(![0,10,20].includes(daily)||!Number.isFinite(base)||base<0)throw new Error('Bonificación de producción inválida');
  const bonus=base+(specialty?15:0)+daily+(focus?59:0);
  return {productionBonus:bonus,returnRate:100*bonus/(100+bonus)};
}

// Capital commitment is measured conservatively from all gross materials needed for the
// proposed batches (not from net-after-returns profit costs). Never fabricate market demand.
// One candidate per destination. Combined mode can assign the same crafted item to
// the Black Market and to Royal cities, without counting stock or capital twice.
export function selectCraftSaleRoutes(candidates,market='black',royalLimit=3){
  if(!['black','royal','mixed'].includes(market))throw new Error('Destino de venta inválido');
  const groups=new Map();
  for(const x of candidates||[]){
    if(!x?.id||!x?.city||!(x.profit>0)||!(x.capitalPerUnit>0))continue;
    const kind=x.city==='Black Market'?'black':'royal';
    if(market!=='mixed'&&market!==kind)continue;
    const list=groups.get(x.id)||[];list.push(x);groups.set(x.id,list);
  }
  const score=x=>(x.profit/x.capitalPerUnit)*(x.dailySales==null?.6:1+Math.min(1,Math.log1p(x.dailySales)/8));
  const result=[];
  for(const group of groups.values()){
    const uniqueRoyal=new Map();
    for(const x of group.filter(x=>x.city!=='Black Market')){const old=uniqueRoyal.get(x.city);if(!old||score(x)>score(old))uniqueRoyal.set(x.city,x);}
    const royals=[...uniqueRoyal.values()].sort((a,b)=>score(b)-score(a));
    const bm=group.filter(x=>x.city==='Black Market').sort((a,b)=>score(b)-score(a));
    if(market!=='black')result.push(...royals.slice(0,royalLimit));
    if(market!=='royal'&&bm.length)result.push(bm[0]);
  }
  return result;
}

// Capital = gross resources for EACH crafted unit, even if its sale is split
// between different destinations. The planner never promises that a listed
// market quote can absorb the proposed quantity.
export function allocateCraftPlan(candidates,budget,{useAll=false,capFraction=.05,unknownCap=2,maxVariants=120,ensureBothMarkets=false}={}){
  const capital=Math.max(0,Number(budget)||0);
  let remaining=capital;
  const available=[...(candidates||[])].filter(x=>Number.isFinite(x.profit)&&x.profit>0&&Number.isFinite(x.capitalPerUnit)&&x.capitalPerUnit>0&&Number.isFinite(x.cost)&&x.cost>0)
    .sort((a,b)=>((b.profit/b.capitalPerUnit)*(b.dailySales==null?.75:1))-((a.profit/a.capitalPerUnit)*(a.dailySales==null?.75:1))||b.profit-a.profit);
  const selected=new Map(),usedByItem=new Map();
  function qtyAvailable(x){
    const prev=selected.get(x)||0;
    const demand=x.dailySales!=null?Math.floor(Math.max(0,x.dailySales)*capFraction):unknownCap;
    const itemBudget=useAll?Infinity:Math.floor(Math.max(0,capital*.30-(usedByItem.get(x.id)||0))/x.capitalPerUnit);
    return Math.max(0,Math.min(demand-prev,Math.floor(remaining/x.capitalPerUnit),itemBudget));
  }
  function take(x,desired=Infinity){
    if(!selected.has(x)&&selected.size>=maxVariants)return 0;
    const qty=Math.min(qtyAvailable(x),desired);
    if(!(qty>0))return 0;
    selected.set(x,(selected.get(x)||0)+qty);
    const amount=qty*x.capitalPerUnit;
    remaining=Math.max(0,remaining-amount);
    usedByItem.set(x.id,(usedByItem.get(x.id)||0)+amount);
    return qty;
  }
  // In combined mode reserve one profitable, affordable unit for EACH market
  // when both have opportunities. Afterwards freely invest the remaining silver
  // in the best routes. Never force losing or unverified purchases.
  if(ensureBothMarkets){
    const bm=available.filter(x=>x.city==='Black Market'&&qtyAvailable(x)>0);
    const royal=available.filter(x=>x.city!=='Black Market'&&qtyAvailable(x)>0);
    let pair=null;
    if(maxVariants>=2){
      for(const b of bm)for(const r of royal){
        const needed=b.capitalPerUnit+r.capitalPerUnit;
        if(needed>capital)continue;
        if(!useAll&&b.id===r.id&&needed>capital*.30)continue;
        const score=b.profit/b.capitalPerUnit+r.profit/r.capitalPerUnit;
        if(!pair||score>pair.score)pair={b,r,score};
      }
    }
    if(pair){take(pair.b,1);take(pair.r,1);}
  }
  for(const x of available)take(x);
  const rows=[],matMap=new Map(),cityMap=new Map();let totalProfit=0,totalNetCost=0;
  for(const [x,qty] of selected){
    if(qty<=0)continue;
    const upfront=qty*x.capitalPerUnit;
    totalNetCost+=qty*x.cost;
    const route={...x,qty,allocation:upfront,totalProfit:qty*x.profit,risk:x.dailySales==null?'Sin historial confirmado':`Máximo ${Math.round(capFraction*100)}% de las ventas diarias`};
    rows.push(route);totalProfit+=route.totalProfit;
    const c=cityMap.get(x.city)||{city:x.city,qty:0,profit:0,capital:0,products:0};
    c.qty+=qty;c.profit+=route.totalProfit;c.capital+=upfront;c.products+=1;cityMap.set(x.city,c);
    for(const m of x.materials||[]){const key=m.id+'|'+(m.city||'');const old=matMap.get(key)||{...m,qtyGross:0,qtyNet:0};old.qtyGross+=m.count*qty;old.qtyNet+=m.used*qty;matMap.set(key,old);}
    if(x.journal?.prices&&x.journal.ratio>0){const j=x.journal,key=j.empty+'|'+(j.buyCity||'');const old=matMap.get(key)||{id:j.empty,city:j.buyCity||'—',unitPrice:j.price,count:j.ratio,used:j.ratio,ret:false,qtyGross:0,qtyNet:0};old.qtyGross+=qty*j.ratio;old.qtyNet+=qty*j.ratio;matMap.set(key,old);}
  }
  return {rows,totalCost:capital-remaining,totalNetCost,totalProfit,remaining,materials:[...matMap.values()],cities:[...cityMap.values()].sort((a,b)=>b.profit-a.profit),capital};
}
