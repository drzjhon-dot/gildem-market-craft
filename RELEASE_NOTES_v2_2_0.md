# v2.2.0 · Top Mercado: filtros y una interfaz más limpia

## Filtros en el ranking
Una barra encima de la tabla filtra al instante, sin volver a consultar AODP:
- **Tier** y **encantamiento** (chips; solo aparecen los que hay en tu consulta, incluidos T2–T3 de refinamiento).
- **Vendidos Q1/día mín.**: unidades de calidad 1 por día.
- **Silver/día mín.**: Cualquiera, 100 K, 500 K, 1 M, 5 M o 20 M.
- **Buscar** por nombre en español (sin importar tildes) o por ID.
- **Señal Q1**: todas, sin pico ni caída, solo estables o solo con aviso.
- **Ordenar** desde la misma barra.
- **Solo marcados** y **Quitar filtros (n)**.

Los filtros se guardan entre sesiones. «Marcar primeros» marca los primeros **filtrados**. Al enviar al Planner van **todas** tus marcas, aunque el filtro actual oculte alguna.

## Menos información en pantalla
- Tabla simple por defecto: ☆ · Objeto · Mercado · Vendidos Q1/día (mini-gráfica y señal) · Silver/día · Precio · + Calc.
- **Vista detallada** (opcional) recupera: posición, todas las calidades/día, días activos, media sin pico y últimos 3 días.
- La barra de marcados aparece fija abajo solo cuando hay marcas, con tres botones cortos (también por encima del menú del teléfono).
- Marcar una fila ya no recarga la página entera.
- El panel de consulta queda en dos pasos: **1 · ¿Qué quieres analizar?** y **2 · ¿Dónde y en qué periodo?**. «Objetos concretos» se pliega por ser opcional.
- Las explicaciones largas sobre la fuente de datos pasan a un único desplegable «ℹ Sobre los datos».
- Cabecera de cada pestaña más compacta.

## Verificación
121 pruebas (6 nuevas para filtros). Probado en Chrome sin pantalla, en escritorio (1440 px) y en teléfono (390 px), con datos simulados: filtros combinados, búsqueda manteniendo el foco, marcas y barra fija.
