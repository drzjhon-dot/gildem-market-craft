// Cálculos para la pestaña Resultados de Gildem Craft Pro.
// Nunca confundir una cotización AODP con volumen realmente ejecutable.
const amount = n => Number.isFinite(Number(n)) ? Number(n) : 0;
const nonnegative = n => Math.max(0, amount(n));

export function resultsSummary(source) {
  const plan=source?.plan||{};
  const rows=Array.isArray(plan.rows)?plan.rows:[];
  const capital=nonnegative(plan.totalCost);
  const profit=amount(plan.totalProfit);
  const budget=nonnegative(source?.budget);
  const focus=nonnegative(plan.focusUsed ?? rows.reduce((sum,r)=>sum+amount(r.qty)*amount(r.focusPerUnit),0));
  const units=rows.reduce((sum,r)=>sum+nonnegative(r.qty)*Math.max(1,nonnegative(r.craftAmount)||1),0);
  const ages=rows.filter(r=>r.ageHours!==null&&r.ageHours!==undefined).map(r=>Number(r.ageHours)).filter(n=>Number.isFinite(n)&&n>=0);
  const confidence=rows.filter(r=>r.confidence?.score!==null&&r.confidence?.score!==undefined).map(r=>Number(r.confidence.score)).filter(n=>Number.isFinite(n)&&n>=0);
  const days=rows.filter(r=>r.activity?.activeDays!==null&&r.activity?.activeDays!==undefined).map(r=>Number(r.activity.activeDays)).filter(n=>Number.isFinite(n)&&n>=0);
  const black=rows.filter(r=>r.city==='Black Market'&&r.mode==='instant');
  return {
    capital,profit,budget,focus,units,routeCount:rows.length,
    roi:capital>0?profit/capital*100:null,
    budgetUsed:budget>0?Math.min(100,100*capital/budget):0,
    ageHours:ages.length?Math.max(...ages):null,
    confidence:confidence.length?Math.min(...confidence):null,
    activityDays:days.length?days.reduce((a,b)=>a+b,0)/days.length:null,
    blackVerified:black.filter(r=>r.depthVerified===true).length,
    blackTotal:black.length,
    unknownPriceCount:rows.length-ages.length,
    rows
  };
}

// Los importes por categoría son una distribución proporcional, no una segunda factura.
export function budgetGroups(source,categoryOf){
  const {capital,rows}=resultsSummary(source);
  const weights=new Map();
  for(const r of rows){
    const category=typeof categoryOf==='function'?categoryOf(r):'Otros';
    const weight=nonnegative(r.qty)*nonnegative(r.capitalPerUnit);
    weights.set(category,(weights.get(category)||0)+weight);
  }
  const total=[...weights.values()].reduce((a,b)=>a+b,0);
  return [...weights].sort((a,b)=>b[1]-a[1]).map(([category,weight])=>({
    category,percent:total>0?100*weight/total:0,
    capital:total>0?capital*weight/total:0
  }));
}

// Los techos de compra se derivan del plan y del presupuesto, NO de un libro de órdenes.
// Si todos los materiales alcanzan su techo, el aumento de costo agregado no excede
// ni 25% del profit estimado ni el capital restante. Los lotes pueden no estar disponibles.
// v9.9.0 · «A comprar» descuenta el retorno: la estación devuelve recursos que se
// reutilizan mientras se fabrica, así que se compra el consumo NETO (qtyNet). El
// bruto de la receta queda como referencia, y por eso el bono de ciudad, el bono
// diario y el Focus ahora SÍ cambian cuánto comprar. Los techos y el capital se
// calculan sobre la cantidad comprada.
export function shoppingWithCeilings(source){
  const plan=source?.plan||{};
  const gross=(Array.isArray(plan.materials)?plan.materials:[]).map(m=>{
    const qtyGross=Math.ceil(nonnegative(m.qtyGross));
    const net=m.qtyNet==null?qtyGross:Math.ceil(nonnegative(m.qtyNet)-1e-9);
    const qtyBuy=Math.max(0,Math.min(qtyGross,net));
    return {...m,qtyGross,qtyBuy,reused:Math.max(0,qtyGross-qtyBuy),unitPrice:nonnegative(m.unitPrice)};
  });
  const totalMaterial=gross.reduce((s,m)=>s+m.qtyBuy*m.unitPrice,0);
  const spare=Math.max(0,nonnegative(source?.investableBudget??source?.budget)-nonnegative(plan.totalCost));
  const extra=Math.min(spare,Math.max(0,amount(plan.totalProfit))*.25);
  return gross.map(m=>{
    const cost=m.qtyBuy*m.unitPrice;
    const allowance=totalMaterial>0?extra*cost/totalMaterial:0;
    const ceiling=m.qtyBuy>0?m.unitPrice+allowance/m.qtyBuy:m.unitPrice;
    return {...m,buyCost:cost,grossCost:cost,suggestedCeiling:ceiling};
  });
}

export function preflightOverview(report,summary){
  if(!summary.routeCount)return {status:'empty',title:'Sin plan generado',details:[]};
  if(!report)return {status:'pending',title:'Comprobación pendiente',details:[
    {level:'pending',text:'Reconsultar precios y órdenes antes de comprar'},
    {level:'pending',text:'Verificar profundidad de materiales, si está disponible'},
    {level:'pending',text:'Confirmar tasas de taller y transporte en el juego'}
  ]};
  const blockers=Array.isArray(report.blockers)?report.blockers:[];
  const notes=Array.isArray(report.notes)?report.notes:[];
  const good=report.ok&&blockers.length===0;
  return {
    status:!good?'warning':notes.length?'partial':'verified',
    title:!good?'Revisión necesaria antes de comprar':notes.length?'Verificado con advertencias':'Comprobación favorable',
    details:[
      ...blockers.slice(0,5).map(text=>({level:'danger',text:String(text)})),
      ...notes.slice(0,4).map(text=>({level:'warning',text:String(text)})),
      ...(blockers.length===0?[{level:'ok',text:'No se detectaron bloqueos en las comprobaciones efectuadas'}]:[])
    ],
    at:report.at||null
  };
}

export function shoppingListText(source,nameOf=id=>id){
  const mats=shoppingWithCeilings(source);
  const journals=source?.plan?.journalSummary?.items||[];
  const lines=['GILDEM CRAFT PRO | LISTA DE COMPRAS',
    'Material | Comprar | Ciudad | Precio presupuestado/u | Techo prudente/u'];
  for(const m of mats)lines.push(`${nameOf(m.id)} | ${m.qtyBuy??m.qtyGross} | ${m.city||'Sin ciudad'} | ${Math.round(m.unitPrice)} | ${Math.floor(m.suggestedCeiling)}`);
  if(journals.length){lines.push('DIARIOS VACÍOS | Cantidad | Ciudad | Costo estimado');for(const j of journals)lines.push(`${j.name||nameOf(j.empty)} | ${j.qty} | ${j.buyCity||'Por definir'} | ${Math.round(amount(j.purchaseCost))}`)}
  lines.push('Precios orientativos sujetos a antigüedad, volumen, tasas y ejecución. Confirmar en el juego.');
  return lines.join('\n');
}
