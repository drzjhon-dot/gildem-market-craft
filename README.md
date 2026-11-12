# Gildem Albion Lab | Market & Craft

**Proyecto nuevo e independiente (v1.1.0)** para Albion Online, servidor **América / West**.

Tiene **solamente dos pestañas**: `Top Mercado` y `Calculadora de Craft`. No modifica ni importa el motor de la aplicación anterior. La fuente única de **estadísticas y precios de mercado** es **Albion Online Data Project (AODP) REST West**. Las recetas y traducciones se obtienen de archivos públicos derivados de los datos oficiales del juego; esos archivos **no** aportan cifras del mercado.

## 1. Crear un GitHub diferente y un nuevo Netlify

1. **Descomprime** el ZIP entregado. No necesitas copiar archivos de tu proyecto anterior.
2. En GitHub, crea un **repositorio nuevo y vacío**, por ejemplo `gildem-market-craft`. No reutilices el antiguo repositorio.
3. Sube **el contenido de esta carpeta** a la raíz del repositorio nuevo: `index.html`, `src/`, `netlify/`, `assets/`, `package.json`, `netlify.toml`, etc. No subas la carpeta contenedora como un único nivel adicional.
4. En Netlify crea un **sitio nuevo**, selecciona `Add new project` → importar desde GitHub y elige **el nuevo repositorio**. No vincules el repositorio viejo ni sobrescribas el sitio viejo.
5. Netlify leerá `netlify.toml` automáticamente. La configuración es:
   - Comando de build: `npm run build`
   - Directorio publicado: `dist`
   - Directorio de functions: `netlify/functions`
   - Node: 22
6. Publica el sitio. Comprueba que carga las dos pestañas, que el catálogo de nombres/recetas no da error y que la consulta de Top regresa datos o un diagnóstico explícito.

**Importante:** para que `/api/market` y `/api/catalog` funcionen, publica mediante **Git conectado con Netlify** o usando la CLI de Netlify con el soporte de functions. Arrastrar solamente `dist/` a Netlify Drop no despliega las funciones serverless.

No hay variables de entorno secretas obligatorias. La app no necesita claves AODP. No se ha creado por sí sola una cuenta, repositorio ni sitio Netlify.

## 2. Cómo usar

### Top Mercado

1. Elige de una a **seis ramas** en los diez grupos, con sus imágenes.
2. Marca Bridgewatch, Fort Sterling, Lymhurst, Martlock, Thetford, Caerleon, Brecilien y/o Mercado Negro.
3. Selecciona **1 / 3 / 7 / 14 días UTC completos**, ordenación y si quieres forzar una nueva consulta.
4. Pulsa **Consultar top**. La primera página cubre **hasta 240 IDs reales** distribuidos por rama, tier y encantamiento. Si aparecen más IDs, pulsa **Ampliar cobertura**. La aplicación indica la cobertura, nunca presenta una muestra como un catálogo completo.
5. Marca productos concretos, o deja todos los resultados observados como candidatos, y abre la Calculadora.

### Calculadora de Craft

1. Configura **ciudades de venta**, tiers, encantamientos, ciudad de fabricación con bono, bono diario, Focus (con coste real por craft), presupuesto, días de venta, estilo, objetivo y diversidad T6–T8.
2. Pulsa **Generar mi plan**. El motor intenta obtener cotizaciones recientes AODP y recetas existentes; no rellena el presupuesto con rutas de pérdida esperada.
3. Examina la **inversión bruta**, beneficio neto **estimado**, impacto **estimado** de tus propias ventas, escenario de estrés, lista de compras y diarios **orientativos**.
4. Usa la **calculadora individual** para simular una cantidad concreta incluso si sale a pérdida, o exporta el plan a CSV.

## 3. Cálculos y criterios

- Historial: `/api/v2/stats/history`, calidades 1–5, días UTC completos, ponderación por unidades y deduplicación básica de entradas repetidas. El historial AODP se basa en órdenes de **venta**, no confirma ejecución real.
- Cotizaciones: `/api/v2/stats/prices`, calidad normal (1) para un cálculo comparable. Se excluyen precios sin fecha o de más de **48 horas** (umbral configurable).
- Venta: para Mercado Negro usa la **mejor puja de compra observada**; para Royal usa la **oferta de venta mínima observada**. Son dos escenarios diferentes, ninguno garantiza que el lote se venda.
- Fórmula de retorno ilustrativa: `33 / (100 + 33) = 24,812%` cuando corresponde **18% Royal + 15% especialidad**, sin bono diario ni Focus. El retorno se recalcula individualmente según la receta.
- Presupuesto: reserva hasta el coste **bruto** de materiales por craft, aunque el retorno previsto reduzca su coste neto después.
- Satisfacción de demanda: límites por proporción prudente del volumen **histórico observado**. El impacto de venta se calcula por escenario; **no** es un simulador verificado de libro de órdenes.
- Diversidad: intenta incluir T6, T7 y T8 cuando hay historial y margen esperado positivo; un resultado negativo bajo estrés se señala. **Nunca** fuerza un craft sin historial, receta, precio o margen esperado positivo.
- Diarios: solo como **estimación señalizada** (no se les atribuye una exactitud oficial ni se agregan automáticamente al coste).
- Caché cliente y función: hasta una hora cuando la instancia conserva memoria. Forzar datos frescos ignora la caché de la aplicación, pero **no obliga a los jugadores a subir nuevas observaciones** a AODP.

### Límites importantes

