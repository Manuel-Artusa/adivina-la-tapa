"""Arma discos.json: para cada disco del catálogo (la lista DISCOS de index.html)
guarda su id de iTunes, la tapa y la lista de temas con el fragmento de audio.

Así el juego no tiene que buscar en iTunes cada vez: carga más rápido, no se traba
por el límite de consultas de iTunes y el desafío del día es igual para todos.

Uso:
  python armar_discos.py          -> busca solo los discos nuevos (los que no están en discos.json)
  python armar_discos.py --todo   -> vuelve a buscar todo (tarda unos 30-60 minutos)

Busca en las tiendas de iTunes de EE.UU., Argentina, México y España, por nombre del disco
y por discografía completa de la banda. Si igual un disco no aparece, se puede cargar a mano
en discos_manual.json con su link de Apple Music:
  {"Sumo|Divididos por la felicidad": "https://music.apple.com/ar/album/divididos-por-la-felicidad/123456789"}

Solo usa la librería estándar de Python. Lo corre GitHub Actions (.github/workflows/discos.yml),
pero también se puede correr a mano.
"""
import json, os, re, sys, time, unicodedata, urllib.parse, urllib.request, urllib.error
from datetime import datetime, timezone

PAUSA = 3.2          # segundos entre consultas (iTunes permite ~20 por minuto)
SALIDA = "discos.json"

FUERA = re.compile(r"vivo|live|grandes|lo mejor|exitos|single|\bep\b|acustico|unplugged|antologia|coleccion|collection|greatest|hits|best of|karaoke|tributo|tribute|remix")
NO_ROCK = re.compile(r"cumbia|tropical|salsa|reggaeton|urban|regional|mexican|bachata|merengue|cuarteto|folklor|christian|cristian|gospel|infantil|children|nino|ranchera|bolero|tango|vallenato|banda|electronica|dance|hip hop|rap|jazz|clasica|classical|soundtrack|comedia")
EXTRA_TITULO = re.compile(r"\s*[\(\[][^\)\]]*(remaster|deluxe|edition|edicion|edición|version|versión|bonus|expanded|anniversary|aniversario)[^\)\]]*[\)\]]", re.I)
EXTRA_TEMA_1 = re.compile(r"\s*[\(\[][^\)\]]*(vivo|live|remaster|versi[oó]n|version|demo|bonus|ac[uú]stic|edit|mix)[^\)\]]*[\)\]]", re.I)
EXTRA_TEMA_2 = re.compile(r"\s+-\s+(en vivo|live|remaster|demo|versi[oó]n).*$", re.I)


def norm(s):
    s = unicodedata.normalize("NFD", str(s).lower().replace("&", " y "))
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    s = re.sub(r"[^a-z0-9 ]", " ", s)
    s = re.sub(r"\b(volumen|volume|vol)\b", "vol", s)
    return re.sub(r"\s+", " ", s).strip()


def limpiar_titulo(t):
    return EXTRA_TITULO.sub("", t).strip()


def limpiar_tema(t):
    return EXTRA_TEMA_2.sub("", EXTRA_TEMA_1.sub("", str(t))).strip()


# Otros nombres con los que iTunes puede tener a una banda
ALIAS = {
    "Luis Alberto Spinetta": ["Pescado Rabioso", "Spinetta"],
    "Fito & Fitipaldis": ["Fito y Fitipaldis"],
    "Pappo's Blues": ["Pappo"],
    "Los Ratones Paranoicos": ["Ratones Paranoicos"],
}


def mismo_artista(nombre, art):
    a = norm(nombre)
    for alt in [art] + ALIAS.get(art, []):
        b = norm(alt)
        if a == b or a.startswith(b + " ") or b.startswith(a + " "):
            return True
    return False


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


PAISES = ["us", "ar", "mx", "es"]   # tiendas de iTunes donde buscar (muchos discos nacionales solo están en la de Argentina)
MANUAL = "discos_manual.json"       # discos que se cargan a mano: {"Artista|Disco": "link de Apple Music o id"}


