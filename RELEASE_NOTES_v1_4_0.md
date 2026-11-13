# Release v1.4.0 · Craft Planner independiente + modo grafito

## Nuevo

- **Tres pestañas reales:** Top Mercado, Craft Planner y Calculadora de Craft.
- El ranking se libera de todo el formulario de planificación.
- **Marcar primeros 50**, **Borrar marcas**, **Enviar marcados a Craft Planner (x)**, **Enviar marcados a Calculadora (x)**.
- Cesta separada en Planner, persistente, sin productos añadidos de manera automática.
- Mercados de venta separados de la consulta Top; historial de venta Q1 consultado directamente en los mercados elegidos.
- **Enviar lote a Calculadora** suma las fabricaciones de cada variante y muestra los destinos de venta originales sin confundir su beneficio con el cálculo BM/Royal manual. Reemplaza el lote anterior expresamente.
- Paleta **grafito medio**: fondos pizarra/carbón, botones oro, estados verde, emblemas de ciudad preservados, sin tema violeta dominante.
- Icono nuevo para Craft Planner en el menú lateral.

## Preservado

- Motor de precios y asignación por demanda y presupuesto de la versión 1.3.
- Escudo de ROI, colchones, prueba de estrés, enfoque en Q1, Focus verificado, retorno de ciudad, diarios, listado de compras y exportación CSV.
- Top de 105 ramas, ranking por números enteros, colores de las ciudades y copia rápida de nombres e IDs.
- Calculadora manual por lotes.

## Calidad

- `npm run build`: 39 pruebas aprobadas.
- Navegación y cálculos probados con API simulada en navegador, sin errores JS; desktop y móvil sin overflow horizontal.
- No se validó AODP real ni el despliegue online en este entorno.
