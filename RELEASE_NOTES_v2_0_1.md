# v2.0.1 · Revisión del motor: demanda, lotes y compras

## 1. Compras: ahora alcanzan para fabricar todo el lote (error grave corregido)
- Antes, la Calculadora compraba solo el **neto** (bruto − retorno). Para 1 craft T8 con 16 barras y 24,8 % de retorno indicaba **13 barras**: no se podía fabricar ni una vez. En un plan de prueba de mazas para Mercado Negro faltaban recursos en 33 materiales.
- El retorno de un craft solo sirve para el siguiente; el del **último** craft ya no se reutiliza. Nueva regla, igual en Craft Planner y en la Calculadora:
  **A comprar = neto + retorno de un craft (el mayor del grupo), nunca más que el bruto.**
- Se puede fabricar en cualquier orden. El retorno real del juego varía; se usan valores esperados.
- «Reutilizas ≈» ahora muestra lo que de verdad vuelves a usar (bruto − compra).

## 2. Estilos coherentes con la demanda
- El estilo se aplicaba **dos veces** (fracción de demanda × segundo recorte en el motor). Prudente cubría solo ~1,4 % de la actividad Q1 y terminaba en lotes de 1 incluso con más de 100 ventas Q1/semana.
- Ahora se aplica una sola vez: **Prudente 6 %, Equilibrado 12 %, Dinámico 23 %** de la actividad Q1 del plazo (×1,35 con «volumen», máx. 30 %).
- El **impacto de precio** dependía del estilo (Prudente 0,45 / Dinámico 1,1). Por eso Prudente era el más optimista y Dinámico daba *menos* beneficio que Equilibrado. Ahora es una propiedad del mercado: 0,75 para todos.

## 3. Sin forzar lotes de 1 en destinos casi vacíos
- Con diversidad se forzaba siempre 1 craft aunque saturase el destino: hasta un 29 % de la actividad semanal (T8.1 con 3,5 ventas/semana).
- El mínimo de 1 solo se acepta si ese craft no supera **12 / 18 / 25 %** de la actividad Q1 del plazo (Prudente / Equilibrado / Dinámico). Si la supera, la ruta aparece descartada con el motivo y el porcentaje.

## 4. Calculadora: impacto con actividad Q1
- La Calculadora medía el impacto de venta con la actividad de **todas** las calidades. Ahora usa Q1, igual que el Planner.

## Simulación de control (mazas T4–T8 .0–.2, Mercado Negro, 10 M)
| Estilo | Antes: capital / beneficio / crafts | Ahora: capital / beneficio / crafts |
|---|---|---|
| Prudente | 6,80 M / 922 k / 25 (23 lotes de 1) | 1,87 M / 322 k / 39 |
| Equilibrado | 5,98 M / 737 k / 73 | 4,78 M / 661 k / 81 |
| Dinámico | 4,98 M / 475 k / 79 | 7,73 M / 806 k / 115 |

Ahora los estilos quedan en el orden esperado. Ningún destino supera ~16 % de su actividad Q1 semanal y las compras alcanzan en todos los casos.

## Verificación
108 pruebas (8 nuevas). Las 3 pruebas antiguas que comprobaban la doble reducción y la regla de compra anterior se actualizaron.
