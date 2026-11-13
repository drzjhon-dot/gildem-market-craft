# Gildem Craft Pro v9.10.0

## Revisión de recetas y retornos
- **Recetas de equipo:** comparadas una a una con el archivo del juego (ao-bin-dumps, 8.385 recetas). Las de albion-market coinciden en materiales, cantidades y artefactos sin retorno.
- **Recetas nuevas:** faltaban las del set de cuero dragón (capucha, chaqueta y botas, T4–T8, .0–.4). Se añaden en `core/recipe-supplement.js` con su ciudad de bono: Lymhurst para capucha y botas, Thetford para la chaqueta. Solo se usan si el catálogo principal no trae ese objeto.
- **Porcentajes de retorno:** ya eran correctos y no cambian.

  | Proceso | Sin bono | Con bono de ciudad | Con bono + Focus |
  |---|---|---|---|
  | Crafteo | 15,2 % | 24,8 % | 47,9 % |
  | Refinado | 15,2 % | 36,7 % | 53,9 % |

  El bono diario se suma a la producción.

## Correcciones
- **Calculadora de Craft, salida por craft:** las pociones y la comida (×5, ×10 por craft) contaban como 1 en el ingreso. Ahora se usa `amountCrafted` del juego.
- **Calculadora de Craft, «A comprar»:** compraba solo el neto del retorno, así que faltaba material para los últimos crafts. Ahora compra el neto + el retorno de un craft, sin pasar nunca del bruto. Es la misma regla que usa Gildem Market & Craft.
- **Focus sin escribirlo a mano:** antes Black Craft y Royal Craft pedían el coste de Focus por objeto. El refinado con Focus estaba bloqueado («requiere consumo específico de tu spec»).
  - Ahora el coste sale del juego: `core/game-focus.js`. En el equipo es el coste de T4.0 de cada familia × 1,75 por nivel de tier o encantamiento, comprobado en 6.020 variantes. En el refinado es el valor exacto de cada objeto.
  - Tu **eficiencia de Focus (FCE)** lo reduce: cada 10.000 FCE lo divide entre 2.
  - Nuevos campos «Focus disponible» y «Eficiencia FCE» en la configuración rápida de Black Craft y Royal Craft.
  - Un coste por objeto escrito en Ajustes sigue teniendo prioridad.
- **Oportunidades de refinado con Focus:** usan el 53,9 % de retorno y el coste de Focus del juego, y respetan tu Focus disponible.
- **Recetas especiales** (pociones, comida, monturas, recolección): guardan también su coste de Focus del juego.

## Motor 3.0 en Black Craft y Royal Craft
- **Cómo elige el plan:** cada plan se calcula con el motor 9.9 y con el **Motor 3.0** (`core/motor3.js`, reparto por beneficio marginal, el mismo de Gildem Market & Craft 3.0).
  - Se usa el Motor 3.0 cuando gana claramente: más de un 8 % de beneficio, o el mismo beneficio usando el capital que el 9.9 deja parado.
  - Si no, se mantiene el reparto del 9.9, que reparte el riesgo entre más objetos.
- **Error corregido:** en el simulador de pruebas, con 3M en Mercado Negro el motor 9.9 invertía solo 0,32M (beneficio 0,10M). Ahora el plan invierte 3,00M (beneficio 0,89M).
- **Resto de casos:** el plan no cambia. Ambos motores rinden lo mismo y el 9.9 está más diversificado.

## Pruebas
432 pruebas (`npm test`), incluidas las nuevas `tests/v9_10-fixes.test.mjs` y `tests/v9_10-motor3.test.mjs`.
