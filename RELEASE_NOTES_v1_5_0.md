# Gildem Market & Craft · v1.5.0

## Nuevo

- Panel de configuración del Craft Planner compacto; presupuesto exclusivo 5M, 10M, 15M, 20M u otro.
- Objetivo Fama por silver permite rutas con pérdidas estimadas, limitado por porcentaje del presupuesto configurable de 0–30% (10% por defecto) y 25% por ruta. Las rutas de objetivos Silver/Equilibrado siguen exigiendo beneficio esperado.
- Mejor diversidad: tiers altos primero, luego encantamientos y artículos; reparto por rondas y respeto a actividad Q1, capital y Focus.
- Se registra la razón por la que un artículo se excluye. Un T8 con actividad Q1 y margen puede recibir al menos un craft si entra en el presupuesto; nunca se inventa demanda.
- No aparecen IDs técnicos debajo de los nombres (continúa el acceso al ID por Shift + clic).
- Plan por artículo y ciudad muestra Crafts sin columna “Salida”. Se elimina del Planner la lista de compras de materiales.
- Calculadora: diarios estimados dentro de la lista de compras, agrupados por tier y categoría de diario, sumando fracciones antes de redondear; coste opcional separado.
- Texto e iconos algo mayores, escenas de Top, Planner y Calculadora diferenciadas.

## Verificación

- `npm run build`: **45/45** tests.
- Chromium con scripts de la aplicación embebidos y fixtures AODP: flujo Top → Planner → Calculadora, presupuestos y modo Fama, agrupación de diarios; cero errores JavaScript y sin overflow horizontal en 390px.
- API AODP en producción, profundidad del libro y despliegue Netlify aún no confirmados en la nueva versión.
