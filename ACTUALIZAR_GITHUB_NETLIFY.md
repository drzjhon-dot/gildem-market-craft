# Actualizar Gildem Market & Craft a v1.4.0

Repositorio independiente actual: https://github.com/drzjhon-dot/gildem-market-craft

Sitio vinculado: https://gildemcraft.netlify.app/

1. Antes de reemplazar archivos, conserva una copia de la versión que tienes en `main` o crea una rama de respaldo.
2. Extrae **Gildem_Market_Craft_v1_4_0_GITHUB_NETLIFY.zip** en tu PC. Abre el contenido de la carpeta extraída.
3. En GitHub abre el repositorio indicado, sube **el contenido de la carpeta** (index.html, styles.css, package.json, netlify.toml, directorios `src`, `netlify`, `scripts`, `assets`, `tests`, etc.) a la **raíz**. No crees un directorio extra encima de ellos.
4. Si GitHub pide resolver duplicados, reemplaza los archivos antiguos con los nuevos; conserva el nombre y ubicación del repositorio. El ZIP contiene todo lo necesario y no depende del repositorio antiguo.
5. Realiza el commit en `main`, por ejemplo: `v1.4: Craft Planner separado + tema grafito`.
6. En Netlify abre el sitio ya conectado y verifica que el deploy termine. Después recarga la web con `Ctrl + Shift + R`.
7. Verifica las tres pestañas: marca objetos del Top, envíalos al Planner, genera una ruta para una ciudad y transfiere el lote a la calculadora.

Si Netlify no despliega automáticamente, revisa que el sitio conserve la rama `main`, el comando `npm run build` y el directorio publicado `dist`. Están declarados en `netlify.toml`.

**Atención:** la conexión de GitHub disponible para esta conversación anteriormente devolvió 403 al escribir. Esta entrega es un ZIP listo para carga manual; **no se ha modificado tu web ni tu repositorio desde aquí**.

**Aviso de mercado:** los tests usan cotizaciones simuladas; confirma disponibilidad real de AODP y la liquidez de los mercados después del deploy.
