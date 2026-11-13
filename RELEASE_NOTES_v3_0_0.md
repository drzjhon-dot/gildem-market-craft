# Gildem Market & Craft 3.0.0

## Qué cambia

### 1. Motor 3.0 para Craft Planner (Royal y Mercado Negro)
El motor 2.x se retiró. Por qué daba poca ganancia (medido con el mercado sintético de pruebas, 30M de presupuesto):
- **Máximo de 40 rutas** (24 en Prudente): con 400 rutas viables, invertía 4,4M y dejaba 25M sin usar.
- **Cupo del 12 % del volumen Q1** con una rebaja de precio del 9 % ya en ese punto, más un **colchón de compra del 8 %** y un **descuento de venta del 2 %**. Los márgenes normales de crafteo desaparecían.
- El capital se contaba en **bruto** (sin restar el retorno de recursos).

Cómo funciona el Motor 3.0 (`src/engine-v3.js` + `src/optimizer.js`):
- **Reparto por beneficio marginal**, sin tope de rutas. Cada lote adicional se compara con todos los demás por silver ganado / silver invertido. El precio baja de forma progresiva con tu cuota del volumen, y el motor para cuando el siguiente lote deja de rendir tu ROI mínimo (o deja de dar beneficio, con «Usar todo lo posible»).
- **Prioridad**:
  - Compra rápida (por defecto): compras al instante y vendes con orden de venta.
  - Más silver: orden de compra para los materiales.
  - Venta rápida: todo instantáneo.
- **Comisiones**: la orden de venta paga impuesto + publicación; el Mercado Negro, solo impuesto.
- **Capacidad por estilo** (orden de venta): 20 / 30 / 45 % del volumen Q1 del plazo × confianza.
- **Capital real** = materiales netos del retorno + retorno de un craft.
- **Encarecimiento compartido de materiales**: 5 % por cada día de mercado extra, con un tope del 25 %, repartido entre todas las rutas que usan ese material.
- **Plan arriesgado**: aviso cuando una ruta supera el 30 % del volumen Q1 del horizonte; se muestra la cantidad recomendada.
- **Nuevos valores por defecto**: colchón de compra 2 %, descuento de venta 0 %. Si tenías los antiguos (8 % / 2 %), se migran solos.

### Comparación con el motor anterior (mismos datos)
Mercado sintético de `tests/fixtures/market-fixture.mjs`. El resultado «real» sale de un **simulador independiente**, que no usa el modelo del motor:
- La captura de ventas es aleatoria: 15–50 % del volumen Q1.
- El precio varía ±6 % y baja más rápido que en el modelo del motor.
- Lo que queda sin vender se liquida al 75 %.

| Plan | Capital | Prometido | Simulado (media) | Peor 10 % | ROI simulado | Sin vender |
|---|---|---|---|---|---|---|
| Motor 2.x Equilibrado, 30M | 4,43M | 1,79M | 2,14M | 2,08M | 48 % | 0 % |
| Motor 2.x Dinámico + usar todo, 30M | 14,06M | 4,19M | 6,37M | 6,21M | 45 % | 2,6 % |
| **Motor 3.0 Equilibrado, 30M** | 30,00M | 15,61M | **15,56M** | 15,26M | 52 % | 7,6 % |
| Motor 2.x Equilibrado, 3M | 3,00M | 1,28M | 1,50M | 1,45M | 50 % | 0 % |
| **Motor 3.0 Equilibrado, 3M** | 3,00M | 1,78M | **1,74M** | 1,66M | 58 % | 9,0 % |

Con el mismo capital (3M), el Motor 3.0 gana un 16 % más. Además, lo que promete se parece mucho más a lo que sale en la simulación. Son datos sintéticos: la primera semana con datos reales de West es la prueba que cuenta.

### 2. Pestaña «Refinamiento» (separada de Top Mercado)
`src/refining-engine.js`, `src/refine-page.js`, `src/refining-data.js` (recetas, transmutaciones y pesos de ao-bin-dumps).
- Lingotes, Tablas, Tela y Cuero, T4–T8, .0–.4.
- Compra en la ciudad más barata, sumando un **coste por salto** (2 % por defecto) hasta la ciudad de refinado.
- **Transmutación** si sale más barata (coste base del juego).
- **Refinado en cadena** del tier inferior si sale más barato que comprarlo.
- **Focus** donde más ahorra por punto, con FCE.
- **Capacidad de montura** (kg) × viajes.
- **Divisiones**: automático o 1–5 ciudades de venta.
- **Prioridad**: Compra rápida / Más silver / Venta rápida.
- **Plan arriesgado** con la cantidad recomendada.
- El resultado se presenta en pasos: Comprar → Transmutar → Refinar (en orden) → Vender, con precio de lista, precio medio esperado, saltos y días aproximados de venta.

Top Mercado ya no muestra las ramas de refinado: queda para crafteo Royal y Mercado Negro.

## Archivos
- **Nuevos**: `src/engine-v3.js`, `src/optimizer.js`, `src/refining-engine.js`, `src/refining-data.js`, `src/refine-page.js`, `assets/tabs/refine-tab.svg`, `tests/engine-v3.test.mjs`, `tests/refining-v3.test.mjs`, `tests/fixtures/refining-fixture.mjs`.
- **Retirados**: `src/portfolio-engine.js`, y de `src/planner.js` las funciones `buildCandidates` y `allocatePlan`. El build los excluye aunque sigan en tu repositorio.
- **Pruebas del motor 2.x retiradas**. `tests/limits-audit-v27.test.mjs` y `tests/refining-v28.test.mjs` quedan como archivos vacíos para no romper `npm test` si copias encima. Puedes borrarlos.
- `npm test`: 137 pruebas.
