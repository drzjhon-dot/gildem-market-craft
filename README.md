# Gildem Albion Lab · Market & Craft v1.5.0

Aplicación independiente para **Albion Online, América (West)**, diseñada para GitHub + Netlify. Funciona como tres pestañas conectadas y conserva la lógica de mercado/crafting de v1.3.

## Flujo principal

1. **Top Mercado:** elige hasta 6 ramas, mercado, ventana de 1/3/7/14 días y orden de clasificación. Consulta AODP History (calidades 1–5), marca filas con ☆, usa «Marcar primeros 50» y «Borrar marcas». Puedes enviar lo marcado a **Craft Planner** o directamente a **Calculadora de Craft**.
2. **Craft Planner:** conserva su propia cesta de objetos, independiente del ranking. Permite quitar artículos, configurar destinos de venta, ciudad de bono, tiers, encantamientos, bono diario, Focus verificado, presupuesto rápido (5M, 10M, 15M, 20M u otro), horizonte, objetivo, variedad de tiers y encantamientos, volumen, impuestos, riesgo, costes de transporte y antigüedad máxima de cotizaciones. **Solo genera planes entre los artículos que enviaste.** Consulta nuevamente el historial de calidad 1 de las ciudades de venta elegidas y precios Q1 para comprobar oportunidades. Presenta inversión, beneficio estimado o pérdida permitida en modo Fama, distribución por destino, tiers y encantamientos. El detalle de compras y diarios vive exclusivamente en la Calculadora. El botón «Enviar lote a Calculadora de Craft» transfiere las variantes y las **cantidades de fabricaciones**, sumando las rutas del mismo objeto.
3. **Calculadora de Craft:** permite editar cantidades, cambiar tiers/encantamientos cuando hay recetas, añadir/eliminar objetos, comparar precios observados BM/Royal, materiales y diarios **integrados y agrupados por tier** en una lista de compras, y exportar/copiar compras. Los diarios son estimaciones opcionales y su coste se presenta separado del profit de crafting. Recibir un plan **reemplaza expresamente el lote actual** para evitar doble conteo. La calculadora muestra un recordatorio de los destinos originales, pero **recalcula el profit BM/Royal por separado**; conserva el plan por ciudad en Craft Planner para la rentabilidad de esos destinos.

## Datos y límites

- **Fuente de precios y actividad:** Albion Online Data Project, región West, mediante funciones de Netlify. Los nombres/recetas se obtienen de los catálogos existentes de v1.3; las imágenes de objetos se solicitan al renderizador oficial de Albion.
- Top Mercado suma calidades 1–5 y días UTC completos. Craft Planner usa **solo actividad de calidad 1** al dimensionar lotes; History no es un libro de órdenes ejecutables ni confirma ventas.
- Exige receta y cotizaciones de materiales y ventas utilizables; no trata datos faltantes como silver cero. El presupuesto es máximo. **Silver/Equilibrado** rechazan pérdidas netas esperadas; **Fama por silver** permite perder hasta el porcentaje configurado del presupuesto (por defecto 10%, máximo 30%), sin exceder un 25% de pérdida por ruta, y avisa expresamente. La fama inferida de materiales es una estimación, no fama verificada.
- El resultado incluye supuestos configurables de margen, impacto, compra, venta, gastos y límites de concentración. AODP Prices no prueba profundidad real del libro. **Contrasta manualmente el precio y la cantidad de cada orden antes de invertir.**
- La cesta del Planner y sus configuraciones se conservan en el navegador local. La consulta del ranking, la cesta y el resultado no se comparten automáticamente entre dispositivos. Al actualizar la pestaña hay que volver a consultar precios para generar otro plan.
- Máximo recomendado por transferencia: 150 variantes; ninguna cantidad individual puede superar las 100.000 fabricaciones por lote de calculadora. Si se excede, se muestra un error, no se trunca silenciosamente.

## Deploy en Netlify

No requiere un backend de pago. El proxy AODP existente está en `netlify/functions`.

```bash
npm test
npm run build
```

`netlify.toml` configura el comando de build y la carpeta `dist` para publicar. En GitHub sube **todos los archivos y carpetas de la raíz** de este ZIP en tu repo independiente `drzjhon-dot/gildem-market-craft` (no en el repositorio original de Gildem Albion Lab). Una vez registrado el commit en `main`, Netlify publica automáticamente si sigue conectado a esa rama.

El `dist` incluido en el ZIP es el artefacto estático compilado para inspección o deploy manual. Si Netlify está conectado a GitHub, vuelve a generar ese `dist` durante la compilación.

## Verificación v1.5

- 45 pruebas automatizadas de cálculo, proxy, catálogo, presupuesto, riesgos y transferencias.
- Compilación para Netlify validada.
- Prueba de interfaz en Chromium con scripts y respuestas AODP **simulados localmente en memoria**: Top → marcas → Planner → presupuestos/objetivo → generación → envío de cantidades a Calculadora y diarios. Sin excepciones JavaScript; sin desbordamiento horizontal a 390 px. Los iconos remotos de ítems no se verificaron en esa simulación.
- La disponibilidad de AODP en producción y el resultado del deploy Netlify **no han sido verificados** en esta ejecución.

No es una calculadora de beneficios garantizados. Albion Online es marca de Sandbox Interactive; esta herramienta es un proyecto independiente de la comunidad.

## Cambios destacados v1.5

- Configuración visual compacta (paneles de varias columnas), con presupuesto por opciones exclusivas 5M/10M/15M/20M y cantidad personalizada.
- Los IDs técnicos ya no se muestran debajo de los nombres. Se pueden seguir copiando con Shift + clic sobre el icono de copiar.
- Modo **Fama por silver** amplía la diversidad de tiers y encantamientos, incluso con pérdidas estimadas acotadas. No fuerza compras sin Q1, receta o cotización.
- Diversidad activa por defecto al migrar desde v1.4; primero se reservan muestras en tiers altos y encantamientos viables, luego se distribuye el resto en rondas para evitar saturación. La concentración sigue sujeta a presupuesto y demanda, con excepción explícita de **un solo craft** de tier seleccionado si supera el límite individual de concentración.
- Diagnóstico por nombre de artículo para explicar exclusiones de datos/cotizaciones/riesgo, especialmente T8. Un promedio del Top de 18/semana de **calidades 1–5** no significa 18 compras Q1 ni profundidad garantizada; si hay 18/semana Q1 y margen/capital válidos, el motor puede reservar un craft T8.
- La tabla Plan por artículo y ciudad muestra **Crafts**, no “Salida”. El Planner ya no duplica la lista de compras.
- La Calculadora incorpora diarios opcionales en la misma lista de materiales, agrupados por tier y tipo, sin contarlos como coste obligatorio ni modificar el profit de crafting.
- Textos, iconos, tarjetas y escenas de fantasía del juego más visibles; nuevos fondos reutilizados de los recursos del proyecto original.

Los fondos incluidos provienen de los recursos gráficos aportados con la versión previa del proyecto. No se han alterado los datos de origen del mercado ni los proxys de Netlify.
