# Gildem Craft Pro v9.11.0

## El motor cumple tu configuración
Nueva etapa final en Black Craft, Royal Craft y las tres propuestas de plan (`core/enforce-config.js`). Se aplica después del motor y sigue cuatro reglas.

1. **Filtros sin excepciones.** Solo entran:
   - los tiers y encantamientos que marcaste;
   - los objetos de las ramas elegidas;
   - el destino correcto: Mercado Negro, o solo las ciudades Royal que marcaste;
   - la ciudad de fabricación elegida (en automático, la ciudad de bono de cada receta);
   - como mucho el número de ciudades de fabricación que pediste;
   - Focus solo si lo activaste.
2. **Límites estrictos.**
   - Cada ruta queda dentro de su capacidad según el estilo y los días de venta.
   - Cada objeto respeta el % máximo de capital.
   - El plan nunca supera el Focus disponible.
   - Ya no hay excepciones automáticas que inflen un objeto.
3. **Cobertura.** El plan incluye al menos un lote de cada combinación de tier y encantamiento marcada que tenga una ruta rentable. Si falta capital, se libera de las combinaciones con más inversión. Las combinaciones sin ruta posible se explican en el aviso del plan.
4. **Usar todo.** El capital sobrante se invierte por beneficio marginal, sin pérdidas y sin pasar los límites. Si sobra dinero, el aviso explica qué límite lo impide.

Las rutas añadidas o ampliadas vuelven a pasar por el control de compra de materiales.

Resultado en el simulador de pruebas (antes → después):
- **Mercado Negro, 10M:** de 8 a 17 combinaciones tier/encantamiento; beneficio de 2,91M a 2,98M.
- **Lymhurst, 30M:** de 13 a 19 combinaciones; beneficio de 7,33M a 7,84M.
- **Mercado Negro, 3M:** inversión de 0,32M a 3,00M.

## Ventas reales desde el AFM Data Client
En **Mi negocio**, nuevo panel **Importar ventas reales del AFM Data Client**. También hay un acceso directo desde Ajustes y datos.

Cómo se usa: en el AFM Data Client (AlbionDataAvalonia), ve a la pestaña **Trades**, pulsa **Export CSV** y elige ese archivo en el panel.

Qué hace con el CSV:
- **Lectura:** acepta coma o punto y coma, decimal con coma o con punto, fechas día/mes o mes/día y AM/PM.
- **Objetos:** convierte nombres como «Adept's Broadsword [4.1]» en su ID del juego (T4_MAIN_SWORD@1) con un mapa de nombres en inglés generado desde ao-bin-dumps.
- **Registro automático:** las ventas reales se anotan en las carteras marcadas como compradas (mismo objeto y mercado, después de la compra), con impuesto y tasa de publicación. Cada operación se importa una sola vez. El motor aprende de ellas con el ajuste personal ya existente.
- **Resumen por objeto y mercado:** unidades, precio medio, porcentaje de órdenes llenadas, órdenes caducadas sin venta y ritmo real por día.
- **Servidor:** solo se usan operaciones de Americas (West).

## Fuentes revisadas
- **JPCodeCraft/AlbionDataAvalonia y AFMDataClientCore:** son clientes de captura de paquetes en C#. Una web no puede leer el tráfico del juego, así que se aprovechó lo que sí sirve aquí:
  - el formato de su exportación de Trades;
  - la regla de nombres «Nombre [tier.encantamiento]».

  No se copió código (licencia propia: uso libre no comercial, redistribución solo en código abierto).
- **ozcankaya3535/Albion-Online-Market-Scanner-LiveFlipper:** el repositorio solo contiene un README promocional, sin código. No hay nada que integrar.

## Pruebas
442 pruebas (`npm test`), incluidas `tests/v9_11-enforce-config.test.mjs` y `tests/v9_11-afm-trades.test.mjs`.
