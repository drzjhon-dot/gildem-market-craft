# v2.0.0 · Gildem Portfolio Engine

**Cambio principal**: reemplazo del asignador de planes por un motor de cartera independiente en `src/portfolio-engine.js`, con tres estrategias y revisión de mejora de beneficio neto.

- El horizonte del Top y la ventana de 14 días pueden contrastarse para detectar picos de actividad Q1, sin confundir actividad de órdenes con ventas ejecutadas.
- Con diversidad, controla el porcentaje máximo del capital por tier, encantamiento y familia. El límite por artículo, el presupuesto bruto, Focus y el cupo Q1 siguen siendo obligatorios.
- La asignación solo añade crafts si su beneficio incremental y sus restricciones lo permiten. Compara tres escenarios de cartera y explica el objetivo elegido.
- Se muestra una tabla de **Profit estimado / Capital / Variantes** para los tres repartos, sin duplicar la Calculadora de Craft.
- Están disponibles los parámetros `maxTierSharePct`, `maxEnchantSharePct`, `maxFamilySharePct`, `trendAnalysis`.
- Se conservan Top Mercado (incluido refinamiento como rama), Craft Planner y Calculadora de Craft; no vuelve Flips.
- Se mantiene la búsqueda de materiales y diarios por Royal con transporte manual. Las cotizaciones y recetas siguen requiriendo verificación.

### Verificación

100 pruebas automatizadas aprobadas, compilación `npm run build`, comprobación de sintaxis y simulación de 150 oportunidades. Las pruebas de navegación en navegador se intentaron, pero el entorno bloqueó la apertura de direcciones locales/interceptadas; por ello no se informa una validación visual completa.

### Limitaciones de producto

No se dispone de un libro de órdenes en vivo verificado en este entorno. El objetivo es maximizar **profit esperado sujeto a restricciones**, no prometer ejecución ni óptimo matemático global. Véase `INVESTIGACION_Y_ARQUITECTURA_MOTOR_V2.md`.