def titulo_coincide(cat, itunes_titulo):
    """Compara el título del catálogo con el de iTunes, tolerando 'The', signos, 'Vol.', subtítulos, etc."""
    art_ = r"^(the|el|la|los|las) "
    a = re.sub(art_, "", norm(cat)); b = re.sub(art_, "", norm(limpiar_titulo(itunes_titulo)))
    if not a or not b:
        return False
    if a == b or b.startswith(a) or a.startswith(b + " "):
        return True
    ta, tb = set(a.split()), set(b.split())
    return len(ta & tb) / len(ta | tb) >= 0.75


def es_rock(x):
    return not NO_ROCK.search(norm(x.get("primaryGenreName", "")))


def con_pais(x, pais):
    x = dict(x); x["_pais"] = pais
    return x


albumes_artista = {}
def discos_del_artista(art, pais):
    """Todos los discos de la banda en esa tienda (buscando primero al artista). Se guarda para no repetir consultas."""
    k = (norm(art), pais)
    if k not in albumes_artista:
        q = urllib.parse.quote(art)
        arts = itunes(f"search?term={q}&entity=musicArtist&limit=10&country={pais}").get("results", [])
        ids = [a["artistId"] for a in arts if a.get("artistId") and mismo_artista(a.get("artistName", ""), art)][:3]
        out = []
        for i in ids:
            r = itunes(f"lookup?id={i}&entity=album&limit=200&country={pais}").get("results", [])
            out += [x for x in r if x.get("wrapperType") == "collection" and x.get("artworkUrl100")]
        albumes_artista[k] = out
    return albumes_artista[k]


def elegir(cands, art, alb):
    cands = sorted((x for x in cands if x.get("collectionName") and x.get("artworkUrl100")
                    and mismo_artista(x.get("artistName", ""), art) and es_rock(x)),
                   key=lambda x: (FUERA.search(norm(x["collectionName"])) is not None, x["collectionId"]))
    for x in cands:
        if titulo_coincide(alb, x["collectionName"]):
            return x
    return None


def buscar_disco(art, alb):
    q = urllib.parse.quote(f"{art} {alb}")
    # 1) búsqueda directa "banda disco" en cada tienda
    for pais in PAISES[:2]:
        x = elegir(itunes(f"search?term={q}&entity=album&limit=50&country={pais}").get("results", []), art, alb)
        if x:
            return con_pais(x, pais)
    # 2) toda la discografía de la banda en cada tienda
    for pais in PAISES:
        for nombre in [art] + ALIAS.get(art, []):
            x = elegir(discos_del_artista(nombre, pais), art, alb)
            if x:
                return con_pais(x, pais)
    # 3) búsqueda directa en las otras tiendas
    for pais in PAISES[2:]:
        x = elegir(itunes(f"search?term={q}&entity=album&limit=50&country={pais}").get("results", []), art, alb)
        if x:
            return con_pais(x, pais)
    return None


def buscar_manual(valor):
    """Disco cargado a mano: acepta el link de Apple Music (…/album/nombre/123456789) o el número solo."""
    m = re.search(r"(\d{6,})(?!.*\d{6,})", str(valor).split("?")[0])
    if not m:
        return None
    for pais in PAISES:
        r = [x for x in itunes(f"lookup?id={m.group(1)}&country={pais}").get("results", []) if x.get("artworkUrl100")]
        if r:
            return con_pais(r[0], pais)
    return None


def temas_de(ids, pais="us"):
    """Temas de varios discos en una sola consulta. Devuelve {id: [[tema, número, disco, preview], ...]}."""
    r = itunes("lookup?id=" + ",".join(map(str, ids)) + f"&entity=song&limit=200&country={pais}")
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

