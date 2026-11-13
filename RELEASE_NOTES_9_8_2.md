# Gildem Albion Lab · Craft Pro v9.8.2 — Nuevo look

## Cambios visuales solicitados
- Nuevo escudo de Gildem Albion Lab en el encabezado lateral. Se utiliza el arte original generado para esta marca.
- Seis fondos ilustrados y optimizados, diferentes para Black Craft, Royal Craft, Top mercado, Craft Cal., Resultados y Ajustes.
- Fondos incorporados en la distribución, sin depender de servicios de imágenes externos.
- Pestañas laterales con sus propias escenas tenues y paneles con oscurecimiento legible.
- Ambientación con resplandor suave y respeto a la preferencia `prefers-reduced-motion`.
- PWA, favicon y caché actualizados para evitar despliegues con una mezcla de versiones.

## No se modificó
- Ningún archivo de `core/`.
- `app.js` (navegación, recetas, tasas, demanda, motores de crafting, diarios, profit, lista de compra, asignaciones y logística).
- Funciones de datos de mercado, excepto su etiqueta de versión en `/health`.
- Configuración y destino de publicación de Netlify.

## Instalación
1. Sustituye todos los archivos del repositorio por el contenido de este ZIP y conserva las carpetas.
2. Haz commit y push a GitHub.
3. Netlify ejecutará `npm run build` y publicará `dist/`.
4. En el navegador, haz una recarga forzada si aún ves la versión en caché.

Las ilustraciones son originales generadas para esta identidad; no son capturas oficiales de Albion Online.
