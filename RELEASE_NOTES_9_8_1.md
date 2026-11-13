# Gildem Craft Pro v9.8.1 · Copia de nombres y pestañas ilustradas

Actualización exclusivamente de interfaz sobre el ZIP `v9.8.0 COMPRAS NETAS`.

## Cambios visibles

- Botón para copiar el nombre visible de cada objeto, material y diario en los planes, listas de compras, Resultados, Craft Cal. y tablas relacionadas. Un clic copia solo el nombre, no cantidades ni precios. El botón es accesible por teclado y confirma la copia con una notificación.
- Seis ilustraciones originales SVG, locales, para Black Craft, Royal Craft, Top mercado, Craft Cal., Resultados y Ajustes. Mantienen las mismas rutas y acciones del menú.
- Estilos visuales renovados exclusivamente para los botones de copia y las miniaturas del menú.

## Integridad y despliegue

- Los 53 archivos de `core/` son **idénticos, byte por byte** al ZIP de entrada. Sin cambios en cálculo de crafting, demanda, precios, rentabilidad, diarios, saturación, planificación, compras ni logística.
- Se incrementó la versión a 9.8.1 para actualizar la caché de la aplicación al publicar. La función `health` y scripts de despliegue solo actualizan la etiqueta de versión.
- Los seis SVG están incluidos en el proyecto, en `assets/tabs/`, copiados al directorio de publicación y registrados en el service worker.
- Pruebas: `npm test`, `npm run preflight` y `npm run build`.

Para instalar: reemplazar el contenido del repositorio GitHub por todos los archivos y carpetas de este ZIP y publicar con el flujo Netlify existente.
