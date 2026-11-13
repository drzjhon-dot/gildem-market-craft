# Gildem Albion Lab 9.9.0-top.7 · Diversidad prioritaria

- Control marcado por defecto en Black Craft y Royal Craft: **Forzar diversidad T6–T8**.
- Los planes priorizan cubrir tiers y encantamientos cuando existen rutas con actividad AODP reciente, precios válidos, coste comprobable y capital suficiente.
- Para T6–T8 se reduce el requisito de actividad semanal, se admite margen esperado menor y estrés negativo acotado (hasta 40% del capital por unidad). **No se admiten pérdidas netas previstas** y se advierte del riesgo.
- Una sola unidad de T7/T8 puede ocupar hasta el 72% de presupuesto como máximo dentro del asignador, siempre que pase los controles de viabilidad; si hay T6–T8 elegibles, T4 y T5 juntos tienen un techo del 55% para evitar saturar esos tiers.
- Al ajustar compras brutas y diarios, la reconstrucción intenta conservar una ruta por tier antes de eliminarla, pero no rebasa el presupuesto ni mantiene lotes con pérdida neta esperada.
- El resto de cálculos, Top Mercado, precios REST AODP, catálogo y cálculos de recetas no se reescriben.
- Si los tiers elevados no caben o no cuentan con cotización/historial suficiente, no se inventan recetas ni demanda y el plan puede seguir sin ellos.
