// Exclusividad numérica: mercado de Albion Online Data Project, servidor América/West.
export const REGION='west';
export const AODP_WEST='https://west.albion-online-data.com';
export function requireWest(region='west'){
 if(region!==REGION)throw new Error('Servidor bloqueado: Gildem solo acepta América (West).');
 return REGION;
}
export const WEST_MARKET_SOURCES=Object.freeze([]);
export const NUMERIC_SOURCE=Object.freeze({name:'Albion Online Data Project',server:'west',base:AODP_WEST,independentTimestamp:true});
export function sourceLabel(source){return source==='aodp'?'AODP · América (West)':'Fuente externa de mercado no admitida';}
// Compatibilidad con lectores antiguos de respaldos: no vuelven a ser fuentes numéricas.
export function recognizedWestSnapshot(){return false;}
