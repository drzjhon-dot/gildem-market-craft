// Sincronización opcional cifrada en el navegador. El servidor ve solamente
// un identificador aleatorio derivado de una clave y un blob cifrado.
import {getStore} from '@netlify/blobs';
const mime={'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'};
const reply=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:mime});
const idOK=id=>typeof id==='string'&&/^[a-f0-9]{64}$/.test(id);
export default async function handler(request){
 if(process.env.GILDEM_SYNC_ENABLED!=='1')return reply({error:'Sincronización privada desactivada. Actívala explícitamente con GILDEM_SYNC_ENABLED=1 en Netlify.'},503);
 if(!['GET','POST'].includes(request.method))return reply({error:'Método no permitido'},405);
 try{
  const url=new URL(request.url);let id=url.searchParams.get('id');let payload=null;
  if(request.method==='POST'){
   const length=Number(request.headers.get('content-length')||0);if(length>260000)return reply({error:'Carga demasiado grande'},413);
   const text=await request.text();if(text.length>260000)return reply({error:'Carga demasiado grande'},413);
   const body=JSON.parse(text);id=body.id;payload=body.encrypted;
   if(!payload||payload.version!==1||typeof payload.iv!=='string'||! /^[A-Za-z0-9_-]{16,22}$/.test(payload.iv)||typeof payload.ciphertext!=='string'||payload.ciphertext.length>225000||!/^[A-Za-z0-9_-]+$/.test(payload.ciphertext))return reply({error:'Cifrado inválido'},400);
  }
  if(!idOK(id))return reply({error:'Identificador inválido'},400);
  const store=getStore({name:'gildem-private-sync-v8'});
  if(request.method==='GET'){
   const saved=await store.get(id,{type:'json'});if(!saved)return reply({error:'Aún no hay una copia en la nube para esa clave'},404);
   return reply({encrypted:saved.encrypted,updatedAt:saved.updatedAt});
  }
  const updatedAt=new Date().toISOString();await store.setJSON(id,{encrypted:payload,updatedAt});return reply({ok:true,updatedAt});
 }catch(e){console.error('Error sincronización privada',String(e));return reply({error:'Almacenamiento no disponible temporalmente'},503);}
}
