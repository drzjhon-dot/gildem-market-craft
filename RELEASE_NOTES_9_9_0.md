# Gildem Albion Lab v9.9.0 · Las listas de compras compran el consumo real

Construida sobre tu ZIP v9.8.5 (rediseño visual y botones de copiar intactos).

## El fallo que reportaste
En los planes de Black Craft y Royal Craft, «A comprar» mostraba el BRUTO de la receta. Por eso el bono de ciudad y el bono diario «no hacían nada» en la lista de compras: cambiaban el profit y el «sobran», pero nunca la cantidad a comprar. Reproducido con un plan de botas: 1.504 y 1.320 lingotes en las tres configuraciones de bono.

## Qué cambia
- **«A comprar» es ahora el consumo neto**: lo que de verdad gastas después de reutilizar los recursos que la estación devuelve mientras crafteas. El bono de ciudad, el bono diario y el Focus SÍ cambian la cantidad (más retorno, menos compra). El bruto queda como referencia al pasar el ratón.
- La etiqueta «sobran N» pasa a **«reutilizas N»**, los totales por material, el KPI «Materiales a comprar», los **techos de precio** («máx.») y el **texto copiable** de la lista usan la cantidad comprada.
- Las tablas de materiales de los planes Royal muestran «A comprar (neto)» primero y «Bruto de la receta» al lado.
- Los diarios no tienen retorno: se compran enteros, como antes.
- Matiz honesto: el retorno llega mientras crafteas; ten margen para las primeras fabricaciones.
- La «Primera compra respaldada» (compra por etapas) sigue siendo conservadora y no cambió.

## Además
- Versión unificada a 9.9.0 (tu ZIP mezclaba 9.8.4 y 9.8.5, lo que puede volver a provocar la pantalla «No se pudo iniciar» por caché mezclada).

## Pruebas
351 pruebas (3 nuevas en `tests/v9_9_0-net-purchases.test.mjs`) sobre TU versión, con el rediseño incluido; verificación en Chrome en curso con datos simulados.

## Instalación
Copia todos los archivos sobre tu repositorio, Commit to main → Push origin, espera `Published` en Netlify, Ctrl + Shift + R y comprueba `v9.9.0`.
