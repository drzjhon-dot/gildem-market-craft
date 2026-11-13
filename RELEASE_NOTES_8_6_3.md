# Gildem Craft Pro 8.6.3 · AODP West, ROI y disponibilidad separados

Esta entrega **no requiere ejecutar instaladores ni usar Python en Windows**.

## Cambios comprobables

1. El ranking equilibrado incorpora una puntuación proporcional al ROI y la actividad observada. El beneficio de una variante cara y poco frecuente deja de dominar automáticamente un objeto común con miles de unidades observadas. El modo **máximo profit** sigue priorizando beneficio absoluto.
2. Los registros idénticos de historia AODP recibidos más de una vez ya no duplican el volumen de un item. Se preserva la separación por ciudad e ID.
3. Black Craft y Royal Craft registran **cuántas variantes se solicitaron a AODP y cuántas tienen historial**, incluso si el historial solo llegó parcialmente. No se presenta una solicitud exitosa como evidencia de actividad para todos los objetos.
4. En **Resultados → Calidad de los datos del plan** se separan el precio (y su antigüedad), actividad observada y primera compra estimada frente a cantidad objetivo. Las compras escalonadas quedan marcadas como **no confirmadas**, no como stock reservado.
5. Se mantuvo el servidor **América (West)** en frontend, API y proxy; no se mezclan mercados Europa/Asia.
6. La versión del proyecto, el precaché offline y la comprobación de Netlify fueron sincronizados.

## Límites que no se deben confundir

- La API `/api/v2/stats/history` recoge observaciones del mercado basadas en órdenes de venta. `item_count` **no garantiza ventas completadas**.
- Los precios de `prices` y los libros de `orderbook` son observaciones fechadas; no reservas. El servidor puede devolver datos parciales o antiguos.
- Una **compra en etapas** es un objetivo de abastecimiento y de venta, no una compra inmediata garantizada al precio unitario mostrado.
- Albion Hub, Royal Forge y otros portales no aportan cifras automáticamente cuando no tienen un feed verificable West. La importación manual sigue validando el servidor.

## Cómo desplegar

**Opción recomendada en GitHub Desktop:** descarga `Gildem_Craft_Pro_v8_6_3_SOLO_CAMBIOS.zip`, extrae y copia *su contenido* dentro del repositorio local en `main`, confirmando el reemplazo. **Haz Fetch/Pull y aborta cualquier merge pendiente antes de copiar.** Después haz Commit → Push. Son pocos archivos, no 100.

Si tu copia no está en 8.6.2, utiliza el ZIP COMPLETO. Nunca subas la carpeta ZIP como un archivo dentro del repositorio. El directorio raíz debe contener `app.js`, `package.json`, `index.html`, `core/`, `tests/` y `netlify/`.

Verificación local: `npm run build`; Netlify usa Node 22 y publica `dist`.
