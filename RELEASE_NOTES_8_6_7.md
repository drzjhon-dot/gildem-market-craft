# Gildem Craft Pro v8.6.7 · Resultados compactos + volumen

- **Resultados sin scroll horizontal:** tarjetas responsive de fabricación, compras y logística. En fabricación cada ID exacto (tier/encantamiento incluidos) aparece una sola vez, con total de fabricaciones y unidades.
- **Logística debajo:** desglose de ruta por objeto, ciudad de crafting, destino de venta, cantidad y profit, sin alterar los cálculos del plan ni duplicar los costos.
- **Edición agrupada:** ajusta el total del objeto en Resultados. Se distribuye automáticamente a las rutas viables y se revalida presupuesto y márgenes.
- **Capacidad de volumen:** límite protector de 6.000 fabricaciones por ruta en lugar del techo arbitrario de 650, siempre sujeto a la cuota de actividad observada en el horizonte, competencia, inventario pendiente y margen neto. No supone que existan 6.000 compradores.
- **Presupuesto:** si hay exactamente dos objetos viables, el límite dinámico 52% + 52% permite aproximarse al 100% sin una reserva obligatoria; los topes de ciudad y tier no obligan a dejar 15%-28% del silver sin usar en planes de volumen.
- **Límites importantes:** los datos históricos de AODP son observaciones, no ventas ejecutadas; objetivos con materiales insuficientes siguen como COMPRAS POR ETAPAS. El llenado del 100% nunca se garantiza cuando las oportunidades rentables no lo permiten.
- **Fuentes de mercado:** analizados los dos clientes de captura aportados por el usuario y el analizador MIT de millelog. Son fuentes de aprendizaje, no precios West verificables nuevos. Ver `RESEARCH_CLIENTES_MERCADO_AMERICA.md`.

Para actualizar desde v8.6.6 copia los archivos del ZIP de cambios sobre el repositorio limpio. No los subas como una carpeta extra dentro del proyecto.
