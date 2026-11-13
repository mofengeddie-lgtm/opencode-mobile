"""Completa la tabla de pruebas del PRD v0.6 con los resultados reales."""
import os
import html
import json
import re
import sys

SP = os.environ.get('SP', os.path.dirname(os.path.abspath(__file__))) + '/'
PRD = '/home/user/opencode-mobile/faro/docs/prd/PRD_web_v0.6.html'
extra = json.loads(open(SP + 'extra-evidence6.json').read())
rows = {}
for name in ('results-v06-pace.json', 'results-v06.json'):
    for r in json.loads(open(SP + name).read()):
        if r['id'].startswith('C'):
            rows[r['id']] = ('ok' if r['ok'] else 'fail', re.sub(r'\s+', ' ', r['ev']).strip())
rows['C04'] = ('ok' if extra['c04_ok'] else 'fail', extra['c04'])
rows['C09'] = ('nt', 'Solo se puede medir en tu iPad: abre la pausa, enciende «Contador de cuadros» y dime el número. Aquí no hay tarjeta gráfica.')
LABEL = {'ok': ('ok', 'Aprobada'), 'fail': ('fail', 'Fallida'), 'nt': ('np', 'No probada')}
s = open(PRD).read()
missing = []


def repl(m):
    cid = m.group(1)
    if cid not in rows:
        missing.append(cid)
        return m.group(0)
    st, ev = rows[cid]
    cls, label = LABEL[st]
    return f'<tr><td>{cid}</td><td>{m.group(2)}</td><td><span class="chip {cls}">{label}</span></td><td>{html.escape(ev)}</td></tr>'


s = re.sub(r'<tr><td>(C\d\d)</td><td>(.*?)</td><td><span class="chip [a-z]+">[^<]*</span></td><td>.*?</td></tr>', repl, s)
s = s.replace('Estado: <b id="estado">Plan</b>', 'Estado: <b id="estado">Terminada (pruebas abajo)</b>')
if '#pruebas td' not in s:
    s = s.replace('.chip { display: inline-block;', '#pruebas td { overflow-wrap: anywhere; word-break: break-word; }\n.chip { display: inline-block;', 1)
open(PRD, 'w').write(s)
counts = {k: sum(1 for v in rows.values() if v[0] == k) for k in LABEL}
print('filas', len(rows), counts, 'sin datos', missing)
if missing:
    sys.exit(1)
