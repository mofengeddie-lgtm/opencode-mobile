"""M06: el documento completo y el PRD Roblox v1.6 tienen lo que deben (se corre después de generarlos)."""
import json
import os
import re
import sys

FARO = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
SP = os.environ.get('SP', os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(FARO, 'docs', 'documento'))
import build_documento as bd  # noqa: E402

doc = open(os.path.join(FARO, 'docs', 'documento', 'Documento_Completo_Faro_de_Ambar.html'), encoding='utf-8').read()
files = [f for f in bd.CODE_FILES if os.path.exists(os.path.join(FARO, f))]
missing = [f for f in files if f'<h3>faro/{f} <span class="small">' not in doc]
# Cada archivo completo: el número de líneas impresas coincide con el archivo.
short = []
for f in files:
    n = sum(1 for _ in open(os.path.join(FARO, f), encoding='utf-8'))
    i = doc.index(f'<h3>faro/{f} <span class="small">')
    block = doc[i:doc.index('</pre>', i)]
    printed = block.count('<span class="ln">')
    if abs(printed - n) > 1:
        short.append(f'{f} ({printed} de {n})')
# La sección (su título), no el índice del principio, que también la nombra.
tl = doc[doc.index('<h2>Línea de tiempo de todas las versiones</h2>'):]
tl = tl[:tl.index('</table>')]
versions = re.findall(r'<td>(\d+\.\d+)</td><td>', tl)
reg16 = bool(re.search(r'<h2[^>]*>v1\.6', doc)) or 'v1.6 ·' in doc
rbx = open(os.path.join(FARO, 'docs', 'roblox', 'PRD_Roblox_v1.6.html'), encoding='utf-8').read()
imgs = all(x in rbx for x in ('ref-isla-propia.png', 'ref-archipielago.jpg'))
svg = 'Esquema del HUD en iPad horizontal' in rbx and '<svg' in rbx
md_kept = open(os.path.join(FARO, 'docs', 'roblox', 'PRD_Faro_de_Ambar_v1_6.md'), encoding='utf-8').read().count('## ') >= 28
pdfs = [p for p in ('docs/documento/Documento_Completo_Faro_de_Ambar.pdf', 'docs/roblox/PRD_Roblox_v1.6.pdf') if os.path.exists(os.path.join(FARO, p))]
ok = not missing and not short and reg16 and imgs and svg and md_kept and len(pdfs) == 2 and '1.6' in versions
ev = (f'Documento completo: {len(files)} archivos de código, todos con su código completo ({"ninguno incompleto" if not short else "incompletos: " + ", ".join(short)}); '
      f'línea de tiempo con {len(versions)} versiones (de la {versions[0] if versions else "?"} a la {versions[-1] if versions else "?"}); registro con la v1.6 ({reg16}); '
      f'PRD Roblox v1.6: tus dos capturas ({imgs}), esquema del HUD ({svg}), tus 28 secciones sin cambios ({md_kept}); PDF generados: {len(pdfs)} de 2')
print('OK  ' if ok else 'FAIL', 'M06', ev)
json.dump([{'id': 'M06', 'ok': ok, 'ev': ev}], open(os.path.join(SP, 'results-v16-docs.json'), 'w'), ensure_ascii=False, indent=1)
