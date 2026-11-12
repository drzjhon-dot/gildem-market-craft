# Gildem Market & Craft · West v1.8.1

Proyecto independiente para **Albion Online América (West)**. Desarrollado para GitHub y Netlify. En esta versión, la aplicación incluye **cinco herramientas y modo teléfono**: **Top Mercado**, **Craft Planner**, **Calculadora de Craft**, **Refinamiento** y **Flips**.

## Qué resuelve cada pestaña

| Pestaña | Función principal |
|---|---|
| Top Mercado | Ranking History de AODP West, por ramas o familias individuales, tier y encantamiento; cifras separadas para todas las calidades y calidad 1; selección y envío. |
| Craft Planner | Convierte la selección del Top en lotes con límites de capital, riesgo, actividad Q1, selección de ciudades, estilo prudente/equilibrado/dinámico y diversidad de artículos, tiers y encantamientos. |
| Calculadora | Revisa el lote, cotizaciones, materiales, diarios opcionales agrupados, cantidades y escenarios de venta Royal/BM; acepta cambios manuales de precio identificados. |
| Refinamiento | Lingotes, tablas, tela, cuero y piedra; recetas de `ao-bin-dumps` cuando son verificables; retorno por especialidad, compras, historial y márgenes. |
| Flips | Comparación Royal → Royal y Royal → Mercado Negro, con márgenes, impuestos, presupuesto, antigüedad de cotizaciones, límites por artículo y actividad Q1. |

## Modo teléfono

La aplicación reconoce automáticamente pantallas de hasta **800 px** y muestra una navegación inferior con acceso a las cinco herramientas. La opción **Tarjetas** de la parte superior cambia las tablas largas por fichas legibles; puedes desmarcarla para ver la tabla tradicional con desplazamiento horizontal. Incluye campos de entrada cómodos para usar con el dedo, menú lateral con fondo oscuro y soporte para las áreas seguras de iOS/Android. Las pantallas de PC mantienen el menú lateral original.

También puedes **añadir Gildem a la pantalla de inicio** desde el navegador del teléfono. Se incluye `manifest.webmanifest`, iconos y un service worker que cachea solamente la carcasa visual. **Los datos de mercado, API de West y cotizaciones NO se cachean con el service worker**. Sin conexión puedes llegar a ver la interfaz, pero **no** datos de mercado actualizados ni planes basados en consultas nuevas.

## Datos, fuentes y licencias

- **Mercado West:** [Albion Online Data Project](https://west.albion-online-data.com/api-docs), endpoints History y Prices, calidad 1 en decisiones de compra/venta. **History corresponde a actividad observada de órdenes, no transacciones ejecutadas**.
- **Recetas estáticas:** [ao-data/ao-bin-dumps](https://github.com/ao-data/ao-bin-dumps); las recetas no sustituyen a precios o demanda. El módulo de refinamiento marca cuando se usó un respaldo no verificado en el dump.
- **Estudio externo:** [AlbionDataAvalonia](https://github.com/JPCodeCraft/AlbionDataAvalonia) y [AFMDataClientCore](https://github.com/JPCodeCraft/AFMDataClientCore) describen clientes de captura y subida de datos, **no una API web pública de precios**. Tienen licencia personalizada que prohíbe uso comercial y exige atribución para derivados: no se copió código de esos proyectos.
- **Inspiración de arbitraje:** [LiveFlipper](https://github.com/ozcankaya3535/Albion-Online-Market-Scanner-LiveFlipper); su repositorio público inspeccionado contiene documentación, no un motor público reutilizable. **Flips es implementación original** de esta aplicación con REST West.
- **No disponible aún:** validación de profundidad ejecutable del libro de órdenes, captura UDP, flujo NATS persistente, y verificaciones de órdenes reales a precios anunciados.

Lee [INTEGRACIONES_PROYECTOS_EXTERNO.md](INTEGRACIONES_PROYECTOS_EXTERNO.md) y [FUENTES_MERCADO_WEST.md](FUENTES_MERCADO_WEST.md) para limitaciones y procedencia.

## Instalar y probar localmente

Requiere **Node.js 20 o superior**, recomendado 22. Desde la carpeta del proyecto:

```bash
npm test
npm run build
npm run dev
```

`npm run dev` solo sirve archivos estáticos. Las funciones `/api/market` y `/api/catalog` requieren `netlify dev` o el despliegue en Netlify. La compilación escribe `dist/` con la interfaz, manifiesto, iconos y service worker.

## Desplegar sin tocar el proyecto anterior

1. Haz una copia de tu repositorio actual [gildem-market-craft](https://github.com/drzjhon-dot/gildem-market-craft) o crea una rama de revisión.
2. Sube el **contenido completo** de este ZIP a la raíz de ese repositorio, manteniendo `src/`, `assets/`, `netlify/functions/`, `tests/`, `scripts/`, `netlify.toml`, `manifest.webmanifest` y `sw.js`.
3. Netlify ya usa `netlify.toml`: `npm run build`, publicación `dist/` y funciones serverless. Cuando se actualice `main`, el despliegue automático funciona si la conexión sigue activa.
4. Prueba en `https://gildemcraft.netlify.app/` con teléfono y PC. Borra la caché del navegador solo si el contenido no se actualiza.

## Protección de capital y límites

Los planes usan precios y volúmenes **observados y fechados**, y conservan presupuestos máximos, límites de riesgo, volumen y diversificación. Un valor publicado no prueba profundidad del libro de órdenes ni garantiza beneficio. La cuota de actividad histórica es una hipótesis de capacidad de venta, no ventas confirmadas. En objetivo Silver se exige beneficio neto previsto; modo Fama puede aceptar pérdidas **limitadas por los ajustes explícitos**. No inviertas sin comprobar precios, cantidades disponibles, estaciones y transporte en el juego.

## Pruebas

`npm run build` ejecuta los tests antes de empaquetar. La revisión visual de PC/móvil usa datos de AODP **simulados**. Una prueba verde no demuestra el estado actual de los mercados reales de West ni el despliegue en Netlify.
