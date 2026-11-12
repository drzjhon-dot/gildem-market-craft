/**
 * Gildem 2.1 · Lectura de la serie diaria Q1 (AODP History, time-scale 24).
 * El promedio de la ventana es frágil: un solo día con un volcado grande lo infla
 * y una caída reciente queda escondida. Aquí se calcula, SOLO con días observados:
 *  - media sin el día pico (robusta a volcados aislados),
 *  - media de los últimos 3 días (momento reciente),
 *  - concentración del pico y dispersión diaria,
 *  - precio Q1 reciente frente al de la ventana.
 * Nunca aumenta la demanda observada: solo puede reducirla o dejarla igual.
 */
const num=x=>Number.isFinite(Number(x))&&Number(x)>=0?Number(x):0;
/** Serie compacta: [[unidades, precioMedio], ...] un elemento por día UTC de la ventana, del más antiguo al más reciente. */
export function normalizeSeries(series){
 if(!Array.isArray(series))return null;
 const out=series.map(x=>Array.isArray(x)?[num(x[0]),num(x[1])]:[num(x?.units),num(x?.price)]);
 return out.length?out:null;
}
export function demandSignals(row){
 const series=normalizeSeries(row?.quality1Series);
 const mean=num(row?.quality1DailyUnits??row?.q1Daily);
 if(!series||series.length<3||!(mean>0))return null;
 const days=series.length,units=series.map(x=>x[0]),total=units.reduce((a,b)=>a+b,0);
 if(!(total>0))return null;
 const windowMean=total/days,peak=Math.max(...units),peakShare=peak/total,active=units.filter(x=>x>0).length;
 // Media sin el día pico: solo con ventanas de 5+ días y actividad en 3+ días.
 const trimmed=days>=5&&active>=3?(total-peak)/(days-1):windowMean;
 const robust=Math.min(windowMean,trimmed);
 const tail=units.slice(-3),recent3=tail.reduce((a,b)=>a+b,0)/tail.length;
 const sd=Math.sqrt(units.reduce((a,b)=>a+(b-windowMean)**2,0)/days),cv=sd/windowMean;
 // Momento: si los últimos 3 días están por debajo, la demanda usada se acerca a ellos.
 // Si están por encima, no se persigue el aumento (puede ser un pico).
 const momentumApplies=days>=7&&active>=4;
 const falling=momentumApplies&&recent3<robust*.6;
 const demandDaily=momentumApplies&&recent3<robust?(robust+recent3)/2:robust;
 // Precio Q1 reciente (ponderado por unidades) frente al de toda la ventana.
 const priced=series.filter(x=>x[0]>0&&x[1]>0),recentPriced=series.slice(-3).filter(x=>x[0]>0&&x[1]>0);
 const wavg=list=>{const u=list.reduce((a,x)=>a+x[0],0);return u?list.reduce((a,x)=>a+x[0]*x[1],0)/u:null;};
 const windowPrice=wavg(priced),recentPrice=recentPriced.length?wavg(recentPriced):null;
 const priceRecentRatio=windowPrice&&recentPrice?recentPrice/windowPrice:null;
 const spike=days>=5&&peakShare>=.35&&peak>=4*Math.max(trimmed,1e-9);
 const label=spike?'Pico aislado':falling?'Actividad cayendo':cv<=.6?'Estable':'Irregular';
 const level=spike||falling?'warn':cv<=.6?'good':'mid';
 return {days,active,windowMean,robustDaily:robust,recent3,demandDaily:Math.min(mean,demandDaily),
  peakShare,cv,falling,spike,label,level,recentPrice,windowPrice,priceRecentRatio,
  priceFalling:priceRecentRatio!=null&&priceRecentRatio<.9,units};
}
/** Mini-barras de texto para tablas: altura relativa de cada día de la ventana. */
export function sparkLevels(units){const max=Math.max(...units,0);return units.map(x=>max?Math.round(8*x/max):0);}
