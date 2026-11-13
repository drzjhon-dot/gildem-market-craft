# Investigación de fuentes y clientes de datos · v8.6.7

Esta revisión se realizó para mejorar planes de fabricación **América (West)**, sin confundir clientes de captura con APIs externas ni utilizar datos de Europa.

## Fuentes revisadas

- **Albion Free Market Data Client**: https://github.com/JPCodeCraft/AlbionDataAvalonia . Cliente multiplataforma que captura precios observados y, cuando está en modo público, los publica en **AODP**. Tiene un registro local de operaciones ejecutadas que puede exportarse en CSV. En **modo privado**, ciertas órdenes se dirigen a AFM, no a AODP. No se obtuvo ningún token ni dato privado de la suscripción del usuario. El README recomienda **solo un cliente de captura a la vez**.
- **Albion Market Data Client**: https://github.com/albionmarketgg/dataclient . Cliente Windows que envía observaciones a **albionmarket.gg**, un servicio distinto de AODP. Su repositorio se distribuye bajo **PolyForm Noncommercial**. No se incorporó su código ni se asumió una API gratuita para terceros.
- **Albion Market Tools**: https://github.com/millelog/albion-market-tools . Ejemplo con licencia **MIT** para analizar precios, profundidad y volumen histórico, filtros de ROI e impuestos, y cálculo de flipping entre ciudades. Útil como referencia arquitectónica, no como fuente alternativa de órdenes AODP.
- **Albion Free Market Profitable Crafts**: https://albionfreemarket.com/profitable-crafts . Su documentación pública distingue EMV de precios de orden ejecutable, muestra ventas de los últimos 14 días y compara 10 fabricaciones por receta/ruta. Resultados de pago NO se descargan ni se asumen accesibles sin autorización.

## Qué está integrado en Gildem Craft Pro

1. `west.albion-online-data.com`: precios, historial y órdenes. Es la única fuente numérica automática por defecto.
2. Informe manual de rotación West con fuente y fecha explícitas, cuando el usuario lo pega voluntariamente.
3. Inventario/ventas propios registrados por el usuario para reducir la cantidad sugerida en mercados donde ya tiene artículos pendientes.
4. Los límites de volumen y las compras por etapas consideran **observaciones históricas**, no ventas garantizadas. No confundir capturas de precios con transacciones completadas.

## Ideas futuras que requieren un paso adicional

- Importar **un CSV exportado voluntariamente** desde la pestaña *Trades* del cliente AFM, distinguiendo las ventas reales propias de la actividad de AODP. No leer archivos locales automáticamente desde el navegador.
- Para ver la suscripción de AFM: usar un mecanismo de exportación documentado o una API oficialmente autorizada, nunca intentar capturar credenciales, eludir paywalls o extraer tokens de sesión.

## Nota de seguridad y compatibilidad

No instales dos clientes simultáneamente solo para alimentar esta calculadora. Un cliente de captura observa el mercado mientras juegas, y no vuelve *actuales* todas las cotizaciones por sí solo. Comprueba siempre el servidor West y la antigüedad de la observación antes de fabricar.
