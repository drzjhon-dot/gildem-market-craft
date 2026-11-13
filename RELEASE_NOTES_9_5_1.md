# Gildem Craft Pro v9.5.1 · Diagnóstico de arranque

## Qué pasó
La pantalla «No se pudo iniciar · Error al cargar un archivo del sitio» de tu despliegue no era un bug del código: la v9.5.0 arranca limpia en pruebas. Aparece cuando el sitio publicado mezcla versiones, normalmente porque algún archivo de `core/` quedó de una versión anterior junto a un `app.js` nuevo (reproducido: `core/craft-calc.js` de v9.4.0 + `app.js` de v9.5.0 produce exactamente ese error).

## Qué cambia
- **La pantalla de error ahora diagnostica.** Si un módulo falla, muestra el detalle real (por ejemplo: «The requested module './core/craft-calc.js' does not provide an export named …») y, cuando el patrón delata un despliegue mezclado, lo dice y da la solución: volver a copiar TODOS los archivos del ZIP, Commit, Push y Reparar carga.
- Blindaje menor: preferencias de la calculadora corruptas ya no pueden dejar sin mapas de precios manuales.

## Cómo arreglar tu despliegue actual
1. Pulsa **Reparar carga** (limpia caché y vuelve a pedir los archivos). Si ya quedó bien, listo.
2. Si reaparece: copia **todos** los archivos de este ZIP sobre el repositorio (deja que sobreescriba todo, incluida la carpeta `core/`), Commit to main → Push origin.
3. Espera `Published` en Netlify y recarga con Ctrl + Shift + R. Debe verse `v9.5.1`.

## Pruebas
339 pruebas, compilación correcta, arranque limpio verificado sobre `dist/` y el caso de despliegue mezclado reproducido mostrando el diagnóstico nuevo.
