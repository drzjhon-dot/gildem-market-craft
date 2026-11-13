# Gildem Albion Lab · Unificado 1.0

Una **sola aplicación** para Albion Online América (West), preparada para GitHub + Netlify. Parte del motor **Gildem Craft Pro v9.11.0** e integra nativamente la planificación de **Gildem Market & Craft v3.1.0**. No se despliegan dos sitios ni se usa `iframe`.

## Pestañas

1. **Calculadora de Craft:** lotes, recetas, compras por ciudad, materiales, diarios y precios propios.
2. **Black Craft:** motor avanzado 9.11 con diversificación y controles de presupuesto; un selector dentro de la misma pestaña activa el **motor rápido 3.1**, con límites por ventas diarias, introducción opcional de tablas y precio máximo para los materiales.
3. **Royal Craft:** planes por ramas, tiers, encantamientos, ciudades de venta y Focus, con parámetros estrictos heredados de 9.11.
4. **Refinamiento:** motor v3.1 de tela, cuero, tablas y lingotes con compras por ciudad, cadena de tiers, transmutación opcional, Focus, peso de la montura, horizonte y divisiones de venta.
5. **Top Mercado:** actividad observada con filtros, tiers, encantamientos y envío a Calculadora.
6. **Ajustes y Datos:** configuración principal y diagnóstico.

Los dos motores Black Craft están disponibles mediante **un selector dentro de la misma pestaña**. Guardan sus datos independientemente para no sobreescribir los planes.

## Instalación y despliegue

1. Vacía el repositorio GitHub conectado a Netlify y sube **el contenido completo de este ZIP**, no la carpeta que contiene el ZIP.
2. Configuración Netlify: `npm run build`, carpeta publicada `dist`, funciones `netlify/functions`, Node.js **22**. Está preconfigurado en `netlify.toml`.
3. No subas la carpeta `dist` ni `node_modules`; el build las genera.
4. Usa `npm install` (o `npm ci` si regeneras un lockfile) y `npm run build` para compilar y probar.

El motor de refinamiento y el BM alternativo usan `/api/market`, que Netlify redirige a la misma función AODP West del proyecto principal. Las páginas del motor 3.1 son **módulos integrados** dentro de `app.js`, sin segunda navegación, ni otro index, ni otro servidor de mercado.

## Validación

- `npm test` ejecuta los tests originales de Craft Pro y pruebas de BM / refinamiento del motor 3.1.
- `npm run build` ejecuta preflight, revisión sintáctica, tests y genera `dist/`.
- No se validan precios ejecutables ni disponibilidad de órdenes en vivo en pruebas sin conexión. Las cotizaciones de AODP son observaciones comunitarias; el volumen histórico no garantiza ejecución.

## Notas

- **Refinamiento v3.1** soporta cuatro recursos de referencia (sin bloques de piedra en el motor profundo). El escáner Royal Craft original conserva sus ramas de recursos.
- Solo servidor **América/West**.
- La pestaña Black Craft 3.1 permite pegar manualmente una tabla de demanda como entrada del usuario; **no consulta proveedores externos**.
- El coste real de transporte, saturación de órdenes y tiempo de venta siguen siendo riesgos que debes contrastar en Albion.
- El proyecto guarda preferencias en el navegador. Al actualizar desde una versión anterior se mantienen las preferencias existentes de Craft Pro y los módulos nuevos crean su propia clave.
