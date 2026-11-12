# Gildem Market & Craft 3.1.0

## Nueva pestaña: Plan Mercado Negro

Esta pestaña arma un plan para vender al Mercado Negro en pocos días. Usa las mismas reglas que el plan manual de espadas:

1. **Demanda real del Mercado Negro.** Hay dos fuentes:
   - **AODP West**: historial de 7 días del Mercado Negro (todas las calidades) y la puja actual de calidad 1. Si no hay puja reciente, usa la media −3 %.
   - **Tabla pegada**: se copia una tabla de ventas de otra web (ID, cantidad diaria, silver diario, precio medio) y se pega. Entiende cifras como `584`, `5,1M` y `8,7K`. Si la cantidad viene redondeada a 0, calcula la venta diaria real como silver / precio. Solo usa las filas del Mercado Negro.
2. **Tope por artículo.** Nadie se lleva más del **6 %** de lo que el Mercado Negro compra en el plazo (3 días por defecto). Así no se hunde el precio aunque haya otros crafteadores.
3. **Valor por material.** Compara las variantes del mismo nivel de poder (tier + encantamiento) que usan los mismos recursos. Descarta las que pagan bastante menos por material que la mejor; por defecto, las que se quedan por debajo del 75 % de la mejor. Casi siempre son las encantadas.
4. **Diversidad.** El presupuesto se reparte entre varios artículos (9 por defecto), equilibrados entre tiers y familias, con un tope de 25 % por artículo. Todos avanzan a la vez, por rondas.
5. **No se descarta nada por falta de cotizaciones.** Si falta el precio de algún material, el coste usa un margen supuesto (25 %). Además se muestra el **precio máximo de material**, sin Focus y con Focus, al que cada artículo aún deja el margen mínimo (20 %).
   - Con precios de AODP o con **tus propios precios** (en la lista de compra), el margen es real. Un artículo que no llega al mínimo sale del plan y se explica por qué.

### Qué muestra
- **Fabricar**: unidades, unidades por día, lo que paga el Mercado Negro, ventas diarias, % del plazo, capital, ganancia y margen, y precio máximo de material.
- **Órdenes de compra**: cantidad neta del retorno (crafteando en tandas), precio máximo de cada orden, precio de AODP (en rojo si supera el máximo), campo «Tu precio» que recalcula al momento, y costo máximo.
- **Vender**: en tandas, una por día, lo más caro primero.
- **Motivos de cada descarte**: sin receta, artefacto, poca venta, menos valor por material, margen real, diversidad.
- Botones **Copiar lista de compra** y **CSV**.

## Archivos
- Nuevos: `src/bm-plan.js` (motor, sin interfaz), `src/bm-page.js` (pestaña), `assets/tabs/bm-plan.svg`, `tests/bm-plan-v31.test.mjs` y `tests/fixtures/bm-swords-sample.txt`.
- Modificados: `src/main.js` (ruta `bm`), `index.html` (5 accesos), `styles.css` (barra del teléfono con 5 botones), `sw.js` (caché v310), `scripts/build.mjs`, `package.json` y las pruebas que contaban 4 pestañas.
- `npm test`: 150 pruebas.
