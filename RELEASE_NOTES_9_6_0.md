# Gildem Craft Pro v9.6.0 · Craftear fuera de la ciudad de bono

## Nuevo
- **«Fuera de ciudad de bono»** en Craft Cal.: cada objeto tiene un checkbox bajo «Fabricar en». Marcado, el cálculo quita el 15 % de especialidad: el retorno pasa de 24,8 % a 15,3 % (con Focus, de 47,9 % a 43,5 %), y el coste, los materiales y los dos profits se recalculan al momento. La elección se guarda por objeto, y al cambiar de tier o encantamiento se conserva.

## Arreglado
- El desplegable «Añadir objeto» se queda abierto encima de los resultados y bloqueaba los clics: ahora se cierra al añadir un objeto y al hacer clic fuera (también el de ramas del Top mercado).

## Pruebas
340 pruebas (1 nueva con las tasas de retorno exactas) y verificación en Chrome: marcar el checkbox sube el coste (78,8K → 88,8K en el caso de prueba), muestra «retorno 15,3 % · sin bono» y la elección queda guardada.

## Instalación
Copia todos los archivos sobre tu repositorio, Commit to main → Push origin, espera `Published` en Netlify, Ctrl + Shift + R y comprueba `v9.6.0`.
