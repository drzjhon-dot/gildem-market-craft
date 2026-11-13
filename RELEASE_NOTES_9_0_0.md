# Gildem Craft Pro v9.0.0 · Nuevas listas de Resultados y tema «Mercado de noche»

## Resultados
- **Lista de fabricación** en filas: icono con la cantidad (×N), nombre, tier, ciudad, cantidad editable, capital y profit.
- **Lista de compras** en tabla: Material · Para (iconos de los objetos que lo usan) · Comprar en · A comprar (con «sobran N» por el retorno) · Precio unidad · Total. Los artefactos llevan la etiqueta «No se devuelve».
- **Logística** en columnas: Objeto · Fabricar en · Vender en · Cantidad · Profit.
- Todo ordenado **de menor a mayor tier** (y encantamiento).
- Se quitó el panel «Qué pide el mercado ahora». El motor sigue usando esa señal para ordenar el plan.
- En móvil cada fila se pliega en dos columnas, sin desplazamiento horizontal.

## Aspecto
- Paleta tinta violeta + oro real. Un resplandor lento de fondo cambia de color según la sección: rojo brasa en Black Craft, oro en Royal Craft, jade en Resultados, azul en Ajustes.
- Cada ciudad tiene su color allí donde aparece (Bridgewatch naranja, Lymhurst verde, Martlock azul, Thetford morado, Fort Sterling blanco, Caerleon y Mercado Negro rojo).
- Los tiers usan los colores de encantamiento del juego (.1 verde, .2 azul, .3 morado, .4 oro).
- Tipografías nuevas incluidas en `fonts/` (Bricolage Grotesque y Grenze Gotisch, licencia SIL OFL), sin depender de servidores externos.
- La animación se desactiva si el sistema pide reducir movimiento.

## Sin cambios
El motor de planes, comisiones y demanda de v8.9.0.

## Pruebas
315 pruebas, `npm run build` correcto. Resultados revisado en capturas de escritorio (1360 px) y móvil (412 px) con datos de ejemplo. Royal Craft y Ajustes comparten los mismos estilos pero no se revisaron en captura.

## Instalación
Copia todos los archivos (incluida la carpeta nueva `fonts/`) sobre tu repositorio, Commit to main → Push origin, espera `Published` en Netlify, Ctrl + Shift + R y comprueba `v9.0.0`.
