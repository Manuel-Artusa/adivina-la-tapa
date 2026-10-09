"""Arma discos.json: para cada disco del catálogo (la lista DISCOS de index.html)
guarda su id de iTunes, la tapa y la lista de temas con el fragmento de audio.

Así el juego no tiene que buscar en iTunes cada vez: carga más rápido, no se traba
por el límite de consultas de iTunes y el desafío del día es igual para todos.

Uso:
  python armar_discos.py          -> busca solo los discos nuevos (los que no están en discos.json)
  python armar_discos.py --todo   -> vuelve a buscar todo (tarda unos 30-40 minutos)

Solo usa la librería estándar de Python. Lo corre GitHub Actions (.github/workflows/discos.yml),
pero también se puede correr a mano.
"""
import json, re, sys, time, unicodedata, urllib.parse, urllib.request, urllib.error
from datetime import datetime, timezone

PAUSA = 3.2          # segundos entre consultas (iTunes permite ~20 por minuto)
SALIDA = "discos.json"

FUERA = re.compile(r"vivo|live|grandes|lo mejor|exitos|single|\bep\b|acustico|unplugged|antologia|coleccion|collection|greatest|hits|best of|karaoke|tributo|tribute|remix")
NO_ROCK = re.compile(r"cumbia|tropical|salsa|reggaeton|urban|regional|mexican|bachata|merengue|cuarteto|folklor|christian|cristian|gospel|infantil|children|nino|ranchera|bolero|tango|vallenato|banda|electronica|dance|hip hop|rap|jazz|clasica|classical|soundtrack|comedia")
EXTRA_TITULO = re.compile(r"\s*[\(\[][^\)\]]*(remaster|deluxe|edition|edicion|edición|version|versión|bonus|expanded|anniversary|aniversario)[^\)\]]*[\)\]]", re.I)
EXTRA_TEMA_1 = re.compile(r"\s*[\(\[][^\)\]]*(vivo|live|remaster|versi[oó]n|version|demo|bonus|ac[uú]stic|edit|mix)[^\)\]]*[\)\]]", re.I)
EXTRA_TEMA_2 = re.compile(r"\s+-\s+(en vivo|live|remaster|demo|versi[oó]n).*$", re.I)


def norm(s):
    s = unicodedata.normalize("NFD", str(s).lower())
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    s = re.sub(r"[^a-z0-9 ]", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def limpiar_titulo(t):
    return EXTRA_TITULO.sub("", t).strip()


def limpiar_tema(t):
    return EXTRA_TEMA_2.sub("", EXTRA_TEMA_1.sub("", str(t))).strip()


def mismo_artista(nombre, art):
    a, b = norm(nombre), norm(art)
    return a == b or a.startswith(b + " ") or b.startswith(a + " ")


def leer_catalogo():
    s = open("index.html", encoding="utf-8").read()
    a = s.index("const DISCOS = [")
    b = s.index("\n];", a) + 3
    txt = s[a + len("const DISCOS = "):b - 1]
    txt = re.sub(r"//[^\n]*", "", txt)
    txt = re.sub(r",\s*\]", "]", txt)
    return [d for d in json.loads(txt) if d[1]]


ultima = 0.0
def itunes(params):
    """Consulta a iTunes respetando la pausa y reintentando si corta por exceso de consultas."""
    global ultima
    url = "https://itunes.apple.com/" + params
    for intento in range(6):
        espera = PAUSA - (time.time() - ultima)
        if espera > 0:
            time.sleep(espera)
        ultima = time.time()
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "JuegosRock/1.0"})
            with urllib.request.urlopen(req, timeout=30) as r:
                return json.loads(r.read().decode("utf-8"))
        except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError, json.JSONDecodeError) as e:
            pausa = 60 * (intento + 1)
            print(f"   iTunes respondió {e}. Espero {pausa}s y reintento…", flush=True)
            time.sleep(pausa)
    raise RuntimeError("iTunes no responde")


