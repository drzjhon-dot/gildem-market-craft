# Gildem Albion Lab v9.9.0-top.5

- Base: AODP Only v9.9.0-top.4. Fuentes numéricas del mercado exclusivamente AODP West; catálogo del juego para recetas, sin modificar fórmulas de RRR, materiales, precios ni diarios.
- Se amplía la exploración de combinaciones permitidas a 1.800 variantes por rama Black Craft y 1.400/1.800 (amplia) en Royal Craft; selección equilibrada entre tiers y encantamientos. Se avisa si se recorta el universo.
- Asignador: límites de exposición por carril tier + encantamiento cuando hay varias combinaciones viables y el objetivo busca diversificación; ponderación proporcional de mercado y preferencia económica.
- Resultados: tres propuestas calculadas con los mismos filtros y universo de oportunidades, incluyendo profit, fama, silver comprometido y variedad. En caso de coincidencia se indica; no se fabrican rutas inválidas para aparentar diversidad.
- Cambio de propuesta: comprobación adicional de compras de materiales, presupuesto, Focus, destino, tier y encantamiento antes de enviarla a Calculadora de Craft.
- Pruebas automatizadas sintéticas de Black Craft, Royal Craft, presupuestos y escenarios sin oportunidades. No implican verificación de precios actuales de AODP ni del despliegue en Netlify.
