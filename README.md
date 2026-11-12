# Gildem Albion Lab · Market & Craft v1.6.0

Herramienta independiente de inteligencia de mercado y crafting para **Albion Online América (West)**. Tres pestañas conectadas: **Top Mercado → Craft Planner → Calculadora de Craft**. Diseñada para GitHub y Netlify, sin servidor de pago ni claves privadas.

## La idea

El ranking y el plan comparten evidencia. Al seleccionar una fila no se envía solamente el ID: se conserva el mercado, las unidades históricas por día de todas las calidades, las unidades de **calidad 1**, los días activos y la ventana UTC. El Planner usa esa ficha y consulta mercados adicionales únicamente cuando hacen falta sus propios datos Q1. La selección y el resultado siguen siendo editables y exportables.

### 1. Top Mercado

Selecciona hasta seis ramas y consulta todo su catálogo, o usa el módulo **Objetos individuales** para buscar nombres/IDs y activar «Solo mis artículos». Después elige mercados, ventana y orden. El ranking distingue `Todas/día` y `Calidad 1/día`, porque un craft de calidad 1 no se puede justificar con actividad de calidad 2–5. Conserva los botones **Marcar primeros 50**, **Borrar marcas**, **Enviar a Craft Planner** y **Enviar a Calculadora**.

### 2. Craft Planner

La cesta muestra las cantidades diarias capturadas por artículo y ciudad. Permite vender en los mercados marcados o cambiar destinos, con historial Q1 independiente para los destinos nuevos. Incluye presets de presupuesto 5M/10M/15M/20M, opción Otro, Focus verificado, ciudades con bono, tiers, encantamientos, objetivos silver/fama, horizonte de venta, variedad de variantes y costes/riesgos ajustables. **No fuerza gastos en artículos no rentables en objetivo silver.**

El resultado indica capital bruto reservado, beneficio neto **estimado**, cuota de actividad Q1 que utilizaría cada lote, efecto de precio, escenario de estrés, retorno, destinos y exclusiones. Admite el mismo artículo en varias ciudades sin permitir que el capital supere el tope combinado por SKU. «Enviar lote a Calculadora» agrega las cantidades de fabricación de todas las rutas para ese objeto.

### 3. Calculadora de Craft

Revisa el lote manualmente: cantidades, variantes, materias primas, precios observados o introducidos manualmente, diarios opcionales agrupados por tier, y comparación de Mercado Negro/Royal. Los diarios no se cuentan como coste obligatorio ni se inventan cotizaciones. Su beneficio individual es distinto de la proyección de ciudades del Planner.

## Archivos del proyecto

| Archivo | Función |
|---|---|
| `src/market-intelligence.js` | Captura de Top, catálogo individual, conciliación de periodos, actividad Q1 y diagnóstico de confiabilidad |
| `src/planner-transfer.js` | Transferencia de marcas y cantidades a otras pestañas |
| `src/market.js` | AODP History, Prices, caché, UTC, agregación y cotizaciones |
| `src/planner.js` | Recetas, retornos, riesgos, cuotas por mercado y asignación diversificada |
| `src/main.js` | Navegación, filtros, selección individual, mercado y resultados |
| `src/batch-calculator.js` | Materiales y diarios opcionales por lote |
| `netlify/functions/*` | Proxy validado para AODP West y catálogos |
| `styles.css` + `assets/` | Identidad visual Obsidian & Copper y recursos gráficos |
| `tests/*.test.mjs` | Pruebas de cálculo, datos y transferencias |

## Instalación y despliegue

1. Sube **todos los archivos y carpetas de la raíz** a tu repositorio **independiente** `drzjhon-dot/gildem-market-craft`. No mezcles con el proyecto original.
2. Netlify conectado a `main` puede usar `netlify.toml` automáticamente: build `npm run build`, publish `dist`, funciones en `netlify/functions`.
3. Para probar desde un ordenador con Node 22 o superior:

```bash
npm test
npm run build
```

`npm run dev` sirve la interfaz local, pero las funciones de mercado necesitan Netlify CLI (`netlify dev`) o el sitio publicado. `dist/` contiene la web generada sin necesitar GitHub para una inspección estática.

## Fuentes y garantías

Fuente única de mercado: [AODP West](https://west.albion-online-data.com/api-docs), endpoints History y Prices. Según la documentación oficial, **History se basa en órdenes de venta observadas, no ventas garantizadas**. Se agregan días completos UTC. El cliente conserva datos en memoria durante una hora. Los precios pueden estar desactualizados y no prueban profundidad del libro, disponibilidad real de materiales ni ejecución. El coste de transporte solo se incluye cuando se configura. Si faltan datos críticos, el motor no crea un plan ficticio ni usa precios cero.

En objetivo **Silver** y **Equilibrado**, exige beneficio neto esperado positivo y ROI mínimo. En **Fama**, las pérdidas posibles están acotadas por el porcentaje elegido y se etiquetan explícitamente. La fama puede ser estimada a partir de recursos y no ser una cifra confirmada del juego.

## Validación

53 pruebas automatizadas aprobadas y recorrido de interfaz probado en Chromium con datos **simulados** (incluye T8, calidad 1 separada, envío al Planner y Calculadora; móvil 390 px). No se ha demostrado todavía que las cotizaciones de producción sean ejecutables ni se ha desplegado el repositorio desde esta sesión.

Revisa `RELEASE_NOTES_v1_6_0.md` para detalles técnicos de la reconciliación Top → Planner.
