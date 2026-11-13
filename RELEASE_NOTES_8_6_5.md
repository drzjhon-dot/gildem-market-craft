# Gildem Craft Pro v8.6.5 · Cartera inteligente

## Qué cambia

- **Black Craft y Royal Craft** asignan capital a varios objetos rentables antes de ampliar grandes lotes; objetivo flexible de hasta 12 referencias y máximo 15 rutas en la cartera automática. Si hay menos oportunidades reales, usa solo las que corresponden.
- El límite de **12% del presupuesto invertible por ID** sigue activo incluso cuando eliges «Usar todo lo posible». Si hay varias ciudades Royal candidatas, el motor también limita la concentración por ciudad y, cuando procede, por tier.
- **Reserva opcional del 15% de silver**, activada por defecto en ambos formularios. Se calcula sobre el presupuesto total; «Uso cauteloso» mantiene un colchón adicional.
- **Descuento de inventario pendiente de venta por objeto y mercado**, procedente exclusivamente de lotes marcados como ejecutados en «Mi negocio» y de las ventas registradas allí. No es una lectura automática del inventario de tu personaje.
- **Compra de materiales por tramos de precio:** cuando AODP West dispone de órdenes observadas, estima el precio medio de la profundidad y el primer lote dentro de techos de gasto conservadores. El margen estimado del plan NO garantiza obtener todos esos precios.
- **Resultado accionable:** fabricación objetivo y primera compra orientativa aparecen separadas; botones para copiar la lista completa o solo el primer lote. Los 5 paneles secundarios que solicitaste continúan ocultos.
- **Edición responsable:** modificar cantidades no puede consumir la reserva ni superar el límite por artículo sin regenerar el plan. Después de editar se invalida la verificación previa del abastecimiento.

## Limitaciones importantes

- AODP West contiene observaciones comunitarias de órdenes y precios; la actividad histórica NO representa obligatoriamente ventas completadas. Los precios y las cantidades publicadas pueden cambiar o desaparecer.
- Si no hay libro de órdenes de materiales, el primer lote debe considerarse **no verificado**. El objetivo de fabricación es una propuesta que puede requerir compras por etapas; **no compres lotes enteros si falta profundidad**.
- La herramienta NO registra automáticamente tus órdenes pendientes dentro del juego: debes guardar una inversión, marcarla como iniciada en «Mi negocio» y registrar las ventas para que el nuevo plan descuente ese inventario.
- El objetivo de 8 a 15 objetos NO es una obligación matemática: solo se incluyen rutas con rentabilidad neta positiva y datos de precio suficientes.
- La reserva protege el capital, pero no sustituye verificar comisiones, tasas de estación, transporte, competencia ni precio real en el juego.

## Validación

- `npm run build`: verificación de fuentes, chequeo JavaScript y **265 pruebas automatizadas aprobadas** en la versión completa.
- Browser smoke interactivo no completado: Chromium está bloqueado por la configuración del entorno para rutas locales. Se validaron funciones de renderizado con tests automatizados.
- El despliegue Netlify y los mercados reales después de publicarse todavía deben verificarse.
