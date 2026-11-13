# Investigación de fuentes de mercado para Albion Online América (West)

Verificación documental: 11 de noviembre de 2026.

| Fuente | Acceso | Qué aporta | Estado en v1.7 |
|---|---|---|---|
| AODP REST History | https://west.albion-online-data.com/api-docs | Registro histórico de órdenes de venta por artículo, ciudad y calidad; ventanas UTC | **Implementado** para Top Mercado y evidencia del Planner |
| AODP REST Prices | mismo host y docs | Mínima oferta y máxima compra conocidas, con fecha y ciudad | **Implementado** para materiales y resultados del Planner/Calculadora |
| AODP REST Orderbook | `/api/v2/stats/orderbook/{id}` | Niveles de precios y profundidad agregados por precio, según docs | **Candidato prioritario** para validar cantidades comprables/vendibles; requiere comprobar estructura, marcas temporales, cobertura West y reglas de fallback antes de sumar al motor |
| AODP NATS West | https://west.albion-online-data.com/developer | Observaciones deduplicadas de órdenes e historial | **Candidato futuro**. Exige backend persistente, almacenamiento, deduplicación y monitoreo. Un sitio estático Netlify, con funciones breves, no mantiene por sí solo una suscripción continua |
| AODP exportaciones de bases de datos | docs de AODP Developer | Histórico por lotes para análisis y backtesting | **Candidato futuro**. Requiere descarga programada, procesamiento y control de versiones |
| Albion Free Market, AlbionOnline2D y otras herramientas | proveedores terceros | Comparación y validación humana | **Referencias externas**, no fuentes independientes verificadas; muchas reutilizan datos de AODP |
| `ao-bin-dumps` | https://github.com/ao-data/ao-bin-dumps | Metadatos estáticos, traducciones y recetas | **No aporta precios**; su uso como catálogo no debe mezclarse con historial del mercado |

## Orden recomendado para una próxima ampliación

1. Validar en West el formato y la cobertura real del endpoint Orderbook mediante muestras de artículos populares y raros. Introducir límites de compra/salida, deslizamiento por niveles de precio, precio efectivo para lotes y advertencia ante profundidad insuficiente. Nunca interpolar una cantidad ausente.
2. Registrar snapshots históricos con fecha e identificar cuándo cambian los niveles para reducir falsas oportunidades.
3. Si se justifica un backend persistente, considerar NATS West para observaciones recientes, deduplicación y estadísticas de fiabilidad; conservar AODP REST como comparación, no como fuente independiente.

## Cautela

El servidor de AODP aplica límites de solicitudes. «Forzar datos frescos» siempre marcado genera **nuevas peticiones cuando pulsas Consultar**. No asegura que un observador del juego haya actualizado los datos. Si aparece 429, desmarca la opción o espera a que se restablezca el servicio.
