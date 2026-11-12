# Actualizar Gildem Market & Craft a v1.9.0

1. Descomprime el ZIP y conserva una copia del repositorio anterior antes de reemplazar sus archivos.
2. En https://github.com/drzjhon-dot/gildem-market-craft reemplaza los archivos por los del paquete, incluidos `src/`, `netlify/functions/`, `assets/` y `scripts/`.
3. Elimina `src/flipping.js`, `assets/tabs/flips.svg` y `assets/tabs/refining.svg` si GitHub todavía conserva versiones antiguas.
4. Haz commit en `main`. Netlify debería desplegarlo si continúa conectado.
5. Abre https://gildemcraft.netlify.app/ y verifica las tres pestañas, las cinco ramas de Refinamiento y el botón **Ampliar cobertura**.
6. Si una versión antigua queda guardada en el teléfono, recarga la página; el Service Worker solo almacena recursos estáticos.

Se mantienen las restricciones de historial Q1, precios vigentes y presupuesto. No publiques un plan sin verificar cotizaciones en el juego.

## Comprobar las compras Royal

1. En **Craft Planner → Compras de materiales y diarios**, deja «Mejor coste entre ciudades Royal».
2. Establece una **tarifa realista de transporte por material/diario** antes de estimar el profit.
3. Puedes activar Caerleon como lugar de compra externo, pero verifica el riesgo de ruta roja.
4. Genera el plan, envíalo a **Calculadora de Craft** y consulta «Comprar en», destino de fabricación, transporte y coste total.
5. Los diarios son opcionales; si los compras o completas, revísalos por separado del beneficio del objeto fabricado.

**Nota:** las cifras de venta de Top Mercado no prueban que exista una orden de compra o venta ejecutable al precio indicado.
