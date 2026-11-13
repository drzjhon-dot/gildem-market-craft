# Gildem Albion Lab top.7.1 | Corrección de lote final y verificación de versión

**Base**: top.7. Cambios acotados, sin reescribir fórmulas de crafting, AODP ni Top Mercado.

1. Corrige contradicción entre la selección inicial de T6-T8 (permitía 1 unidad) y el filtro final de compras, que volvía a exigir 3–5 unidades y podía eliminar esos tiers silenciosamente.
2. Mantiene el lote mínimo anterior cuando desactivas diversidad y para T4–T5, salvo las reglas ya existentes.
3. Muestra `Gildem v9.9.0-top.7.1` debajo del estado de AODP en el menú para identificar un despliegue real; no añade texto junto al logo.
4. Añade pruebas que ejercitan específicamente el filtro final.

**Importante**: esta corrección no fuerza fabricar T7/T8 sin presupuesto, precios, actividad o margen neto positivo. Con 5M algunos T8 no caben. La compilación local no verifica por sí sola el código efectivamente publicado en Netlify.

**Verificar Netlify**: `https://TU-SITIO.netlify.app/.netlify/functions/health` debe indicar `version: 9.9.0-top.7.1`. En la barra lateral debe aparecer el mismo número. Si son distintos, hay despliegue antiguo o caché mezclada.
