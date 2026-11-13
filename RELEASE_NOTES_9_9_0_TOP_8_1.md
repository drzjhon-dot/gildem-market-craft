# Gildem Albion Lab v9.9.0-top.8.1

## Continuación de la auditoría iniciada por Claude

**Base:** v9.9.0-top.8, sin volver al proyecto antiguo.

### Corregido

1. La prioridad de diversidad ya no puede quedar ignorada por `diversityLanes=false` en objetivos centrados en silver o con pocas rutas.
2. La reserva de tiers ahora revisa una lista de rutas en cada tier: si una receta no cabe por Focus, precio o límites, intenta otra antes de descartar el tier.
3. Al desactivar la casilla, la reserva entre tiers y encantamientos se desactiva también en las tres propuestas, dejando la selección al modelo ordinario por demanda.
4. Se mantienen los límites reales de compra y mercado y el cálculo final de materiales, diarios y presupuesto. Sin actividad ni beneficio esperado positivo no se fuerza una receta.
5. Se añadieron pruebas de extremo a extremo para comprobar que los controles seleccionados se reflejan en Black Craft y Royal Craft, incluidas selecciones de tiers y encantamientos no consecutivos.

### Qué NO cambiamos

- Catálogo y fórmulas de recetas, diarios, impuestos, retorno de materiales y cálculo de Focus.
- Endpoints de AODP West, Top Mercado, transferencia a la Calculadora, imágenes y estilo.
- Modos no diversificados: siguen su selección habitual por actividad y margen.

### Limitaciones

Los tests usan datos sintéticos. El historial comunitario de AODP no garantiza ventas y una selección de T8 no es posible si carece de precio/actividad, pierde plata en el escenario esperado o cuesta más que el capital disponible. Los límites de consulta pueden impedir evaluar todas las variantes.
