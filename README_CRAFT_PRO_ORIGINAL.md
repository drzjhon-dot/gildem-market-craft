# Versión actual: Gildem Albion Lab v9.11.0

**Novedad v9.11.0:** el motor cumple tu configuración (filtros, límites estrictos, cobertura de todos los tiers/encantamientos marcados y «Usar todo») e importación de tus ventas reales desde el CSV de Trades del AFM Data Client. Ver [RELEASE_NOTES_9_11_0.md](RELEASE_NOTES_9_11_0.md).



**Novedad v9.9.0-top.4:** los generadores permiten presupuesto manual, exploran combinaciones tier/encantamiento de manera más equilibrada, validan las restricciones sobre el plan final y ajustan la distribución por estilo/objetivo. La tabla Top Mercado alinea todas sus columnas. Consulte [COMPROBAR_PLANES_TOP_4.md](COMPROBAR_PLANES_TOP_4.md) para las pruebas de regresión y limitaciones de los datos.


## Experimento v9.9.0-top.3 · Mercado exclusivamente AODP West

**Única fuente automática y manual admitida para precios, cotizaciones, historial, actividad y profundidad de órdenes: [Albion Online Data Project (West)](https://west.albion-online-data.com/api-docs).** Las importaciones manuales de rankings de terceros se han desactivado y los respaldos antiguos con esos rankings no intervienen en los planes.

**La API AODP no proporciona recetas completas.** Para que Black Craft, Royal Craft y Calculadora de Craft continúen funcionando, se conservan por separado el catálogo de recetas y los nombres del juego (albion-market / ao-bin-dumps). Son metadatos del crafting, no datos de demanda ni precios.

La actividad y los precios observados por AODP son comunitarios y pueden ser incompletos o antiguos. Ninguna cifra implica ventas garantizadas. El flujo de cinco pestañas y los cálculos económicos siguen la base 9.9.0-top.2. Véase `RELEASE_NOTES_9_9_0_TOP_3_AODP.md`.


La navegación visible tiene cinco pestañas: **Calculadora de Craft, Black Craft, Royal Craft, Top Mercado, Ajustes y Datos**. Ya no existe la pestaña Resultados; los planes completos pasan automáticamente a la calculadora para editar cantidades y añadir objetos. La sección «Fuentes y evidencia de mercado» permanece oculta. Los motores de 9.9.0 y el Top Mercado de 9.9.6 se conservan. Consulta `EMPIEZA_AQUI.md` y `RELEASE_NOTES_9_9_0_TOP_2.md`.

---

## Historial de documentación de versiones anteriores

# Gildem Craft Pro v8.6.9

**Actualización:** ya no se emiten listas ficticias de una unidad como «plan de investigación». Black Craft consulta el historial West antes de decidir rentabilidad y admite escenarios de venta por orden BM calculados a partir de medianas históricas de al menos cuatro días con actividad, alto volumen y cotizaciones recientes. Los escenarios históricos se identifican como **CONDICIONADOS**: nunca se debe comprar ni fabricar sin confirmar el precio objetivo dentro del juego. La disponibilidad de materiales sigue siendo verificable por etapas.

# Gildem Craft Pro v8.6.9

**Novedades v8.6.9:** Diseño corregido para el estado sin oportunidades: tarjeta de ancho completo, texto legible y botones responsive. El motor de rentabilidad permanece igual.

**Novedades v8.6.8:** Resultados compactos sin desplazamiento horizontal, fabricación total agrupada y logística de destinos debajo. Se elimina el techo de 650 de la fase de volumen y los límites de diversificación que impedían gastar el presupuesto aun con dos objetos rentables. Consulta `RELEASE_NOTES_8_6_7.md` y `RESEARCH_CLIENTES_MERCADO_AMERICA.md`.


**Novedades 8.6.6:** modo fabricación de volumen, mínimo de más de 50 observaciones semanales, sin reserva automática, hasta 65 rutas y asignación ajustada a riesgo y capital disponible. Consulta `RELEASE_NOTES_8_6_6.md`.

**Novedades 8.6.4:** Royal Craft permite elegir uno o varios mercados de venta (todas las ciudades marcadas por defecto), sin limitar dónde comprar materiales ni dónde fabricar. La tab Resultados conserva KPIs, fabricación, compras y botones, ocultando cinco paneles secundarios. Ver `RELEASE_NOTES_8_6_4.md`.

Consulta `RELEASE_NOTES_8_6_3.md` para la versión entregada: ranking equilibrado sensible al volumen, deduplicación AODP y auditoría de precios, actividad y compras por etapas.

# v8.6.2: fuentes visibles y transparencia

Esta versión corrige las cinco tarjetas de fuentes que aparecían sin nombre. El motor **NO importa automáticamente estadísticas numéricas** de esas páginas; sólo se comprueba su disponibilidad. AODP West sigue siendo la fuente numérica automática y las importaciones manuales se validan para América. El botón de IA prepara una consulta para copiar; no ejecuta una búsqueda web.

# Gildem Craft Pro v8.6.2 | América West y procedencia de fuentes

**Novedad v8.6.2:** planes Black/Royal exclusivos de América (West); AODP West como única API numérica automática; rechazo de datos Europa/Asia incluso en proxy Netlify; eliminación de Albion Journal como fuente; controles explícitos de West en importaciones manuales de Albion Hub; contraste con Royal Forge, Albion Online Tools, Albion Free Market y AO MCT sin prometer APIs públicas inexistentes. Botón de consulta para investigación con IA (copiar prompt; no búsqueda autónoma sin servicio conectado). Consulta `FUENTES_AMERICA_Y_VERIFICACION.md` para detalles.


Herramienta web de crafting en español para **Albion Online**, configurada por defecto para **América (West)**. Proyecto completo para GitHub + Netlify, sin reparadores locales. Las tabs principales son **Black Craft**, **Royal Craft** y **Resultados**; Level Craft no aparece en la navegación.

## Qué se corrigió en v8.6.2

El motor anterior podía proponer una unidad de botas T5.4 aunque se observaran miles de unidades diarias de botas T4.0, T5.0 y T6.0. El problema no se limita a botas. Cambiamos la lógica de ambas tabs para que:

1. Consulte primero **7, 14 y 30 días de actividad observada** de hasta 900 objetos **de la rama seleccionada**, incluyendo .0, .1, .2, .3 y .4, antes de clasificar oportunidades por margen. La selección se limita si una rama excede el cupo; la cobertura parcial se indica en el diagnóstico.
2. Calcule cantidades a partir de un **horizonte de órdenes de venta de 7, 14 o 30 días** (14 días por defecto). No redondea la actividad de un solo día a cero ni impone 12 unidades máximas a todos los artículos.
3. Compare margen positivo, inversión, actividad observada, concentración por objeto, competencia, antigüedad y materiales para **Black Market y los siete Royal**. El algoritmo es una aproximación, no un óptimo garantizado.
4. Proponga cantidades mayores de objetos con actividad alta, **sujetas a capital y precio verificable**, y una exposición pequeña para productos con poca información. La cantidad es el objetivo de producción/venta por órdenes, no una garantía de ejecución del libro.
5. Conserve el modo **PLAN CONDICIONADO** cuando no haya stock de materiales verificado para comprar el lote al precio presupuestado. Muestra necesidad de **compras por etapas** y exige comprobación previa antes de ejecutar. El beneficio estimado se puede deteriorar con deslizamiento de compra, impuestos, transporte y competencia.
6. Muestre en Resultados, bajo cada objeto, **actividad aproximada por día, fuente de datos, límite indicativo de fabricaciones y advertencia de compras por etapas**.

## Datos de mercado, fuentes y sus límites

Los precios y la actividad automática se consultan a **Albion Online Data Project (AODP)** por objeto y ciudad, para el servidor elegido. La API y su historia son registros públicos observados por clientes; **`item_count` no es una garantía de ventas completadas, de demanda futura ni de que el precio se mantenga**. Las ofertas pueden estar obsoletas. La puja BM de compra de NPC es referencia de precio para la propia orden de venta, no una ejecución confirmada.

La aplicación conserva referencias compatibles con una selección América (West): [Albion Online Hub: Top Selling](https://albiononlinehub.com/top-selling-items), [Royal Forge Market](https://royalforge.app/market), [Albion Online Tools Marketplace](https://albiononlinetools.com/marketplace/), [Albion Free Market](https://albionfreemarket.com/topitems) y [AO MCT](https://aomct.app/). **Comprobar que una web responde no equivale a verificar West ni a importar sus estadísticas**. La fuente europea anterior queda excluida. No se integran directamente los datos privados/dinámicos de estas páginas si no hay una API pública verificable.

### Importación manual opcional de rankings

En **Ajustes y datos → Estadísticas externas de volumen**, expande el panel y pega una tabla de **Albion Online Hub** o **Albion Journal**, como las que proporcionaste. Selecciona su fuente, **mercado de destino**, **servidor** y **fecha real de la muestra**. Pulsa **Guardar estadísticas**. Se guardará **una importación por vez** en el navegador, y puedes reemplazarla por otra. Se aceptan datos de hasta 14 días de antigüedad y solo si coinciden con el servidor configurado. Los valores sirven exclusivamente para una señal **provisional de rotación**, con exposición reducida por menor verificabilidad. **No se importan precios ni ROI desde las tablas**.

Por ejemplo, la fila de Hub `T5_SHOES_PLATE_SET2` con `3,696` unidades diarias en **Black Market** se puede utilizar para dimensionar el interés del mercado, pero la rentabilidad se vuelve a calcular usando costes y precios de AODP para **América/West**. La web de Albion Journal puede estar configurada para Europa; **no marques América para datos obtenidos en Europa**, aunque un artículo se llame igual.

## Qué hace cada tab

- **Black Craft:** rama individual, lista de objetos, tiers T4-T8, .0-.4, ciudad con bono, producción 0/10/20%, Focus, presupuesto, uso del capital y horizonte de venta. El destino es siempre **Mercado Negro** mediante orden de venta.
- **Royal Craft:** mismas opciones compactas, selección de categorías, **Refinamiento** disponible, Recolección agrupada por profesión sin repetir herramientas, todas las monturas en una sola rama. Compara publicaciones de órdenes en los siete mercados Royal y fuentes de materiales entre ciudades.
- **Resultados:** tarjetas de capital/profit/ROI/Focus, fabricación editable, compras con límite orientativo, diarios, distribución del capital, advertencias, exportación y **Verificar antes de comprar**. Las cantidades mostradas pueden requerir compras por etapas.
- **Ajustes y datos:** importación opcional de volumen por tabla pegada. La fuente, la fecha y el servidor son explícitos.

### Si un plan continúa proponiendo solo 1 objeto

Revisa la leyenda bajo ese objeto: puede deberse a falta de historial para ese ID y ciudad, precios obsoletos, concentración de capital, presupuesto insuficiente, competencia o materiales aún no verificables. El horizonte de 14 o 30 días permite planificar más inventario, **pero no debe superar cantidades justificadas ni ignorar costes**. Comprueba las fuentes seleccionadas y mira **Mercados examinados** si falta un plan. Un objeto con mucho volumen puede no ser rentable en el momento de la cotización.

## Publicación y pruebas

Consulta `SUBIR_A_GITHUB_DESDE_WINDOWS.md` para reemplazar el código completo usando GitHub Desktop. El ZIP incluye `app.js`, `index.html`, `styles.css`, `core/`, `netlify/`, `assets/`, `scripts/`, `.github/` y `tests/` sin subcarpetas extra de instaladores.

```bash
npm install --ignore-scripts --no-audit --no-fund
npm run preflight
npm run build
```

**Validación local v8.6.2:** 237 pruebas automáticas aprobadas; compilación y preflight correctos con Node 22. Navegador Chromium probado **con datos de mercado simulados**, no con ejecuciones o compras reales. Los resultados de prueba con cientos de unidades **no son un consejo de compra**. La publicación Netlify, cuotas y calidad de las APIs reales solo se verifican tras desplegar.

La comprobación previa no equivale a una reserva real de recursos ni a garantías de llenado en Royal o BM. Compra por tramos, valida tarifas y precio máximo, y no fabrique si el margen resulta negativo.
