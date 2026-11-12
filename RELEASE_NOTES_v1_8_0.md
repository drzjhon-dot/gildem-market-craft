# Gildem Market & Craft v1.8.0

## Nuevo en esta versión

1. **Refinamiento**: cinco familias, variantes T4–T8, encantamientos aplicables, ciudad de especialidad, materias primas y productos anteriores por receta, con fuente `ao-bin-dumps` cuando sea verificable. Presupuesto, retorno sin Focus, costes, ROI, variedad y mercados de destino.
2. **Flips**: compra en mercados Royal y venta en Royal o Black Market. AODP West Prices Q1 + History Q1, cotizaciones recientes y fechadas, distinción entre oferta de compra y puja de venta, costes/tasas configurables, capital por artículo, impacto estimado, filtro de estrés, CSV y motivos de exclusión.
3. **Top Mercado**: botón «Enviar marcados a Flips» y portadas de ramas ilustradas con iconos del juego.
4. **Craft Planner**: verificación adicional de recetas desde `ao-bin-dumps` y corrección del límite de capital por artículo, incluso durante la reserva de tiers de diversidad.
5. **Fuentes externas**: documentación técnica de AlbionDataAvalonia, AFMDataClientCore y LiveFlipper. Se ha escrito código original para esta versión y no se ha copiado código de los dos proyectos con licencia no comercial.
6. **Tema**: controles nuevos de Refinamiento/Flips en grafito y cobre, sin fondos morados heredados.

## Límites

- Netlify estática: sin captura local UDP ni NATS permanente.
- AODP Orderbook está documentado pero **no integrado** en el cálculo de ejecución; compra/venta a un precio observado no implica profundidad.
- La fuente `ao-bin-dumps` puede fallar o tardar en cargar por su tamaño. Se señaliza receta verificada o de referencia.
- No se garantiza el beneficio ni la ejecución de una ruta de comercio.

## Tests

Verifica con `npm run build`. Las pruebas emplean datos sintéticos o respuestas simuladas y no certifican acceso externo ni despliegue real en Netlify.
