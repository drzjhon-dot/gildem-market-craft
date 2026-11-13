# v9.9.0-top.3 | Experimento AODP como única fuente de mercado

**Base:** 9.9.0-top.2 (Calculadora de Craft, Black Craft, Royal Craft, Top Mercado y Ajustes).

**Mercado:** únicamente AODP REST West para precios, historial, profundidad de órdenes y acontecimientos.

- La importación manual de rankings de terceros quedó desactivada. Incluso si había estadísticas externas guardadas, ya no afectan al cálculo.
- Eliminadas de la interfaz las tarjetas de fuentes externas y las llamadas de comprobación HEAD a otros sitios.
- Las imágenes de ítems se descargan solamente mediante el render oficial del juego, con proxy Netlify y respaldo local.
- Se preservan el motor económico original, formularios y flujo a Calculadora de Craft.
- **Excepción de datos indispensable:** AODP no tiene catálogo completo de recetas ni traducciones de crafting. Seguimos obteniendo estos metadatos del juego mediante los catálogos existentes; **no son datos de precios, demanda ni órdenes**. Desconectarlos sin sustituirlos rompería el planificador.
- No se inventan datos ni se prometen ventas; el historial de AODP procede de observaciones de órdenes de venta.
- No se integra NATS: necesita un trabajador permanente fuera de una función bajo demanda de Netlify.

## Prueba de humo
1. Black Craft > Mazas > presupuesto 10M > Generar: revisar que el plan usa precios e historial AODP West.
2. Royal Craft con configuración equivalente: comprobar plan y paso a Calculadora.
3. Top Mercado > Mazas > Mercado Negro > 7/14 días: examinar actividad, días observados y advertencia de cobertura parcial.
4. Ajustes: el bloque de importación externa ya no existe.
5. Si AODP no responde o no tiene datos, no tratarlo como 0 ventas ni sustituirlo por otra web.
