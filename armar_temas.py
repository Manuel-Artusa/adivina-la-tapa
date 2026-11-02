"""Arma la carpeta temas/: un archivo por banda con sus temas más escuchados en iTunes (la misma búsqueda que
hace el Ahorcado rockero desde el navegador). Así el juego no depende de que iTunes conteste en el celular.
Cada archivo trae "desde" (el día a partir del cual vale la lista nueva) y "antes" (la lista anterior), para que
una actualización a mitad del día no cambie el desafío de hoy. Lo corre la tarea "Armar discos.json".
Uso: python armar_temas.py
"""
import json
import os
import re
import unicodedata
import urllib.parse
from datetime import datetime, timedelta, timezone

from armar_discos import itunes, leer_catalogo, limpiar_tema

CARPETA = "temas"


def norm_js(s):
    # igual que norm() de index.html, para comparar el nombre del artista como lo hace la página
    s = unicodedata.normalize("NFD", str(s).lower())
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    s = re.sub(r"[^a-z0-9 ]", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def archivo(banda):
    return os.path.join(CARPETA, norm_js(banda).replace(" ", "-") + ".json")


def fila(x):
    # solo lo que usa la página: tema, disco, fecha y tapa
    return [x["trackName"], x.get("collectionName", ""), x.get("releaseDate", "")[:10], x.get("artworkUrl100", "")]


def de_la_banda(r, banda):
    return [x for x in r.get("results", [])
            if x.get("wrapperType") == "track" and x.get("trackName") and norm_js(x.get("artistName", "")) == norm_js(banda)]


# Discos de cada banda ya encontrados (discos.json): de ahí sale qué artista de iTunes es la banda, así la lista
# no trae a otro con el mismo nombre (Manal, Massacre, V8 y Riff traían a artistas de afuera)
DISCOS_BANDA = {}
try:
    for k, v in json.load(open("discos.json", encoding="utf-8")).get("discos", {}).items():
        if v.get("id"):
            DISCOS_BANDA.setdefault(k.split("|")[0], []).append((v["id"], v.get("pais") or "us"))
except (OSError, ValueError):
    pass


def artista_real(banda):
    """El id de artista de iTunes de la banda: el que más se repite entre (hasta) 4 de sus discos."""
    cuenta = {}
    for cid, pais in DISCOS_BANDA.get(banda, [])[:4]:
        r = itunes(f"lookup?id={cid}&country={pais}").get("results", [])
        if r and r[0].get("artistId"):
            cuenta[r[0]["artistId"]] = cuenta.get(r[0]["artistId"], 0) + 1
    return max(cuenta, key=cuenta.get) if cuenta else None


def sin_repetir(ts):
    vistos, out = set(), []
    for x in ts:
        k = norm_js(limpiar_tema(x["trackName"]))
        if k not in vistos:
            vistos.add(k); out.append(x)
    return out


def temas(banda):
    try:
        aid = artista_real(banda)
    except RuntimeError:
        aid = None
    # con el id de artista se aceptan solo sus temas; sin él (banda sin discos encontrados), por el nombre
    de_ella = (lambda r: [x for x in de_la_banda(r, banda) if x.get("artistId") == aid]) if aid else (lambda r: de_la_banda(r, banda))
    base = f"search?term={urllib.parse.quote(banda)}&media=music&entity=song&country=ar&limit=60"
    r = itunes(base + "&attribute=artistTerm")
    if not de_ella(r):
        r = itunes(base)
    ts = de_ella(r)
    # si la búsqueda trae pocos temas de la banda, se piden al perfil del artista (los más escuchados)
    if len(ts) < 10 and aid:
        for pais in ["ar", "us"]:
            otros = de_ella(itunes(f"lookup?id={aid}&entity=song&limit=60&country={pais}"))
            if len(otros) > len(ts):
                ts = sin_repetir(otros)
            if len(ts) >= 10:
                break
    return [fila(x) for x in ts]


def main():
    os.makedirs(CARPETA, exist_ok=True)
    manana = (datetime.now(timezone(timedelta(hours=-3))) + timedelta(days=1)).strftime("%Y-%m-%d")
    bandas = sorted({d[0] for d in leer_catalogo(True)})
    nuevos = cambiados = 0
    for i, b in enumerate(bandas, 1):
        try:
            ts = temas(b)
        except RuntimeError:
            ts = []
        f = archivo(b)
        try:
            previo = json.load(open(f, encoding="utf-8"))
        except (OSError, ValueError):
            previo = None
        print(f"{i}/{len(bandas)} {b}: {len(ts)} temas", flush=True)
        if not ts or (previo and previo.get("r") == ts):
            continue  # sin respuesta o sin cambios: queda como estaba
        if previo:
            # si la lista vigente todavía no arrancó (otra corrida de hoy), se reemplaza sin tocar "antes"
            antes = previo.get("antes") if previo.get("desde", "") >= manana else previo.get("r")
            cambiados += 1
        else:
            antes = None
            nuevos += 1
        dato = {"banda": b, "desde": manana, "r": ts}
        if antes:
            dato["antes"] = antes
        with open(f, "w", encoding="utf-8") as fh:
            json.dump(dato, fh, ensure_ascii=False, separators=(",", ":"))
    print(f"Listo: {nuevos} bandas nuevas y {cambiados} actualizadas en {CARPETA}/ (valen desde {manana})")


if __name__ == "__main__":
    main()
