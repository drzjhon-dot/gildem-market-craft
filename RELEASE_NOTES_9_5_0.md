# Gildem Craft Pro v9.5.0 · Craft Cal. afinada

## Arreglado
- **«Faltan cotizaciones de algún material en AODP».** La calculadora descartaba cualquier cotización con más de 24 h y se rendía si faltaba una (los artefactos, como el de la Hoja Clarent, casi nunca tienen precio fresco). Ahora usa la última cotización vista aunque sea antigua, marcada como «antigua» con su edad, y una fresca siempre gana a una vieja. La fila SIEMPRE calcula.
- **Menos «s/d».** Si un precio no existe en AODP, el campo queda vacío y resaltado para que lo escribas tú; el profit aparece en cuanto lo completas. Nunca se inventa un número. Un aviso bajo los totales dice exactamente qué falta y qué edad tiene la cotización más vieja usada.

## Nuevo
- **Añadir objetos con desplegable organizado**, como el de Top mercado: categoría → rama → objeto (Armas → Espadas → Claymore…), con contador de objetos por rama. Sustituye al buscador.
- **Tier y encantamiento en cada fila.** Dos selectores (T4–T8 y .0–.4) junto a cada objeto, solo con las variantes que tienen receta. Al cambiar, se recalcula; si la variante ya estaba en la lista, se fusionan las cantidades.

## Pruebas
339 pruebas (las de la calculadora reescritas para el nuevo comportamiento) y verificación en Chrome con precios simulados: objeto con artefacto sin cotización fresca calcula con la antigua, el desplegable añade por rama y el cambio de tier recalcula. Falta contrastar con precios reales de West.

## Instalación
Copia todos los archivos sobre tu repositorio, Commit to main → Push origin, espera `Published` en Netlify, Ctrl + Shift + R y comprueba `v9.5.0`.
