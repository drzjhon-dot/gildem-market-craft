# v2.5.0 · Más silver con los mismos datos, compras realistas y diario de planes

## 1. Diarios llenos como ganancia
- El plan consulta el precio del diario **vacío** (donde lo compras) y del **lleno** (mejor venta neta entre ciudades Royal: a orden de compra o publicando) y suma la diferencia a cada craft.
- Comprar los vacíos suma al capital; venderlos llenos reduce el coste neto.
- **Tope prudente:** los diarios nunca cuentan más del 25 % de la venta del objeto, para que el plan lo siga guiando la demanda del objeto.
- Opción «Contar diarios llenos como ganancia» en el Planner y «Diarios llenos» en la Calculadora. La Calculadora muestra en cada diario su precio lleno, dónde venderlo y lo que suma.

## 2. Focus donde más rinde
- El coste de Focus de cada objeto se toma del juego (`craftingfocus` en ao-bin-dumps) y se ajusta con tu **eficiencia de Focus (FCE)**: cada 10.000 puntos lo reducen a la mitad.
- El Focus es opcional por craft: el motor lo reparte entre los crafts que más silver ahorran por punto y fabrica el resto sin Focus. Ninguna ruta queda en pérdida tras el reparto.
- El plan indica «Focus en X/Y crafts». Al enviar a la Calculadora se conserva ese reparto; si activas Focus allí, la Calculadora lo reparte con la misma regla (ya no da error si no alcanza para todo).

## 3. Calidades superiores (experimental, desactivado por defecto)
- Consulta las pujas del Mercado Negro por calidad 1–5 y suma el extra esperado de las piezas que salgan con mejor calidad (cada pieza puede ir a la mejor puja de su calidad o inferior).
- Probabilidades editables (por defecto, aproximadas sin bono de calidad). El extra nunca supera el 15 % del precio.

## 4. Compras realistas
- Se consulta el historial de cada material en las ciudades de compra y se calcula cuántos **días de mercado** hacen falta para comprar lo que pide el plan.
- Más de 1 día: sobrecoste estimado del 5 % por día adicional (tope 25 %). El plan muestra el **beneficio ajustado**.
- Aviso de **precio inflado** (≥25 % sobre su media reciente) y **antigüedad** de cada cotización.
- En la lista de compras de la Calculadora: «comprable hoy», «N días de mercado · +X %», «precio +X % sobre su media», «cotización de hace N h».

## 5. Premium
- Casilla «Tengo Premium» en el Planner y la Calculadora: ajusta el impuesto de venta (4 % con Premium, 8 % sin él) y la fama.

## 6. Diario de planes
- Cada plan generado se guarda (en tu navegador, hasta 20).
- Desde el día siguiente (UTC) puedes pulsar «Comprobar con el mercado»: compara por ruta la actividad Q1/día real y el precio real con lo previsto, y da recomendaciones (estilo, días de venta, «Venta -%»).

## 7. Craft Planner más limpio
- A la vista solo lo esencial: presupuesto, objetivo, estilo, días de venta, tiers, encantamientos, Premium y diarios, y Focus.
- El resto en «Opciones avanzadas» (plegado): ciudad de fabricación, bono diario, compras Royal, diversidad, tendencia, lectura diaria Q1, volumen, costes, protección del beneficio, límites de capital, logística y calidades superiores.
- Resumen del plan con chips: diarios, Focus, calidades y compras grandes.

## Verificación
131 pruebas (11 nuevas). Recorrido completo en Chrome sin pantalla, con datos simulados: Top → Planner con Focus y calidades → plan → Calculadora → diario de planes con comprobación, en escritorio y teléfono.
