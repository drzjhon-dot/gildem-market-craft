# Gildem Craft Pro v8.8.0 · Planes que no saturan el mercado, pero tampoco son mediocres

## La idea
No fabricas lo mismo todos los días: haces un lote y lo vendes en varios días. El motor ahora dimensiona cada lote según **cuánto bajaría el precio con tus propias ventas**, en lugar de usar un porcentaje fijo del volumen para todos los objetos.

## Cómo funciona (`core/market-impact.js`)
- Impacto medio en el precio = **k × tu cuota** del volumen observado durante los días de venta.
- El lote crece mientras la ganancia de la **última** unidad siga siendo una fracción útil de la de la primera.
- Resultado: **margen alto ⇒ lote grande; margen fino ⇒ lote pequeño**. Un objeto con 3 % de margen ya no se llena como uno con 25 %.
- El beneficio del plan **ya viene descontado** por esa saturación (antes era optimista), y se muestra en Resultados: cuota media, cuota máxima y beneficio perdido por saturación estimada.
- Se mantienen: caída de actividad en la última semana reduce la capacidad (una subida no la infla), competencia, antigüedad de precios y confianza.
- Rutas con libro de órdenes verificado siguen usando el libro real (sin penalización doble).

## Estilo del plan (nuevo selector)
| Estilo | Cuota máx. del volumen | Para qué |
|---|---|---|
| Prudente | 12 % | Casi no mueves el precio |
| Equilibrado (por defecto) | 22 % | Impacto moderado si el margen lo compensa |
| Agresivo | 35 % | Lotes grandes en objetos de margen alto |

El selector antiguo de horizonte pasa a llamarse **«Días para vender el lote (hasta tu próximo craft)»**: elige cuándo piensas repetir el craft.

## Importante
Los parámetros (k, tope y cuota) son una **estimación transparente, no ventas medidas**. Lo ideal es calibrarlos con tus ventas reales registradas. Probado con datos simulados; falta validarlo con cotizaciones reales de AODP.

## Pruebas
301 pruebas (9 nuevas en `tests/v8_8_0-saturation.test.mjs`) y `npm run build` correctos.

## Instalación
Copia todos los archivos del ZIP sobre tu repositorio con GitHub Desktop, Commit to main → Push origin, espera `Published` en Netlify, Ctrl + Shift + R y comprueba `v8.8.0`.
