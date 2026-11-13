# Gildem Craft Pro v9.7.0 · Bono diario de producción

## Nuevo
- **Selector «Bono diario»** en Craft Cal., junto al interruptor de Focus: Sin bono, +10 % o +20 % (el bono de producción del día que anuncia el juego en cada ciudad). Afecta al retorno de todo el lote y se combina con el bono de ciudad, el checkbox «Fuera de ciudad de bono» y el Focus:
  - Con bono de ciudad: 24,8 % → 30,1 % (+10) → 34,6 % (+20).
  - Fuera de ciudad de bono: 15,3 % → 22,1 % (+10) → 27,5 % (+20).
  - El retorno activo se muestra en cada fila («retorno 34,6 % · día +20 %»).
- La elección queda guardada en el navegador, como el resto de la calculadora.

## Pruebas
341 pruebas (1 nueva con las tasas combinadas exactas) y verificación en Chrome: cambiar el selector recalcula las filas y la elección persiste.

## Instalación
Copia todos los archivos sobre tu repositorio, Commit to main → Push origin, espera `Published` en Netlify, Ctrl + Shift + R y comprueba `v9.7.0`.
