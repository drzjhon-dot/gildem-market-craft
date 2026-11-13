import json,sys,re,collections
items=json.load(open(sys.argv[1]))['items']; loot=open(sys.argv[2]).read(); out=sys.argv[3]
ench={}; lvres=collections.defaultdict(set)
for cat in ('equipmentitem','weapon'):
    for x in items[cat]:
        u=x['@uniquename']; e=x.get('enchantments',{}).get('enchantment')
        if not e: continue
        e=e if isinstance(e,list) else [e]
        counts=[]
        for lv in e:
            ur=lv.get('upgraderequirements',{}).get('upgraderesource')
            if not ur: counts.append(0); continue
            lvres[lv['@enchantmentlevel']].add(re.sub(r'^T\d_','',ur['@uniquename']))
            counts.append(int(ur['@count']))
        if any(counts):
            c=set(x for x in counts if x)
            ench[u]=counts[0] if len(c)==1 else counts
print({k:sorted(v) for k,v in lvres.items()}, len(ench))
farm=[]
for x in items['farmableitem']:
    if x.get('@kind')!='plant': continue
    h=x['harvest']; ll=h['@lootlist']
    m=re.search(r'"@name": "%s",\s*"Item": \[\s*\{\s*"@type": "([^"]+)",\s*"@chance": "([^"]+)",\s*"@amount": "([^"]+)"'%ll,loot)
    lo,hi=(m.group(3).split('-')+[m.group(3)])[:2]
    farm.append({'seed':x['@uniquename'],'crop':m.group(1),'tier':int(x['@tier']),'kind':x['@shopsubcategory1'],
      'seedChance':float(h['seed']['@chance']),'focusBonus':float(x['@activefarmbonus']),'focusCost':int(x['@activefarmfocuscost']),
      'yieldMin':int(lo),'yieldMax':int(hi),'growHours':round(int(h['@growtime'])/3600,2),'npcSeedSilver':int(x['craftingrequirements']['@silver'])})
json.dump({'source':'ao-bin-dumps items.json + loot.json','enchant':ench,'farm':farm},open(out,'w'),separators=(',',':'))
print(len(farm),farm[0])

# ── v4.1 · animales, comida para animales y productos ──────────────────────
def build_animals(items,loot_text):
    idx={}
    for k,v in items.items():
        if isinstance(v,list):
            for x in v:
                if isinstance(x,dict) and '@uniquename' in x: idx[x['@uniquename']]=(k,x)
    nutrition={u:{'n':int(x['@nutrition']),'cat':x.get('@foodcategory')} for u,(k,x) in idx.items() if x.get('@nutrition') and x.get('@foodcategory') in ('plants','meat') and k=='simpleitem'}
    def loot_first(name):
        m=re.search(r'"@name": "%s",\s*"Item": \[?\s*\{\s*"@type": "([^"]+)",\s*"@chance": "([^"]+)",\s*"@amount": "([^"]+)"'%re.escape(name),loot_text)
        if not m: return None
        a=m.group(3).split('-');lo=float(a[0]);hi=float(a[-1])
        return {'id':m.group(1),'chance':float(m.group(2)),'amount':(lo+hi)/2}
    uses={}
    for u,(k,x) in idx.items():
        cr=x.get('craftingrequirements')
        if not cr: continue
        for c in (cr if isinstance(cr,list) else [cr]):
            r=c.get('craftresource');rs=r if isinstance(r,list) else ([r] if r else [])
            g=[y['@uniquename'] for y in rs if '_FARM_' in y.get('@uniquename','') and y['@uniquename'].endswith('_GROWN')]
            if not g or 'TEST' in u or u.startswith('UNIQUE_'): continue
            uses.setdefault(g[0],[]).append({'id':u,'kind':'meat' if k=='simpleitem' else 'mount','amount':int(c.get('@amountcrafted') or 1),
              'mats':[{'id':y['@uniquename'],'count':int(y['@count'])} for y in rs if y['@uniquename']!=g[0]]})
    animals=[]
    for u,(k,x) in idx.items():
        if k!='farmableitem' or x.get('@kind')!='animal' or 'grownitem' not in x: continue
        if 'RABBIT_EASTER' in u: continue
        gi=x['grownitem'];grown=gi['@uniquename'];food=(x.get('consumption') or {}).get('food') or {}
        acc=food.get('acceptedfood') or {}
        g=idx.get(grown,(None,{}))[1];prod=None
        p=(g.get('products') or {}).get('product')
        if p:
            lf=loot_first(p['@lootlist'])
            if lf: prod={**lf,'hours':round(int(p['@productiontime'])/3600,2)}
        gfood=((g.get('consumption') or {}).get('food') or {})
        animals.append({'baby':u,'grown':grown,'tier':int(x['@tier']),'growHours':round(int(gi['@growtime'])/3600,2),
          'offspringChance':float(gi.get('offspring',{}).get('@chance',0)),'focusBonus':float(x.get('@activefarmbonus',0)),'focusCost':int(x.get('@activefarmfocuscost',1000)),'focusCycles':int(x.get('@activefarmmaxcycles',1)),
          'secondsPerNutrition':float(food.get('@secondspernutrition') or 0),'foodCategory':acc.get('@foodcategory'),'favorite':acc.get('@favorite'),'favoriteBonus':float(acc.get('@favoritebonus') or 0),
          'npcBabySilver':int((x.get('craftingrequirements') or {}).get('@silver') or 0),'product':prod,
          'adultSecondsPerNutrition':float(gfood.get('@secondspernutrition') or 0),'uses':uses.get(grown,[])})
    return animals,nutrition

