import test from 'node:test';
import assert from 'node:assert/strict';
import {evidenceForRoute,evidenceForPlan} from '../core/market-proof.js';
test('plan paciente distingue cantidad objetivo de primer lote comprado',()=>{
 const x=evidenceForRoute({id:'T5_SHOES_PLATE_SET2',qty:100,craftAmount:1,city:'Black Market',
  ageHours:2,demandDaily:3696,activity:{activeDays:14},procurementFirstBatch:12,patientSupplyPending:true},
 {horizonDays:14,supplyPending:true});
 assert.equal(x.units,100);assert.equal(x.firstBatch,12);assert.equal(x.needsStaging,true);
 assert.equal(x.quote,'reciente');assert.equal(x.historySource,'AODP West: órdenes observadas');
 assert(x.alerts.some(y=>y.includes('compra completa')));
 assert(x.alerts.some(y=>y.includes('puja NPC')));
});
test('sin datos no inventa fecha, ventas ni cantidad comprable',()=>{
 const x=evidenceForRoute({qty:4,craftAmount:2,city:'Martlock',patientSupplyPending:true});
 assert.equal(x.observedDaily,null);assert.equal(x.ageHours,null);assert.equal(x.firstBatch,null);
 assert.equal(x.quote,'sin fecha');assert.equal(x.ratio,null);
});
test('plan acreditado separa certeza de precio, actividad y materiales',()=>{
 const p=evidenceForPlan({rows:[{qty:4,city:'Martlock',ageHours:3,demandDaily:22,activity:{activeDays:8}},
  {qty:2,city:'Thetford',ageHours:40,demandDaily:null,patientSupplyPending:true}]});
 assert.equal(p.ready,1);assert.equal(p.incomplete,1);assert.equal(p.staged,1);assert.equal(p.total,2);
});

test('datos ausentes en null no se vuelven una cotización reciente inventada',()=>{
 assert.equal(evidenceForRoute({ageHours:null,qty:1,demandDaily:null}).quote,'sin fecha');
});
