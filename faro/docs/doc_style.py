"""Estilo común de los documentos de Faro de Ámbar (PRD, documento completo)."""

CSS = r'''
@page { size: A4; }
:root { --ink: #17313a; --teal: #1b6b63; --amber: #d99a2b; --soft: #f1f3f1; --line: #d9dfdc; --muted: #5d6b70; }
* { box-sizing: border-box; }
body { margin: 0; font-family: 'DejaVu Sans', 'Helvetica Neue', Arial, sans-serif; color: var(--ink); font-size: 10.5pt; line-height: 1.5; }
h1 { font-size: 30pt; margin: 0 0 4px; line-height: 1.1; }
h2 { font-size: 19pt; margin: 18px 0 10px; line-height: 1.2; page-break-after: avoid; }
h3 { color: var(--teal); font-size: 12pt; margin: 16px 0 6px; page-break-after: avoid; }
h4 { font-size: 10.5pt; margin: 12px 0 4px; page-break-after: avoid; }
p { margin: 0 0 8px; }
a { color: var(--teal); }
.eyebrow { font-size: 8.5pt; letter-spacing: 0.06em; color: var(--muted); text-transform: uppercase; margin-bottom: 2px; }
.sub { color: var(--teal); font-size: 15pt; margin: 0 0 12px; }
.meta { color: var(--muted); font-size: 9pt; margin-bottom: 16px; }
.tiles { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin: 0 0 18px; }
.tile { background: var(--soft); border-radius: 8px; padding: 10px 12px; }
.tile b { display: block; color: var(--teal); font-size: 11pt; }
.tile span { font-size: 9pt; }
section { page-break-before: always; }
section.first { page-break-before: auto; }
table { width: 100%; border-collapse: collapse; margin: 6px 0 12px; font-size: 9pt; page-break-inside: auto; }
th { background: var(--teal); color: #fff; text-align: left; padding: 6px 8px; font-weight: 700; }
td { padding: 6px 8px; border-bottom: 1px solid var(--line); vertical-align: top; overflow-wrap: anywhere; }
tr { page-break-inside: avoid; }
tbody tr:nth-child(odd) td { background: var(--soft); }
ul, ol { margin: 0 0 8px; padding-left: 18px; }
li { margin-bottom: 3px; }
code { font-family: 'DejaVu Sans Mono', Menlo, monospace; font-size: 8.6pt; background: #eef1ef; padding: 0 3px; border-radius: 3px; }
pre { font-family: 'DejaVu Sans Mono', Menlo, monospace; font-size: 7.6pt; line-height: 1.35; background: #f6f7f6; border: 1px solid var(--line); border-radius: 6px; padding: 8px 10px; white-space: pre-wrap; overflow-wrap: anywhere; word-break: break-word; }
pre code { background: none; padding: 0; font-size: inherit; }
.chip { white-space: nowrap; display: inline-block; padding: 1px 7px; border-radius: 10px; font-size: 8pt; font-weight: 700; }
.pend { background: #e3e7e5; color: #3d4a4f; }
.ok { background: #d5f0dd; color: #165a2b; }
.fail { background: #f8d6d6; color: #8a1f1f; }
.note { border-left: 3px solid var(--amber); padding: 6px 10px; background: #fbf5e8; margin: 8px 0 12px; font-size: 9.5pt; }
.small { font-size: 8.5pt; color: var(--muted); }
figure { margin: 10px 0 14px; page-break-inside: avoid; }
figure img, figure svg { width: 100%; height: auto; border-radius: 8px; border: 1px solid var(--line); display: block; }
figcaption { font-size: 8.5pt; color: var(--muted); margin-top: 4px; }
.figgrid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
'''


def head(title, fecha, pie='Prototipo web'):
    return f'''<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="fecha" content="{fecha}">
<meta name="pie" content="{pie}">
<title>{title}</title>
<style>{CSS}</style>
</head>
<body>
'''
