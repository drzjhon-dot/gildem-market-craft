# Gildem Albion Lab 9.9.0-top.6 · Top Mercado en el planificador

- Black Craft y Royal Craft ahora obtienen el mismo historial AODP West que Top Mercado: las cinco calidades y días UTC completos, con una ventana de 14 días. Las cotizaciones de ventas siguen usando calidad Normal; los datos de las otras calidades son señales de actividad, nunca promesas de venta.
- AODP se consulta para una muestra equilibrada por tier/encantamiento: hasta 450 variantes Black y 200 Royal (320 con búsqueda amplia). Cuando el universo es mayor, se declara expresamente la cobertura parcial. No se inventan cantidades.
- El informe por tier «Top Mercado vs plan» indica cantidad de variantes con actividad, rutas con precio/coste, rutas viables y rutas seleccionadas. Permite diagnosticar por qué T6/T7/T8 no entraron.
- Cuando existen al menos cuatro objetos viables, incluso «Más silver» habilita un criterio suave de diversidad. La asignación considera una ruta por tier viable antes de llenar su lista de artículos, siempre dentro del presupuesto y los límites de riesgo/capacidad. No se fuerzan rutas con pérdidas ni sin margen.
- Se mantienen cálculo de recetas, compras netas, diarios y tres propuestas.
- Las pruebas automatizadas son con datos simulados; no garantizan beneficios ni disponibilidad en West.
