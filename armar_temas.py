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

from armar_discos import itunes, leer_catalogo

CARPETA = "temas"


def norm_js(s):
    # igual que norm() de index.html, para comparar el nombre del artista como lo hace la página
    s = unicodedata.normalize("NFD", str(s).lower())
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    s = re.sub(r"[^a-z0-9 ]", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def archivo(banda):
    return os.path.join(CARPETA, norm_js(banda).replace(" ", "-") + ".json")


def temas(banda):
    base = f"search?term={urllib.parse.quote(banda)}&media=music&entity=song&country=ar&limit=60"
    r = itunes(base + "&attribute=artistTerm")
    if not any(norm_js(x.get("artistName", "")) == norm_js(banda) for x in r.get("results", [])):
        r = itunes(base)
    # solo lo que usa la página: tema, disco, fecha y tapa, de los temas de esa banda (en el orden de iTunes)
    return [[x["trackName"], x.get("collectionName", ""), x.get("releaseDate", "")[:10], x.get("artworkUrl100", "")]
            for x in r.get("results", [])
            if x.get("wrapperType") == "track" and x.get("trackName") and norm_js(x.get("artistName", "")) == norm_js(banda)]


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
