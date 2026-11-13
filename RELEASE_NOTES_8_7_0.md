# Gildem Craft Pro v8.7.0 · Plan de crafteo proporcional a la demanda

## Qué fallaba
El motor de producción de volumen limitaba **cada objeto al mismo porcentaje del presupuesto** (11 %–75 % según cuántos objetos hubiera), y además repartía por turnos hasta ~48 unidades a cada ruta. Resultado: un objeto con 2.500 observaciones/día recibía casi lo mismo que uno con 300/día, y los objetos poco activos absorbían capital que el mercado grande podía haber usado.

## Qué cambia
- **Reparto por demanda** (`core/allocator-v6.js`): cada ruta recibe una cuota del capital según lo que su mercado puede absorber (capacidad × coste). Más actividad ⇒ más unidades, siempre limitadas por la capacidad de ese mercado.
- Se elimina la ronda por turnos en modo volumen; se mantiene 1 unidad de cada ruta para diversificar.
- **Tope por objeto dinámico**: el tope plano pasa a ser un mínimo; un objeto que concentra gran parte de la demanda puede llegar hasta el 60 % del presupuesto. Las ediciones manuales (`validateIntelligentEdits`) respetan ese mismo tope.
- **Capacidad prudente** (`core/demand-first.js`): si la última semana tiene menos actividad que el promedio de 14 días, la capacidad baja. Una subida reciente no la infla.
- **Añadir ruta manualmente** usa el mismo cálculo de capacidad que el motor (antes ignoraba el horizonte de venta).
- Sin cambios de precios, impuestos, filtros de actividad (>50/semana) ni lógica de verificación.

## Pruebas
292 pruebas (4 nuevas en `tests/v8_7_0-demand-weighted.test.mjs`) y `npm run build` correctos. Probado con datos simulados; falta validar con cotizaciones reales de AODP.

## Instalación
Sustituye los archivos del repositorio por los de este ZIP (o solo `core/allocator-v6.js`, `core/demand-first.js`, `core/intelligent-portfolio.js`, `app.js` y los archivos de versión), Commit y Push. Tras publicar en Netlify, Ctrl+Shift+R y comprueba `v8.7.0`.
