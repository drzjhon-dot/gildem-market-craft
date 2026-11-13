# v2.6.0 · Libro de órdenes West: el motor usa órdenes reales

AODP publica, además de su API, un canal en tiempo real con **cada orden** del mercado (cantidad, precio, calidad, tipo y caducidad). Esta versión lo recoge con GitHub Actions y el motor lo usa para dimensionar y valorar los planes. Ninguna web de terceros aporta datos independientes de AODP; esta es la fuente que faltaba.

**Para activarlo, sigue `ACTIVAR_LIBRO_DE_ORDENES.md` (una sola vez, gratis en repositorio público).** Sin activarlo, todo funciona igual que en 2.5.

## Recolector (GitHub Actions)
- `.github/workflows/orderbook-west.yml`: cada 3 h (minuto 23 UTC) escucha ~25 min el canal `marketorders.deduped` de West y publica el resumen en la rama `orderbook-data` (un único commit; el repositorio no crece). También se puede lanzar a mano.
- `collector/`: acumula el estado entre ejecuciones, detecta la escala de precios del juego (×10.000), descarta órdenes caducadas o no vistas en 72 h y **mide ventas seguras** (una orden que reaparece con menos cantidad).
- La compilación de Netlify detecta tu repositorio y escribe `orderbook.config.json`; la web lee el resumen de `raw.githubusercontent.com`.

## Motor
- **Venta al Mercado Negro:** las primeras unidades del lote se valoran con las **pujas reales** (sin superar el precio de planificación); solo el resto usa el modelo de impacto. Igual en Planner, motor de cartera y Calculadora.
- **Lote en Mercado Negro:** si ahora mismo hay pujas rentables de sobra, el lote puede crecer hasta el 50 % / 80 % / 100 % de esas unidades (Prudente / Equilibrado / Dinámico). El beneficio marginal sigue decidiendo cada craft.
- **Ciudades Royal:** se descuenta la **competencia** ya publicada a tu precio o menos (de cualquier calidad). Si cubre toda la actividad del plazo, la ruta se descarta con el motivo.
- **Materiales:** coste **exacto** recorriendo las ofertas reales de la ciudad de compra; solo lo que el libro no cubre se estima por días de mercado.
- Solo se usan órdenes vistas en las últimas 24 h. Donde no hay, el motor sigue con la estimación de siempre.

## Interfaz
- Craft Planner: estado «Libro de órdenes West · actualizado hace X h · N artículos».
- En cada ruta: unidades en pujas, cuántas de tu lote van a pujas reales, lote ampliado, ventas vistas, competencia.
- Calculadora: «N u. a pujas reales MN» y, en compras, «libro: cubiertas/necesarias · precio medio».

## Verificación
147 pruebas (8 de motor con libro, 7 del recolector). Recolector probado en modo simulado en dos ejecuciones encadenadas (estado y ventas) y simulación local del publicado en la rama. Interfaz probada en Chrome con un libro simulado. La conexión real al canal de AODP no se pudo probar desde este entorno (sin salida a esa red): la primera ejecución manual en GitHub lo confirmará.