def buscar_disco(art, alb):
    q = urllib.parse.quote(f"{art} {alb}")
    res = itunes(f"search?term={q}&entity=album&limit=50").get("results", [])
    k = norm(alb)
    cands = sorted(
        (x for x in res if x.get("artworkUrl100") and x.get("collectionName")
         and mismo_artista(x.get("artistName", ""), art)
         and not NO_ROCK.search(norm(x.get("primaryGenreName", "")))),
        key=lambda x: x["collectionId"])
    for x in cands:
        if norm(limpiar_titulo(x["collectionName"])).startswith(k):
            return x
    return None


def temas_de(ids):
    """Temas de varios discos en una sola consulta. Devuelve {id: [[tema, número, disco, preview], ...]}."""
    r = itunes("lookup?id=" + ",".join(map(str, ids)) + "&entity=song&limit=200")
    por = {i: [] for i in ids}
    for x in r.get("results", []):
        if x.get("wrapperType") == "track" and x.get("trackName") and x.get("collectionId") in por:
            por[x["collectionId"]].append(x)
    out = {}
    for i, xs in por.items():
        xs.sort(key=lambda x: (x.get("discNumber") or 1, x.get("trackNumber") or 0))
        vistos, temas = set(), []
        for x in xs:
            t = limpiar_tema(x["trackName"]); k = norm(t)
            if not k or k in vistos:
                continue
            vistos.add(k)
            temas.append([t, x.get("trackNumber") or 0, x.get("discNumber") or 1, x.get("previewUrl")])
        out[i] = temas
    return out


def main():
    todo = "--todo" in sys.argv
    try:
        previo = json.load(open(SALIDA, encoding="utf-8"))
    except (OSError, ValueError):
        previo = {}
    discos = {} if todo else dict(previo.get("discos", {}))
    catalogo = leer_catalogo()
    claves = [f"{d[0]}|{d[1]}" for d in catalogo]
    pendientes = [d for d in catalogo if f"{d[0]}|{d[1]}" not in discos]
    print(f"Catálogo: {len(catalogo)} discos. A buscar: {len(pendientes)}.", flush=True)

    nuevos = {}
    for n, (art, alb, *_ ) in enumerate(pendientes, 1):
        x = buscar_disco(art, alb)
        estado = "ok" if x else "NO ESTÁ"
        print(f"[{n}/{len(pendientes)}] {art} — {alb}: {estado}", flush=True)
        if x:
            nuevos[f"{art}|{alb}"] = {
                "id": x["collectionId"], "a": x.get("artistName", art),
                "url": x["artworkUrl100"].replace("100x100bb", "600x600bb"),
                "temas": [],
            }

    # Temas de a 5 discos por consulta; si alguno vuelve vacío, se pide solo
    items = list(nuevos.items())
    for i in range(0, len(items), 5):
        lote = items[i:i + 5]
        res = temas_de([v["id"] for _, v in lote])
        for k, v in lote:
            v["temas"] = res.get(v["id"], [])
            if not v["temas"]:
                v["temas"] = temas_de([v["id"]]).get(v["id"], [])
        print(f"Temas: {min(i + 5, len(items))}/{len(items)}", flush=True)

    discos.update(nuevos)
    discos = {k: discos[k] for k in claves if k in discos}   # saca lo que ya no está en el catálogo
    faltan = [k for k in claves if k not in discos]
    salida = {"generado": datetime.now(timezone.utc).strftime("%Y-%m-%d"), "discos": discos, "faltan": faltan}
    with open(SALIDA, "w", encoding="utf-8") as f:
        json.dump(salida, f, ensure_ascii=False, separators=(",", ":"))
    print(f"Listo: {len(discos)} discos guardados, {len(faltan)} no están en iTunes.")
    for k in faltan:
        print("  falta:", k)


if __name__ == "__main__":
    main()
