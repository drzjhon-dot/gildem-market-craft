# Subir Gildem Market & Craft v1.7.0 a GitHub y Netlify

El repositorio que usa esta aplicación es https://github.com/drzjhon-dot/gildem-market-craft . **No subas estos archivos al repositorio antiguo de Gildem Albion Lab.**

1. Haz una copia de la versión publicada o crea una rama en GitHub antes de reemplazar archivos.
2. Descomprime `Gildem_Market_Craft_v1_7_0_GITHUB_NETLIFY.zip` en tu PC.
3. Sube su contenido al directorio raíz de `drzjhon-dot/gildem-market-craft`, conservando las carpetas `src/`, `netlify/functions/`, `assets/`, `tests/` y `scripts/` y el archivo `netlify.toml`.
4. Si tu sitio Netlify despliega automáticamente desde `main`, realiza el commit allí cuando quieras publicar, o prueba primero desde una rama con Deploy Preview.
5. En Netlify abre https://gildemcraft.netlify.app/ cuando termine la publicación. Prueba «Mazas → Objetos individuales → Maza → Solo mis objetos → Consultar top».
6. Revisa el indicador «Forzar datos frescos» (debe iniciar marcado) y los controles de «Protección del beneficio» en Craft Planner.

## Antes de publicar desde Windows (opcional)

En la carpeta descomprimida con Node.js 20+ instalado:

```bash
npm run build
```

Se ejecutan las pruebas y se genera `dist/`. Netlify también dispone de un build configurado por el proyecto.

## Cambios que **no** hacen esta actualización

- No añade una cuarta pestaña.
- No altera los porcentajes ni el modelo de beneficio de la versión 1.6.
- No afirma obtener volumen de ventas reales: el History sigue midiendo órdenes observadas.
- No instala una suscripción NATS ni combina fuentes externas sin comprobar.
