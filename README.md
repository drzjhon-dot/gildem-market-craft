# Gildem Market & Craft 2.4.0

Aplicación independiente para Albion Online **América (West)**; tres pestañas: **Top Mercado**, **Craft Planner** y **Calculadora de Craft**.

## Motor de cartera 2.0

- Analiza **tres repartos independientes** (`profit`, `balanced`, `spread`) de los mismos artículos y restricciones; elige el de mejor puntuación para tu objetivo.
- Añade controles de concentración por **tier, familia y encantamiento**. Mantiene los filtros de presupuesto bruto, Focus, comisión, riesgos, cupo Q1 y coste de compra/traslado.
- Un segundo pase revisa intercambios entre crafts para mejorar beneficio neto estimado, sin aumentar artificialmente las unidades vendidas.
- Compara opcionalmente el historial Q1 de **14 días** con la ventana reciente, para evitar que un pico temporal sobrestime capacidad de venta.
- Muestra **tres escenarios de profit/capital/diversidad** y diagnósticos por objeto o mercado descartado.
- Sigue en tres pestañas: **Top Mercado, Craft Planner y Calculadora**. Refinamiento continúa dentro de las ramas, no como pestaña.

Investigación, metodología y límites en [`INVESTIGACION_Y_ARQUITECTURA_MOTOR_V2.md`](./INVESTIGACION_Y_ARQUITECTURA_MOTOR_V2.md).

## Novedades

- **Refinamiento** en **Top Mercado → Ramas del mercado**. Selecciona Lingotes, Tablas, Tela, Cuero o Bloques de piedra; aparecen sus tiers y encantamientos en el ranking con historial Q1. Utiliza recetas de referencia cuando no hay dump, señalándolo como tal. El Planner contrasta recetas con `ao-bin-dumps` cuando la API de catálogo lo permite.
- **Ramas ilimitadas**. Puedes seleccionar todas las ramas, pero AODP puede limitar la velocidad de consultas. Para evitar saturarlo, cada página considera 240 IDs y la siguiente se consulta con **Ampliar cobertura**. La pestaña no afirma cobertura completa sin haberla consultado.
- **Planner de beneficio marginal**. Prioriza varias recetas y tiers viables si activas diversidad; después elige cada siguiente craft según ganancia marginal estimada por capital. Prueba impacto de tu propio lote, límite por Q1, ROI, impuestos, colchón de compra y presupuesto bruto; no promete maximización global matemática. Las metas de fama admiten pérdidas solo con la autorización y límite elegido.
- **Compras Royal entre ciudades:** por defecto se compara el precio publicado de los materiales entre Bridgewatch, Fort Sterling, Lymhurst, Martlock y Thetford. Para cada ingrediente se elige el coste **puesto en la ciudad de fabricación** (precio + transporte manual por unidad), no el precio de mercado más bajo sin contar traslado. Si fabricas en Caerleon, también se consulta el precio local; comprar en Caerleon para llevar a otra ciudad requiere marcar la casilla correspondiente y asumir riesgo.
- **Modo de compras** configurable en Craft Planner: «Mejor coste entre ciudades Royal» o «Solo en la ciudad de fabricación». Permite fijar el coste estimado de traslado por unidad y la ciudad de fabricación sin especialidad.
- **Calculadora de Craft** mantiene cotizaciones manuales y diarios estimados por tier. La lista de compras separa «comprar en» de «fabricar en», agrupa materias por origen/destino, incluye traslado estimado en el coste efectivo, y compra los diarios opcionales en la ciudad con mejor cotización disponible. El precio del diario es adicional y no se descuenta automáticamente del profit de crafting.
- **Portapapeles y CSV** incluyen ciudad de origen, destino de fabricación, precio observado, transporte por unidad y coste efectivo.
- **PC y móvil**, con navegación de 3 herramientas y presentación de tarjetas.

## Fuentes

- Datos dinámicos de mercado: [AODP West](https://www.albion-online-data.com/api/) (History y Prices). Su historial recoge órdenes observadas y no garantiza ventas ejecutadas.
- Datos estáticos de recetas: [ao-bin-dumps](https://github.com/ao-data/ao-bin-dumps) a través del proxy de catálogo.
- Sin integración de captura en tiempo real ni profundidad de órdenes ejecutable. Un precio mínimo observado no confirma que exista volumen suficiente para tu lote.

## Ejecutar y probar

Requiere Node.js >=20. `npm test`, `npm run build`, `npm run dev`. Netlify utiliza `netlify.toml` y las funciones `netlify/functions/`. Subir todo el ZIP al repositorio GitHub que ya está conectado a Netlify; no hace falta modificar el antiguo proyecto.

## Precauciones

AODP es comunitaria: verifica precios, profundidad de libros y comisiones actuales antes de invertir. **El traslado de materiales/diarios no se puede deducir directamente de AODP**. Su coste por unidad empieza en 0, visible como advertencia si compras fuera de la ciudad de fabricación; introduce una tarifa prudente. Comprar o fabricar en Caerleon puede implicar trayectos peligrosos y riesgo de pérdida de la carga. Una ruta que solo está cotizada puede no ser ejecutable. La búsqueda de beneficio es una heurística con restricciones, **no un optimizador exacto del mercado completo**.

## v1.9.1: arreglo de Netlify

La actualización incremental desde v1.8 podía conservar `tests/flips-v18.test.mjs`, una prueba que exigía cinco pestañas. Esta entrega sobrescribe ese archivo con una comprobación actual de tres pestañas. No es necesario reintroducir Flips ni separar Refinamiento. Se mantiene `npm run build` con pruebas activas. Ver `RELEASE_NOTES_v1_9_1.md`.

### Ordenar resultados por tier (v1.9.2)

- Top Mercado: en **Ordenar por**, selecciona **Tier: T4 → T8** o **Tier: T8 → T4**.
- Craft Planner: tras generar un plan, en **Plan por artículo y ciudad** selecciona el mismo orden o el orden original.
- Las variantes se agrupan por tier y, dentro de cada tier, por encantamiento (.0, .1, etc.).
- La ordenación es únicamente visual: no modifica los crafts, el silver, la demanda ni el beneficio calculado. Se conserva al recargar la página.
