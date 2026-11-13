# Comprobación funcional después de publicar · Gildem top.8

## 1. Confirmar versión

Abre la web, localiza `Gildem v9.9.0-top.8` debajo del panel AODP y consulta `/.netlify/functions/health`. Ambos deben indicar `9.9.0-top.8`. Si la versión no coincide, revisar commit publicado y caché antes de interpretar resultados.

## 2. Prueba controlada con las mismas cotizaciones

1. Black Craft → Mazas → T4, T5, T6, T7 y T8 → enchant .0/.1/.2.
2. Presupuesto 20M, 7 días, Focus desactivado, sin bono diario, diversidad activa.
3. Generar con Prudente + Silver y fama. Guardar cantidades de T4/T5 y capital por tier de «Configuraciones aplicadas».
4. Cambiar únicamente el estilo a Equilibrado y luego a Agresivo; repetir. Los techos por objeto cambiarán, aunque el plan pueda ser idéntico si no hay rutas suficientes.
5. Cambiar solo el objetivo a Más fama; comprobar que cambian las puntuaciones y la elección **cuando existen rutas con fama distinta y margen positivo**.
6. Probar T4 + T6 + T8, enchant .0 + .2 y presupuesto 7.850.000. No debe aparecer T5, T7, .1, .3 ni .4. Las compras más diarios no deben superar el presupuesto.
7. Cambiar horizonte de 7 a 30 días; comprobar cambio del techo por actividad. Si los precios o el resto de filtros impiden ampliar lotes, es legítimo que no cambie la selección.
8. Activar Focus únicamente si hay consumo verificable en Ajustes. El plan nunca podrá usar más Focus del disponible.
9. Desactivar «Forzar diversidad», generar de nuevo y comprobar que deja de aplicarse el límite especial de los lotes low-tier.
10. Repetir con Royal Craft y con un destino Royal concreto para comprobar que no se mezclan mercados.

## 3. Por qué un tier puede quedar fuera legítimamente

- No existe receta compatible con el filtro y el catálogo instalado.
- No hay cotización fechada para salida o materiales.
- AODP no registró suficiente actividad del artículo de calidad publicable (Top Mercado puede mostrar otras calidades).
- La fabricación excede el presupuesto individual o el disponible para el plan.
- El margen esperado, incluyendo impuestos, retorno, taller, transporte y diarios, es negativo.
- Órdenes competidoras, volumen histórico o profundidad observada no justifican el lote.
- Hay una solicitud parcial o la fuente no respondió; la ausencia no debe interpretarse como 0 ventas.

## 4. Lo probado en esta entrega

`npm run build` pasó las pruebas de sintaxis, verificación de archivos, 412 tests y generó `dist/`.
Los siete nuevos tests comprueban límites por objeto, las tres intensidades de estilo, las dos metas económicas extremas, filtros discontinuos, varios presupuestos, Focus, horizonte y modo de diversidad desactivado. Las fuentes de las pruebas son datos sintéticos; no sustituyen una operación de prueba con el servidor West.

**Precaución:** Las series de AODP son observaciones comunitarias. No aseguran ni el volumen de ventas reales ni la compra/venta efectiva de materiales a precios del plan.
