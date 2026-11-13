# Gildem Market & Craft v1.6.0 · Market Intelligence

**Release:** 12 de noviembre de 2026 · Proyecto independiente para Albion Online América (West).

## Por qué se rehízo el flujo

El error conceptual de v1.5 era separar la selección del ranking de sus números de mercado: al enviar una fila al Planner se enviaba solamente el ID del objeto, mientras el Planner volvía a consultar History Q1 sin trasladar las cantidades elegidas ni la ciudad original. Además, el asignador retenía solo la mejor ciudad para cada ID, perdiendo otras rutas.

En v1.6 la unidad de evidencia es **artículo + mercado + periodo UTC + calidad**:

- El Top conserva por separado `allDaily` (calidades 1 a 5) y `q1Daily` (solo calidad 1), precio medio histórico y días activos.
- «Enviar marcados a Craft Planner» adjunta la ficha de evidencia y adopta inicialmente las ciudades de venta de las filas marcadas.
- El Planner **reutiliza** estas fichas si su periodo coincide exactamente con la ventana actual de 1, 3, 7 o 14 días completos UTC. Para otras ciudades consulta Q1 por separado. Si cambió la ventana UTC, vuelve a consultar y no reutiliza estadísticas antiguas.
- Si una segunda consulta devuelve cifras diferentes, el Planner conserva el dato de la fila que seleccionaste para ese periodo y muestra la diferencia en el resumen.
- El asignador permite **el mismo artículo en varios destinos** con historial Q1 independiente, pero aplica un tope de inversión combinado por SKU para no duplicar la concentración de capital entre ciudades.
- La cuota del lote se calcula por ciudad: fabricaciones × salida por craft, dividido por Q1 diario × días de venta. A menor frecuencia de días activos, menor cupo prudente.
- El diagnóstico muestra tanto las exclusiones de precio/receta/ROI como rutas viables que no recibieron capital por presupuesto, Focus, cupo o diversificación.

## Interfaz

- **Ramas del mercado:** selector de objetos individuales con búsqueda por nombre en español o ID, filtro «Mostrar seleccionados», modo «Todas las variantes» o «Solo mis artículos», hasta 150 variantes elegidas, botones «Marcar visibles» y «Borrar objetos».
- **Ranking:** columnas distintas de actividad diaria de todas las calidades y actividad diaria de calidad 1, con contador de días Q1 y barra de frecuencia. Los valores menores de media unidad/día aparecen como `<1` en lugar de redondearse a cero.
- **Craft Planner:** cesta con las cifras diarias de las ciudades enviadas, indicador de fuente de cada ruta y cuota sobre actividad Q1; panel de auditoría de tres pasos; destinos independientes y costes/riesgos ya existentes.
- **Calculadora:** sigue recibiendo cantidades por variante, incluyendo varias rutas de venta en un mismo artículo, con diarios opcionales agrupados por tier.
- **Nueva identidad visual:** Obsidian & Copper, fondo carbón azulado, cobre/bronce y marfil cálido; emblemas originales por ciudad, escenas de Albion reutilizadas, tipografía e iconos más legibles y sin violeta en el menú general de ramas.

## Qué no afirma el motor

AODP History se basa en **órdenes de venta** y no certifica ventas reales. Una actividad de 18 unidades/día en calidades 1–5 no demuestra 18 unidades/día de calidad 1, y menos aún que se puedan vender 18 de inmediato. Se usa exclusivamente Q1 para dimensionar lotes; se exige receta, cotización reciente y rentabilidad según objetivo. Las tasas, costes de estación/transporte y los supuestos de impacto en precio son configurables pero no sustituyen la profundidad real del libro de órdenes.

Una Maza T8.0 puede recibir **una fabricación** cuando tiene historial Q1, precio y receta, cabe dentro del presupuesto y cumple el riesgo permitido. Nunca se fuerza fabricación sin Q1, ni se crea beneficio ficticio. Si queda fuera, el diagnóstico indica la razón.

## Verificación

- **53 pruebas automatizadas aprobadas**, incluidas 8 comprobaciones nuevas de selección individual, reconciliación Q1, periodos UTC, rutas multi-mercado y capital compartido.
- `npm run build` genera correctamente `dist/` y copia todos los recursos y módulos nuevos.
- Recorrido Chromium con respuestas **simuladas**: selector individual → Top → marcados → Planner con fichas Q1 → plan → Calculadora y vista móvil de 390 px. Sin excepciones JavaScript ni desbordamiento horizontal en las pantallas probadas.
- **Pendiente:** comprobar desde Netlify las conexiones reales a AODP, disponibilidad del servidor y cotizaciones de mercado antes de invertir.
