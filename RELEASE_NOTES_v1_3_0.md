# v1.3.0 · Plans inside Top Mercado

- El planificador automático deja de estar dentro de Calculadora. Top Mercado ofrece sus propias configuraciones, y Calculadora permanece como calculadora manual por lotes.
- Los destinos de venta son independientes de los mercados del ranking. El motor consulta History adicional en ciudades elegidas y nunca extrapola una ciudad a otra.
- Diferencia historial agregado calidades 1–5 para Ranking y Q1 para demanda del plan, puesto que la cotización de venta usada es Q1.
- Añadidos colchón compras, descuento venta, ROI mínimo, control de estrés, concentración de capital, transporte por unidad y límite histórico Q1 a cotizaciones atípicas.
- Mejoras en resumen: tarjetas por ciudad de venta, distinción entre precio observado y precio usado, ciudades coloreadas, copiar compras y CSV ampliado.
- Preparado para Netlify, dos pestañas, 34 pruebas Node; recorrido funcional de navegador con API simulada.
- **Importante:** sin garantías de liquidez real ni verificación live del libro de órdenes. No se ha publicado automáticamente en GitHub/Netlify.
