# Gildem Albion Lab · v9.9.0-top.2

Base: **v9.9.0 original** con mejoras exclusivas de Top Mercado de v9.9.6.

- Cinco pestañas, en orden: Calculadora de Craft, Black Craft, Royal Craft, Top Mercado, Ajustes y Datos. Se elimina el acceso de Resultados.
- Tras un plan exitoso, los objetos pasan automáticamente a la calculadora. Se suman las fabricaciones del mismo ID exacto, manteniendo Tier/encantamiento. Un mismo artículo con distintas rutas de venta no duplica compras.
- En Calculadora puedes modificar cantidades/variantes, añadir/quitar objetos, usar Focus/bono diario y corregir precios. Se informa el presupuesto de origen y avisa si se excede.
- Los planes originales se conservan en memoria de la sesión, sin cambios en los motores de selección, tarifas o demanda. La calculadora recalcula sus propias cotizaciones y NO conserva las rutas/logística de venta ni reproduce el beneficio de una orden BM de publicación.
- Se pueden copiar las compras y exportar CSV de la calculadora actualizada, incluidos materiales y diarios.
- Ocultada la sección «Fuentes y evidencia de mercado».
- Sin cambios en los módulos del motor de crafting heredados de v9.9.0.

**Instalación:** reemplazar TODO el repositorio GitHub y permitir que Netlify ejecute `npm run build`.
