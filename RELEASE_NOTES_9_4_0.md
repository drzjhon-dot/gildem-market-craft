# Gildem Craft Pro v9.4.0 · Craft Cal.

## Pestaña nueva: Craft Cal.
Calculadora de crafteo por lotes, con las mismas reglas que el motor de planes:
- **Añade objetos** desde el buscador por nombre o con **«Agregar a Cal.»** en Top mercado (sustituye al botón «Planificar»). Hasta 30 objetos; la selección se guarda en el navegador.
- Por objeto: cantidad editable, ciudad con bono y retorno aplicado, coste del lote (neto tras retornos) y **dos profits: Mercado Negro** (venta inmediata a la puja actual, solo impuesto) **y Royal** (mejor orden de venta observada, impuesto + 2,5 % de publicación), además de la fama de crafteo.
- **Materiales necesarios**: lista agregada con «Para» (qué objetos lo usan), ciudad más barata, cantidad a comprar con «sobran N» por el retorno, precio y total.
- **Diarios**: cuántos diarios vacíos llenará el lote (dato exacto del dump del juego cuando existe, estimación marcada con ≈ si no), con su precio si AODP lo tiene.
- Interruptor de **Focus** (59 % de bono de retorno) para todo el lote.
- Precios **de AODP West y editables a mano**: cualquier precio de material, diario, puja del Mercado Negro o venta Royal se puede corregir; queda marcado como «manual» (en dorado) y el botón ↺ vuelve al precio de AODP. Si falta una cotización, la fila dice «s/d» en lugar de inventar un número.
- Totales del lote: capital de compra (materiales + diarios), coste neto, profit por cada mercado y fama.

Las recetas salen del catálogo ya integrado (ao-bin-dumps, 6.800+ recetas, incluidas pociones, comidas y monturas).

## Pruebas
338 pruebas (8 nuevas en `tests/v9_4_0-craft-cal.test.mjs`) y verificación en Chrome con precios simulados: añadir desde Top mercado y buscador, cambiar cantidades, Focus, materiales, diarios y doble profit. Falta contrastarla con precios reales de West desde tu navegador.

## Instalación
Copia todos los archivos sobre tu repositorio, Commit to main → Push origin, espera `Published` en Netlify, Ctrl + Shift + R y comprueba `v9.4.0`.
