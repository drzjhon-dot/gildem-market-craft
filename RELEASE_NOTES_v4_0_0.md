# Gildem Albion Lab 4.0.0 · una sola herramienta (solo West)

Esta versión une en un solo proyecto **Gildem Market & Craft 3.1.0** y **Gildem Craft Pro 9.11.0**. Todo funciona solo para West: AODP `west.albion-online-data.com`.

## Cómo se unieron
- **La base es Market & Craft 3.1.0**, porque es el árbol más nuevo y ordenado (Motor 3.0, Plan Mercado Negro, Refinamiento con su pestaña, Calculadora).
- **Del 9.11 se trajo lo que la base no tenía:**
  - **Mi negocio**: inversiones, ventas e importación del CSV de Trades del AFM Data Client (`ledger.js`, `afm-trades.js`, `names-en.js`).
  - **Recetas del set de cuero dragón** (`recipe-supplement.js`). Solo se usan si el catálogo principal no trae ese objeto.
  - **Alertas de precio**, que ahora viven en «Precios y alertas».
- **Black Craft y Royal Craft del 9.11 no se copiaron.** El Craft Planner (Motor 3.0) ya planifica para el Mercado Negro y las ciudades Royal, y el 9.10/9.11 usaba ese mismo motor. El Plan Mercado Negro cubre el caso de vender al Mercado Negro en pocos días.
- **Encantamiento y transmutación del 9.11** pedían escribir a mano la cantidad de runas. Se reemplazaron por una herramienta nueva con cantidades exactas del juego (ver abajo). La transmutación sigue dentro de Refinamiento.

## Nueve herramientas
| Sección | Pestaña | Qué hace |
|---|---|---|
| Planificar | Top Mercado | Ranking de crafteo para el Mercado Negro y las ciudades Royal. |
| Planificar | Craft Planner | Motor 3.0. Ahora con **Registrar en Mi negocio**. |
| Planificar | Plan Mercado Negro | Plan diversificado para vender en pocos días. Ahora con **Registrar en Mi negocio**. |
| Planificar | Refinamiento | Comprar, refinar y vender. |
| Planificar | Calculadora de Craft | Lotes manuales, materiales y diarios. |
| Vender y vigilar | **Precios y alertas** (nueva) | Precio del oro en West (endpoint `/stats/gold` de AODP), precios de cualquier objeto en los 8 mercados, historial de 14 días y alertas que se revisan cada 15 min con la web abierta. Aviso del navegador opcional. |
| Vender y vigilar | **Encantar** (nueva) | Compra el objeto en el nivel más barato, encántalo con runas, almas o reliquias y véndelo al Mercado Negro. Usa las cantidades exactas del juego (p. ej. 288 runas para la Espada ancha) y limita las unidades al % del volumen del Mercado Negro. |
| Negocio e isla | **Mi negocio** (portada del 9.11) | Ver detalle abajo. |
| Negocio e isla | **Granja** (nueva) | Ver detalle abajo. |

### Mi negocio
- Registra planes como inversiones y márcalas como compradas.
- Anota las ventas a mano o importa el CSV de Trades del AFM Data Client.
- Muestra el beneficio real y «lo que de verdad vendes» por objeto y mercado.
- Permite exportar e importar una copia en JSON.

### Granja
- Muestra los 15 cultivos y hierbas con su beneficio por cosecha, con y sin Focus.
- Calcula cuánto silver te deja cada punto de Focus y cuánto necesitas para empezar.
- Usa datos del juego: cosecha de 3–6 por semilla (Premium +100 %), retorno de semilla sin Focus y ciclo de 22 h.
- El retorno con Focus se puede editar (100 % por defecto).

En el teléfono, la barra de abajo mantiene las 5 herramientas principales. Las demás se abren desde el menú ☰.

## Investigación: otras herramientas para West
Herramientas revisadas: Albion Free Market (flipper, crafteo, granja, isla, portfolio, Study Calculator), Albion Battle Hub, Albion Online Builds, GuildOrder, gamergeeks y la documentación de AODP.

- **Incluidas:**
  - granja (cultivos y hierbas);
  - oro de West;
  - buscador de precios con historial;
  - alertas;
  - encantar para el Mercado Negro;
  - registro de ventas reales (portfolio).
- **Para próximas versiones:**
  - **Flips Caerleon → Mercado Negro**: es el método que más destacan los flippers. Esta herramienta lo quitó en la 1.9, así que no se volvió a meter sin preguntar.
  - **Animales y monturas** de la isla: crianza y nutrición.
  - **Cocina y alquimia desde la granja**: cultivo → comida o poción.
- **Descartadas:** la Study Calculator (estudiar destruye objetos para ganar fama, y no te interesa) y los killboards (no son de economía).

## Datos y archivos
- `assets/data/game-extra.json`: generado desde ao-bin-dumps (`items.json` + `loot.json`) con `scripts/generar-datos-juego.py`. Incluye las cantidades de encantamiento de 1.369 objetos y 15 semillas.
- Nueva función de Netlify `netlify/functions/gold.mjs` (`/api/gold`), solo para West.
- Nuevos módulos:
  - Mi negocio: `business-store.js`, `business-page.js`, `ledger.js`, `afm-trades.js`, `names-en.js`.
  - Precios y alertas: `price-tools.js`, `prices-page.js`.
  - Encantar: `enchant.js`, `enchant-page.js`.
  - Granja: `farm.js`, `farm-page.js`.
  - Recetas: `recipe-supplement.js`.
- `npm test`: 161 pruebas, incluidas las de `tests/v4-unificado.test.mjs`.

## Al publicar
Sube este proyecto al repositorio de **Market & Craft** como siempre. El repositorio antiguo de Craft Pro 9.x ya no hace falta: todo está aquí. Tus datos de Mi negocio del 9.x estaban en otra web (otro dominio), así que no se pasan solos.
