# Corrección v1.9.1 · GitHub y Netlify

1. Descarga el ZIP completo y descomprímelo.
2. En `drzjhon-dot/gildem-market-craft`, sube el **contenido** de la carpeta raíz, conservando rutas como `src/`, `tests/` y `scripts/`. No subas una carpeta contenedora.
3. **Imprescindible:** verifica que `tests/flips-v18.test.mjs` haya sido **reemplazado**. Ahora comienza con `Regression guard for v1.9` y contiene tres pruebas de tres pestañas. El test antiguo es lo que bloqueaba Netlify.
4. Confirma los cambios en la rama `main`. Netlify ejecutará `npm run build`.
5. Si aparece un error, revisa que se hayan sobrescrito todos los archivos y el despliegue use `main`.
6. Limpieza opcional: elimina `src/flipping.js`, `assets/tabs/flips.svg` y `assets/tabs/refining.svg` si aún permanecen en GitHub. No son parte del sistema actual.

**Alternativa mínima:** en GitHub, elimina el viejo `tests/flips-v18.test.mjs` y vuelve a desplegar. Esto basta para corregir el fallo de las cinco pestañas si el resto de v1.9 ya está subido correctamente.

Se conserva la prueba automática dentro de `npm run build`; desactivarla ocultaría problemas reales.
