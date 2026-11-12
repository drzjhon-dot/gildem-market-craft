# Integraciones y límites de licencia · Gildem Market & Craft v1.8

Esta edición mantiene código independiente: **no copia** componentes de los proyectos externos abajo. El motor web es original, escrito para AODP West REST, y no usa drivers, sniffer, credenciales o librerías .NET.

## 1. ao-data/ao-bin-dumps

- Fuente: https://github.com/ao-data/ao-bin-dumps
- Integración: `netlify/functions/catalog.mjs` recupera `items.json` y `src/refining.js` extrae materiales de recetas; se identifica `verifiedFromDump` y un respaldo de referencia cuando no se logra verificar.
- Usos: contrastar crafting y refinamiento, no precios ni volumen.
- Fuente grande (17 MB aprox.) y endpoint externo: puede fallar o agotar tiempo de la función; el respaldo no se marca como verificado.
- Su contenido puede cambiar tras parches: actualizar y probar antes de craftear.

## 2. AlbionDataAvalonia

- Fuente: https://github.com/JPCodeCraft/AlbionDataAvalonia
- Lección: un cliente de captura local permite contribuir observaciones de mercado a AODP mientras el jugador navega el mercado. **No hay conexión automática** entre ese cliente y esta web.
- Los archivos del repositorio usan una licencia personalizada que prohíbe uso comercial y distribución de pago, y exige atribución a sus derivados. **No se ha copiado ni incorporado código suyo**.
- Si decides usar el cliente para contribuir a AODP, revisa las instrucciones del autor y **no ejecutes simultáneamente dos clientes** que dupliquen las mismas observaciones.

## 3. AFMDataClientCore

- Fuente: https://github.com/JPCodeCraft/AFMDataClientCore
- Lecciones: datos de captura deben conservar fuente, hora y validez; no deben sumarse duplicados; los precios de paquetes de juego pueden venir escalados en 1/10.000 de silver. **AODP REST ya entrega precios en silver y NO requiere esa división**.
- Es una librería .NET de protocolo/ingesta, **no una API REST de precios que pueda desplegarse como una página estática**.
- La licencia es personalizada, no comercial, y no hay código de la librería incorporado a Gildem.

## 4. LiveFlipper

- Fuente: https://github.com/ozcankaya3535/Albion-Online-Market-Scanner-LiveFlipper
- Repositorio público inspeccionado: README; sin código público del motor de arbitrage para integrar.
- Implementación original: `src/flipping.js` + pestaña «Flips» en `src/main.js`.
- Royal → Royal y Royal → BM, cotización observada `sell_price_min` en origen y `buy_price_max` en destino, ambas **calidad 1**.
- Estima rentabilidad después de gastos configurables, transporte, margen de seguridad, impacto y participación en actividad Q1. Limita el presupuesto y diversidad de rutas.
- El resultado es **una simulación, no una oferta ejecutable**. El historial AODP es actividad de órdenes de venta y no operaciones cerradas.
- No utiliza inspección UDP, no instala APK, ni consulta una API privada de LiveFlipper.

## Por qué no prometemos Flips ejecutables

AODP Prices indica precios destacados *observados*, no el número de unidades al mejor nivel. Para validar un lote real convendría añadir AODP West Orderbook (nivel de profundidad, con fecha y validación de esquema) y re-calcular el VWAP efectivo de compra/venta; si falla el libro, se debe mostrar `profundidad no verificada` sin inventar volumen. No se afirma que Orderbook esté conectado en v1.8.

NATS West es un flujo de eventos para un servicio persistente, no una función Netlify que se ejecuta por petición. Su incorporación requiere almacenamiento, deduplicación y expiración de datos, además de estudiar costes y licencias.

### Documentación AODP
- https://west.albion-online-data.com/api-docs
- https://west.albion-online-data.com/developer

### Integridad y servidor
- Toda consulta de mercado pasa por `netlify/functions/market.mjs` y usa `https://west.albion-online-data.com`.
- Los catálogos no reemplazan los datos de mercado y nunca aportan precios automáticos.
- `Flips` utiliza datos sólo del servidor América/West, con fecha UTC, calidad 1, y rechazando precios demasiado antiguos.
