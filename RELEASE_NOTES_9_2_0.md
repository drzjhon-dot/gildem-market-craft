# Gildem Craft Pro v9.2.0 · Top del mercado (América / West)

## Qué es
Una pestaña nueva, **Top mercado**, con lo mismo que ofrecen webs como albiononlinehub («top selling items»), pero dentro de la herramienta, siempre en el servidor América (West) y conectada al creador de planes.

Esa web no tiene API pública ni forma de fijar el servidor por enlace: su selector es manual. Sus números salen del mismo historial público comunitario (Albion Online Data Project) que ya usa Gildem, así que la vista se calcula aquí directamente de la fuente.

## Cómo funciona
- Eliges **rama** (cualquiera de las del creador de planes, también pociones, comidas, monturas o recolección), **ventana** (1, 3, 7 o 14 días), **mercados** (las 7 ciudades Royal y el Mercado Negro) y el **orden**: silver por día, unidades por día o precio por unidad.
- La tabla muestra por objeto y mercado: unidades/día, silver/día, precio medio por unidad (ponderado por volumen) y cuántos días de la ventana tuvo movimiento.
- **Planificar** en cada fila lleva esa rama al creador de planes: Black Craft para equipo, Royal Craft para las ramas Royal.
- Usa la misma caché de 1 hora que el resto de la herramienta; «Forzar datos frescos» la salta.
- Promedios de observaciones del mercado, calidad Normal. No son ventas garantizadas.

## Pruebas
326 pruebas (4 nuevas en `tests/v9_2_0-top-market.test.mjs`), compilación correcta y la página verificada en Chrome con datos simulados del servidor (tabla y salto a Planificar incluidos). Falta probarla con datos reales de West desde tu navegador.

## Instalación
Copia todos los archivos sobre tu repositorio, Commit to main → Push origin, espera `Published` en Netlify, Ctrl + Shift + R y comprueba `v9.2.0`.
