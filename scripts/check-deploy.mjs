import {access,readFile} from 'node:fs/promises';
import {join} from 'node:path';
import assert from 'node:assert/strict';
const must=['package.json','netlify.toml','index.html','app.js','styles.css',
'core/craft-plan-controls.js','core/diversity-policy.js','core/catalog.js','core/special-recipes.js','core/market-discovery.js','core/demand-first.js','core/market-proof.js','core/external-demand.js','core/royal-sale-markets.js','core/server-policy.js','core/west-ai-brief.js','core/procurement-liquidity.js','core/high-volume.js','core/bm-listing-prices.js','scripts/build.mjs',
'netlify/functions/health.mjs','netlify/functions/market.mjs',
'netlify/functions/recipes.mjs','netlify/functions/catalog.mjs','netlify/functions/item-image.mjs','netlify/functions/market-references.mjs',
'netlify/functions/hourly-prices.mjs','netlify/functions/snapshot.mjs'];
for(const path of must)await access(join(process.cwd(),path));
const pkg=JSON.parse(await readFile('package.json','utf8'));
assert.match(pkg.version,/^9\.11\.0$/,'La distribución debe declarar la versión 9.11.0');
// Prevent the regression that sent only test files to GitHub while keeping
// app.js/index.html on an older version. These checks run in every Netlify build.
const html=await readFile('index.html','utf8');
const source=await readFile('app.js','utf8');
const sw=await readFile('sw.js','utf8');
const builder=await readFile('scripts/build.mjs','utf8');
assert.ok(!html.includes('data-nav="resultados"'),'La pestaña Resultados debe estar eliminada del menú');
for(const tab of ['craftcal','crafting','autocraft','refinamiento','topmercado','ajustes'])assert.ok(html.includes('data-nav="'+tab+'"'),'Falta la pestaña: '+tab);
assert.ok(source.includes("sendPlanToCalculator('crafting')")&&source.includes("sendPlanToCalculator('autocraft')"),'Los planes no llegan a la calculadora');
assert.ok(source.includes('function resultsPage(){'),'La pantalla Resultados falta en app.js');
assert.ok(source.includes('royalSaleCitiesHtml()')&&source.includes('selectedRoyalSaleCities()'),'Royal Craft debe permitir elegir destinos de venta');
const css=await readFile('styles.css','utf8');
assert.ok(css.includes('.gcp-results .gcp-market-audit')&&css.includes('.gcp-results .gcp-panel-budget'),'Los paneles secundarios deben permanecer ocultos en Resultados');
assert.ok(source.includes("qcControls('craft')")&&source.includes("qcControls('auto')"),'Black/Royal no tienen controles compactos');
assert.ok(!source.includes('researchPlanHtml(')&&source.includes('historicalBmListingTarget('),'No deben mostrarse planes de investigación ni perder el contraste del historial BM');
assert.ok(source.includes('marketCoverageHtml(p)')&&source.includes('chosenDemandIds('),'Falta la exploración por demanda de v9.9.0');
assert.ok(source.includes('evidenceForPlan(b,')&&source.includes('marketCoverage.historyObserved='),'Falta auditoría de precio, historial y abastecimiento');
assert.ok(source.includes('pendingUnitsByMarket(loadPortfolios())')&&source.includes('intelligent:true'),'Falta Cartera inteligente en Black/Royal');
assert.ok(!source.includes('qc-reserve')&&source.includes('bulkMarketCandidates(')&&source.includes('materialDepthAssessment('),'Faltan los filtros de volumen o sobran controles de reserva');
assert.ok(html.includes('v'+pkg.version)&&sw.includes('gildem-craft-pro-v'+pkg.version),'Versión incorrecta en HTML o caché del navegador');
assert.ok(builder.includes("version:'"+pkg.version+"'"),'Versión incorrecta en scripts/build.mjs');
assert.ok(!source.includes('vanatoliyv.github.io'),'Referencia europea no debe estar en la aplicación');
assert.ok(!html.includes('value="europe"'),'No ofrecer servidor Europa en el selector');
for(const file of ['core/results-view.js','core/market-references.js','core/market-volume.js','core/procurement-liquidity.js','assets/results-banner.webp','assets/results-sidebar.webp'])await access(file);
const health=await readFile('netlify/functions/health.mjs','utf8');
assert.ok(health.includes("version:'"+pkg.version+"'"),'La función health tiene una versión distinta al package.json');
assert.equal(pkg.dependencies['@netlify/blobs'],'11.1.7');
assert.equal(pkg.overrides['@netlify/otel'],'7.0.6');
const config=await readFile('netlify.toml','utf8');
assert.match(config,/command\s*=\s*"npm run build"/);
assert.match(config,/publish\s*=\s*"dist"/);
assert.match(config,/functions\s*=\s*"netlify\/functions"/);
assert.match(config,/GILDEM_PREFETCH_ICONS\s*=\s*"0"/);
assert.ok(source.includes('createRefinePage(')&&source.includes('createBmPage(')&&source.includes('renderBlackUnified()'),'No se han integrado los motores v3');
assert.ok(html.includes('lab-v3.css'),'Falta el estilo aislado de Refinamiento');
console.log('PRECHECK OK: repositorio completo, JSON válido, dependencias fijadas, Netlify listo.');
