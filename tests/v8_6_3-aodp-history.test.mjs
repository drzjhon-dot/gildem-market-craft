import test from 'node:test';
import assert from 'node:assert/strict';
import {demandHistoryIndex,discoverDemand,chosenDemandIds} from '../core/demand-first.js';
const now=Date.parse('2026-11-10T14:00:00Z');
const timestamp='2026-11-09T00:00:00Z';
const row={item_id:'T5_SHOES_PLATE_SET2',location:'Black Market',quality:1,data:[{timestamp,item_count:3696,avg_price:7300}]};
test('AODP: duplicados de historial no multiplican artificialmente la actividad',()=>{
 const series=demandHistoryIndex([row,{...row}]);
 assert.equal(series.get('T5_SHOES_PLATE_SET2|Black Market').length,1);
 const x=discoverDemand(['T5_SHOES_PLATE_SET2'],series,['Black Market'],now).leaders[0];
 assert.equal(x.activity.count,3696);
 assert(Math.abs(x.daily-3696/14)<.0001);
});
test('AODP: no mezclar ciudades ni inventar observaciones faltantes',()=>{
 const series=demandHistoryIndex([row,{...row,location:'Martlock'}]);
 const markets=discoverDemand(['T5_SHOES_PLATE_SET2','T4_SHOES_PLATE_SET1'],series,['Black Market','Martlock'],now).byMarket;
 assert.equal(markets.get('T5_SHOES_PLATE_SET2|Martlock').activity.count,3696);
 assert.equal(markets.get('T4_SHOES_PLATE_SET1|Black Market').daily,null);
});
test('escaneo de recetas mantiene los tiers bajos antes que .4 cuando el límite obliga a muestrear',()=>{
 const ids=['T5_A@4','T8_B@3','T4_C','T5_D','T6_E@1'];
 assert.deepEqual(chosenDemandIds(ids,3),['T4_C','T5_D','T6_E@1']);
});
