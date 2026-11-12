# Actualizar Gildem Market & Craft a v1.2.0

**Solo este repositorio:** https://github.com/drzjhon-dot/gildem-market-craft  
**Solo este sitio:** https://gildemcraft.netlify.app/

No necesitas crear otra web ni modificar el antiguo Gildem Albion Lab. La v1.2 se basa en la v1.1 y conserva las dos pestañas, el motor de generación de planes y todas las funciones de Netlify.

## Actualización desde GitHub Desktop (recomendada)

1. Abre GitHub Desktop y clona el repositorio `drzjhon-dot/gildem-market-craft` si aún no lo tienes local.
2. Descomprime `Gildem_Market_Craft_v1_2_0_GITHUB_NETLIFY.zip`.
3. Copia **los archivos y las carpetas del interior del ZIP** a la raíz del repositorio clonado; confirma reemplazar los existentes. **No borres la carpeta `.git`**.
4. En GitHub Desktop comprueba los archivos modificados (principalmente `styles.css`, `src/main.js`, `src/batch-calculator.js`, pruebas y documentación).
5. Escribe el commit `v1.2: ranking Albion, colores por ciudad y calculadora visual`, pulsa **Commit to main** y después **Push origin**.
6. Si Netlify sigue conectado a la rama `main`, revisa el despliegue y recarga https://gildemcraft.netlify.app/ con `Ctrl + F5` cuando esté publicado.

## Alternativa con terminal

```bash
git clone https://github.com/drzjhon-dot/gildem-market-craft.git
# Copiar encima el contenido descomprimido del ZIP
cd gildem-market-craft
npm run build
git add .
git commit -m "v1.2: ranking Albion y calculadora visual"
git push origin main
```

## Verificación de producción tras subirlo

1. En Top Mercado, consulta **Hachas** o **Arcos** en Mercado Negro y comprueba que aparece el ranking `#`, ciudad con su color, unidades/día y precio unitario redondeado al entero.
2. Pulsa el icono dorado de **copiar** junto a un objeto; usa **Shift + clic** para copiar su ID interno.
3. Pulsa **Agregar a Calculadora**, cambia cantidad, tier o encantamiento y comprueba que las cifras se recalculan.
4. Revisa los materiales: cada ciudad Royal usa su color; si falta una cotización, se muestra y puede introducirse manualmente.
5. Comprueba el botón **Copiar compras**, los diarios estimados, CSV, y el **Generador automático de planes** plegable.
6. Prueba con un teléfono o una ventana estrecha: las tablas se desplazan lateralmente dentro del panel, sin desbordar toda la web.

## Límites de validación

Se han superado **27 pruebas automatizadas** y pruebas de interfaz mediante un navegador con respuestas AODP **simuladas**. Son pruebas de comportamiento, no precios actuales. **Todavía no se han verificado las solicitudes reales a AODP ni un despliegue de producción en Netlify.**

La integración de GitHub disponible en este chat devolvió `403 Resource not accessible by integration` al intentar escribir en el repositorio; por eso se entrega el ZIP para subir los cambios manualmente. El sitio en producción no se ha alterado desde aquí.
