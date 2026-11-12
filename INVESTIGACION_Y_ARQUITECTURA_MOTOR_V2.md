# Gildem Portfolio Engine 2.0 · investigación, diseño y límites

## Qué se investigó (noviembre de 2026)

- **AODP West**: https://west.albion-online-data.com/api-docs — precios por calidad, History por día UTC, Orderbook con niveles de profundidad documentados. REST sigue siendo la fuente dinámica de esta versión. La API y el cliente son comunitarios; no prometen que una orden esté disponible cuando transportes la mercancía. Aunque existe endpoint Orderbook, **no se incorpora a la estimación de volumen ejecutable** hasta comprobar su formato y calidad con muestras reales de West.
- **Albion Free Market Crafting**: https://albionfreemarket.com/crafting — fuentes de coste de recursos, precio de venta, retorno, materiales intermedios, upgrade con runas/almas/reliquias, calidad y diarios. Sirve como lista de verificación de funciones, no como feed público contratado.
- **Albion Free Market Profitable Crafts**: https://albionfreemarket.com/profitable-crafts — el mismo objeto puede tener distintas oportunidades según ciudad de fabricación, mercado de venta, Focus y ruta de receta. No se debe combinar en una sola fila antes de optimizar.
- **AO Refinery**: https://aorefinery.com/ — usa precios AODP, considera ventas/día y alerta sobre cotizaciones viejas. No es una segunda fuente independiente garantizada.
- **Silvermark**: https://silvermark.app/ — compara rutas de crafting/upgrade, foco, calidad y volumen; su análisis no se incorpora sin verificar metodología y acceso autorizado.
- **Albion Markets**: https://albionmarkets.com/ — publica información de sus propias capturas y ofrece scans bajo condiciones de cuenta/plan; no hay API pública reusable confirmada para este proyecto.
- **Albi(on) Online Data `ao-bin-dumps`**: https://github.com/ao-data/ao-bin-dumps — fuente de datos estáticos y recetas, ya consultada mediante el proxy de catálogo. Nunca emplear su JSON como fuente de precios.
- **Albion Data Project para NATS**: https://www.albion-online-data.com/developer — flujo persistente de eventos; una función Netlify sin proceso persistente no debe presentarse como escucha NATS continua.

## Problemas detectados en el motor anterior

1. El plan tomaba un único período histórico sin comparar si la actividad acababa de subir o bajar. Las ventanas cortas podían inflar el lote.
2. Las reservas iniciales de tiers se hacían antes de comparar suficientes carteras alternativas.
3. La asignación voraz por retorno marginal no comprobaba si reemplazar un craft ya seleccionado por otro desbloqueaba mayor beneficio absoluto.
4. Los límites por SKU eran importantes, pero no había límites de cartera por **tier, encantamiento o familia de artículo**.
5. La salida no comparaba varias distribuciones de la misma selección.

## Portfolio Engine 2.0

**Entrada**: ID exacto (incluye tier/encantamiento), ciudad de venta, historial Q1 de días UTC completos, precio con timestamp, receta verificable y precios de insumos por Royal (precio + transporte declarado). La calidad Q1 nunca se sustituye por el agregado de calidades 1–5.

**Etapa 1: Tendencias**. Con la casilla de tendencia encendida, se compara la actividad Q1 de la ventana actual (1/3/7 días) con 14 días en la *misma ciudad e ID*. La ventana larga no crea volumen ficticio. Si la actividad reciente crece bruscamente, el tope se estabiliza con el valor más conservador; si cae, prevalece el valor reciente. La referencia Q1 de precio alto también se modera. Cuando falla la consulta, se conserva el historial original y se indica el fallo.

**Etapa 2: Oportunidades**. Solo artículos con receta, materiales y cotizaciones utilizables. El importe de venta Royal es una oferta observada y NO precio ejecutado confirmado; el de Mercado Negro es una puja observada. Se descuentan impuestos, tasas Royal, colchón, estación, retorno, transporte y un impacto de precio estimado sobre tu propia publicación.

**Etapa 3: Límites duros**. Capital bruto <= presupuesto; Focus disponible; beneficio neto marginal positivo y ROI mínimo en objetivos de silver; límites de lote basados en actividad Q1 y días del horizonte; exposición máxima por SKU. Con diversidad activada, límites independientes de capital por tier, familia, encantamiento y, si lo configuras, ciudad. Una ruta T8 solo entra si supera las mismas condiciones. No se inventan órdenes del libro.

**Etapa 4: Optimización**. Se calculan tres estrategias deterministas: `profit`, `balanced`, `spread`. Primero se reservan muestras viables de tiers; en modos de diversidad se añade una muestra de cada encantamiento viable; después se recalcula la ganancia marginal unidad por unidad. Una revisión de intercambios elimina un craft de menor contribución si otro mejora estrictamente el beneficio neto sin romper las cuotas que estuvieran en uso. Se compara la cartera completa y se selecciona la de mejor puntuación para `silver`, `balanced` o `fame`. Esto **no es garantía de óptimo global matemático**.

**Salida**: tres simulaciones comparables, plan seleccionado, cantidad exacta de crafts, inversión, profit estimado, fama estimada, concentración y por qué algunos artículos quedaron fuera. Se puede enviar el plan seleccionado a la Calculadora de Craft.

## Una limitación esencial

AODP History es información histórica de órdenes de venta y **no debe etiquetarse automáticamente como ventas ejecutadas**. Del mismo modo, el precio mínimo de un material no certifica cantidad disponible a ese precio. La profundidad de órdenes y el precio medio efectivo de una compra de gran tamaño seguirán requiriendo confirmación in-game hasta integrar y validar Orderbook. Cuando se use `Compra +8%`, ese porcentaje es un colchón declarado, no una medición real de slippage.

## Validación

- `npm test`: 100 tests automatizados (92 de regresión + 8 de Portfolio 2.0).
- `npm run build`: tests + assets en `dist`.
- `node --check src/main.js` y módulos del motor: sintaxis.
- Simulación determinista de 150 oportunidades: 3 carteras comparadas sin exceder capital ni límites seleccionados. El tiempo local medido no es un SLA de producción.
- Las pruebas NO reproducen compra real, impuestos del juego actualizados, liquidez del libro en West ni funcionamiento del proxy en Netlify real. Verificar antes de invertir.

## Próximas integraciones que requieren datos o validación adicional

1. Orderbook West con lectura por tramos y protección contra tiempo de observación antiguo, si el endpoint devuelve niveles confiables por artículo y calidad.
2. Cadenas de fabricación/upgrade mediante runas, almas, reliquias y materiales intermedios sin doble contabilización.
3. Diferenciación de calidad esperada por especialización y alimentación, sin asumir distribución no verificada.
4. Modelos de precio y demanda calibrados contra ventas completadas propias (importación CSV) y resultados posteriores del lote.
5. Límite de peso/capacidad de transporte y coste por ruta real, incluyendo riesgo en zonas rojas.
