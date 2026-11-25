#!/usr/bin/env python3
"""Arma build/slides.html: agrega barra superior, número y barra de progreso a cada diapositiva."""
import re

from build import BUILD, CONTENT, svg_markup

src = (CONTENT / "slides.html").read_text(encoding="utf-8")
src = re.sub(r"\[\[svg ([\w-]+)\]\]", lambda m: svg_markup(m.group(1)), src)

sections = re.findall(r"<section\b.*?</section>", src, flags=re.S)
total = len(sections)
out = []
for i, sec in enumerate(sections, start=1):
    ch = re.search(r'data-ch="([^"]*)"', sec).group(1)
    es, _, en = ch.partition(" · ")
    top = (
        f'<div class="top"><span>{es} <span class="en" style="color:#fff">· {en}</span></span>'
        f"<span>{i} / {total}</span></div>"
        f'<div class="bar-bg"></div><div class="bar" style="width:{100 * i / total:.2f}%"></div>'
    )
    out.append(re.sub(r"(<section\b[^>]*>)", r"\1" + top, sec, count=1))

page = f"""<!doctype html>
<html lang="es">
<head><meta charset="utf-8"><title>Presentación · Repaso</title>
<link rel="stylesheet" href="../slides.css"></head>
<body>
{chr(10).join(out)}
</body>
</html>"""
BUILD.mkdir(exist_ok=True)
(BUILD / "slides.html").write_text(page, encoding="utf-8")
print(f"[slides] {total} diapositivas → {BUILD / 'slides.html'}")
