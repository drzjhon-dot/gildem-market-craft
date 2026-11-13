# Gildem Craft Pro v9.8.0 · Comprar lo que de verdad consumes

## Arreglado (lo que señalaste)
«A comprar» en Craft Cal. mostraba el bruto de la receta, así que el bono de ciudad, el diario o el Focus no cambiaban la cantidad. Ahora:
- **«A comprar» descuenta el retorno**: los recursos que la estación devuelve se reutilizan al craftear, así que se compra el consumo neto. Con 20 fabricaciones de unas botas: 181 lingotes con bono de ciudad, 157 con día +20 %, 174 fuera de bono (el bruto sigue siendo 240).
- Cada material muestra «reutilizas N» (antes «sobran N») y el total de la fila usa la cantidad comprada.
- El KPI «Capital de compra» usa el neto y muestra entre paréntesis cuánto sería sin reutilizar retornos.
- Matiz honesto en el pie: el retorno llega MIENTRAS crafteas, así que conviene tener algo de margen para las primeras fabricaciones.

## Sobre el Data Client que enviaste (AlbionDataAvalonia)
Es el cliente de datos de Albion Free Market: se deja corriendo mientras juegas y sube a AODP los precios de los mercados que visitas. **Sí ayuda a la herramienta**, porque AODP es nuestra fuente: con el cliente activo, los precios de West que tú mismo ves quedan actualizados al instante para tus propios planes (menos «antigua» y menos «s/d»). No es código que se integre en la web: instálalo en tu PC (Windows: `AFMDataClientSetup` del repositorio de JPCodeCraft) y recuerda la regla de **un solo cliente de datos** (si usas este, desinstala el cliente oficial de AODP para no subir duplicado).

## Pruebas
342 pruebas (1 nueva que fija las cantidades netas con cada bono) y verificación en Chrome: cambiar bono diario o «fuera de bono» mueve «A comprar» en vivo.

## Instalación
Copia todos los archivos sobre tu repositorio, Commit to main → Push origin, espera `Published` en Netlify, Ctrl + Shift + R y comprueba `v9.8.0`.