Este v1.0 **no calcula** el precio real por tramos al barrer el libro de órdenes, costes de transporte, ni tarifas particulares de fabricación salvo la que introduzcas. Debes revisar manualmente la profundidad de compras de materiales y ventas finales antes de comprometer silver. El dato de `History` tampoco equivale a demanda ejecutable.

**Recetas especiales:** monturas, comidas, pociones y herramientas dependen de descargar los `craftingrequirements` del catálogo público `ao-bin-dumps`; pueden fallar por tamaño o disponibilidad temporal de esa fuente. En ese caso el Top puede mostrar los IDs que consiga identificar, pero la calculadora **no fabrica una receta ficticia**. Las especialidades no verificadas de recetas especiales no reciben automáticamente el +15%.

La cobertura del Top es **paginada** para respetar las cuotas del servicio. AODP limita solicitudes y puede responder HTTP 429. La UI informa los lotes que fallen, en lugar de sustituirlos con cifras inventadas.

## 4. Pruebas locales

Requiere **Node.js 20+**, recomendado Node 22.

```bash
npm test
npm run build
```

El build genera `dist/` y ejecuta primero el conjunto de pruebas automatizadas. Para una vista **solo de interfaz** en local:

```bash
npm run dev
```

Visita `http://localhost:8787`. Este servidor local ligero **no ejecuta functions**, por lo que la consulta real a AODP requiere **Netlify CLI** (`netlify dev`) o el despliegue en Netlify. No confundas una prueba local sin funciones con una consulta fallida de AODP.

Las pruebas automatizadas verifican motor, presupuesto, retornos, calidades/días, Focus, selección, rechazo de escenarios imposibles, proxy West y estados de interfaz. **No equivalen a una prueba de integración con precios reales**. La API y Netlify deben validarse en el sitio publicado.

## 5. Estructura

```text
index.html                    Estructura visual de las dos pestañas
styles.css                   Diseño adaptable oscuro
src/main.js                  Interfaz, selección y flujo de consulta/plan
src/branches.js              105 opciones de 10 grupos y filtros por ID
src/branch-reference.js      Patrones base de ramas del juego
src/market.js                Cliente West, agregación UTC, caché y cotizaciones
src/planner.js               Motor de simulación y asignación totalmente nuevo
src/recipe-extractor.js      Intérprete de recetas oficiales especiales
netlify/functions/market.mjs Proxy AODP West validado con caché
netlify/functions/catalog.mjs Descarga de nombres/recetas desde fuentes públicas
netlify.toml                 Build y rutas de functions
scripts/                     Build y servidor estático de prueba
assets/                      Elementos de marca, banners e iconos
 tests/                      Pruebas automatizadas
```

### Fuentes documentadas

- AODP West API: https://west.albion-online-data.com/api-docs
- Documentación del proyecto: https://www.albion-online-data.com/developer
- Metadatos de recetas y nombres: https://github.com/vkorne-web/albion-market
- Información del juego (`items.json`): https://github.com/ao-data/ao-bin-dumps

---

**Versión:** 1.0.0 · **Independiente de Gildem Albion Lab anterior** · **Servidor de mercado:** West.


## Actualización visual v1.1.0 · estilo Albion Lab clásico

- **Top Mercado**: selector de ramas en 10 categorías plegables compactas (5 columnas en PC), selección rápida mediante etiquetas con imagen, contador por categoría y opción «Contraer todo». No se eliminó ninguna de las 105 opciones.
- **Calculadora de Craft**: ahora la primera sección es una calculadora manual de hasta 30 artículos, inspirada en la calculadora antigua de Gildem Albion Lab. Permite buscar y añadir por nombre/ID, editar cantidades, cambiar Tier y encantamiento cuando la receta existe, marcar fabricación sin bono, comparar beneficio BM/Royal y consultar compras agrupadas y diarios estimados. Puedes cambiar precios manualmente, exportar CSV y copiar la lista de compras.
- **Desde Top a Calculadora**: «↗ Calc» añade un artículo a la calculadora y «Enviar marcados» transfiere los artículos seleccionados con recetas reales. Los marcados para el plan siguen separados.
- **Generador automático**: se conserva con el motor independiente v1.0, bajo una sección expandible para que la pantalla principal siga siendo la calculadora manual. No se modificaron sus límites de beneficio/demanda/retorno.
- **Diseño**: recupera la paleta violeta, dorado y jade, con paneles oscuros y controles compactos. Estilos responsive.

### Importante sobre el profit manual

El capital inicial bruto, la compra neta con retornos y el coste efectivo son cantidades diferentes. Las ediciones manuales de precios se identifican, no se presentan como cotizaciones verificadas. Si no existe precio utilizable, el resultado queda en `s/d` en lugar de inventarse. El profit de BM usa el **precio máximo de compra observado** y Royal el **menor precio de venta observado** con ajustes de comisiones. El efecto de tus propias ventas solo se descuenta cuando hay historial del destino; sin él, se indica la limitación.

El Focus de la calculadora manual exige datos verificados de Focus por fabricación y Focus disponible. La estimación de diarios no entra en los costes de materiales. El calculador manual no necesita un historial Top previo, pero no estima automáticamente la demanda si no existe.

La interfaz se comprobó también con navegación funcional automatizada en navegador (Top Mercado → búsqueda → lote → cantidad → ajustes), usando respuestas de mercado simuladas. El despliegue y la disponibilidad de AODP deben verificarse también en Netlify.
