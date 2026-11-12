import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {flipSettings,scanFlipRoutes,allocateFlips} from '../src/flipping.js';
import {quoteMap} from '../src/market.js';
const T=Date.parse('2026-11-11T20:00:00Z');
const stamp=new Date(T-3_600_000).toISOString(),stale=new Date(T-80*3_600_000).toISOString();
const id='T6_MAIN_MACE';
const quote=(item,city,ask,bid,when=stamp)=>({item_id:item,city,quality:1,sell_price_min:ask||0,sell_price_min_date:when,buy_price_max:bid||0,buy_price_max_date:when});
const history=(item=id,city='Black Market',daily=50)=>({id:item,city,quality1DailyUnits:daily,quality1ActiveDays:6,averageDailyUnits:daily+25,days:7});
const base={budget:100000,daysToSell:7,maxSkuSharePct:75,demandSharePct:20,minRoiPct:5,sources:['Martlock'],targets:['Black Market'],transportPerUnit:1000};
const quotePair=(ask=10000,bid=22000)=>quoteMap([quote(id,'Martlock',ask,5000),quote(id,'Black Market',25000,bid)]);
test('Flips: compra ask y venta bid, nunca usa el ask de destino como ejecución',()=>{
 const res=scanFlipRoutes({ids:[id],quotes:quotePair(),history:[history()],config:base,now:T});
 assert.equal(res.candidates.length,1);assert.equal(res.candidates[0].sourcePrice,10000);assert.equal(res.candidates[0].targetPrice,22000);
 const p=allocateFlips(res);assert(p.rows.length===1);assert(p.rows[0].profit>0);assert(p.rows[0].qty<=p.rows[0].maxUnits);
});
test('Flips: falta puja de destino => no se inventa ganancia usando oferta publicada',()=>{
 const res=scanFlipRoutes({ids:[id],quotes:quoteMap([quote(id,'Martlock',10000,0),quote(id,'Black Market',55000,0)]),history:[history()],config:base,now:T});
 assert.equal(res.candidates.length,0);assert(res.rejections.some(r=>r.reason.includes('puja')));
});
test('Flips: oferta stale o historial de otra ciudad => no se usa',()=>{
 const quotes=quoteMap([quote(id,'Martlock',10000,0,stale),quote(id,'Black Market',20000,19000)]);
 assert.equal(scanFlipRoutes({ids:[id],quotes,history:[history()],config:base,now:T}).candidates.length,0);
 const current=quotePair();assert.equal(scanFlipRoutes({ids:[id],quotes:current,history:[history(id,'Thetford')],config:base,now:T}).candidates.length,0);
});
test('Flips: la demanda diaria Q1, no el total de calidades, limita el lote',()=>{
 const h={...history(id,'Black Market',1),averageDailyUnits:300};
 const res=scanFlipRoutes({ids:[id],quotes:quotePair(),history:[h],config:{...base,demandSharePct:10,daysToSell:3},now:T});
 assert.equal(res.candidates.length,0);assert(res.rejections.some(x=>x.reason.includes('inferior a una unidad')));
});
test('Flips: presupuesto, cap por objeto, importe de transporte y ROI se respetan',()=>{
 const res=scanFlipRoutes({ids:[id],quotes:quotePair(),history:[history()],config:{...base,maxSkuSharePct:25,budget:100000,transportPerUnit:500},now:T});
 const p=allocateFlips(res);assert(p.summary.capital<=100000);assert(p.summary.capital<=25000+.01);assert(p.rows.every(r=>r.profit>0&&r.roi>=5));
 const costly=scanFlipRoutes({ids:[id],quotes:quotePair(),history:[history()],config:{...base,transportPerUnit:18000},now:T});
 assert.equal(costly.candidates.length,0);
});
test('Flips: al activar estrés obligatorio se bloquean oportunidades frágiles',()=>{
 const quotes=quotePair(10000,13500);
 const loose=scanFlipRoutes({ids:[id],quotes,history:[history()],config:{...base,transportPerUnit:0,buyBufferPct:0,sellHaircutPct:0,taxPct:4,stressPct:25},now:T});
 assert.equal(loose.candidates.length,1);
 const guard=scanFlipRoutes({ids:[id],quotes,history:[history()],config:{...base,transportPerUnit:0,buyBufferPct:0,sellHaircutPct:0,taxPct:4,stressPct:25,requireStressProfit:true},now:T});
 assert.equal(guard.candidates.length,0);
});
test('Flips: config no acepta Black Market como origen y limpia mercados inventados',()=>{
 const s=flipSettings({sources:['Black Market','Martlock','Atlantis'],targets:['Black Market','Atlantis']});
 assert.deepEqual(s.sources,['Martlock']);assert.deepEqual(s.targets,['Black Market']);
});
test('Interfaz: cinco pestañas, selector de transferencias, cuotas, costes y copia',()=>{
 const html=readFileSync('index.html','utf8'),js=readFileSync('src/main.js','utf8'),css=readFileSync('styles.css','utf8');
 assert.equal((html.match(/class="nav-link[^"]*" data-route=/g)||[]).length,5);
 for(const token of ['data-route="flip"','send-marked-flip','function flipPage()','function runFlips()','id="run-flips"','id="flip-export"','data-flip-setting="budget"','data-flip-market="${kind}"'])assert(js.includes(token)||html.includes(token),token);
 assert.match(css,/\.flip-workbench/);assert.match(html,/flips\.svg/);
});
