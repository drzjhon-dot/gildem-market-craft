# Política de fuentes de mercado · v9.9.0-top.3

## Mercado: AODP West exclusivamente

- Host: `https://west.albion-online-data.com`
- `/api/v2/stats/prices/{ids}.json`: cotizaciones de compra y venta con marca temporal.
- `/api/v2/stats/history/{ids}.json`: historial observado (puede estar incompleto, no garantiza ventas futuras).
- `/api/v2/stats/orderbook/{ids}.json`: profundidad observada de ofertas.
- `/api/v2/stats/festivities`: festividades confirmadas del juego cuando están disponibles.
- Solo región `west`; los datos de Europa y Asia se rechazan.
- Las llamadas de consultas están agrupadas y cacheadas para respetar límites de AODP.
- Top Mercado puede agregar calidades 1 a 5; el cálculo del crafting no convierte automáticamente ese agregado en ventas garantizadas.
- La fecha de consulta no equivale a la fecha de observación del mercado.

## Otras páginas

Los enlaces y las comprobaciones de disponibilidad a webs de mercado competidoras se eliminaron del flujo activo. Las estadísticas pegadas manualmente en versiones anteriores permanecen en los respaldos del usuario, pero no influyen en ningún plan de esta edición.

## Metadatos de recetas e imágenes

La API de AODP no incluye todas las recetas de fabricación; se mantienen los catálogos ajenos al mercado procedentes de los datos del juego y sus traducciones. Estos archivos aportan requisitos de fabricación, no cifras de precio o demanda. Los iconos se obtienen del render oficial de Albion mediante un proxy o del respaldo local.

## Límites

No existe monitor NATS 24/7 en Netlify; la edición usa AODP REST. Si la API no responde, el programa no debe inventar observaciones frescas. Confirmar los precios y la capacidad de compra dentro del juego antes de invertir.
