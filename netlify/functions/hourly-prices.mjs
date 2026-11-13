// Netlify Scheduled Function. Consulta un catálogo reducido de seguimiento cada
// hora, incluso si nadie abrió la app. No escanea todo Albion ni envía alertas privadas.
import {getStore} from '@netlify/blobs';
export const DEFAULT_WATCH=[
 'T4_SHOES_PLATE_SET1','T5_SHOES_PLATE_SET1','T6_SHOES_PLATE_SET1',
 'T4_SHOES_PLATE_SET2','T5_SHOES_PLATE_SET2','T6_SHOES_PLATE_SET2',
 'T4_SHOES_CLOTH_SET1','T5_SHOES_CLOTH_SET1','T6_SHOES_CLOTH_SET1',
 'T4_SHOES_LEATHER_SET1','T5_SHOES_LEATHER_SET1','T6_SHOES_LEATHER_SET1',
 'T4_MAIN_AXE','T5_MAIN_AXE','T6_MAIN_AXE','T4_2H_AXE','T5_2H_AXE','T6_2H_AXE',
 'T4_METALBAR','T5_METALBAR','T6_METALBAR','T4_LEATHER','T5_LEATHER','T6_LEATHER',
 'T4_CLOTH','T5_CLOTH','T6_CLOTH',
 'T4_MEAL_SALAD','T5_MEAL_PIE','T6_MEAL_STEW','T7_MEAL_OMELETTE','T4_MEAL_SALAD_FISH','T1_FISHSAUCE_LEVEL1','T4_POTION_HEAL','T4_MOUNT_HORSE'
];
const hosts={west:'https://west.albion-online-data.com'};
export function watchConfig(env=process.env){
 const ids=(env.GILDEM_WATCH_IDS||DEFAULT_WATCH.join(',')).split(',').map(x=>x.trim()).filter(x=>/^[A-Z0-9_@-]{3,100}$/.test(x)).slice(0,40);
 const region='west'; // Las configuraciones de despliegue heredadas no pueden cambiar el servidor.
 return {region,ids:[...new Set(ids)]};
}
export default async ()=>{
 const {region,ids}=watchConfig();
 if(!ids.length){console.info('Gildem: sin IDs configurados para seguimiento');return;}
 const params=new URLSearchParams({locations:'Bridgewatch,Fort Sterling,Lymhurst,Martlock,Thetford,Caerleon,Brecilien,Black Market',qualities:'1'});
 const url=hosts[region]+'/api/v2/stats/prices/'+ids.join(',')+'.json?'+params;
 try{
  const res=await fetch(url,{signal:AbortSignal.timeout(19000),headers:{Accept:'application/json'}});
  if(!res.ok)throw Error('AODP '+res.status);
  const rows=await res.json();if(!Array.isArray(rows))throw Error('Formato de respuesta inesperado');
  const payload={region,requested:ids.length,rows,fetchCompletedAt:new Date().toISOString(),source:'AODP',note:'Las fechas de cotización son independientes del momento de consulta.'};
  const store=getStore({name:'gildem-public-prices'});
  await store.setJSON('hourly-'+region,payload);
  console.info('Gildem: actualizado snapshot público',region,rows.length,'filas');
 }catch(e){console.error('Gildem: no se actualizó el snapshot. Se conserva el anterior:',String(e.message||e));}
};
export const config={schedule:'@hourly'};
