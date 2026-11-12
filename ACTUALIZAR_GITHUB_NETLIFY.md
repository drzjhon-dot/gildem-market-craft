# Actualizar Gildem Market & Craft a v1.6.0

**Repositorio que debes actualizar:** https://github.com/drzjhon-dot/gildem-market-craft

**Sitio al que apunta Netlify:** https://gildemcraft.netlify.app/

Esta actualización **no toca** el repositorio antiguo de Gildem Albion Lab.

## Pasos

1. Descarga y descomprime `Gildem_Market_Craft_v1_6_0_GITHUB_NETLIFY.zip`.
2. Entra en el repositorio `gildem-market-craft`. Para mayor seguridad, haz una copia o crea una rama de respaldo con tu versión actual.
3. Actualiza la raíz del repositorio con **el contenido del ZIP**, no con una carpeta contenedora. Sube también `src/market-intelligence.js` y `tests/market-intelligence-v16.test.mjs`, además de los demás archivos reemplazados.
4. Haz commit en `main`. Netlify, si continúa conectado a esta rama, ejecutará `npm run build` y publicará `dist`.
5. Comprueba que ves **LABORATORIO / V1.6** en la barra lateral.
6. Prueba: selecciona **Mazas** → busca `T8_MAIN_MACE` → marca la variante → modo **Solo mis artículos** → consulta Mercado Negro → marca una fila → envía a Craft Planner. La cesta debe mostrar **Q1** y **total** por día. Al generar el plan, revisa el campo **cuota del periodo** y el diagnóstico de exclusiones.
7. Antes de invertir, verifica precios y profundidad reales de materiales/venta en el juego. Una fila del ranking no confirma una venta ejecutable.

## Problemas comunes

- **No veo los cambios:** revisa el log del despliegue de Netlify y que la rama publicada sea `main`; recarga la web después de que se publique.
- **Precios o datos vacíos:** AODP puede devolver 429, estar caído o no tener observaciones recientes. La herramienta no suplanta información faltante.
- **No aparece un T8 en el plan:** abre «¿Por qué algunos objetos no entraron?». Necesita actividad histórica **Q1**, receta, precio reciente, capital y riesgo compatible; una observación 1–5 no es prueba Q1.
- **Cambian las cantidades entre Top y Planner:** verifica la ventana UTC, la ciudad de venta y la columna Calidad 1/día. Los destinos no incluidos en Top requieren consulta aparte.

## Comprobar fuera de Netlify

Con Node 22+:

```bash
npm test
npm run build
```

Esta versión superó 53 pruebas automáticas y una prueba de navegación con datos simulados. La integración externa en producción debe comprobarse desde tu despliegue.
