# Gildem Albion Lab v9.9.0-top.1

Base: **el ZIP 9.9.0 proporcionado por el usuario**, restaurado sin los cambios de v9.9.1–v9.9.6 en los motores de crafting.

## Única mejora funcional: Top Mercado (versión 9.9.6)
- Calidades 1–5 de la API de historial AODP West, agregadas por objeto y mercado.
- Ventanas de días **UTC completos**, precios medios ponderados y datos únicos sin doble conteo.
- Catálogo ampliado de variantes por rama, incluidos ítems presentes en nombres aunque falte receta.
- Consulta por ciudad seleccionada, ventana explícita (`date`, `end_date`) en el proxy Netlify.
- Cobertura y avisos de consultas parciales o con errores.
- Se mantiene el botón «Agregar a Cal.» con el comportamiento de v9.9.0.

**Sin cambios** al motor de planes, demanda de crafting, límites de inversión, recetas, materiales, diarios, estilos o prioridades. La tabla Top Mercado utiliza un historial más completo; **no** se ha conectado al motor de crafting.

La opción NATS de v9.9.6 no se porta porque es una infraestructura opcional no activa y el usuario pidió preservar estrictamente el proyecto 9.9.0.

## Instalación
Descomprimir el ZIP y copiar **todo su contenido** al repositorio GitHub, incluidas `core/`, `tests/`, `scripts/` y `netlify/functions/`. Desplegar con `npm run build` (Netlify usa `dist/`).

Versión de caché distinta `9.9.0-top.1` para evitar mezclar archivos viejos y nuevos. El proyecto sigue siendo funcionalmente v9.9.0 salvo Top Mercado.
