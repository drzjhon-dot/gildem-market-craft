# Gildem Market & Craft v1.8.1 · GitHub + Netlify

Esta versión añade **Refinamiento, Flips y modo móvil**. Modifica únicamente el proyecto independiente [gildem-market-craft](https://github.com/drzjhon-dot/gildem-market-craft). No subas estos archivos al Gildem Albion Lab original.

1. Descarga el ZIP y extrae su contenido.
2. Crea una rama de respaldo o guarda una copia de la publicación actual.
3. En tu repositorio `drzjhon-dot/gildem-market-craft`, sustituye/sube **todos los archivos y carpetas** de la raíz descomprimida.
4. Haz commit a `main` para desplegar, o prueba una rama con Deploy Preview.
5. Entra a [gildemcraft.netlify.app](https://gildemcraft.netlify.app/), abre las cinco pestañas y comprueba que Flips aparece también en PC.
6. En teléfono: verifica la barra inferior, cambia **Tarjetas** on/off y prueba «Marcar → Enviar a Planner → Generar plan → Calculadora». Prueba también Refinamiento y Flips.
7. Para añadirla a pantalla de inicio, usa la opción del navegador «Añadir a pantalla de inicio» o «Instalar aplicación» si está disponible.

Netlify lee `netlify.toml`, construye con `npm run build` y publica `dist/`. Las funciones de Netlify consultan AODP West y el catálogo del juego. No hace falta instalar ninguna APK ni un cliente de captura para utilizar la web.

**Importante:** la aplicación no instala el código .NET de JPCodeCraft ni el escáner de LiveFlipper; incorpora aprendizajes de sus documentos y un módulo original de arbitraje, con la fuente AODP West. Datos de mercado sin profundidad verificada no son órdenes ejecutables.
