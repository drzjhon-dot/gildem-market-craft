# Gildem Albion Lab v9.9.0-top.8 · Rotación y diversidad comprobables

Base: ZIP top.7.1 proporcionado por el usuario. Se preservan AODP West como fuente de datos de mercado, las recetas, Top Mercado, Calculadora de Craft y la arquitectura GitHub/Netlify.

## Cambios
- Nuevo `core/diversity-policy.js` con topes de lotes **por artículo**, actividad y días. Solo cuando `Forzar diversidad` está activada.
- Para carteras con oportunidades altas viables, T4/T5 tienen techo conjunto de **24% Prudente, 32% Equilibrado y 42% Agresivo** del presupuesto. Antes podía llegar al 55%.
- En un plazo de 7 días, límites superiores por ruta T4/T5 de 10, 22 y 36 fabricaciones respectivamente (Prudente/Equilibrado/Agresivo). Los límites por actividad AODP, impacto, pendientes y presupuesto pueden recortarlos. Para T6–T8, máximos exploratorios de 5, 10 y 18 antes de aplicar los otros topes. Los techos aumentan moderadamente con horizontes más largos.
- Conservamos la reserva de una fabricación viable de T6–T8 en la etapa de asignación, el ajuste final y la protección contra cantidades de bajo volumen. Nunca se fuerza un objeto sin precio/historial suficiente, profit esperado positivo o presupuesto.
- El resultado de Black y Royal Craft presenta explícitamente **configuración efectiva** y **fabricaciones por tier/enchant**, para que cada usuario pueda auditar si sus elecciones se aplicaron.
- El modo desactivado mantiene las reglas de asignación normales de top.7.1.

## Validación
- Nuevas simulaciones de las 3 intensidades de estilo, los 3 objetivos, presupuestos de 5, 8, 12, 16, 25 y 40 millones, 7/30 días, tiers/enchant discontinuos, Focus y sin demanda AODP.
- `npm run build` ejecuta el preflight, las pruebas y el empaquetado dist.
- Las pruebas sintéticas no validan el inventario, cotizaciones ni ventas futuras de West en producción.

## Cómo verificar
1. Reemplazar **todo** el repositorio usando el contenido del ZIP. Netlify debe compilar la rama publicada.
2. `/.netlify/functions/health` debe mostrar versión `9.9.0-top.8`; el sidebar debe mostrar el mismo texto.
3. Comparar exactamente una misma rama, tiers, enchants, monto y horizonte con estilo Prudente/Equilibrado/Agresivo. Revisar la nueva sección «Configuraciones aplicadas».
4. Si T8 no entra, abrir «Top Mercado vs plan» y revisar: historial, precio/costo completo, margen, presupuesto y actividad.

**Advertencia**: AODP registra observaciones comunitarias. Las estimaciones no garantizan ventas ni tiempos de venta.
