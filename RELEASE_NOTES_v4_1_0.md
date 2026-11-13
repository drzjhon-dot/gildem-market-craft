# Gildem Albion Lab 4.1.0 · las tres herramientas que faltaban

Diez herramientas, todas para West (AODP `west.albion-online-data.com` y datos del juego de ao-bin-dumps).

## Nuevas
### Flips Mercado Negro (pestaña nueva)
Compra en el mercado de Caerleon y vende al instante a la orden de compra del Mercado Negro. Están en la misma ciudad, así que no hay transporte.
- **Dos formas de comprar:**
  - al instante, a la orden de venta más barata;
  - con tu propia orden de compra, 1 silver por encima de la mejor. Es más barato, pero tarda y paga la tasa de 2,5 %.
- **Cuánto comprar:** las unidades se limitan al % de lo que el Mercado Negro compra al día (10 % por defecto), según su historial de 7 días.
- **Precios frescos:** solo usa precios de hace 6 h o menos (lo puedes cambiar). Los flips desaparecen rápido.
- **Ciudades Royal (opcional):** también puedes comprar ahí, con un % de transporte. La fila se marca en rojo porque llevarlo a Caerleon cruza zona roja.
- Botones «Actualizar precios» y «Registrar en Mi negocio».

### Isla (antes «Granja»), con tres vistas
1. **Cultivos y hierbas.** Igual que en la 4.0.
2. **Animales y monturas.** Calcula los 45 animales del juego con su cría, su comida y lo que puedes hacer con el adulto.
   - **Comida:** la más barata por punto de nutrición. El alimento favorito rinde el doble, y la nutrición total sale del juego.
   - **Crecimiento:** Premium hace que crezcan el doble de rápido.
   - **Cría con Focus:** probabilidad del juego + bono (estimación).
   - **Mejor salida, comparada automáticamente:**
     - vender el adulto;
     - carnicero (18 de carne);
     - ensillar la montura, descontando 20 de cuero, 30 tablas o metal y tela.
   - **Producción de adultos:** huevos o leche por día, ya descontada su comida.
   - **Resultados:** por animal, por parcela (9) y por día, y lo que necesitas para empezar.
3. **Cocina y alquimia.** Calcula 99 recetas de comida y pociones que usan productos de la isla.
   - **Coste:** con el retorno que elijas (15,2 / 24,8 / 43,5 / 47,9 %). Los ingredientes raros no tienen retorno.
   - **Beneficio por craft.**
   - **«Tu cosecha aquí»:** cuánto más (o menos) te pagan por tus cultivos, huevos, leche o carne al convertirlos en ese producto en lugar de venderlos crudos.

## Mejoras
- **Barra lateral:** ahora se desplaza y sus accesos son más compactos, para que quepan las 10 herramientas en pantallas bajas.
- **Datos del juego regenerables:** `scripts/generar-datos-juego.py` produce `assets/data/game-extra.json` con encantamiento, cultivos, animales, nutrición y cocina.

## Pruebas
166 pruebas (`npm test`), incluida `tests/v41-isla-flips.test.mjs`. También se revisaron en Chrome con datos de mercado simulados.
