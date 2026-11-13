"""Genera data.js con recetas compactas para Gildem's Craft a partir de ao-bin-dumps."""
import json, re, sys

SRC = sys.argv[1]
OUT = sys.argv[2]

items = json.load(open(f"{SRC}/items.json"))["items"]
fmt = {x["UniqueName"]: x for x in json.load(open(f"{SRC}/formatted_items.json"))}
mods = json.load(open(f"{SRC}/craftingmodifiers.json"))["craftingmodifiers"]["craftinglocation"]

def L(x):
    return x if isinstance(x, list) else ([] if x is None else [x])

def es(uid):
    f = fmt.get(uid)
    if not f or not f.get("LocalizedNames"):
        return None
    return f["LocalizedNames"].get("ES-ES") or f["LocalizedNames"].get("EN-US")

# Índice de todos los items para itemvalue
allidx = {}
for k, v in items.items():
    if isinstance(v, list):
        for x in v:
            allidx[x["@uniquename"]] = x

FAME_BASE = {1: 0, 2: 1.5, 3: 7.5, 4: 22.5, 5: 90, 6: 270, 7: 645, 8: 1395}

def res_market_id(uid, ench):
    return uid + (f"@{ench}" if ench else "")

def res_info(uid, ench):
    base = allidx.get(uid, {})
    iv = float(base.get("@itemvalue", 0) or 0)
    fame = 0.0
    if base.get("@shopsubcategory1") == "refinedresources":
        t = int(base.get("@tier", 0))
        fame = FAME_BASE.get(t, 0) * (2 ** ench)
    return iv, fame

def parse_recipe(cr):
    res = []
    iv = 0.0
    fame = 0.0
    for r in L(cr.get("craftresource")):
        uid = r["@uniquename"]
        ench = int(r.get("@enchantmentlevel", 0) or 0)
        cnt = int(float(r["@count"]))
        noret = 1 if r.get("@maxreturnamount") == "0" else 0
        mid = res_market_id(uid, ench)
        res.append([mid, cnt, noret])
        v, fm = res_info(uid, ench)
        iv += v * cnt
        fame += fm * cnt
    if not res:
        return None
    return [res,
            int(float(cr.get("@amountcrafted", 1) or 1)),
            int(float(cr.get("@silver", 0) or 0)),
            int(float(cr.get("@craftingfocus", 0) or 0)),
            round(fame, 1),
            round(iv, 1)]

# Diarios: base sin tier -> tipo
journal_kind = {}
for j in items["journalitem"]:
    m = re.match(r"T\d_JOURNAL_(WARRIOR|HUNTER|MAGE|TOOLMAKER)$", j["@uniquename"])
    if not m:
        continue
    cf = j.get("famefillingmissions", {}).get("craftitemfame")
    if not cf:
        continue
    for v in L(cf.get("validitem")):
        journal_kind[re.sub(r"^T\d_", "", v["@id"])] = m.group(1)

journal_maxfame = {}
for j in items["journalitem"]:
    m = re.match(r"T(\d)_JOURNAL_(WARRIOR|HUNTER|MAGE|TOOLMAKER)$", j["@uniquename"])
    if m:
        journal_maxfame[f"{m.group(2)}_{m.group(1)}"] = int(float(j["@maxfame"]))

TIER_SUFFIX = re.compile(r"\s+del (novato|obrero|iniciado|experto|maestro|gran maestro|anciano)$")

SKIP_SHOP = {"other", "vanity", "artefacts", "farming"}

out_items = {}
bases = {}
res_ids = set()

