// Mercado sintético para auditar el motor: 8 familias, T4–T8, .0–.4, Mercado Negro + Royal + Caerleon.
let seed=1;
export const T=Date.parse('2026-11-12T12:00:00Z'),fresh=T-3600e3;
const ROY=['Bridgewatch','Fort Sterling','Lymhurst','Martlock','Thetford'],MK=['Black Market',...ROY,'Caerleon'];
const fams=[['MAIN_MACE','Martlock',[['METALBAR',16],['CLOTH',8]]],['2H_MACE','Martlock',[['METALBAR',20],['CLOTH',12]]],['MAIN_SWORD','Lymhurst',[['METALBAR',16],['LEATHER',8]]],
 ['2H_CLAYMORE','Lymhurst',[['METALBAR',20],['LEATHER',12]]],['HEAD_PLATE_SET1','Bridgewatch',[['METALBAR',8]]],['ARMOR_CLOTH_SET1','Fort Sterling',[['CLOTH',16]]],['SHOES_LEATHER_SET1','Thetford',[['LEATHER',8]]],['2H_BOW','Lymhurst',[['PLANKS',32]]]];
const base={4:260,5:950,6:2600,7:7200,8:21000};
export const quotes=new Map(),recipes={},top=[];
const q=(id,city,ask,bid)=>{const k=id+'|'+city,o=quotes.get(k)||{id,city};if(ask)o.ask={price:ask,time:fresh};if(bid)o.bid={price:bid,time:fresh};quotes.set(k,o);};
for(let t=4;t<=8;t++)for(let e=0;e<=4;e++){const em=[1,2.1,4.4,9,19][e],suf=e?'@'+e:'',lvl=e?'_LEVEL'+e:'';
 for(const r of ['METALBAR','CLOTH','LEATHER','PLANKS'])for(const c of [...ROY,'Caerleon'])q(`T${t}_${r}${lvl}${suf}`,c,Math.round(base[t]*em*(1+(c.length%5)*.01)));
 for(const [stem,city,mats] of fams){const id=`T${t}_${stem}${suf}`;const cost=mats.reduce((s,[r,n])=>s+n*base[t]*em,0);
  recipes[id]={city,specialtyBonus:15,amountCrafted:1,materials:mats.map(([r,n])=>({id:`T${t}_${r}${lvl}${suf}`,count:n}))};
  for(const m of MK){const k=(stem.length*7+t*3+e+m.length)%10;const daily=Math.max(.1,[16,9,5,2.4,1.1][t-4]*[1,.45,.18,.08,.03][e]*(m==='Black Market'?1:.5)*(0.5+k/10));
   const price=Math.round(cost*(0.95+k*.05));if(m==='Black Market')q(id,m,null,price);else q(id,m,Math.round(price*1.08));
   top.push({id,city:m,days:7,quality1DailyUnits:daily,quality1ActiveDays:daily>.4?7:3,averageDailyUnits:daily*1.3,quality1AveragePrice:m==='Black Market'?price:price*1.08,from:'x',to:'y'});}}}
