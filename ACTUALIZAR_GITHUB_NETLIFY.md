# Publicación de Gildem Market & Craft v2.7.0

## Método seguro: reemplazo integral del repositorio nuevo

1. Haz una copia o rama de respaldo de `https://github.com/drzjhon-dot/gildem-market-craft`.
2. Descarga y descomprime el ZIP **v2.7.0**.
3. **Elimina del repositorio los archivos que ya no estén en el ZIP**, especialmente restos de pestañas abandonadas y pruebas obsoletas. Subir una carpeta por encima de otra NO borra archivos viejos. En la actualización anterior eso causó un deploy fallido por un test que esperaba cinco pestañas.
4. Sube el contenido de la carpeta extraída a la **raíz** de `main`: `index.html`, `src/`, `tests/`, `scripts/`, `netlify/`, `assets/`, `netlify.toml`, etc. No metas una carpeta `Gildem_Market_Craft_v2_0_0` dentro del repositorio.
5. Confirma los cambios y revisa que Netlify lance `npm run build`. El resultado esperado es `100 pass`, `0 fail` y `dist/ lista para Netlify`.
6. Abre la web con recarga completa (Ctrl/Cmd+Shift+R) si el navegador conserva archivos antiguos del Service Worker.

Con Git CLI, una forma segura es descomprimir la entrega **fuera del repositorio**, hacer commit/back-up y luego copiar o sincronizar con borrado de archivos obsoletos; comprueba el diff con `git status` antes del commit.

## Prueba local

```bash
npm test
npm run build
```

Para probar AODP con Netlify functions usa Netlify Dev. `npm run dev` sirve HTML/JS local, pero **no ejecuta** las funciones `netlify/functions/`.

## Controles nuevos

En Craft Planner, activa **Tendencia de mercado** para contrastar la ventana reciente con 14 días. Bajo **Distribución máxima del capital** puedes limitar concentración por tier, familia y encantamiento. Los tres repartos comparados se muestran encima de la tabla de resultados. Si falta Q1, receta o precio, la ruta queda diagnosticada y no se rellena con datos imaginarios.

## Importante

Este paquete sustituye la lógica del plan, no la receta o los precios reales de Albion. Se usan datos observados de terceros y coberturas parciales. Antes de comprar, revisa profundidad de órdenes, coste de estaciones, transportes y caducidad de cotizaciones.
