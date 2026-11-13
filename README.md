# Gildem Albion Lab 4.1.0

Una sola herramienta para Albion Online **América (West)**, que une Market & Craft 3.1 y Craft Pro 9.11. Tiene diez pestañas:
- **Planificar:** Top Mercado, Craft Planner, Plan Mercado Negro, Refinamiento y Calculadora de Craft.
- **Vender y vigilar:** Precios y alertas (con el oro de West), Flips Mercado Negro y Encantar.
- **Negocio e isla:** Mi negocio (con las ventas reales del AFM Data Client) e Isla (cultivos, animales y monturas, cocina y alquimia).

Ver [`RELEASE_NOTES_v4_1_0.md`](./RELEASE_NOTES_v4_1_0.md) y [`RELEASE_NOTES_v4_0_0.md`](./RELEASE_NOTES_v4_0_0.md).

## Plan Mercado Negro (v3.1)

Plan diversificado para vender al Mercado Negro en pocos días. La demanda sale de AODP o de una tabla de ventas pegada. Ningún artículo pasa del 6 % del volumen del plazo. Se descartan las variantes que pagan menos por material, el plan se reparte entre tiers y familias, y cada material lleva su precio máximo de compra. Ver [`RELEASE_NOTES_v3_1_0.md`](./RELEASE_NOTES_v3_1_0.md).

## Motor 3.0 (Craft Planner)

- **Beneficio marginal sin topes fijos:** cada lote adicional compite con los demás por silver ganado / silver invertido. El precio baja a medida que cubres más volumen Q1 y el motor se detiene cuando el siguiente lote deja de compensar (antes había un máximo de 24/40/55 rutas).
- **Prioridad de compra y venta:** Compra rápida (compra instantánea + orden de venta), Más silver (orden de compra + orden de venta) o Venta rápida (todo instantáneo). El Mercado Negro siempre vende a sus pujas.
- **Capacidad de venta realista para órdenes de venta:** Prudente 20 %, Equilibrado 30 %, Dinámico 45 % del volumen Q1 del plazo, ajustado por confianza (frecuencia, picos, caída de actividad, antigüedad del precio).
- **Capital real:** neto del retorno de recursos + el retorno de un craft; el encarecimiento por comprar muchos días de un material se reparte entre todas las rutas que lo comparten.
- **Plan arriesgado:** aviso cuando una ruta supera el 30 % del volumen Q1 del horizonte, con la cantidad recomendada.
- Sin cotización de venta pero con historial Q1, la ruta se valora a precio histórico −3 % y con menos confianza (ya no se descarta).

## Refinamiento inteligente (pestaña nueva)

Lingotes, Tablas, Tela y Cuero, T4–T8 .0–.4: compra en la ciudad más barata (con coste por salto), **transmutación** cuando sale más barata (costes base del juego), **refinado en cadena** del tier inferior, Focus donde más ahorra, **capacidad de montura (kg) y viajes**, **divisiones** (1–5 ciudades de venta o automático), prioridad de compra/venta y aviso de plan arriesgado. Recetas, transmutaciones y pesos extraídos de ao-bin-dumps (`src/refining-data.js`).

Detalles y comparación con el motor anterior en [`RELEASE_NOTES_v3_0_0.md`](./RELEASE_NOTES_v3_0_0.md).

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
