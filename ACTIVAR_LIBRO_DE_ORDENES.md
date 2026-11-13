# Activar el libro de órdenes West (GitHub Actions)

El motor de Gildem puede usar las **órdenes reales** del mercado de West (cantidad, precio, calidad y tipo de cada orden), no solo el mejor precio y el historial. Las publica AODP en su canal público en tiempo real; un recolector en GitHub Actions las escucha cada 3 horas y deja un resumen que la web lee sola.

Coste: **gratis**, porque tu repositorio es público (GitHub Actions no cobra minutos en repositorios públicos con los servidores estándar).

## Pasos (una sola vez)

1. **Sube el proyecto a tu repositorio de GitHub** (incluidas las carpetas `.github/workflows` y `collector`). Si subes los archivos desde la web de GitHub, asegúrate de que se crea la carpeta oculta `.github/workflows/orderbook-west.yml`.
2. En GitHub, abre tu repositorio → pestaña **Actions**. Si te pide habilitar los workflows, pulsa **I understand my workflows, go ahead and enable them**.
3. Comprueba los permisos: **Settings → Actions → General → Workflow permissions** → marca **Read and write permissions** → **Save**. (El recolector necesita escribir en la rama `orderbook-data`.)
4. Primera ejecución manual: **Actions → «Libro de órdenes West» → Run workflow** (puedes dejar 25 minutos). Tarda unos 30 minutos.
5. Cuando termine en verde, verás una rama nueva **orderbook-data** con la carpeta `ob/`.
6. **Netlify:** vuelve a desplegar el sitio (Deploys → Trigger deploy, o haz cualquier commit). La compilación detecta tu repositorio y escribe `orderbook.config.json` con la dirección del resumen. En el Craft Planner aparecerá **«Libro de órdenes West · actualizado hace X h»**.

A partir de ahí se ejecuta solo cada 3 horas (minuto 23, hora UTC).

### Si Netlify no detecta el repositorio
Crea en la raíz del proyecto un archivo `orderbook.config.json` con tu usuario y repositorio:
```json
{ "repo": "TU_USUARIO/TU_REPOSITORIO" }
```
y vuelve a desplegar.

## Qué mejora en el motor

| Dónde | Antes | Con el libro |
|---|---|---|
| Venta al Mercado Negro | precio de la mejor puja + impacto estimado | se recorren las **pujas reales** (las primeras unidades a su precio real) y solo el resto usa la estimación |
| Lote en Mercado Negro | % de la actividad Q1 | si hay **pujas rentables** de sobra ahora mismo, el lote puede crecer hasta el 80 % de esas unidades |
| Ciudades Royal | % de la actividad Q1 | se descuenta la **competencia** ya publicada a tu precio o menos; si la cubre toda, la ruta se descarta |
| Compra de materiales | sobrecoste estimado por días de mercado | **coste exacto** recorriendo las ofertas reales; solo lo que falte se estima |
| Ventas reales | — | cuando una orden reaparece con menos cantidad, se cuenta como **venta segura** (p. ej. «ventas vistas 9 u. en 3 días») |

Donde no haya órdenes vistas (o tengan más de 24 h), el motor sigue con la estimación de siempre.

## Límites honestos
- Solo existen las órdenes que algún jugador con el cliente de datos (AODP o AFM) ha **mirado**. Los artículos populares estarán bien cubiertos; los raros, a veces vacíos. Ayuda que tengas tu cliente de datos abierto mientras miras el Mercado Negro.
- El canal no reenvía órdenes antiguas: cada ejecución añade lo visto en sus ~25 minutos al estado acumulado (las órdenes no vistas en 72 h o caducadas se eliminan).
- GitHub pausa los workflows programados de repositorios públicos sin actividad durante 60 días. Si pasa, entra en Actions y vuelve a activarlo.
- Las credenciales del canal son las **públicas** que publica AODP en su página para desarrolladores; no hace falta ninguna clave tuya.

## Archivos
- `.github/workflows/orderbook-west.yml` — programación y publicación.
- `collector/collect.mjs` — escucha AODP West y genera el resumen.
- `collector/orderbook-core.mjs` (+ pruebas) — normaliza, fusiona, mide ventas y resume.
- `src/orderbook.js` — lectura del resumen en la web.
