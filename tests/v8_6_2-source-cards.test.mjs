import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {MARKET_REFERENCES,marketReferenceSnapshot} from '../core/market-references.js';
import {WEST_MARKET_SOURCES,NUMERIC_SOURCE} from '../core/server-policy.js';
const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
test('AODP-only elimina los enlaces y la consulta a webs de mercado competidoras',()=>{
 assert.equal(WEST_MARKET_SOURCES.length,0);
 assert.equal(MARKET_REFERENCES.length,0);
 assert.equal(NUMERIC_SOURCE.server,'west');
 assert.deepEqual(marketReferenceSnapshot(null),[]);
 assert(!app.includes('marketReferencesPanel('));
 assert(!app.includes('checkMarketReferences('));
 assert(!app.includes('Albion Online Hub'));
 assert(!app.includes('Estadísticas de volumen West (opcional)'));
});
test('El mensaje de origen distingue mercado AODP y recetas no incluidas en la API',()=>{
 assert(app.includes('AODP West'));
 assert(app.includes('AODP no ofrece recetas completas'));
 assert(!app.includes('externalDaily('));
});
