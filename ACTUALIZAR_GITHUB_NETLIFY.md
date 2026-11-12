# Actualizar Gildem Market & Craft a v1.1

Repositorio exclusivo del proyecto: https://github.com/drzjhon-dot/gildem-market-craft
Sitio actual: https://gildemcraft.netlify.app/

## Método recomendado: GitHub Desktop

1. Clona `drzjhon-dot/gildem-market-craft` con GitHub Desktop.
2. Descomprime el ZIP de v1.1. Copia su **contenido** (no la carpeta contenedora) encima de la carpeta clonada, conservando `.git`.
3. Comprueba que `src/main.js`, `src/batch-calculator.js`, `styles.css`, `index.html` y `tests/batch-calculator.test.mjs` estén en sus rutas correctas.
4. En GitHub Desktop revisa los cambios, crea el commit `v1.1: interfaz clásica y calculadora por lotes` y pulsa **Push origin**.
5. Si Netlify está conectado a `main`, espera el estado **Published** en Netlify; abre tu sitio y recarga con Ctrl+F5.

## Método por terminal

```bash
git clone https://github.com/drzjhon-dot/gildem-market-craft.git
# Copia el contenido del ZIP descomprimido a la carpeta gildem-market-craft, reemplazando archivos existentes.
cd gildem-market-craft
npm run build
git add .
git commit -m "v1.1: interfaz clásica y calculadora por lotes"
git push origin main
```

## Qué cambió

- `styles.css`: paleta clásica, selector compacto, tabla y paneles de calculadora.
- `src/main.js`: nueva interfaz, botones y flujo de transferencia de Top Mercado a Calculadora.
- `src/batch-calculator.js`: cálculos manuales de varios objetos sin tocar el generador automático.
- `index.html`: versión y tema visual.
- `tests/batch-calculator.test.mjs`: pruebas de Focus, materiales, cotizaciones y rentabilidad manual.
- `package.json`, `scripts/build.mjs`, `README.md`: versión 1.1 y documentación.

El ZIP conserva `netlify.toml`, `netlify/functions` y el motor del proyecto anterior. No subas este paquete al repositorio antiguo de Gildem Albion Lab.

## Verificación después de publicar

- Comprueba que Top Mercado muestre las 10 tarjetas de categoría, con una selección por defecto y los grupos cerrados.
- Abre Armas, marca/desmarca dos ramas y comprueba el contador.
- Busca un objeto en Calculadora, añade 1, comprueba precios y lista de materiales; verifica el aviso si alguna cotización no existe.
- Cambia crafts, tier, encantamiento, Focus y bono diario; prueba CSV.
- Abre el Generador automático y comprueba que sigue ofreciendo los mismos controles y límites.

**Nota:** La integración GitHub de este chat permitió lectura pero devolvió 403 en operaciones de escritura; por eso la subida del ZIP no está hecha por el asistente. Las pruebas automatizadas y el navegador usaron respuestas de mercado simuladas y no equivalen a validar cotizaciones AODP reales después del despliegue.
