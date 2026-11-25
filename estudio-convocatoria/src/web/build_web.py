#!/usr/bin/env python3
"""Arma ../../resumen-interactivo.html (página interactiva del resumen).

Reutiliza el contenido de los PDF: preguntas del examen pasado (05-resumen.md),
tarjetas y preguntas relámpago (07-guia.md) y las fichas de temas (web/temas-*.md).
"""
import html
import json
import pathlib
import re
import sys

import markdown

WEB = pathlib.Path(__file__).resolve().parent
SRC = WEB.parent
sys.path.insert(0, str(SRC))
import build  # noqa: E402


def web_svg_block(name: str, caption: str | None) -> str:
    """Diagrama sobre una 'lámina' clara con scroll horizontal en el celular."""
    label = html.escape(caption or name, quote=True)
    svg = build.svg_markup(name).replace("<svg ", f'<svg role="img" aria-label="{label}" ', 1)
    cap = ""
    if caption:
        es, _, en = caption.partition(" · ")
        cap = f'<figcaption>{es}{f" · <span class=\"en-t\">{en}</span>" if en else ""}</figcaption>'
    return f'\n<figure class="plate">\n<div class="plate-scroll">\n{svg}\n</div>\n{cap}\n</figure>\n'


build.svg_block = web_svg_block


def md_html(text: str) -> str:
    md = markdown.Markdown(extensions=["tables", "md_in_html", "attr_list", "sane_lists"])
    out = md.convert(build.preprocess(text))
    out = out.replace("<table>", '<div class="table-scroll"><table>').replace("</table>", "</table></div>")
    return out


def inline_md(text: str) -> str:
    out = markdown.markdown(text.strip())
    return re.sub(r"^<p>(.*)</p>$", r"\1", out, flags=re.S)


def split_title(line: str) -> tuple[str, str]:
    m = re.match(r'^#+\s*(.*?)\s*<span class="en">·\s*(.*?)</span>', line)
    return (m.group(1), m.group(2)) if m else (line.lstrip("# ").strip(), "")


def tag_list(text: str) -> list[dict]:
    return [{"k": k, "t": html.escape(t, quote=False)} for k, t in re.findall(r"\{\{(\w+):(.*?)\}\}", text)]


def status_of(tags: list[dict]) -> str:
    kinds = {t["k"] for t in tags}
    if "bad" in kinds:
        return "bad"
    if "note" in kinds:
        return "review"
    if "ok" in kinds:
        return "partial"
    return "good"


def parse_exam() -> list[dict]:
    src = (SRC / "content/05-resumen.md").read_text(encoding="utf-8")
    lines = src[src.index("# Geología I ·"):].split("\n")
    parts: list[dict] = []
    part = None
    sub = None
    i = 0
    while i < len(lines):
        line = lines[i]
        s = line.strip()
        if s.startswith("# "):
            es, en = split_title(s)
            part = {"exam": "geo" if es.startswith("Geología") else "cell", "es": es, "en": en, "items": [], "notes": []}
            parts.append(part)
            sub = None
        elif s.startswith("## ") and part:
            es, en = split_title(s)
            sub = f"{es} · {en}" if en else es
        elif s.startswith(":::") and part and s not in (":::", ":::div geo", ":::div cell"):
            depth, block = 1, []
            i += 1
            while i < len(lines):
                t = lines[i].strip()
                if t == ":::":
                    depth -= 1
                    if depth == 0:
                        break
                elif t.startswith(":::") and t != ":::en":
                    depth += 1
                block.append(lines[i])
                i += 1
            if s == ":::div q":
                head = next(b for b in block if b.strip())
                rest = block[block.index(head) + 1:]
                m = re.match(r"^\*\*(\d+)\.\*\*\s*(.*?)\s*(\{\{.*)?$", head.strip())
                tags = tag_list(m.group(3) or "")
                part["items"].append({
                    "n": m.group(1), "sub": sub, "q": inline_md(m.group(2)), "tags": tags,
                    "status": status_of(tags), "body": md_html("\n".join(rest)),
                })
            else:
                part["notes"].append(md_html("\n".join([s] + block + [":::"])))
        elif s.startswith("|") and part:
            rows = []
            while i < len(lines) and lines[i].strip().startswith("|"):
                rows.append([c.strip() for c in lines[i].strip().strip("|").split("|")])
                i += 1
            i -= 1
            for n, r in enumerate(rows[2:], start=1):
                yours, correct = r[1], r[2]
                ok = "✓" in yours
                tags = [{"k": "good" if ok else "bad", "t": f"Tú: {yours}"}, {"k": "good", "t": f"Correcta: {inline_md(correct)}"}]
                clue = f'<p class="clue">Pista · Clue: {inline_md(r[3])}</p>' if len(r) > 3 else ""
                part["items"].append({
                    "n": str(n), "sub": sub, "q": inline_md(r[0]), "tags": tags,
                    "status": "good" if ok else "bad", "body": clue or '<p class="clue">Pareo · Matching</p>',
                })
        i += 1
    return parts


def table_rows(section: str) -> list[list[str]]:
    rows = [[c.strip() for c in l.strip().strip("|").split("|")] for l in section.split("\n") if l.strip().startswith("|")]
    return [r for r in rows if not set("".join(r)) <= set("-: ")][1:]


