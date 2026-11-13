# Gildem Craft Pro v8.9.0 · Mecánicas reales de mercado (West)

Basada en la investigación de `INVESTIGACION_MERCADOS.md`.

## Corregido
- **Comisiones del Mercado Negro.** La herramienta aplicaba 2,5 % de impuesto + 2,5 % de publicación (5 %). Lo correcto es el mismo impuesto que en Royal: 4 % con Premium u 8 % sin Premium, más 2,5 % si publicas orden (6,5 % o 10,5 %). Los beneficios del Mercado Negro salían inflados en 1,5 % del precio de venta. Ahora ambos mercados leen **Ajustes → Tipo de cuenta**.

## Nuevo
- **Lote del Mercado Negro a precio medio.** Su precio va en sierra: sube mientras nadie le vende y baja al venderle. Si la puja actual está por encima de la mediana de 14 días, el lote se valora a la mediana. Las rutas que solo eran rentables por un pico desaparecen del plan y se avisa de cuántas fueron.
- **Demanda por calidades.** Se consulta también el volumen de calidades 2 y 3 (solo de las rutas con margen, máximo 3 consultas extra). El lote máximo es el que cabe en la demanda Normal (el 68,9 % de lo que crafteas sale Normal) y en el total.
- **«Qué pide el mercado ahora».** Panel en Resultados con los objetos más pedidos: en el Mercado Negro, puja sobre su media (pedidos acumulados); en Royal, poca oferta por delante de tu orden. Indica si cada uno está en tu plan.
- **Orden del plan.** A igualdad de lo demás, se prefieren objetos que el mercado pide ahora (ajuste suave, máximo ±12 %).

## Sin cambios
Filtro de actividad semanal, modelo de saturación y estilos del plan (v8.8.0), verificación antes de comprar.

## Pruebas
312 pruebas (11 nuevas en `tests/v8_9_0-market-mechanics.test.mjs`), `npm run build` correcto y carga en Chrome sin errores de consola. Todo con datos simulados: no se pudo consultar la API real de West desde el entorno de desarrollo.

## Instalación
Copia todos los archivos sobre tu repositorio con GitHub Desktop, Commit to main → Push origin, espera `Published` en Netlify, Ctrl + Shift + R y comprueba `v8.9.0`. Revisa en Ajustes que el tipo de cuenta (Premium o no) sea el tuyo.
