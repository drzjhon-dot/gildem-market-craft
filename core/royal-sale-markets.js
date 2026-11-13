// Royal Craft: ciudades de VENTA. No restringe compras ni ciudades de fabricación.
import {CITIES} from './engine.js';

export function normalizeRoyalSaleCities(value){
 if(!Array.isArray(value))return [...CITIES];
 return CITIES.filter(city=>value.includes(city));
}
export function chooseRoyalSaleCities(value){
 const selected=normalizeRoyalSaleCities(value);
 return selected.length?selected:[...CITIES];
}
export function filterRoyalSaleRoutes(routes,saleCities){
 const selected=new Set(normalizeRoyalSaleCities(saleCities));
 return (routes||[]).filter(route=>selected.has(route?.city));
}
