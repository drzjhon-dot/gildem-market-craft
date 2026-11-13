# Gildem Craft Pro v9.3.0 · Horas de venta, eventos y ramas organizadas

Basada en la documentación oficial de la API de AODP (ver sección 5 de `INVESTIGACION_MERCADOS.md`).

## Nuevo
- **Mejores horas para vender (Resultados).** Al crear un plan, la herramienta consulta el historial POR HORAS (`time-scale=1`) de los objetos del plan y muestra, por mercado de venta, las 3 mejores horas en hora local: en el Mercado Negro, cuándo pagó por encima de su media; en Royal, cuándo hay más compradores. Se carga en segundo plano y no retrasa ni cambia el plan.
- **Aviso de eventos del juego.** Consulta el calendario comunitario (`/stats/festivities`): si hay un evento en curso o próximo, el resumen del plan lo avisa (la demanda puede moverse más de lo normal). Sin eventos o sin datos, no muestra nada.
- **Ramas del Top mercado en desplegable organizado.** Categorías con contador (Armas 0/17, Armaduras 0/9…), «Seleccionar todo» y «Borrar» por categoría, y selección múltiple de hasta 6 ramas por consulta.

## Técnica
- El proxy de Netlify acepta ahora `time-scale` 1, 6 y 24 (antes forzaba 24).
- El ritmo de consultas (una cada 1,2 s) queda muy por debajo de los límites publicados de AODP.

## Pruebas
330 pruebas (4 nuevas en `tests/v9_3_0-sell-hours.test.mjs`), compilación correcta y el desplegable verificado en Chrome con datos simulados (selección múltiple, tope de 6 y consulta combinada). El formato exacto de `festivities` no se pudo ver en vivo: si cambia, el aviso simplemente no aparece.

## Instalación
Copia todos los archivos sobre tu repositorio, Commit to main → Push origin, espera `Published` en Netlify, Ctrl + Shift + R y comprueba `v9.3.0`.
