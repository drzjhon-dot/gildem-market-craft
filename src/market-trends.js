/** Market intelligence overlay. Uses *observed* Q1 History only.
 * Long window must cover the same item+city and end on same complete UTC date.
 * AODP History tracks order activity, not executable sales/available book depth.
 */
export function enrichTrends(current=[],long=[],{enabled=true}={}){
 const index=new Map(long.map(x=>[`${x.id}|${x.city}`,x]));
 let compared=0,falling=0,fast=0;
 const rows=current.map(h=>{
  const prior=index.get(`${h.id}|${h.city}`);
  const observed=Number(h.quality1DailyUnits??h.averageDailyUnits)||0;
  if(!enabled||!prior||!(prior.days>h.days)||prior.to!==h.to||!(Number(prior.quality1DailyUnits)>0))return {...h,quality1DemandSource:'Última ventana UTC',trend:'sin referencia',trendRatio:null};
  compared++;
  const baseline=Number(prior.quality1DailyUnits);
  const ratio=observed/baseline;
  // Historical activity does not create extra executable depth. Increasing activity
  // can only prevent discounting; declining activity reduces the allowable batch.
  const effective=Math.min(observed,baseline*1.15);
  if(ratio<.8)falling++;if(ratio>1.5)fast++;
  const priorAvg=Number(prior.quality1AveragePrice)||0;
  const presentAvg=Number(h.quality1AveragePrice)||0;
  // A sudden Q1 price jump should not determine the entire plan's clearing price.
  const stablePrice=priorAvg>0&&presentAvg>0?Math.min(presentAvg,priorAvg*1.15):null;
  return {...h,effectiveQuality1DailyUnits:effective,trendRatio:ratio,
   trend:ratio<.8?'actividad inferior':ratio>1.5?'aumento reciente':'actividad estable',
   longWindowDays:prior.days,longDaily:baseline,longAveragePrice:priorAvg||null,
   stabilizedQuality1Price:stablePrice,quality1DemandSource:`${h.days}d actual + ${prior.days}d referencia`};
 });
 return {rows,compared,falling,fast,enabled};
}
