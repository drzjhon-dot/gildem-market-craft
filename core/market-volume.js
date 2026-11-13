// Historical AODP item_count is a sampled activity/turnover signal, NOT
// proof of current orderbook depth, execution or an available stock level.
const finite = x => Number.isFinite(Number(x)) ? Math.max(0, Number(x)) : 0;
export function prudentDailyVolume(activity14, activity7) {
  if (!(activity14?.observations > 0)) return null;
  const longDaily = finite(activity14.observedDaily);
  if (!(longDaily > 0)) return 0;
  // Recent 7-day evidence can reduce a stale 14-day estimate, never inflate it.
  if (activity7?.observations > 0) return Math.min(longDaily, finite(activity7.observedDaily));
  // A missing separate 7-day series is not evidence of a 50% demand drop.
  // Keep the observed 14-day rate for the quantity cap, while volumeTrend()
  // explicitly reports missing recent evidence and ranking remains conservative.
  // Otherwise modestly active, demonstrably profitable Royal listings can be
  // rounded from one permissible craft to zero and silently disappear.
  return longDaily;
}
export function prudentListingCapacity(route, fraction=.10) {
  const daily = prudentDailyVolume(route?.activity, route?.activity7);
  if (daily === null) return null;
  const rate = Math.max(0, Math.min(.25, finite(fraction)));
  return Math.max(0, Math.floor(daily * rate / Math.max(1, finite(route.craftAmount) || 1)));
}
export function volumeTrend(activity14, activity7) {
  const d14 = finite(activity14?.observedDaily), d7=finite(activity7?.observedDaily);
  if (!(activity14?.observations>0)) return 'Sin historial';
  if (!(activity7?.observations>0)) return 'Últimos 7 días sin observaciones';
  if (d7 < d14*.7) return 'Rotación observada a la baja';
  if (d7 > d14*1.3) return 'Rotación observada al alza';
  return 'Rotación relativamente estable';
}

// Mild ranking weight: high turnover helps break ties, without overriding ROI or risk.
export function liquidityWeight(activity14,activity7){
 const day=prudentDailyVolume(activity14,activity7);
 if(day===null)return .65;
 return .72+.28*Math.min(1,Math.log1p(day)/Math.log1p(100));
}
