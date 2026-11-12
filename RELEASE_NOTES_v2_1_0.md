# v2.1.0 · Lectura diaria Q1: mejores datos para el plan

Mejora del análisis con los datos que la herramienta **ya descarga** de AODP West (History, escala diaria). Sin servidores ni fuentes nuevas.

## Qué cambia
Hasta ahora el motor usaba la **media** de la ventana. Esa media falla en dos casos muy comunes:
- **Volcado aislado:** un solo día con muchas unidades la infla, y el plan fabrica para una demanda que no se repite.
- **Caída reciente:** si los últimos días ya casi no se vende, la media de 7 días no lo refleja.

Ahora se conserva la **serie diaria de calidad 1** (unidades y precio por día) y se calcula, para cada artículo y ciudad:

| Señal | Qué hace en el plan |
|---|---|
| **Media sin el día pico** | Si un día concentra la actividad, se descarta ese día al dimensionar el lote. |
| **Últimos 3 días** | Si venden menos que la media, la demanda usada se acerca a ellos (punto medio). Un aumento reciente **no** amplía el lote. |
| **Precio Q1 reciente** | Si el precio de los últimos 3 días es menor que el de la ventana, el beneficio se calcula con el reciente. |
| **Diagnóstico** | *Estable*, *Irregular*, *Pico aislado* o *Actividad cayendo*. |

Regla de seguridad: estas señales **solo pueden reducir** la demanda o el precio observados, nunca aumentarlos.

## Dónde se ve
- **Top Mercado:** bajo «Calidad 1/día», mini-gráfica de los días de la ventana (los 3 últimos en dorado) y la etiqueta del diagnóstico.
- **Craft Planner:** en cada ruta, la demanda usada frente a la media, la media sin pico y los últimos 3 días, y un aviso si el precio Q1 reciente ha bajado.
- **Configuración del Planner:** opción «Lectura diaria Q1» (activada por defecto) para comparar con y sin ajuste.
- **Calculadora de Craft:** el impacto de venta usa la misma demanda ajustada.

## Ejemplo (datos de prueba)
Alabarda T5.2 en Mercado Negro: media 46 u./día, pero por un único día de volcado. Sin ese día la demanda es de 18 u./día y el plan usa 18. Antes habría dimensionado el lote para 46.

## Notas
- Las fichas que ya estaban en tu selección del Planner antes de actualizar no tienen serie: vuelve a consultar Top Mercado y reenvíalas para aprovechar el ajuste.
- Con ventanas de 1 o 3 días no se descarta el día pico; con menos de 7 días no se aplica el momento reciente.

## Verificación
115 pruebas (7 nuevas). La interfaz se probó en Chrome sin pantalla, con datos simulados: Top Mercado (65/65 filas con diagnóstico) → envío al Planner → plan con desglose de demanda.