mb_ultima = 0.0
def mb_get(ruta):
    """Consulta a MusicBrainz (máximo 1 por segundo, con reintentos). Devuelve el JSON o None."""
    global mb_ultima
    url = "https://musicbrainz.org/ws/2/" + ruta
    for intento in range(4):
        espera = 1.2 - (time.time() - mb_ultima)
        if espera > 0:
            time.sleep(espera)
        mb_ultima = time.time()
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "JuegosRock/1.0 ( https://juegosrock.com.ar )", "Accept": "application/json"})
            with urllib.request.urlopen(req, timeout=30) as r:
                return json.loads(r.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return None
            print(f"   MusicBrainz respondió {e}. Reintento…", flush=True)
            time.sleep(10 * (intento + 1))
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as e:
            print(f"   MusicBrainz respondió {e}. Reintento…", flush=True)
            time.sleep(10 * (intento + 1))
    return None


def musicbrainz(art, alb):
    """Fecha de salida original del disco (AAAA-MM-DD, o AAAA si no se sabe el día) y el id del artista en MusicBrainz."""
    esc_ = lambda t: str(t).replace('\\', ' ').replace('"', ' ')
    q = urllib.parse.quote(f'releasegroup:"{esc_(alb)}" AND artist:"{esc_(art)}"')
    res = (mb_get(f"release-group?query={q}&fmt=json&limit=10") or {}).get("release-groups", [])
    cands = []
    for g in res:
        creditos = [c for c in g.get("artist-credit", []) if isinstance(c, dict)]
        mbid = next((c.get("artist", {}).get("id") for c in creditos
                     if mismo_artista(c.get("name", ""), art) or mismo_artista(c.get("artist", {}).get("name", ""), art)), None)
        if not mbid:
            continue
        if not titulo_coincide(alb, g.get("title", "")):
            continue
        f = g.get("first-release-date") or ""
        if not re.match(r"^\d{4}", f):
            continue
        cands.append((0 if g.get("primary-type") == "Album" else 1, -int(g.get("score", 0)), f, mbid))
    if not cands:
        return None, None
    cands.sort()
    return cands[0][2], cands[0][3]


def mb_discografia(mbid):
    """Discos de estudio de la banda en orden: [[título, año, id], ...]. Sin en vivo, compilados, EPs ni bandas sonoras."""
    out, offset = [], 0
    while True:
        r = mb_get(f"release-group?artist={mbid}&type=album&fmt=json&limit=100&offset={offset}")
        if not r:
            break
        for g in r.get("release-groups", []):
            anio = (g.get("first-release-date") or "")[:4]
            if g.get("primary-type") != "Album" or g.get("secondary-types") or not anio.isdigit():
                continue
            out.append([g.get("title", ""), int(anio), g.get("id", "")])
        offset += 100
        if offset >= r.get("release-group-count", 0):
            break
    out.sort(key=lambda x: (x[1], x[0]))
    return out


def mb_banda(mbid):
    """Datos de la banda para el juego La banda del día: país, banda o solista, año en que arrancó y si sigue."""
    a = mb_get(f"artist/{mbid}?fmt=json")
    if not a:
        return None
    vida = a.get("life-span") or {}
    inicio = (vida.get("begin") or "")[:4]
    pais = a.get("country") or ""
    if not pais:
        area = a.get("area") or {}
        codigos = area.get("iso-3166-1-codes") or []
        pais = codigos[0] if codigos else ""
    return {
        "mbid": mbid,
        "pais": pais,
        "tipo": "solista" if a.get("type") == "Person" else "banda",
        "inicio": int(inicio) if inicio.isdigit() else None,
        "sigue": not vida.get("ended", False),
        "discografia": mb_discografia(mbid),
    }


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

    try:
        manual = json.load(open(MANUAL, encoding="utf-8"))
    except (OSError, ValueError):
        manual = {}

    nuevos = {}
    for n, (art, alb, *_ ) in enumerate(pendientes, 1):
        k = f"{art}|{alb}"
        x = buscar_manual(manual[k]) if manual.get(k) else None
        x = x or buscar_disco(art, alb)
        estado = f"ok ({x['_pais']}) {x['collectionName']}" if x else "NO ESTÁ"
        print(f"[{n}/{len(pendientes)}] {art} — {alb}: {estado}", flush=True)
        if x:
            nuevos[k] = {
                "id": x["collectionId"], "a": x.get("artistName", art),
                "url": x["artworkUrl100"].replace("100x100bb", "600x600bb"),
                "pais": x["_pais"], "temas": [],
            }

    # Temas de a 5 discos por consulta (de la misma tienda); si alguno vuelve vacío, se pide solo
    items = list(nuevos.items())
    hechos = 0
    for pais in PAISES:
        grupo = [kv for kv in items if kv[1]["pais"] == pais]
        for i in range(0, len(grupo), 5):
            lote = grupo[i:i + 5]
            res = temas_de([v["id"] for _, v in lote], pais)
            for k, v in lote:
                v["temas"] = res.get(v["id"], [])
                if not v["temas"]:
                    v["temas"] = temas_de([v["id"]], pais).get(v["id"], [])
            hechos += len(lote)
            print(f"Temas: {hechos}/{len(items)}", flush=True)

    discos.update(nuevos)
    discos = {k: discos[k] for k in claves if k in discos}   # saca lo que ya no está en el catálogo

    # Fecha de salida de cada disco (para los posts de "un día como hoy"). Se busca una sola vez por disco.
    viejos = previo.get("discos", {})
    for k, v in discos.items():
        for campo in ("fecha", "mbid"):
            if campo not in v and campo in viejos.get(k, {}):
                v[campo] = viejos[k][campo]
    sin_fecha = [k for k, v in discos.items() if "fecha" not in v or "mbid" not in v]
    print(f"Fechas a buscar en MusicBrainz: {len(sin_fecha)}", flush=True)
    for n, k in enumerate(sin_fecha, 1):
        art, alb = k.split("|", 1)
        f, mbid = musicbrainz(art, alb)
        if f or "fecha" not in discos[k]:
            discos[k]["fecha"] = f or discos[k].get("fecha", "")
        discos[k]["mbid"] = mbid or ""
        print(f"[{n}/{len(sin_fecha)}] {art} — {alb}: {f or 'sin fecha'}", flush=True)

    # Datos de cada banda (para La banda del día). El artista sale de sus discos en MusicBrainz.
    bandas_previas = {} if todo else previo.get("bandas", {})
    bandas = {}
    por_banda = {}
    for k, v in discos.items():
        if v.get("mbid"):
            por_banda.setdefault(k.split("|", 1)[0], []).append(v["mbid"])
    print(f"Bandas a revisar: {len(por_banda)}", flush=True)
    for art, ids in sorted(por_banda.items()):
        mbid = max(set(ids), key=ids.count)
        b = bandas_previas.get(art)
        if not b or b.get("mbid") != mbid or "discografia" not in b:
            b = mb_banda(mbid)
            print(f"   {art}: {b}", flush=True)
        if b:
            bandas[art] = b
    faltan = [k for k in claves if k not in discos]
    salida = {"generado": datetime.now(timezone.utc).strftime("%Y-%m-%d"), "discos": discos, "bandas": bandas, "faltan": faltan}
    with open(SALIDA, "w", encoding="utf-8") as f:
        json.dump(salida, f, ensure_ascii=False, separators=(",", ":"))
    print(f"Listo: {len(discos)} discos guardados, {len(faltan)} no están en iTunes.")
    for k in faltan:
        print("  falta:", k)
    # Resumen en la página de la tarea de GitHub (pestaña Summary)
    resumen = os.environ.get("GITHUB_STEP_SUMMARY")
    if resumen:
        with open(resumen, "a", encoding="utf-8") as f:
            f.write(f"## discos.json\n\n{len(discos)} discos guardados · {len(faltan)} no encontrados\n\n")
            if faltan:
                f.write("Para cargar uno a mano, agregalo a `discos_manual.json` con su link de Apple Music.\n\n")
                f.write("```\n" + "\n".join(faltan) + "\n```\n")


if __name__ == "__main__":
    main()
