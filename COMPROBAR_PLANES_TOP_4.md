# Validación de Gildem Albion Lab v9.9.0-top.4

## Objetivo

Corregir la distribución de capital y la exploración de recetas para respetar tier, encantamiento, objeto, estilo, objetivo y presupuesto, conservando la fuente de mercado AODP West y el flujo hacia Calculadora de Craft.

## Qué cambia

- Presupuesto exacto: usar los accesos de 5M/10M/15M/20M o escribir una cantidad manual, en número entero de silver.
- Exploración equilibrada por combinación de tier y encantamiento dentro del catálogo disponible, sin prometer que todas las opciones sean rentables.
- Confirmación final de la rama, variantes, mercado, Focus, capital asignado y coste bruto del plan.
- Modos Más silver, Silver y fama y Más fama producen distintas prioridades cuando existen oportunidades viables.
- El plan paciente no revive alternativas descartadas por falta de viabilidad.
- Mejor lectura de actividad de las cinco calidades como *indicio* de rotación, no como venta garantizada.
- Tabla de Top Mercado con columnas alineadas en PC y vista adaptativa en pantalla estrecha.

## Escenario de verificación tras publicar en Netlify

1. En Top Mercado seleccionar Mazas, Mercado Negro, ventana de 7 días, pulsar «Forzar datos frescos». El listado puede estar incompleto si AODP West no proporciona muestras recientes.
2. En Black Craft escoger Mazas, T4/T6 (sin T5), encantamientos .0/.2 (sin .1), presupuesto manual 7.850.000, horizonte 7 días, Equilibrado + Silver y fama. Generar y verificar que **ninguna** fila tiene T5 ni .1, y que el capital comprometido no excede 7.850.000.
3. Repetir con Prudente y Agresivo. Comparar concentración de capital y tamaños de lotes; pueden coincidir si el mercado aporta pocas rutas o las restricciones ya son dominantes.
4. Repetir con Más silver y Más fama. Cuando existan suficientes rutas rentables y con liquidez, Más fama debe tender a explorar mayor variedad y rendimiento de fama. No se garantiza más fama absoluta si los precios o la demanda no lo permiten.
5. En Royal Craft repetir seleccionando únicamente T5/T7, encantamientos .0/.2 y ciudad de venta Royal. Verificar que ninguna ruta tiene destino Black Market.
6. Pulsar el envío a Calculadora de Craft; comprobar que mantiene los ID y cantidades de fabricación agrupadas y permite editar cantidades, recalcular materiales/diarios y exportar compras.
7. Probar una rama con poca actividad. No se deben inventar precios ni forzar el gasto del presupuesto remanente.

## Pruebas técnicas ejecutadas

- `npm run build`: preflight, verificación sintáctica, pruebas automáticas y generación de `dist/`.
- `node --test tests/v9_9_0-top_4-simulator.test.mjs`: pruebas de configuraciones exactas, exploración, 9 perfiles Black, varios presupuestos Royal, estrés y escasez, demanda por calidad y comparación de Más fama vs Más silver en datos sintéticos.
- Capturas visuales aisladas para Top Mercado a 1440 y 650 píxeles, verificando coordenadas de las siete columnas y ausencia de desplazamiento horizontal en móvil.

**Limitación:** las simulaciones usan datos inventados para comprobar las propiedades del algoritmo. No representan precios ni volumen actuales de AODP. No se ejecutó una compra, ni una orden de venta, ni se verificó que un plan concreto vaya a venderse. La prueba completa del sitio desplegado en Netlify requiere una revisión posterior en ese entorno.
