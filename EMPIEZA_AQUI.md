**Versión actual: Gildem Albion Lab v9.9.0-top.4**. Suba el contenido COMPLETO del ZIP al repositorio de GitHub, incluyendo `core/`, `tests/`, `scripts/`, `netlify/` y `assets/`. Netlify ejecuta `npm run build`. Lea `COMPROBAR_PLANES_TOP_4.md` para validar las configuraciones y límites de las propuestas.

# Gildem Albion Lab · v9.9.0-top.3

Este ZIP contiene la prueba **AODP como única fuente de mercado**. No necesitas instalar nada extra en GitHub: reemplaza todos los archivos, haz Commit y Netlify ejecutará `npm run build`.

Mantiene las cinco pestañas y la transferencia de Black/Royal a Calculadora de Craft de v9.9.0-top.2. El ranking importado desde otras páginas ya no interviene en los cálculos. Las recetas se conservan desde metadatos del juego, porque la API AODP no suministra recetas completas.

**Verificaciones locales:** `npm run build`, tests de exclusividad AODP, caché y proxy West.

# Gildem Albion Lab · v9.9.0-top.2

**Base conservada:** v9.9.0 original en Black Craft y Royal Craft, con el Top Mercado mejorado de v9.9.6. Los 53 módulos `core/` originales de la base v9.9.0-top.1 siguen intactos.

### Navegación (cinco pestañas)

1. Calculadora de Craft
2. Black Craft
3. Royal Craft
4. Top Mercado
5. Ajustes y Datos

Al generar un plan en Black o Royal, la lista de artículos se transfiere automáticamente a Calculadora de Craft. Podrás editar cantidades, tier, encantamiento, Focus y bono diario, añadir/quitar artículos, copiar compras y exportar CSV con materiales y diarios. El presupuesto original aparece como referencia y se avisa si las ediciones lo exceden.

**Advertencia:** la calculadora actualiza precios y calcula los dos mercados independientemente. No traspasa destinos, órdenes publicadas, competencia ni gastos logísticos del plan original. No presupongas que su profit coincide con el plan de origen.

«Fuentes y evidencia de mercado» no se muestra en la interfaz.

**Publicación:** extrae este ZIP, copia TODOS los archivos en la raíz del repositorio GitHub, realiza Commit y Push. Netlify ejecutará `npm run build` y publicará `dist/`. Recarga con Ctrl+Shift+R si el navegador tiene caché antigua.

Lee `RELEASE_NOTES_9_9_0_TOP_2.md` para los cambios exactos.
