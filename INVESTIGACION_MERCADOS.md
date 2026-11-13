# Investigación de mercados · América (West) · noviembre 2026

Qué se aprendió sobre cómo funcionan el Mercado Negro y los mercados Royal, de dónde sale cada dato y qué se implementó en v8.9.0.

## 1. Mercado Negro

| Hecho | Fuente | En la herramienta |
|---|---|---|
| Es un NPC de Caerleon que solo tiene órdenes de COMPRA. Lo que se le vende pasa al botín de mobs y cofres. | albiondatabase.com, albionbattlehub.com | Ya era así |
| Cada mob muerto puede generar una orden; cuando se acumulan sin atender, el NPC sube el precio; al venderle alguien, baja. El precio va «en sierra», no en tendencia. | albionsnipe.com (cita la wiki), massivelyop.com | **Nuevo:** el lote se valora a la mediana de 14 días cuando la puja actual es un pico |
| Vender a su orden de compra paga solo el impuesto (4 % Premium, 8 % sin Premium). Publicar una orden de venta y esperar suma 2,5 %. | albionsnipe.com, albioncodex.com | **Corregido:** la herramienta usaba 2,5 % de impuesto en el Mercado Negro |
| Cada calidad es un mercado aparte. Una orden acepta su calidad o una superior. El Mercado Negro paga ~1 % más por calidad alta, así que la calidad no se cobra. | albionsnipe.com, itemlevel.net | **Nuevo:** demanda atendible con calidades 1-3 |
| La estructura es lenta: lo que paga bien en 7 días sigue pagando en 30 nueve de cada diez veces (medido en Europa). | albionsnipe.com | Respalda usar medias de 14 días |
| No acepta comida ni pociones; solo equipo. | albioncodex.com | Ya se filtraba |

## 2. Mercados Royal

| Hecho | Fuente | En la herramienta |
|---|---|---|
| Comprar de una orden de venta: sin comisión. Crear orden de compra: 2,5 %. Vender a orden de compra: impuesto. Crear orden de venta: 2,5 % + impuesto (6,5 % Premium, 10,5 % sin Premium). | albionsnipe.com, albiononlinegrind.com, albionfreemarket.com | **Corregido:** ambos mercados leen el impuesto de Ajustes (tipo de cuenta) |
| La tarifa de 2,5 % se cobra al publicar o editar y no se devuelve al cancelar. Las órdenes pueden estar hasta 30 días. | albionsnipe.com, albiononlinegrind.com | Sugerencia pendiente (coste de re-publicar) |
| El historial del juego muestra precio y volumen vendido a 24 h, 7 días y 4 semanas por mercado; AODP publica ese historial. | albionsnipe.com, albionfreemarket.com | Es la fuente de demanda de la herramienta |

## 3. Herramientas de «qué necesita el mercado»

| Herramienta | West | Qué da | ¿Integrable? |
|---|---|---|---|
| Albion Online Data Project (west.albion-online-data.com) | Sí | Precios, historial diario con volumen, por ciudad y calidad. 180 consultas/min. | **Sí, es la fuente numérica** |
| Albion Free Market · Top Traded | Sí (selector Americas) | Top 100 por silver/día o unidades/día, por mercado (incluye Mercado Negro). Lee el mismo historial de AODP. | No: requiere inicio de sesión con Google y no tiene API pública. Sirve para contrastar a mano. |
| AlbionSnipe · Top Traded / Craft Planner | No demostrado (sus capturas son de Europa) | Medias de 7 y 30 días | No se integra: sin servidor West confirmado |
| Albion Online Hub, Royal Forge, AO MCT, Albion Online Tools | Ya estaban como referencias | Contraste visual | Sin API documentada |

Conclusión: ninguna web externa ofrece una API pública de demanda para West mejor que AODP. La mejora real es **leer mejor AODP** (calidades, mediana, presión), que es lo implementado.

## 4. Lo que NO se pudo comprobar

- No se pudo consultar la API de West desde el entorno de desarrollo (red bloqueada). El formato del historial por calidad se tomó de la documentación de AODP; si West no devuelve calidades 2-3, la herramienta sigue funcionando solo con calidad Normal.
- Los porcentajes de calidad al craftear (68,9 / 25 / 5 / 1 / 0,1 %) son los valores base conocidos del juego; no aparecieron en las fuentes consultadas.
- Las mediciones de AlbionSnipe son del servidor Europa.

## Fuentes

- https://albionsnipe.com/guides/black-market-flipping
- https://www.albioncodex.com/guides/albion-online-black-market-flipping
- https://www.albiondatabase.com/guides/black-market
- https://albionbattlehub.com/en/guides/black-market
- https://albiononlinegrind.com/guides/market-flipping-guide
- https://albionfreemarket.com/topitems · https://albionfreemarket.com/faq
- https://www.albion-online-data.com/api-site/api.html
- https://itemlevel.net/albion-online-black-market-guide/
- https://massivelyop.com/?p=105879

## 5. Documentación oficial de la API (añadido v9.3.0)

Revisión de los api-docs y la página de desarrolladores de AODP que nos pasaste:

| Recurso | Qué da | En la herramienta |
|---|---|---|
| `/api/v2/stats/history` con `time-scale=1` | Historial POR HORAS (unidades y precio medio por hora) | **Nuevo:** panel «Mejores horas para vender» en Resultados |
| `/api/v2/stats/festivities` | Calendario de eventos confirmado por la comunidad (tiempos en ticks de C#; 404 = sin eventos) | **Nuevo:** aviso de evento en el resumen del plan |
| `items.json` / `world.json` de ao-bin-dumps | IDs y metadatos oficiales | Ya se usaba: las recetas especiales salen de ao-bin-dumps |
| IDs de localización (Black Market=3003, Thetford=7…) | Alternativa a los nombres en `locations` | No hace falta: los nombres funcionan |
| Volcados diarios (`albion-online-data.com/database/`) | Base de datos completa por día | Anotado para una futura calibración masiva |
| NATS (`nats.albion-online-data.com:4222`) | Flujo en vivo de órdenes e historiales | Fuera de alcance para una web estática |

El proxy de Netlify ahora acepta `time-scale` 1, 6 y 24 (antes forzaba 24).
