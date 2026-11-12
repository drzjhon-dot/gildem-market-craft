# v2.4.0 · Tema HUD oscuro (sustituye al tema medieval de 2.3.0)

Solo apariencia. Ninguna función, botón, filtro ni cálculo cambia (121 pruebas pasan).

## Paleta
| Uso | Color |
|---|---|
| Fondo | casi negro `#06080b` con rejilla HUD muy tenue |
| Paneles | grafito `#0d1218 → #0a0e13`, borde `#1c2631` |
| Acento HUD | ámbar `#f2b13c` (esquinas, títulos, botón principal, selección) |
| Estado | verde `#3ddc84` (beneficio) · rojo `#ff5d5d` (pérdida) · azul `#59c3ff` (avisos informativos) |
| Texto | `#e6edf5`, secundario `#8a97a8` |

Toda la hoja se recoloreó desde la versión anterior al tema medieval, oscureciendo fondos y bordes y manteniendo claros los textos. Se conservan los **colores por ciudad** y de **rareza de encantamiento**.

## Elementos HUD
- Paneles con **esquinas en ámbar** (arriba-izquierda y abajo-derecha) y títulos con barra lateral.
- Títulos, etiquetas, cabeceras de tabla y botones en **Rajdhani** (estilo interfaz de juego), en mayúsculas; incluida en `assets/fonts` (licencia OFL), funciona sin conexión.
- Indicadores (inversión, resultado, crafts, profit…) con cifras grandes y **línea de carga ámbar** inferior.
- Botón principal ámbar sólido con brillo; secundarios con contorno fino.
- Tabla del ranking: cabecera con línea ámbar, fila marcada con barra lateral y brillo, «Vendidos Q1/día» resaltado, mini-gráfica con los 3 últimos días iluminados.
- Avisos con barra de color según tipo (informativo, advertencia, correcto).
- Cabecera de cada pestaña: tu escena como banner oscuro y desaturado con líneas de escaneo y filete ámbar.
- Barra de marcados flotante con borde ámbar; menú del teléfono y barras de desplazamiento a juego.

## Otros
- `theme-color` del navegador y del manifiesto: `#06080b`.
- Caché de la app: `gildem-shell-v240`.
