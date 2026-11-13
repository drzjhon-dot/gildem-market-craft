# Gildem Market & Craft v1.7.0

## Lo nuevo

1. **Objetos individuales por familia, sin repetir tiers.** Por ejemplo, la opción «Maza» comprende `T4_MAIN_MACE`, `T5_MAIN_MACE`, `T8_MAIN_MACE` y todos sus encantamientos presentes en el catálogo. El ranking continúa mostrando los tiers y encantamientos por separado, con la demanda histórica de cada variante. Los tipos de objeto se construyen a partir de los IDs reales del catálogo y se agrupan por su sufijo común después de Tn_ y antes de @n.
2. **Búsqueda flexible.** Busca por el nombre en español, familia o incluso un ID concreto, aunque solo se marque el tipo de objeto. El botón «Marcar visibles» selecciona tipos, no tiers.
3. **Consulta individual ampliable.** Si la familia abarca más de 240 variantes, «Ampliar cobertura» sigue consultando las siguientes; no se corta silenciosamente la selección por límite de lote. La lista de tipos continúa limitada a 150 selecciones.
4. **Forzar datos frescos activado por defecto.** El botón Consultar top evita la caché en el cliente y en el proxy de Netlify cuando el control está activo. Puedes desmarcarlo para limitar solicitudes. No garantiza información nueva en el servidor de AODP y no significa refresco automático en segundo plano.
5. **Protección del beneficio explicada sin jerga.** Nuevo título y explicaciones concretas de compra +%, venta -%, ROI mínimo, concentración del capital y prueba de caída del precio. Las fórmulas y valores predeterminados de protección anteriores se preservan.
6. **Panel plegable de fuentes West.** Explica las dos entradas utilizadas (AODP History y Prices) y los endpoints adicionales documentados (Orderbook y NATS) sin mezclarlos con los resultados del motor, porque aún requieren validación operativa.

## Verificado

- `npm run build`: 59 pruebas automatizadas aprobadas.
- Prueba funcional en navegador con **respuestas simuladas de AODP**: selección por familias, consulta History, ranking de variantes, traslado al Planner, plan y transferencia a Calculadora; sin errores JavaScript.
- Visualización móvil 390 px sin desbordamiento horizontal.
- No se ha probado el endpoint Orderbook ni NATS en producción; no forman parte del motor de profit v1.7.
- No se han validado consultas reales de AODP o deploy de Netlify desde este entorno.

## Datos reales, fuentes y advertencias

- AODP West: https://west.albion-online-data.com/api-docs
- AODP Developer (NATS): https://west.albion-online-data.com/developer
- Las cifras History registran órdenes de venta observadas, no ventas garantizadas.
- No se debe tratar el promedio de calidades 1–5 como demanda ejecutable de calidad 1. El Planner mantiene sus controles y validación de datos Q1, costes, presupuestos y riesgo.
- Las webs de terceros que reciben AODP no son fuentes independientes sin contratos y origen de datos contrastados.
