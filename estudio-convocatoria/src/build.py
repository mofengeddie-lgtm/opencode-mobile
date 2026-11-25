#!/usr/bin/env python3
"""Convierte los archivos de content/*.md en HTML listo para imprimir a PDF.

Sintaxis extra (además de Markdown normal):
  :::bi            abre un bloque bilingüe (columna español)
  :::en            pasa a la columna en inglés
  :::box KIND T    caja de color (tip, warn, memo, exam, key) con título T
  :::div CLASES    contenedor genérico
  :::              cierra el último bloque abierto
  [[svg nombre|pie]]  inserta svg/nombre.svg
  [[pb]]           salto de página
  {{bad:texto}}    etiqueta (bad, good, ok, note, es, en)
"""
import html
import pathlib
import re
import sys

import markdown

ROOT = pathlib.Path(__file__).resolve().parent
CONTENT = ROOT / "content"
SVG_DIR = ROOT / "svg"
BUILD = ROOT / "build"

TAGS = {"bad", "good", "ok", "note", "es", "en"}


def svg_markup(name: str) -> str:
    svg = (SVG_DIR / f"{name}.svg").read_text(encoding="utf-8")
    svg = re.sub(r"<\?xml.*?\?>", "", svg)
    return "\n".join(line for line in svg.splitlines() if line.strip())


def svg_block(name: str, caption: str | None) -> str:
    cap = f"<figcaption>{caption}</figcaption>" if caption else ""
    return f'\n<figure class="fig">\n{svg_markup(name)}\n{cap}\n</figure>\n'


def inline_tags(text: str) -> str:
    def repl(m: re.Match) -> str:
        kind = m.group(1) if m.group(1) in TAGS else "note"
        return f'<span class="tag {kind}">{m.group(2)}</span>'

    return re.sub(r"\{\{(\w+):(.*?)\}\}", repl, text)


def inline_md(text: str) -> str:
    text = html.escape(text, quote=False)
    text = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", text)
    return re.sub(r"\*(.+?)\*", r"<em>\1</em>", text)


def preprocess(src: str) -> str:
    out: list[str] = []
    stack: list[str] = []
    for line in src.split("\n"):
        s = line.strip()
        if s.startswith(":::"):
            body = s[3:].strip()
            if not body:
                kind = stack.pop()
                out.append("\n</div>\n</div>\n" if kind == "bi" else "\n</div>\n")
                continue
            name, _, rest = body.partition(" ")
            if name == "en":
                out.append('\n</div>\n<div class="en" markdown="1">\n')
            elif name == "bi":
                stack.append("bi")
                extra = f" {rest}" if rest else ""
                out.append(f'\n<div class="bi{extra}" markdown="1">\n<div class="es" markdown="1">\n')
            elif name == "box":
                kind, _, title = rest.partition(" ")
                stack.append("box")
                t = f'<p class="box-title">{inline_md(title)}</p>\n' if title else ""
                out.append(f'\n<div class="box {kind}" markdown="1">\n{t}\n')
            else:
                stack.append("div")
                out.append(f'\n<div class="{rest}" markdown="1">\n')
            continue
        m = re.match(r"^\[\[svg ([\w-]+)(?:\|(.*))?\]\]$", s)
        if m:
            out.append(svg_block(m.group(1), m.group(2)))
            continue
        if s == "[[pb]]":
            out.append('\n<div class="pb"></div>\n')
            continue
        out.append(line)
    if stack:
        raise SystemExit(f"Bloques sin cerrar: {stack}")
    return inline_tags("\n".join(out))


def parse_front(src: str) -> tuple[dict, str]:
    meta: dict[str, str] = {}
    if src.startswith("---\n"):
        head, _, src = src[4:].partition("\n---\n")
        for line in head.splitlines():
            key, _, value = line.partition(":")
            meta[key.strip()] = value.strip()
    return meta, src


def cover(meta: dict) -> str:
    if not meta.get("title"):
        return ""
    if meta.get("cover") == "mini":
        return (
            f'<header class="mini-cover"><div class="cover-kicker">{meta.get('kicker', '')}</div>'
            f'<h1 class="cover-title">{meta['title']} <span class="en">{meta.get('title_en', '')}</span></h1>'
            f'<p class="cover-sub">{meta.get('subtitle', '')} · 📅 Examen / Test: jueves 4 de diciembre de 2026</p></header>'
        )
    title_en = meta.get("title_en", "")
    en = f'<span class="en">{title_en}</span>' if title_en else ""
    legend = (
        '<div class="cover-legend"><b>Cómo leer este documento · How to read this document</b><br>'
        "Cada explicación está en <b style=\"color:var(--es)\">ESPAÑOL</b> (izquierda) y "
        "<b style=\"color:var(--en)\">ENGLISH</b> (derecha) al mismo tiempo. El examen es en inglés: "
        "aprende las palabras en <b>negrita</b> en los dos idiomas.<br>"
        "<i>Each explanation is in Spanish (left) and English (right) at the same time. "
        "The test is in English: learn the <b>bold</b> words in both languages.</i></div>"
    )
    return f"""
<section class="cover">
  <div class="cover-kicker">{meta.get('kicker', '')}</div>
  <h1 class="cover-title">{meta['title']}{en}</h1>
  <p class="cover-sub">{meta.get('subtitle', '')}</p>
  <div class="cover-chips">
    <span class="chip geo">🌋 Geología · Geology</span>
    <span class="chip cell">🦠 La Célula · The Cell</span>
  </div>
  <div class="cover-meta">📅 <b>Examen / Test:</b> jueves 4 de diciembre de 2026 · Thursday, December 4, 2026</div>
  <div class="cover-meta">🎓 Ciencias · Science — 7.º grado · 7th grade — Make-up Science Test</div>
  {legend}
</section>"""


def toc(md: markdown.Markdown) -> str:
    items = [
        f'<li><a href="#{t["id"]}">{t["name"]}</a></li>'
        for t in md.toc_tokens
        if t["level"] == 1
    ]
    if not items:
        return ""
    return (
        '<section class="toc"><h1>Contenido <span class="en">· Contents</span></h1>'
        f'<ol>{"".join(items)}</ol></section>'
    )


def build(name: str) -> pathlib.Path:
    src = (CONTENT / f"{name}.md").read_text(encoding="utf-8")
    meta, body = parse_front(src)
    md = markdown.Markdown(
        extensions=["tables", "md_in_html", "attr_list", "sane_lists", "toc"],
        extension_configs={"toc": {"toc_depth": "1"}},
    )
    content = md.convert(preprocess(body))
    toc_html = toc(md) if meta.get("toc") == "yes" else ""
    theme = meta.get("theme", "plan")
    page = f"""<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>{meta.get('title', name)}</title>
<link rel="stylesheet" href="../style.css">
</head>
<body class="{theme}">
{cover(meta)}
{toc_html}
{content}
</body>
</html>"""
    BUILD.mkdir(exist_ok=True)
    out = BUILD / f"{name}.html"
    out.write_text(page, encoding="utf-8")
    return out


if __name__ == "__main__":
    names = sys.argv[1:] or sorted(p.stem for p in CONTENT.glob("*.md"))
    for n in names:
        print(f"[build] {build(n)}")
