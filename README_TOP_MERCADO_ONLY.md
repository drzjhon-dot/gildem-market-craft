# Base de Gildem Albion Lab 9.9.0, con Top Mercado 9.9.6 y calculadora integrada

El código base es el ZIP **Gildem_Albion_Lab_v9_9_0_COMPRAS_NETAS_PLANES(1).zip** del usuario.

- Black Craft: **motor 9.9.0 original**.
- Royal Craft: **motor 9.9.0 original**.
- Lógica de diarios, recetas, retorno, budgets, prioridades, demanda, compras netas, logística: **original 9.9.0**.
- Top Mercado: listado y cálculo de 9.9.6 (cinco calidades, días UTC completos, consulta más amplia de ramas, selección de mercados, cobertura y avisos parciales). Se conserva la opción «Agregar a Calculadora».
- No se incorpora ni se activa NATS. No se conecta el nuevo historial a los generadores de 9.9.0.

## Instalación en GitHub/Netlify

1. Descomprimir este ZIP.
2. Copiar **todo el contenido** a la raíz del mismo repositorio conectado a Netlify.
3. Confirmar los reemplazos, hacer `Commit` y `Push`.
4. Netlify ejecuta `npm run build` y publica `dist/`.
5. Recargar la app (si hay contenido viejo, usar la opción «Reparar carga» que limpia cachés antiguas).

La versión visible de caché es `9.9.0-top.2` únicamente para mantener coherente la publicación y evitar versiones mezcladas. No es un regreso a 9.9.6 del resto de la herramienta.

## Limitaciones

Top Mercado usa historial público AODP y no garantiza ventas; la comparación con fuentes EMV puede producir cifras distintas. El build automatizado no verifica transacciones reales del mercado West.

**Novedad top.2:** Resultado pasa directamente a Calculadora de Craft sin alterar el motor. Más información en `RELEASE_NOTES_9_9_0_TOP_2.md`.
