# ⚒ Gildem's Craft

Planificador de crafteo y refinamiento para **Albion Online** (servidor América por defecto).
Consulta precios en vivo de [Albion Online Data](https://www.albion-online-data.com/) y genera un plan:
qué craftear, dónde, cuántas unidades sin saturar el mercado, lista de compras por ciudad y diarios.

## Estructura
| Ruta | Qué es |
|---|---|
| `index.html` | La app completa (HTML + JS + recetas). Es lo que publica Netlify. |
| `netlify.toml` | Puente `/proxy/...` hacia la API de Albion Online Data. |
| `herramientas/build_data.py` | Regenera las recetas desde [ao-bin-dumps](https://github.com/ao-data/ao-bin-dumps). |
| `herramientas/app.template.html` | Código fuente de la app (sin datos). |
| `local/` | Para usarla sin internet propio de hosting: `Iniciar_Gildems_Craft.bat` abre un puente local en Windows. |

## Publicar en Netlify
1. En Netlify: **Add new site → Import an existing project → GitHub** y elige este repositorio.
2. Deja vacío el *Build command* y pon `.` como *Publish directory* (ya viene en `netlify.toml`).
3. **Deploy**. Cada cambio que se suba a GitHub se publica solo.

## Actualizar recetas tras un parche del juego
```bash
mkdir datos && cd datos
curl -LO https://raw.githubusercontent.com/ao-data/ao-bin-dumps/master/items.json
curl -L -o formatted_items.json https://raw.githubusercontent.com/ao-data/ao-bin-dumps/master/formatted/items.json
curl -LO https://raw.githubusercontent.com/ao-data/ao-bin-dumps/master/craftingmodifiers.json
cd ..
python3 herramientas/build_data.py datos herramientas/data.js
python3 -c "t=open('herramientas/app.template.html').read(); open('index.html','w').write(t.replace('/*DATA*/', open('herramientas/data.js').read()))"
```
