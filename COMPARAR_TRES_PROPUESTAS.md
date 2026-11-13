# Cómo usar las tres propuestas · v9.9.0-top.5

Elige una rama, tiers, encantamientos, presupuesto, días de venta, ciudad de fabricación, estilo y objetivo en Black Craft o Royal Craft.

1. Genera un plan con la API oficial AODP West.
2. El motor busca entre las recetas que cumplen la selección, investiga precios y movimiento observado y filtra rutas sin margen y sin evidencia suficiente.
3. La sección **Tres propuestas para la misma inversión** presenta **Más silver**, **Silver y rotación** y **Más fama**, con el mismo universo de opciones factibles. Cada una presenta su presupuesto comprometido, beneficio, fama y número de objetos/combinaciones.
4. El plan del objetivo marcado en los controles es el plan activo. Seleccionando otra propuesta se vuelve a comprobar abastecimiento de materiales y los filtros estrictos. Si no supera el control de seguridad, no se cambia el plan.
5. Una propuesta válida se traslada a Calculadora de Craft, donde puedes añadir o editar objetos. Precios y cantidades de mercado no se garantizan al momento de vender.

**Cobertura de búsqueda:** la selección inicial admite hasta 1.800 recetas en Black Craft y hasta 1.400 en Royal Craft (1.800 en el modo amplio). El escaneo indica si la cobertura es parcial. La API es comunitaria y su historial no debe confundirse con ventas garantizadas.

**No se obliga a presentar alternativas distintas.** Si la liquidez, el Focus o el presupuesto solo permiten un plan seguro, las propuestas pueden coincidir. No se incorporan artículos no viables para forzar diversidad.

## Validación sintética

Se crearon 64 variantes hipotéticas de mazas para comprobar las tres estrategias con 5.000.000 silver (no son precios reales de West):

| Estrategia | Capital bruto simulado | Profit simulado | Fama estimada | Objetos / carriles tier+enchant |
|---|---:|---:|---:|---:|
| Más silver | 4.995.632 | 1.677.260 | 1.530.000 | 9 / 6 |
| Silver y rotación | 4.738.677 | 1.589.974 | 2.400.000 | 6 / 5 |
| Más fama | 4.952.486 | 1.661.512 | 2.544.000 | 6 / 5 |

Se prueban también tres presupuestos Royal, filtros no consecutivos, ausencia de oportunidades rentables, conservación del plan original y rechazo de alternativas fuera de los filtros. Que un objetivo produzca menos objetos distintos en un escenario no indica una violación: puede preferir variantes caras con mucha fama. La diversificación es secundaria a no perder silver y no exceder la demanda.
