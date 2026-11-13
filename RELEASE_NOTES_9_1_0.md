# Gildem Craft Pro v9.1.0 · Objetivo de fama y fin de los lotes de 1

## Por qué salían lotes de 1 con demanda de 58 por semana
No era la demanda: era la comprobación de materiales. Después de calcular la cantidad correcta, el motor la recortaba así:
- material sin historial suficiente → máximo 1 fabricación;
- material un 20 % sobre su mediana → máximo 1 fabricación;
- compra limitada al 8 % de lo que el material movía en **un solo día**, aunque el lote se venda en 14.

## Qué cambia en el motor
- **La cantidad sale de la demanda.** Los materiales ya no recortan a 1. Solo queda un tope real: no comprar más del 10 % de lo que se movió de cada material durante toda la ventana de venta. Lo demás se marca como «compra por etapas» para verificar, sin tocar la cantidad.
- **Lote mínimo útil en el Mercado Negro.** Una ruta por orden entra con 3 a 5 unidades como mínimo (o las que muevan unas 400.000 de silver; una sola si el objeto vale eso). Si no llega, sale del plan y su capital pasa a las demás. En Royal y con libro de órdenes verificado sigue valiendo 1.
- **Saturación más suave en el Mercado Negro.** Como el lote ya se valora a la media pagada y lo vendido sale del juego, el impacto estimado de tus ventas es la mitad que en Royal. Es una estimación.

## Nuevo: Objetivo del plan
En Configuración del plan: **Más silver**, **Silver y fama** (por defecto) o **Más fama**.
- El motor prioriza y reparte capital según la fama de crafteo por silver invertido, además del profit.
- Nunca fabrica más de lo que el mercado absorbe ni acepta rutas con pérdida.
- Resultados muestra la fama por objeto, la fama total y el silver ganado por cada 1.000 de fama.
- La fama es una estimación: sale de los materiales refinados de la receta (por tier y encantamiento) con el bono Premium de Ajustes. Los artefactos pueden dar más de lo calculado.

## Pruebas
322 pruebas (7 nuevas en `tests/v9_1_0-fame-and-lots.test.mjs`), `npm run build` correcto y carga en Chrome sin errores. Con datos simulados: falta comprobarlo con un plan real de West.

## Instalación
Copia todos los archivos sobre tu repositorio, Commit to main → Push origin, espera `Published` en Netlify, Ctrl + Shift + R y comprueba `v9.1.0`.