def add(x, group, sub):
    uid = x["@uniquename"]
    if "craftingrequirements" not in x:
        return
    t = int(x.get("@tier", 0) or 0)
    ench_map = {}
    recs = [r for r in (parse_recipe(c) for c in L(x["craftingrequirements"])) if r]
    if recs:
        ench_map[0] = recs
    for e in L((x.get("enchantments") or {}).get("enchantment")):
        lvl = int(e["@enchantmentlevel"])
        recs = [r for r in (parse_recipe(c) for c in L(e.get("craftingrequirements"))) if r]
        if recs:
            ench_map[lvl] = recs
    if not ench_map:
        return
    # refinados: la versión encantada es un item aparte (T4_PLANKS_LEVEL1)
    baseid = re.sub(r"^T\d_", "", uid)
    name = es(uid) or uid
    jk = journal_kind.get(baseid, "")
    cc = x.get("@craftingcategory", "") or ""
    out_items[uid] = [name, group, sub, t, cc, jk, ench_map]
    for recs in ench_map.values():
        for r in recs:
            for rr in r[0]:
                res_ids.add(rr[0])
    b = bases.setdefault(baseid, {"g": group, "s": sub, "n": None, "t": []})
    b["t"].append(t)
    nm = TIER_SUFFIX.sub("", name)
    if b["n"] is None or nm != name:
        b["n"] = nm

for cat in ["weapon", "equipmentitem", "mount", "consumableitem", "furnitureitem"]:
    for x in items[cat]:
        sc = x.get("@shopcategory")
        if sc in SKIP_SHOP or sc is None:
            continue
        add(x, sc, x.get("@shopsubcategory1", "other"))

# Refinamiento: los encantados (_LEVELn) se tratan como encantamientos del mismo item base
for x in items["simpleitem"]:
    if x.get("@shopsubcategory1") != "refinedresources" or "craftingrequirements" not in x:
        continue
    uid = x["@uniquename"]
    m = re.match(r"^(T\d_[A-Z]+?)(?:_LEVEL(\d))?$", uid)
    if not m:
        continue
    base_uid, lvl = m.group(1), int(m.group(2) or 0)
    t = int(x["@tier"])
    recs = [r for r in (parse_recipe(c) for c in L(x["craftingrequirements"])) if r]
    if not recs:
        continue
    name = es(base_uid) or base_uid
    cc = x.get("@craftingcategory", "")
    entry = out_items.setdefault(base_uid, [name, "refining", cc, t, cc, "", {}])
    entry[6][lvl] = recs
    for r in recs:
        for rr in r[0]:
            res_ids.add(rr[0])
    baseid = re.sub(r"^T\d_", "", base_uid)
    b = bases.setdefault(baseid, {"g": "refining", "s": cc, "n": None, "t": []})
    if t not in b["t"]:
        b["t"].append(t)
    b["n"] = {"wood": "Tablas", "ore": "Lingotes de metal", "hide": "Cuero", "fiber": "Tela", "rock": "Bloques de piedra"}.get(cc, name)

# Nombres de recursos
res_names = {}
for rid in res_ids:
    base, _, e = rid.partition("@")
    n = es(rid) or es(base) or base
    if e and not es(rid):
        n = f"{n} .{e}"
    res_names[rid] = n

# Modificadores de ciudad
CITY = {"0000": "Thetford", "1000": "Lymhurst", "2000": "Bridgewatch", "3004": "Martlock",
        "4000": "Fort Sterling", "3003": "Caerleon", "5000": "Brecilien"}
city_mods = {}
for l in mods:
    cid = l.get("@clusterid")
    if cid not in CITY:
        continue
    city_mods[CITY[cid]] = {
        "base_craft": float(l["craftingbonus"]["@value"]),
        "base_refine": float(l["refiningbonus"]["@value"]),
        "mods": {m["@name"]: float(m["@value"]) for m in L(l.get("craftingmodifier"))},
    }

data = {
    "items": out_items,
    "bases": {k: [v["n"], v["g"], v["s"], sorted(set(v["t"]))] for k, v in bases.items()},
    "res": res_names,
    "cities": city_mods,
    "jfame": journal_maxfame,
}
s = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
open(OUT, "w").write("window.GC_DATA=" + s + ";")
print(len(out_items), "items", len(bases), "bases", len(res_names), "res", len(s) // 1024, "KB")
print(city_mods)
print(sorted(set((v["g"], v["s"]) for v in bases.values())))
