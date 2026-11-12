// Mercado sintético de tela (fibra → tela) para probar Refinamiento inteligente.
export const T=Date.parse('2026-11-12T12:00:00Z');const fresh=T-2*3600e3;
const CITIES=['Bridgewatch','Fort Sterling','Lymhurst','Martlock','Thetford'];
export const quotes=new Map();
const put=(id,city,ask,bid)=>{const o=quotes.get(id+'|'+city)||{id,city};if(ask)o.ask={price:ask,time:fresh};if(bid)o.bid={price:bid,time:fresh};quotes.set(id+'|'+city,o);};
const id=(t,k,e)=>`T${t}_${k}${e?`_LEVEL${e}@${e}`:''}`;
const fiber={2:8,3:22,4:70,5:210,6:620,7:1500,8:3600},cloth={2:12,3:40,4:150,5:520,6:1650,7:4400,8:11000},em=[1,2,4.2,8.8,18];
// Fort Sterling: fibra barata; Lymhurst: la tela se paga más.
const cityRaw={'Fort Sterling':.88,'Bridgewatch':1.04,'Lymhurst':1,'Martlock':1.06,'Thetford':1.02};
const citySell={'Lymhurst':1.06,'Fort Sterling':1,'Thetford':1.03,'Bridgewatch':.97,'Martlock':.98};
export const history=[];
for(let t=2;t<=8;t++)for(let e=0;e<=4;e++){if(t<4&&e)continue;
 for(const c of CITIES){const raw=Math.round(fiber[t]*em[e]*cityRaw[c]);put(id(t,'FIBER',e),c,raw,Math.round(raw*.9));
  const cl=Math.round(cloth[t]*em[e]*citySell[c]);put(id(t,'CLOTH',e),c,cl,Math.round(cl*.92));
  const daily=[0,0,9000,3000,4000,1200,400,120,40][t]*[1,.5,.2,.08,.03][e];
  history.push({id:id(t,'CLOTH',e),city:c,days:7,quality1DailyUnits:daily,quality1ActiveDays:7,averageDailyUnits:daily,quality1AveragePrice:cl,
   quality1Series:Array.from({length:7},()=>[Math.round(daily),cl])});}}
export const materialHistory=[];
for(let t=2;t<=8;t++)for(let e=0;e<=4;e++){if(t<4&&e)continue;for(const c of CITIES){const d=[0,0,40000,20000,25000,8000,2500,700,200][t]*[1,.5,.2,.08,.03][e];
 materialHistory.push({id:id(t,'FIBER',e),city:c,averageDailyUnits:d,averageUnitPrice:fiber[t]*em[e]});materialHistory.push({id:id(t,'CLOTH',e),city:c,averageDailyUnits:d/3,averageUnitPrice:cloth[t]*em[e]});}}
