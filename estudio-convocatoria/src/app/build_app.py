#!/usr/bin/env python3
"""Arma ../../app-entender.html: la app de estudio (Fase 1 web) con el temario de ciencias.

- content.js: temario por temas (Sistema de Entender) e ítems para FSRS.
- 06-practica.md: banco de opción múltiple para el Simulacro (40 preguntas con clave).
- svg/*.svg: diagramas, como <template> para clonarlos en cada tema.
"""
import html
import json
import pathlib
import re
import sys

APP = pathlib.Path(__file__).resolve().parent
SRC = APP.parent
sys.path.insert(0, str(SRC))
import build  # noqa: E402

SVGS = ["earth-layers", "seismic", "plate-boundaries", "soil-horizons", "rock-cycle",
        "cells", "virus", "lytic-lysogenic", "bacteria"]


def md_inline(text: str) -> str:
    text = html.escape(text.strip(), quote=False)
    return re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", text)


def parse_mcq() -> list[dict]:
    src = (SRC / "content/06-practica.md").read_text(encoding="utf-8")
    bank: list[dict] = []
    for mod, start, end, key_start in (
        ("geo", "# Geology Part I ·", "# Geology Part II ·", "# Clave A ·"),
        ("cell", "# Cell Part I ·", "# Cell Part II ·", "# Clave B ·"),
    ):
        part = src[src.index(start):src.index(end)]
        keys = {}
        key_sec = src[src.index(key_start):]
        for row in re.findall(r"^\| (\d+) \| \*\*([a-d])\*\* \| (.*?) \| (.*?) \|$", key_sec, flags=re.M):
            n, letter, why_es, why_en = row
            keys.setdefault(int(n), (letter, why_es, why_en))
        for block in re.findall(r":::div q flat\n(.*?)\n:::", part, flags=re.S):
            m = re.match(r"\*\*(\d+)\.\*\* (.+)", block.strip())
            if not m:
                continue
            n = int(m.group(1))
            help_m = re.search(r'<span class="es-help">(.*?)</span>', block)
            opts = re.findall(r"^- ([a-d])\. (.+)$", block, flags=re.M)
            letter, why_es, why_en = keys[n]
            bank.append({
                "mod": mod,
                "q": md_inline(m.group(2)),
                "help": html.escape(help_m.group(1)) if help_m else "",
                "opts": [md_inline(o[1]) for o in opts],
                "ans": "abcd".index(letter),
                "why": [html.escape(why_es), html.escape(why_en)],
            })
    return bank


def svg_templates() -> str:
    out = []
    for name in SVGS:
        svg = build.svg_markup(name).replace("<svg ", '<svg role="img" ', 1)
        out.append(f'<template id="svg-{name}">{svg}</template>')
    return "\n".join(out)


def main() -> None:
    mcq = parse_mcq()
    assert len(mcq) == 40, f"esperaba 40 preguntas, hay {len(mcq)}"
    page = (APP / "template.html").read_text(encoding="utf-8")
    page = page.replace("{{TEMPLATES}}", svg_templates())
    page = page.replace("{{CONTENT}}", (APP / "content.js").read_text(encoding="utf-8"))
    page = page.replace("{{MCQ}}", "const MCQ = " + json.dumps(mcq, ensure_ascii=False).replace("<", "\\u003c") + ";")
    out = SRC.parent / "app-entender.html"
    out.write_text(page, encoding="utf-8")
    print(f"[app] {out} · {len(mcq)} preguntas de simulacro · {len(page) // 1024} KB")


if __name__ == "__main__":
    main()
