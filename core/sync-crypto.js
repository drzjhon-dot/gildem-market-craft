// Cifrado extremo a extremo: jamás se manda la clave al backend.
// La clave se genera con CSPRNG (256 bits), no a partir de una contraseña débil.
const enc=new TextEncoder(),dec=new TextDecoder();
export function toBase64Url(bytes){let s='';for(const b of bytes)s+=String.fromCharCode(b);return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');}
export function fromBase64Url(value){const s=String(value||'').replace(/-/g,'+').replace(/_/g,'/');if(!/^[A-Za-z0-9+/]*={0,2}$/.test(s))throw Error('Clave inválida');const raw=atob(s+'='.repeat((4-s.length%4)%4));return Uint8Array.from(raw,c=>c.charCodeAt(0));}
export function newSyncCode(){const data=new Uint8Array(32);crypto.getRandomValues(data);return toBase64Url(data);}
async function keyFrom(code){const key=fromBase64Url(code);if(key.length!==32)throw Error('Introduce una clave de sincronización de 256 bits válida');return crypto.subtle.importKey('raw',key,{name:'AES-GCM'},false,['encrypt','decrypt']);}
export async function syncId(code){await keyFrom(code);const hash=await crypto.subtle.digest('SHA-256',enc.encode('gildem-v8-sync-id:'+code));return [...new Uint8Array(hash)].map(x=>x.toString(16).padStart(2,'0')).join('');}
export async function encryptPayload(data,code){const key=await keyFrom(code),iv=new Uint8Array(12);crypto.getRandomValues(iv);
 const body=enc.encode(JSON.stringify(data));if(body.length>150000)throw Error('El respaldo supera el tamaño permitido (150 KB)');
 const out=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv},key,body));return {version:1,iv:toBase64Url(iv),ciphertext:toBase64Url(out)};
}
export async function decryptPayload(input,code){if(input?.version!==1)throw Error('Formato de sincronización no compatible');const iv=fromBase64Url(input.iv),cipher=fromBase64Url(input.ciphertext);if(iv.length!==12||cipher.length>220000)throw Error('Copia cifrada inválida');
 try{const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv},await keyFrom(code),cipher);return JSON.parse(dec.decode(plain));}catch{throw Error('Clave incorrecta o copia dañada');}
}
