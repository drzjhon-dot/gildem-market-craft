# Gildem Market & Craft v1.9.1 · Corrección del deploy

## Problema
Al subir v1.9 a un repositorio existente, GitHub mantiene los archivos que ya no figuran en el ZIP. Por eso `tests/flips-v18.test.mjs` de v1.8 continuó ejecutándose y esperaba cinco pestañas cuando la aplicación actual solo tiene tres. Este caso se reprodujo localmente: 92 tests, 91 correctos y 1 error.

## Corrección
- Se sustituye `tests/flips-v18.test.mjs` por regresiones de la navegación actual y las transferencias. El archivo conserva su nombre para sobrescribir el test obsoleto al subirlo por GitHub.
- Se mantiene el comando `npm run build` ejecutando la suite; no se desactivan las pruebas para ocultar problemas.
- El compilador excluye `src/flipping.js`, `assets/tabs/flips.svg` y `assets/tabs/refining.svg` del sitio distribuido si persisten en el repositorio.
- La versión PWA pasa a 1.9.1, renovando la caché de la aplicación.

## Limpieza recomendada en GitHub
Tras publicar, se puede eliminar manualmente el antiguo archivo `src/flipping.js` y las imágenes de pestañas `assets/tabs/flips.svg` y `assets/tabs/refining.svg`, si existen. También se puede eliminar `tests/flips-v18.test.mjs` (v1.9 ya tiene pruebas de tres pestañas), aunque el reemplazo incluido es útil para evitar errores durante una actualización incremental.

No se han vuelto a introducir las pestañas Flips o Refinamiento. Refinamiento continúa en las ramas de Top Mercado.
