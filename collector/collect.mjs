#!/usr/bin/env node
/**
 * Gildem · Recolector del libro de órdenes de AODP West.
 * Uso: node collect.mjs --dir <carpeta de datos> [--minutes 25] [--dry-run archivo.json]
 *
 * 1. Carga el estado anterior (state.json.gz) de la carpeta de datos.
 * 2. Escucha el canal público de AODP West «marketorders.deduped» durante N minutos.
 * 3. Fusiona las órdenes, registra ventas seguras (reducciones de cantidad) y poda lo caducado.
 * 4. Escribe ob/meta.json y ob/T1..T8.json/other.json (resumen que lee la web) y el nuevo estado.
 * Credenciales públicas publicadas por AODP: https://www.albion-online-data.com/developer
 */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {gzipSync,gunzipSync} from 'node:zlib';
import {join} from 'node:path';
import {emptyState,flattenMessage,detectScale,normalizeOrder,mergeOrders,pruneState,buildShards} from './orderbook-core.mjs';

const args=Object.fromEntries(process.argv.slice(2).reduce((acc,a,i,all)=>{if(a.startsWith('--'))acc.push([a.slice(2),all[i+1]&&!all[i+1].startsWith('--')?all[i+1]:'true']);return acc;},[]));
const dir=args.dir||'orderbook-data',minutes=Math.max(1,Math.min(300,Number(args.minutes)||25));
const NATS={servers:process.env.AODP_NATS_SERVER||'nats://nats.albion-online-data.com:4222',user:process.env.AODP_NATS_USER||'public',pass:process.env.AODP_NATS_PASS||'thenewalbiondata',subject:process.env.AODP_NATS_SUBJECT||'marketorders.deduped'};

async function loadState(){
 try{const buf=await readFile(join(dir,'state.json.gz'));const s=JSON.parse(gunzipSync(buf).toString('utf8'));if(s?.v===1&&s.orders)return s;}catch{}
 return emptyState();
}
async function* fromFile(path){const data=JSON.parse(await readFile(path,'utf8'));for(const m of (Array.isArray(data)?data:[data]))yield m;}
async function* fromNats(){
 const {connect,StringCodec}=await import('nats');const sc=StringCodec();
 const nc=await connect({servers:NATS.servers,user:NATS.user,pass:NATS.pass,name:'gildem-orderbook-collector',maxReconnectAttempts:-1,reconnectTimeWait:3000});
 console.log(`Conectado a ${NATS.servers} · ${NATS.subject} · ${minutes} min`);
 const sub=nc.subscribe(NATS.subject);setTimeout(()=>sub.unsubscribe(),minutes*60_000);
 try{for await(const m of sub){try{yield JSON.parse(sc.decode(m.data));}catch{}}}finally{await nc.drain().catch(()=>{});}
}
const state=await loadState();
const pending=[];let messages=0,stats={added:0,updated:0,filledUnits:0,invalid:0};
const flush=(now)=>{if(!pending.length)return;if(!state.scale){const s=detectScale(pending);if(!s&&pending.length<500)return;state.scale=s||10000;console.log('Escala de precio detectada: ÷'+state.scale);}
 const normalized=pending.splice(0).map(o=>normalizeOrder(o,state.scale,now));stats.invalid+=normalized.filter(x=>!x).length;
 const r=mergeOrders(state,normalized,now);stats.added+=r.added;stats.updated+=r.updated;stats.filledUnits+=r.filledUnits;};
const source=args['dry-run']?fromFile(args['dry-run']):fromNats();
let lastLog=Date.now();
for await(const msg of source){messages++;pending.push(...flattenMessage(msg));if(pending.length>=200)flush(Date.now());
 if(Date.now()-lastLog>60_000){lastLog=Date.now();console.log(`${messages} mensajes · ${Object.keys(state.orders).length} órdenes en memoria`);}}
flush(Date.now());if(pending.length){state.scale=state.scale||10000;flush(Date.now());}
const now=Date.now(),removed=pruneState(state,now);state.updatedAt=new Date(now).toISOString();state.runs=(state.runs||0)+1;
const {meta,shards}=buildShards(state,now);meta.lastRun={minutes:args['dry-run']?0:minutes,messages,...stats,removed};
await mkdir(join(dir,'ob'),{recursive:true});
for(const [name,content] of Object.entries(shards))await writeFile(join(dir,'ob',name+'.json'),JSON.stringify(content));
await writeFile(join(dir,'ob','meta.json'),JSON.stringify(meta,null,1));
await writeFile(join(dir,'state.json.gz'),gzipSync(JSON.stringify(state)));
console.log(`Listo: ${messages} mensajes, +${stats.added} órdenes nuevas, ${stats.updated} actualizadas, ${stats.filledUnits} unidades vendidas detectadas, ${removed} podadas. Resumen: ${meta.entries} entradas.`);
if(!args['dry-run']&&messages===0){console.error('No llegó ningún mensaje de AODP en este intervalo.');process.exitCode=2;}
