import test from 'node:test';
import assert from 'node:assert/strict';
import {planAdvice} from '../src/plan-advisor.js';
test('v2.7 diagnóstico: plan vacío por demanda baja sugiere días y estilo',()=>{
 const a=planAdvice({rejected:{sinCupo:30,margenNegativo:4},candidates:0,config:{style:'prudent',saleDays:3,minRoiPct:10,maxQuoteHours:48,budget:5e6}});
 assert.equal(a.level,'empty');assert.match(a.tips[0].title,/30 rutas/);assert.match(a.tips[0].detail,/7 días/);assert.match(a.tips[0].detail,/más volumen/);
 assert.match(a.tips[1].detail,/5 %/);
});
test('v2.7 diagnóstico: plan correcto no muestra consejos; recorte por límites sí',()=>{
 assert.equal(planAdvice({rows:[{}],config:{budget:1e6},summary:{capitalReserved:9e5}}).level,'ok');
 const t=planAdvice({rows:[{}],config:{budget:1e6},summary:{capitalReserved:9e5},shareTrim:{crafts:5,by:{tier:30}}});
 assert.match(t.tips[0].title,/máx\. por tier 30 %/);
});
