# Instalar la versión 1.3.0 en gildemcraft.netlify.app

1. Descarga el ZIP v1.3.0 y extrae su contenido.
2. Abre https://github.com/drzjhon-dot/gildem-market-craft en GitHub.
3. Carga los contenidos de la carpeta extraída en la **raíz del repositorio**; reemplaza los archivos anteriores conservando sus rutas (por ejemplo, `src/main.js` debe quedar en `src/main.js`). Nunca subas todo dentro de una carpeta llamada `Gildem_Market_Craft_v1_3/`.
4. Crea un commit en `main`, o en una rama de prueba para revisar antes de fusionar.
5. Abre el panel de Deploys de Netlify. Si tu sitio está conectado a este repo y rama, Netlify ejecutará `npm run build` y publicará `dist` junto a las functions.
6. Comprueba el flujo: Top Mercado -> Consultar top -> Seleccionar destinos -> Generar plan por ciudades -> Revisar resultados.

No reemplaces el proyecto Gildem Albion Lab anterior: este ZIP solo corresponde a `gildem-market-craft`.

Para probar localmente (Node 22): `npm test` y `npm run build`. El pequeño `npm run dev` muestra interfaz, pero no ejecuta functions. Para AODP real necesita Netlify o Netlify CLI.

La publicación no se ha realizado desde esta conversación. El resultado final con precios reales dependerá de los datos de AODP y de las consultas desde tu sitio.
