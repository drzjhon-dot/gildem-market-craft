# Release v1.2.0 · Estilo Albion, ranking y calculadora

### Interfaz
- Ranking numérico, filas compactas, iconos y tier badges.
- Colores por ciudad en la selección de mercados, Top y calculadora.
- Unidades/día y precio/unidad redondeados al entero; métricas de volumen abreviadas.
- Copiar el nombre de un objeto con un clic; **Shift + clic** copia su ID.
- Marcar rutas con estrella y agregar artículos directamente a la calculadora.
- Materiales con ciudad coloreada, icono de uso, precio y total; diarios estimados en fichas.
- Vistas de escritorio y móvil con tablas desplazables dentro de cada panel.

### Robustez
- Cuando faltan cotizaciones de materiales, la calculadora conserva cada fila y permite introducir precio manual; no inventa ganancias ni suma materiales incompletos al capital verificable.
- Se conserva el generador automático v1.1, las rutas y funciones Netlify, y AODP REST West como fuente de precios/actividad.

### Pruebas
- 27 pruebas automatizadas aprobadas.
- Recorrido completo Top → copiar → agregar → cotización pendiente → valor manual → recalcular, y comprobación de ancho responsive, utilizando API simulada.
- No se certificó disponibilidad en tiempo real de AODP ni despliegue remoto en producción.
