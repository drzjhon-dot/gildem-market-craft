# Gildem Craft Pro v8.6.8 · Market-First Black Craft

**Qué cambia:** No se muestra ningún «Plan de investigación: 1 fabricación». Se generan rutas reales con cotizaciones y márgenes positivos cuando existen. Para el Mercado Negro por orden se añade una alternativa de **precio objetivo histórico** basada en actividad y medianas recientes de AODP América, únicamente si el escenario supera impuestos, costos, estrés y umbral de actividad. Esa alternativa es un plan **condicionado** y jamás una venta asegurada: se debe confirmar que se puede publicar al precio objetivo y que es razonable esperar la puja del NPC antes de comprar materiales o fabricar.

**Cuando ninguna ruta es viable:** se muestra «Sin crafting rentable con las cotizaciones disponibles» y botones para ampliar todas las variantes o volver a consultar la API. La herramienta no fabrica a pérdidas para agotar el presupuesto.

**Origen de datos:** AODP West exclusivamente. Los promedios de Albion Hub compartidos sirven para validar descubrimiento, no se convierten automáticamente en una API ni sustituyen precios. El usuario puede importar estadísticas West confirmadas desde Ajustes.

**Riesgo:** los precios históricos NO son bids actuales y el beneficio potencial depende del tiempo de venta, la fluctuación del BM, tasas, costos de materiales, exposición a gankers y compra por etapas. Se sigue mostrando el estado del stock en la lista de compra. La verificación previa puede bloquear un plan hipotético si el bid actual es insuficiente.

**Actualización:** copiar los archivos del ZIP de cambios sobre una instalación v8.6.7; Commit to main y Push origin usando GitHub Desktop. No hacer Merge manual entre ZIPs. Probar Black Craft > Arcos > T4-T6 > .0 y .1, sin Focus, con bono de Lymhurst, presupuesto 5M. Prestar atención a los avisos «Plan condicionado».
