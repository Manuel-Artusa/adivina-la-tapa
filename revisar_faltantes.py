"""Revisión de los discos nacionales que no se encontraron: para cada uno muestra lo más parecido que hay en iTunes
(toda la discografía de la banda en las tiendas ar/us/mx/es y la búsqueda directa), y por qué no entró.
Escribe revision_faltantes.json. Uso: python revisar_faltantes.py"""
import json, difflib, urllib.parse
import armar_discos as A

cat = [c for c in A.leer_catalogo(True) if c[1] and c[3] == "nac"]
disc = json.load(open(A.SALIDA, encoding="utf-8"))["discos"]
manual = json.load(open(A.MANUAL, encoding="utf-8")) if __import__("os").path.exists(A.MANUAL) else {}
falt = [c for c in cat if f"{c[0]}|{c[1]}" not in disc and f"{c[0]}|{c[1]}" not in manual]
print(f"{len(falt)} discos nacionales sin encontrar", flush=True)
out = []
for i, (art, alb, *_r) in enumerate(falt, 1):
    vistos = {}
    for pais in A.PAISES:
        for nombre in [art] + A.ALIAS.get(art, []):
            for x in A.discos_del_artista(nombre, pais):
                vistos.setdefault(x["collectionId"], (x, pais))
    for pais in A.PAISES[:2]:
        q = urllib.parse.quote(f"{art} {alb}")
        for x in A.itunes(f"search?term={q}&entity=album&limit=50&country={pais}").get("results", []):
            if x.get("artworkUrl100"):
                vistos.setdefault(x["collectionId"], (x, pais))
    cands = []
    for x, pais in vistos.values():
        t = x.get("collectionName", "")
        s = difflib.SequenceMatcher(None, A.norm(alb), A.norm(A.limpiar_titulo(t))).ratio()
        motivo = []
        if not A.mismo_artista(x.get("artistName", ""), art): motivo.append("otro artista")
        if not A.es_rock(x): motivo.append("género " + x.get("primaryGenreName", ""))
        if not A.titulo_coincide(alb, t): motivo.append("título distinto")
        cands.append({"s": round(s, 2), "titulo": t, "artista": x.get("artistName", ""), "anio": x.get("releaseDate", "")[:4],
                      "pais": pais, "temas": x.get("trackCount"), "genero": x.get("primaryGenreName", ""),
                      "url": x.get("collectionViewUrl", "").split("?")[0], "motivo": motivo})
    cands.sort(key=lambda c: -c["s"])
    arts = sorted({c["artista"] for c in cands if A.mismo_artista(c["artista"], art)})
    out.append({"disco": f"{art}|{alb}", "anio": _r[0] if _r else None, "discos_de_la_banda": sum(A.mismo_artista(c["artista"], art) for c in cands),
                "nombres_en_itunes": arts, "parecidos": cands[:5]})
    print(f"\n{i}/{len(falt)} {art} — {alb}  ({out[-1]['discos_de_la_banda']} discos de la banda en iTunes)", flush=True)
    for c in cands[:4]:
        print(f"   {c['s']:.2f}  {c['titulo']} · {c['artista']} · {c['anio']} · {c['pais']} · {c['temas']} temas · {', '.join(c['motivo']) or 'OK'}  {c['url']}", flush=True)
json.dump(out, open("revision_faltantes.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
