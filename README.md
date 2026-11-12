# Gildem Market & Craft v1.3.0

Proyecto **independiente** para Albion Online (servidor **América / West**), preparado para el repositorio [`drzjhon-dot/gildem-market-craft`](https://github.com/drzjhon-dot/gildem-market-craft) y Netlify. Mantiene **solo dos pestañas**.

- **Top Mercado:** ranking con datos AODP History y **generador automático de planes en la misma pestaña**, con selección de ciudades de venta independiente del ranking.
- **Calculadora de Craft:** calculadora manual por lotes que conserva la comparación de Mercado Negro / Royal, variantes de tier y encantamiento, tabla de materiales, cotizaciones editables y diarios estimados.

## Qué se añadió a Top Mercado

Tras consultar una o más ramas, baja a **Mi plan desde Top Mercado** o usa **Configurar plan** en el encabezado del ranking.

1. **Seleccionar dónde VENDER.** Puedes elegir una o varias entre Bridgewatch, Fort Sterling, Lymhurst, Martlock, Thetford, Caerleon, Brecilien y Mercado Negro. Esta selección es **independiente** de los mercados usados para explorar el ranking. Ejemplo: Top en Mercado Negro y plan de venta en Lymhurst + Martlock. El motor consulta *History* adicional en esos destinos; no reutiliza datos de un mercado como demanda de otro.
2. **Seleccionar objetos.** Las estrellas `☆` del ranking limitan la consulta a los artículos marcados, pero las ciudades de venta las decide la configuración. Si no marcas ninguno, se evalúa un subconjunto ordenado de artículos del Top (máximo 150 IDs por ejecución). Para ampliar el universo, usa **Ampliar cobertura** en el ranking.
3. **Configurar fabricación.** Ciudad de bono de cada receta, tiers, encantamientos, bono diario, Focus (con coste/craft y saldo introducidos por ti), silver, días hasta la siguiente fabricación, estilo, objetivo (silver/fama), diversidad T6–T8, inversión máxima y volumen.
4. **Protección de rentabilidad.** Por defecto: **8%** de colchón en compras, **2%** de rebaja de venta, **5%** de ROI mínimo, **40%** de capital por tipo de artículo y prueba de estrés de -10% en el precio de venta. Estos porcentajes son configurables, no cotizaciones del libro de órdenes.
5. **Logística y anomalías.** Puedes ingresar silver de transporte **por unidad de salida** y limitar precios de venta atípicamente altos con respecto a la media histórica de calidad 1. Por defecto se capan al **110%** de la media Q1, sin sobrepasar la cotización observada.
6. Pulsa **Generar plan por ciudades**. Resultados: inversión bruta reservada, beneficio **estimado**, ROI, fama, resumen por ciudad de venta, lotes, efecto supuesto del volumen, estrés, compra de materias primas, diarios orientativos, exportación CSV y copia de lista de compras.

### Por qué la estimación es más prudente

**El ranking y el plan no miden lo mismo:** el ranking agrega calidades **1–5** en días UTC completos, mientras que los precios de referencia de la calculadora son para **calidad 1**. En v1.3, **la asignación de cantidades y la media histórica del motor usan actividad Q1**. No se infiere demanda de calidad 1 a partir de ventas observadas en calidad 2–5.

El motor también:

- Comprueba receta existente, actividad histórica Q1 en la ciudad de venta, cotización de salida y materias primas con fecha válida (hasta 48 horas por defecto).
- Usa la puja de compra observada para el Mercado Negro y la oferta de venta mínima observada para las Royal, con la advertencia de que una oferta Royal **no es una orden de compra ejecutable**.
- Reserva material **bruto** y aplica colchón de compra al capital y coste; no depende de retornos futuros para mantenerse dentro del presupuesto.
- Proyecta retorno con la fórmula `RRR = bono / (100 + bono)`; un bono de producción del 33% equivale al **24,81% de retorno**. Los retornos de materiales no reutilizables no se aplican cuando la receta lo marca.
- Penaliza en escenarios el impacto potencial de tus ventas, la caída de precio, el transporte introducido y costes de comercialización.
- Rechaza rutas sin margen esperado positivo, por debajo del ROI mínimo o con pérdida en estrés cuando está activada la protección. La diversidad T6–T8 puede permitir estrés negativo **solo si el beneficio esperado sigue siendo positivo** y hay observación Q1.
- Limita exposición y unidades por artículo, sin fabricar cantidades extras para consumir el presupuesto disponible.

### Límites reales de datos

**Ni AODP History ni Prices ofrecen garantía de venta, inventario comprable por tramos o profundidad ejecutable del libro.** El colchón por compra y el impacto de venta son supuestos prudentes, no cálculos de orderbook. La aplicación no conoce los costes logísticos de una ruta ni tu tarifa de estación hasta que los introduces. Verifica profundidad de compra/venta, comisiones y tarifas reales antes de invertir.

La fama y los diarios son **estimaciones** cuando no hay valores verificables; la compra opcional de diarios no está incluida en el beneficio. Focus/craft es un valor que debes obtener del propio juego; la app **no puede comprobar automáticamente** el consumo individual en tu Destiny Board. Las recetas y traducciones se descargan de archivos públicos del juego; las cifras de mercado se obtienen de AODP REST West.

## Actualizar tu sitio existente

1. Descomprime el ZIP y abre [tu repositorio GitHub](https://github.com/drzjhon-dot/gildem-market-craft).
2. Sustituye los archivos correspondientes en la **raíz** de `main`: `src/`, `tests/`, `styles.css`, `index.html`, `scripts/`, `README.md` y `package.json` (y conserva `netlify/functions/` y `assets/`, incluidas en el ZIP).
3. Confirma con **Commit changes**. Netlify, si está vinculado a `main`, compilara con `npm run build` y publicará `dist/`. No arrastres solo `dist/`: la API requiere las funciones de Netlify.
4. Comprueba en `https://gildemcraft.netlify.app/` que aparecen los dos tabs, que puedes consultar un Top y después generar un plan para una ciudad de venta distinta de la consultada.

La conexión de GitHub disponible para esta sesión ha permitido lectura pero anteriormente devolvió `403` al intentar escribir; este paquete **no ha sido desplegado automáticamente**.

### Configuración Netlify

Se mantiene `netlify.toml`:

```toml
[build]
  command = "npm run build"
  publish = "dist"
  functions = "netlify/functions"
[build.environment]
  NODE_VERSION = "22"
```

`/api/market` dirige a la función `netlify/functions/market.mjs`, validada para `west.albion-online-data.com`; `/api/catalog` apunta a su función de catálogo.

## Pruebas

```bash
npm test
npm run build
```

- **34 pruebas automatizadas** en Node 22: historial Q1/Q2–Q5, retorno, quote freshness, riesgo, presupuesto, Focus, filtros, motor, proxy y estructura de pestañas.
- Recorrido **en navegador con AODP simulado**: consulta Top en Mercado Negro, cambio de ciudad de venta a Lymhurst, generación de plan con ciudad de fabricación y lista de materiales; navegación a Calculadora manual y revisión de desbordamiento horizontal en escritorio y móvil.
- **No se han validado** cotizaciones AODP en vivo, profundidad de órdenes o la compilación de Netlify en producción. Verifica con datos reales después de publicar.

## Fuentes de datos

- AODP West: https://www.albion-online-data.com/api/ y https://west.albion-online-data.com/api-docs
- Fórmula de retorno: https://wiki.albiononline.com/wiki/Resource_return_rate
- Catálogo de recetas: derivado de archivos del juego, sin usar fuentes alternativas para precios.

No está afiliado a Sandbox Interactive.