if __name__=='__main__' and len(sys.argv)>3:
    data=json.load(open(sys.argv[3]))
    animals,nutrition=build_animals(json.load(open(sys.argv[1]))['items'],open(sys.argv[2]).read())
    data['animals']=animals;data['nutrition']=nutrition
    json.dump(data,open(sys.argv[3],'w'),separators=(',',':'))
    print('animales',len(animals),'alimentos',len(nutrition))

# ── v4.1 · cocina y alquimia que usan productos de la isla ─────────────────
FARM_RE=re.compile(r'^T\d_(CARROT|BEAN|WHEAT|TURNIP|CABBAGE|POTATO|CORN|PUMPKIN|AGARIC|COMFREY|BURDOCK|TEASEL|FOXGLOVE|MULLEIN|YARROW|MEAT|EGG|MILK|BUTTER|FLOUR)$')
def build_kitchen(items):
    out=[]
    for x in items.get('consumableitem',[]):
        if not isinstance(x,dict): continue
        u=x.get('@uniquename','');cat=x.get('@shopsubcategory1')
        if cat not in ('cooked','potions','potion') and not u.split('_',1)[-1].startswith(('MEAL','POTION')): continue
        cr=x.get('craftingrequirements')
        for c in (cr if isinstance(cr,list) else [cr] if cr else []):
            r=c.get('craftresource');rs=r if isinstance(r,list) else ([r] if r else [])
            mats=[{'id':y['@uniquename'],'count':int(y['@count'])} for y in rs]
            if not any(FARM_RE.match(m['id']) for m in mats): continue
            if 'SPECIAL' in u or any('_FARM_' in m['id'] for m in mats): continue
            out.append({'id':u,'kind':'potion' if 'POTION' in u else 'food','tier':int(x.get('@tier',0)),'amount':int(c.get('@amountcrafted') or 1),'focus':int(float(c.get('@craftingfocus') or 0)),'silver':int(c.get('@silver') or 0),'mats':mats})
            break
    return out
if __name__=='__main__' and len(sys.argv)>3:
    data=json.load(open(sys.argv[3]))
    data['kitchen']=build_kitchen(json.load(open(sys.argv[1]))['items'])
    json.dump(data,open(sys.argv[3],'w'),separators=(',',':'))
    print('cocina/alquimia',len(data['kitchen']))
