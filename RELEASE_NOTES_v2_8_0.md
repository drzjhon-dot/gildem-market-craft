# v2.8.0 · Refinado y productos de gran volumen

Origen: prueba real del usuario. Refinar tela T4 no daba ningún plan en Gildem, mientras otra app daba +3,05 M con 10 M (comprar en Fort Sterling, refinar en Lymhurst, vender T4.0/T4.1/T4.2 en Fort Sterling, Lymhurst y Thetford). Reproducido con esos mismos precios.

## Causas y correcciones
1. **Tope fijo de 250 crafts por ruta** (pensado para equipo). En refinado, 250 telas son ~100 K de silver, cuando la tela T4 mueve decenas de miles de unidades al día. **Eliminado.** La cantidad la decide la demanda Q1 de tu estilo.
2. **Límites de reparto imposibles vaciaban el plan.** Con solo 2 artículos, «máx. 40 % por objeto» no se puede cumplir (40 + 40 < 100). El recorte iba quitando crafts hasta dejar el plan casi vacío: 12.081 crafts, unos 8 M. Ahora, con N grupos, un límite nunca baja de 100/N + 5 %.
3. **El colchón de compra del 8 % descartaba rutas rentables de margen fino.** La protección por defecto se mantiene, porque en equipo los precios cambian mucho, pero ahora:
   - El motor distingue «solo falla por la protección del beneficio» (por ejemplo: «sin colchón dejaría 34 silver por craft, 9,2 %») de una ruta realmente sin margen.
   - El diagnóstico lo explica y ofrece un botón **«Aplicar perfil Refinado y recalcular»** (colchón 2 %, venta −1 %, ROI mínimo 3 %).
4. **Asignación por bloques:** las rutas de gran volumen avanzan en bloques de crafts en lugar de uno a uno. Miles de crafts en décimas de segundo.

## Resultado con los precios del usuario (10 M, T4 .0–.2)
| Configuración | Antes | Ahora |
|---|---|---|
| Por defecto | 2 rutas · 8,8 K invertidos | 2 rutas · 8,0 M invertidos · +1,99 M |
| Perfil Refinado + usar todo | 3 rutas · 236 K (tope 250) | 3 rutas · 10 M · +2,7–2,9 M |

La otra app estimaba +3,05 M sin colchón ni descuento de venta y sin tasa de estación.

## Verificación
155 pruebas, entre ellas el caso real como prueba permanente: retorno 36,7 %, más de 250 crafts por ruta, detección de «solo protección» con su botón, y plan completo con el perfil. Auditoría de 300 configuraciones: 0 incumplimientos. Flujo de refinado probado en Chrome (Top → Planner → plan de miles de crafts en 3 ciudades).