def parse_guide() -> tuple[list[dict], list[dict]]:
    src = (SRC / "content/07-guia.md").read_text(encoding="utf-8")
    vocab = src[src.index("# 5. Tarjetas"):src.index("# 6. Plantillas")]
    geo = vocab[vocab.index("## Geología"):vocab.index("## La Célula")]
    cell = vocab[vocab.index("## La Célula"):]
    flash = [{"exam": ex, "es": inline_md(r[0]), "en": inline_md(r[1]), "def": inline_md(r[2])}
             for ex, sec in (("geo", geo), ("cell", cell)) for r in table_rows(sec)]
    qs = src[src.index("# 9. Preguntas relámpago"):src.index("# 10.")]
    quick = [{"q": inline_md(r[1]), "a": inline_md(r[2])} for r in table_rows(qs)]
    return flash, quick


SCORES = [
    {"key": "geo", "icon": "🌋", "name": "Geología", "total": "22.5 / 50 · 45 %", "parts": [
        {"es": "Selección única", "en": "Multiple choice", "pts": 13, "max": 22, "lost": "Fallaste: ondas S, xenolitos, raya, granito, fósiles, meteorización y rotación de cultivos."},
        {"es": "Pareo", "en": "Matching", "pts": 2, "max": 9, "lost": "Fallaste: núcleo externo, manto y los 5 horizontes del suelo."},
        {"es": "Respuesta corta", "en": "Short answer", "pts": 5, "max": 11, "lost": "Fallaste: campo magnético, corteza oceánica/continental y características de un mineral."},
        {"es": "Pensamiento crítico", "en": "Critical thinking", "pts": 2.5, "max": 8, "lost": "Fallaste: prácticas de conservación y el proceso del volcán."},
    ]},
    {"key": "cell", "icon": "🦠", "name": "La Célula", "total": "23 / 50 · 46 %", "parts": [
        {"es": "Selección única", "en": "Multiple choice", "pts": 16, "max": 22, "lost": "Fallaste: paramecio vs. humano, célula animal, inmunidad de rebaño, gemación y 2 de la pág. 6."},
        {"es": "Pareo de organelos", "en": "Organelle matching", "pts": 1, "max": 8, "lost": "Solo acertaste el cloroplasto."},
        {"es": "Respuesta corta", "en": "Short answer", "pts": 2, "max": 7, "lost": "Fallaste: 3 postulados, diferencia planta/animal y fisión binaria vs. fragmentación."},
        {"es": "Escritura", "en": "Writing", "pts": 4, "max": 13, "lost": "Fallaste: asexual vs. sexual, ciclos de los virus y papel de los microorganismos."},
    ]},
]

IDEAS = [
    ("Los <b>8 organelos</b> y su función (1/8 en el pareo)", "The 8 organelles and their functions", "celula:organelos"),
    ("Los <b>3 postulados</b> de la teoría celular", "The 3 postulates of the cell theory", "celula:teoria"),
    ("Los horizontes del suelo <b>O-A-B-C-R</b> (0/5)", "Soil horizons O-A-B-C-R", "geologia:suelo"),
    ("Núcleo <b>externo = líquido</b> → campo magnético; <b>interno = sólido</b>", "Outer core liquid → magnetic field; inner core solid", "geologia:capas"),
    ("Corteza <b>oceánica 5 km</b> / <b>continental 70 km</b>", "Oceanic crust 5 km / continental 70 km", "geologia:capas"),
    ("<b>Características</b> de un mineral ≠ propiedades (raya, brillo)", "Mineral characteristics ≠ properties", "geologia:minerales"),
    ("<b>Raya</b> = color del polvo", "Streak = color of the powder", "geologia:minerales"),
    ("Ígnea <b>intrusiva = granito</b>, cristales grandes", "Intrusive igneous = granite, large crystals", "geologia:rocas"),
    ("Meteorización <b>mecánica</b> (hielo) vs. <b>química</b> (ácido)", "Mechanical (ice) vs. chemical (acid) weathering", "geologia:meteorizacion"),
    ("<b>Prácticas de conservación</b> del suelo", "Soil conservation practices", "geologia:suelo"),
    ("Por qué <b>asexual / sexual</b> según el ambiente; <b>lítico vs. lisogénico</b>", "Asexual/sexual and environment; lytic vs. lysogenic", "celula:reproduccion"),
    ("<b>Papel</b> de los microorganismos en ecosistemas y salud", "Role of microorganisms in ecosystems and health", "celula:papel"),
]


def main() -> None:
    flash, quick = parse_guide()
    data = {
        "scores": SCORES,
        "ideas": [{"es": es, "en": en, "go": go} for es, en, go in IDEAS],
        "parts": parse_exam(),
        "flash": flash,
        "quick": quick,
    }
    page = (WEB / "template.html").read_text(encoding="utf-8")
    page = page.replace("{{GEO}}", md_html((WEB / "temas-geo.md").read_text(encoding="utf-8")))
    page = page.replace("{{CELL}}", md_html((WEB / "temas-cell.md").read_text(encoding="utf-8")))
    page = page.replace("{{DATA}}", json.dumps(data, ensure_ascii=False).replace("</", "<\\/"))
    out = SRC.parent / "resumen-interactivo.html"
    out.write_text(page, encoding="utf-8")
    n_items = sum(len(p["items"]) for p in data["parts"])
    print(f"[web] {out} · {n_items} preguntas · {len(flash)} tarjetas · {len(quick)} relámpago · {len(page) // 1024} KB")


if __name__ == "__main__":
    main()
