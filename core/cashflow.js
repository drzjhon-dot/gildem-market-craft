// Contabilidad de caja transparente: los planes guardados NO descuentan capital
// hasta que el usuario confirma que compró materiales / inició el lote.
const num=v=>Number.isFinite(Number(v))?Number(v):0;
export function validateWallet(w){
 if(!w||w.initial===null||w.initial===undefined||w.initial==='')return null;
 const initial=Number(w.initial);if(!Number.isFinite(initial)||initial<0)throw Error('Capital inicial inválido');
 const adjustments=Array.isArray(w.adjustments)?w.adjustments:[];
 if(adjustments.some(x=>!Number.isFinite(Number(x.amount))))throw Error('Movimiento de caja inválido');
 return {initial,adjustments};
}
export function cashPosition(wallet,portfolios=[]){
 const w=validateWallet(wallet);if(!w)return {configured:false,available:null,starting:0,adjustments:0,committed:0,collected:0,unsoldGross:0,planned:0};
 const adjustments=w.adjustments.reduce((s,x)=>s+num(x.amount),0);
 let committed=0,collected=0,unsoldGross=0,planned=0;
 for(const p of portfolios){const up=(p?.lots||[]).reduce((s,l)=>s+Math.max(0,num(l.qty))*Math.max(0,num(l.capitalPerUnit)),0);
  if(p.started!==true){planned+=up;continue;}
  committed+=Math.max(0,up-num(p.inventoryCredit));
  for(const lot of p.lots||[]){let sold=0;for(const s of lot.sales||[]){sold+=num(s.qty);collected+=num(s.qty)*num(s.price)-num(s.fees)-num(s.transport);}
    unsoldGross+=Math.max(0,num(lot.qty)-sold)*num(lot.capitalPerUnit);
  }
 }
 return {configured:true,starting:w.initial,adjustments,committed,collected,unsoldGross,planned,available:w.initial+adjustments-committed+collected};
}
export function startPortfolio(portfolios,id,wallet){
 const all=structuredClone(portfolios),p=all.find(x=>x.id===id);if(!p)throw Error('No existe la inversión');
 if(p.started===true)return all;
 const before=cashPosition(wallet,all);
 const amount=Math.max(0,(p.lots||[]).reduce((s,l)=>s+Math.max(0,num(l.qty)*num(l.capitalPerUnit)),0)-num(p.inventoryCredit));
 if(before.configured&&amount>before.available+.001)throw Error('Capital insuficiente. Ajusta el capital en Mi negocio o confirma solo inversiones que hayas pagado.');
 p.started=true;p.startedAt=new Date().toISOString();return all;
}
export function adjustWallet(wallet,amount,note='Ajuste manual'){
 const w=validateWallet(wallet);if(!w)throw Error('Configura primero el capital inicial');
 const a=Number(amount);if(!Number.isFinite(a)||a===0)throw Error('Introduce un movimiento distinto de cero');
 return {initial:w.initial,adjustments:[...w.adjustments,{amount:a,note:String(note).slice(0,150),at:new Date().toISOString()}]};
}
