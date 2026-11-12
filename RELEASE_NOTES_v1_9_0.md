# Gildem Market & Craft 1.9.0

- Navegación: **Top Mercado**, **Craft Planner** y **Calculadora** (PC y móvil). Las pestañas Flips y Refinamiento se eliminaron.
- **Refinamiento** está dentro de Ramas del mercado con cinco ramas: Lingotes, Tablas, Tela, Cuero y Bloques de piedra. Sus recetas de referencia se contrastan en Planner con ao-bin-dumps; no se inventan precios.
- El límite de **6 ramas** se elimina. Puedes marcar ramas de cualquier grupo; la consulta se pagina de 240 IDs por página y permite «Ampliar cobertura»; los datos pueden ser parciales si AODP aplica límites.
- Motor de crafting: reserva diversidad viable de tiers/encantamientos y después selecciona iterativamente el siguiente craft según su **beneficio marginal estimado por capital**, sin continuar fabricando cuando una unidad adicional reduce el beneficio esperado.
- El presupuesto, el estilo prudente/equilibrado/dinámico, las ciudades de destino, los tiers, encantamientos y el límite de inversión por artículo se aplican en cada ruta. La opción de fama permite pérdidas únicamente dentro del límite configurado.
- Los resultados son estimaciones de actividad y cotizaciones de AODP West. **No son ventas garantizadas ni profundidad ejecutable de órdenes.**

## Nuevas compras Royal + diarios

- En **Craft Planner → Configuración del plan** puedes comparar compras de materiales y diarios entre las cinco ciudades Royal conectadas por rutas seguras, comprar solo donde fabricas, incluir Caerleon de forma voluntaria, y configurar el coste de transporte por unidad.
- El motor calcula el coste efectivo por materia como **precio de venta observado + traslado estimado** y utiliza ese coste tanto en el capital reservado como en el profit, evitando recomendar un material remoto si moverlo anula el ahorro.
- En Calculadora, los diarios opcionales también se buscan en varias ciudades. Se agrupan por tier y tipo, con precio, origen y coste de traslado visible. **No se cargan al profit de crafting** porque son opcionales y no se cuenta un supuesto valor de recuperación/venta de diarios llenos.
- CSV y copiado de compras incluyen ciudad de origen y destino de fabricación. Las cotizaciones proceden de AODP West; el transporte es una **estimación manual** y la profundidad de órdenes no está verificada.
- Corregida la caché del modo móvil/PWA para no intentar descargar archivos Flips eliminados.
