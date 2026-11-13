# v2.7.0 · El plan respeta tu configuración

Auditoría del motor con cientos de configuraciones aleatorias sobre un mercado sintético grande (8 familias, T4–T8, .0–.4, Mercado Negro + 5 Royal + Caerleon), comprobando cada ajuste en el plan resultante.

## Errores encontrados y corregidos
1. **Los límites de reparto se medían contra el presupuesto, no contra el plan.** Con 30 M de presupuesto y un plan de 8 M, «Máx. por tier 50 %» permitía meter 15 M en un tier, es decir, el 100 % del plan. Fallaba en más de la mitad de los planes. Ahora todos los límites (capital por objeto, por tier, por encantamiento, por familia y por ciudad) son **porcentaje del capital del plan**:
   - Primero se diluye: se añaden crafts rentables de otros grupos.
   - Si no basta, se recortan los crafts menos rentables del grupo que se pasa.
   - Después se rellena sin romper ningún límite.
   - Margen de un craft: una pieza no se puede partir, así que un grupo solo incumple si, quitándole su craft más caro, seguiría por encima.
   - Un límite solo actúa si el plan tiene al menos dos grupos en esa dimensión (si solo un tier es rentable, no se vacía el plan).
2. **Con «Diversificar» desactivado, los límites por tier, encantamiento y familia se ignoraban.** Ahora se aplican siempre.
3. **«Usar todo lo posible» no hacía nada** desde la v2.0.1 (al corregir la doble reducción por estilo se perdió su efecto). Nuevo significado, claro y probado:
   - Desmarcado: cada destino se llena como mucho al **75 %** de lo que permite tu estilo.
   - Marcado: hasta el **100 %**.
4. **El objetivo «Silver y fama» era prácticamente igual a «Más silver»** (la fama pesaba 0,008). Ahora cada ruta sigue exigiendo beneficio y ROI, pero entre las rentables cada punto de fama cuenta como **0,6 silver** al decidir.

## Diagnóstico del plan
Cuando el plan sale vacío, pequeño o recortado por tus límites, aparece arriba un bloque **«Por qué no salió ningún plan» / «Por qué el plan es pequeño»** con los motivos principales y el ajuste concreto que lo cambiaría. Por ejemplo: «30 rutas: un solo craft ya supera lo que tu estilo permite vender → prueba 7 días de venta o un estilo con más volumen».

## Rendimiento
Interpretar el ID de cada artículo se memoriza y el reparto por límites funciona en tres fases sin ciclos. Un plan con límites estrictos pasó de 15 s a ~0,1 s.

## Textos de la interfaz
- Límites de reparto: «porcentaje del capital del plan, se aplica siempre, con margen de un craft».
- Estilo: se indica también el máximo de rutas distintas (24 / 40 / 55, 70 con volumen).
- «Usar todo lo posible» y los objetivos explican exactamente qué hacen.

## Verificación
152 pruebas, entre ellas una auditoría de 60 configuraciones aleatorias que comprueba en cada plan: tiers, encantamientos, ciudades, presupuesto, demanda, ROI, pérdidas, ciudad de fabricación, modo de compra y los cuatro límites de reparto. Auditoría ampliada fuera de la batería: 300 configuraciones, 0 incumplimientos. Comprobado en Chrome que los ajustes de la interfaz llegan al motor.
