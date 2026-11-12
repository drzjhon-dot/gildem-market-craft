/**
 * Gildem 3.0 · Diagnóstico del plan en lenguaje claro (Motor 3.0).
 * Explica por qué el plan salió vacío o pequeño y qué ajuste concreto lo cambiaría.
 * Solo usa los motivos que el motor ya registró; no inventa causas.
 */
const STYLE={prudent:'Prudente',balanced:'Equilibrado',dynamic:'Dinámico'},SHARE={prudent:20,balanced:30,dynamic:45};
const pct=(n,t)=>t?Math.round(n/t*100):0;
export function planAdvice({rejected={},candidates=0,config={},summary=null,rows=[],shareTrim=null}={}){
 const total=Object.values(rejected).reduce((a,b)=>a+(Number(b)||0),0)+candidates;const tips=[];
 const capital=summary?.capitalReserved||0,budget=Number(config.budget)||0,empty=!rows.length;
 const small=!empty&&budget>0&&capital<budget*.25;
 if(!empty&&!small&&!shareTrim?.crafts)return {level:'ok',tips};
 const add=(score,title,detail,action=null)=>tips.push({score,title,detail,action});
 const r=k=>Number(rejected[k])||0;
 if(r('sinCupo'))add(r('sinCupo'),`${r('sinCupo')} rutas: un solo craft ya supera lo que tu estilo permite vender`,
  `Con ${STYLE[config.style]||config.style} (${SHARE[config.style]??12} % de lo vendido) y ${config.saleDays} días de venta, la demanda Q1 de esas rutas es demasiado baja. Prueba ${config.saleDays<7?'7 días de venta, ':''}${config.style!=='dynamic'?'un estilo con más volumen, ':''}o tiers/encantamientos con más actividad (en Top Mercado, filtra por «Vendidos Q1/día»).`);
 if(r('margenProteccion'))add(r('margenProteccion')*1.5,`${r('margenProteccion')} rutas son rentables, pero las descarta tu protección del beneficio`,
  `El colchón de compra (${config.buyBufferPct} %) y el descuento de venta (${config.sellHaircutPct} %) se comen el margen. Para refinado usa la pestaña Refinamiento, que tiene su propio motor.`,'refining');
 if(r('margenNegativo'))add(r('margenNegativo'),`${r('margenNegativo')} rutas no alcanzan beneficio o tu ROI mínimo (${config.minRoiPct} %)`,
  `${Number(config.minRoiPct)>0?`Bajar el ROI mínimo a ${Math.max(0,Number(config.minRoiPct)-5)} % `:'Cambiar las ciudades de venta '}o comparar en la Calculadora dónde se pierde margen (materiales, impuestos, venta).`);
 if(r('sinHistorial'))add(r('sinHistorial'),`${r('sinHistorial')} rutas sin ventas de calidad 1 observadas`,`Sin historial Q1 el motor no estima demanda. Elige otras ciudades de venta o revisa esos artículos en Top Mercado.`);
 if(r('sinPrecioVenta')+r('sinPrecioMaterial'))add(r('sinPrecioVenta')+r('sinPrecioMaterial'),`${r('sinPrecioVenta')+r('sinPrecioMaterial')} rutas sin cotizaciones recientes`,
  `Faltan precios de venta o de materiales de las últimas ${config.maxQuoteHours} h. Activa «Forzar datos frescos» o abre el mercado en el juego con el cliente de datos.`);
 if(r('fueraPresupuesto'))add(r('fueraPresupuesto'),`${r('fueraPresupuesto')} rutas cuestan más que tu presupuesto por craft`,`Sube el presupuesto o quita tiers/encantamientos altos.`);
 if(r('fueraFiltros'))add(r('fueraFiltros')*.2,`${r('fueraFiltros')} artículos fuera de tus tiers/encantamientos`,`Están en tu cesta pero no en los tiers o encantamientos marcados.`);
 if(r('sinReceta'))add(r('sinReceta')*.5,`${r('sinReceta')} artículos sin receta verificada`,`No se pueden planificar hasta verificar su receta con el dump del juego.`);
 if(shareTrim?.crafts){const lims=Object.entries(shareTrim.by||{}).map(([k,v])=>`máx. por ${k} ${v} %`).join(', ');
  // Si el límite efectivo es mayor que el del usuario, es porque con pocos grupos el suyo era imposible.
  add(1e9,`Para respetar tus límites (${lims}) se quitaron ${shareTrim.crafts} crafts`,`Los límites se miden sobre el capital del plan, con margen de un craft. Si prefieres más volumen, sube esos porcentajes en «Opciones avanzadas».`);}
 if(!empty&&!config.useBudget&&budget>0&&capital<budget*.25&&!tips.length)add(.5,`El plan invierte ${pct(capital,budget)} % del presupuesto`,`Con «Usar todo lo posible» desmarcado cada lote adicional debe rendir tu ROI mínimo (${config.minRoiPct} %). Márcalo para seguir mientras haya beneficio, o añade más artículos desde Top Mercado.`);
 if(small&&!tips.length)add(1,`El plan usa ${pct(capital,budget)} % del presupuesto`,`La demanda observada no da para más con tu configuración. Añade más artículos al Planner desde Top Mercado.`);
 tips.sort((a,b)=>b.score-a.score);
 return {level:empty?'empty':'small',tips:tips.slice(0,4),evaluated:total};
}
