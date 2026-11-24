"""Completa la tabla de pruebas del PRD v0.5 con los resultados reales (JSON de las pruebas)."""
import os
import html
import json
import re
import sys

SP = os.environ.get('SP', os.path.dirname(os.path.abspath(__file__))) + '/'
PRD = '/home/user/opencode-mobile/faro/docs/prd/PRD_web_v0.5.html'
extra = json.loads(open(SP + 'extra-evidence.json').read())


def load(name):
    return json.loads(open(SP + name).read())


rows = {}


def put(bid, ok, ev, status=None):
    st = status or ('ok' if ok else 'fail')
    if bid in rows:
        o_st, o_ev = rows[bid]
        if o_st == 'fail' or st == 'fail':
            st = 'fail'
        rows[bid] = (st, o_ev + ' · ' + ev)
    else:
        rows[bid] = (st, ev)


def short(ev, n=230):
    ev = re.sub(r'\s+', ' ', ev).strip()
    return ev if len(ev) <= n else ev[:n - 1] + '…'


for r in load('results-v05-rules.json'):
    put(r['id'], r['ok'], short(r['ev']))
for r in load('results-v05-visual.json'):
    if r['id'].startswith('B'):
        put(r['id'], r['ok'], short(r['ev']))
for r in load('results-v05-maps-bots.json'):
    put(r['id'], r['ok'], short(r['ev'], 320))
for r in load('results-v05-ref.json'):
    if r['id'].startswith('B'):
        put(r['id'], r['ok'], short(r['ev']))
meta = load('results-v05-meta.json')
lobby = [r for r in meta if r['id'].startswith('B16')]
put('B16', all(r['ok'] for r in lobby), f'{sum(r["ok"] for r in lobby)}/{len(lobby)} comprobaciones en Chromium (iPad): modos (6 tarjetas, Liga bloqueada), tus números, pase (40 niveles), misiones (cambiar 1), premio diario (racha baja al faltar), códigos, cofres (garantía cada 30, repetidos devuelven cristales), tienda e inventario.')
for r in meta:
    bid = r['id'].split('-')[0]
    if bid in ('B01', 'B16') or not bid.startswith('B'):
        continue
    put(bid, r['ok'], short(r['ev'], 200))
sizes = load('results-v05-sizes.json')
put('B25', extra['old_ok'] and all(s['ok'] for s in sizes), extra['old_text'] + f' Vestíbulo, tienda, pase, personalizado y pantalla final sin desbordes en {sum(s["ok"] for s in sizes)}/5 tamaños.')
put('B26', False, 'No hay un iPad físico en este entorno; las pruebas usan Chromium con tamaño de iPad.', status='nt')
put('B31', False, extra['safari'], status='nt')

LABEL = {'ok': ('ok', 'Aprobada'), 'fail': ('fail', 'Fallida'), 'nt': ('np', 'No probada')}
s = open(PRD).read()
missing = []


def repl(m):
    bid = m.group(1)
    if bid not in rows:
        missing.append(bid)
        return m.group(0)
    st, ev = rows[bid]
    cls, label = LABEL[st]
    return f'<tr><td>{bid}</td><td>{m.group(2)}</td><td><span class="chip {cls}">{label}</span></td><td>{html.escape(ev)}</td></tr>'


s = re.sub(r'<tr><td>(B\d\d)</td><td>(.*?)</td><td><span class="chip [a-z]+">[^<]*</span></td><td>.*?</td></tr>', repl, s)
s = s.replace('Estado: En desarrollo', 'Estado: Terminada (pruebas abajo)')
open(PRD, 'w').write(s)
counts = {k: sum(1 for v in rows.values() if v[0] == k) for k in LABEL}
print('filas', len(rows), counts, 'sin datos', missing)
if missing:
    sys.exit(1)
