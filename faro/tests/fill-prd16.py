"""Completa el PRD web v1.6 con los resultados reales."""
import datetime
import glob
import html
import json
import os
import re
import sys

SP = os.environ.get('SP', os.path.dirname(os.path.abspath(__file__))) + '/'
PRD = os.environ.get('PRD') or '/home/user/opencode-mobile/faro/docs/prd/PRD_web_v1.6.html'
GAME = '/home/user/opencode-mobile/faro/faro.html'
MES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
MES3 = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC']
hoy = datetime.date.today()


def load(name):
    return json.loads(open(SP + name, encoding='utf-8').read())


def camp(name):
    s = open(SP + name).read()
    return json.loads(s[s.index('['):])


def clean(t):
    return re.sub(r'\s+', ' ', t).strip()


st = lambda ok: 'ok' if ok else 'fail'
web = {r['id']: r for r in load('results-v16.json')}
docs = load('results-v16-docs.json')[0]
monkey = load('results-v16-monkey.json')[0]
rows = {}
for k in ('M01', 'M02', 'M03', 'M04', 'M05'):
    rows[k] = (st(web[k]['ok']), clean(web[k]['ev']))
rows['M06'] = (st(docs['ok']), clean(docs['ev']))


def soak(prefix):
    games = []
    issues = {}
    for f in sorted(glob.glob(SP + prefix + '-*.json')):
        d = json.load(open(f))
        games += d['games']
        for k, v in d['issues'].items():
            t = issues.setdefault(k, {'n': 0, 'ex': []})
            t['n'] += v['n']
            t['ex'] += v['ex']
    return games, issues


g16, i16 = soak('soak16')
iss = lambda d: '; '.join(f"{k}: {v['n']}" for k, v in sorted(d.items(), key=lambda x: -x[1]['n'])) or 'ninguno'
rows['M07'] = (st(monkey['ok'] and len(g16) == 30 and not i16), clean(
    f"Toques al azar: {monkey['ev']}. Partidas largas: {len(g16)} de 20 minutos (10 modos, 7 mapas, 3 dificultades) con chequeos cada segundo; problemas: {iss(i16)}."))

REPLACED = {'H03web': 'J09', 'I08': 'J10', 'I09': 'L01', 'I09sim': 'L01'}
old = []
old += [r for r in load('results-v15-sim-on-v16.json')]
old += [r for r in load('results-v15-on-v16.json') if re.match(r'^L\d\d', r['id'])]
old += load('results-v14-sim-on-v16.json')
old += load('results-v14-board-on-v16.json')
old += [r for r in load('results-v14-on-v16.json') if re.match(r'^K\d\d', r['id'])]
old += load('results-v13-sim-on-v16.json')
old += [r for r in load('results-v13-on-v16.json') if re.match(r'^J\d\d', r['id'])]
old += load('results-v12-sim-on-v16.json')
old += [r for r in load('results-v12-on-v16.json') if re.match(r'^I\d\d$', r['id'])]
old += load('results-v11-sim-on-v16.json')
old += [r for r in load('results-v11-on-v16.json') if r['id'] in ('H01web', 'H03web', 'H05web', 'H06web', 'H07web', 'H08web')]
old += load('results-v10-sim-on-v16.json')
old += [r for r in load('results-v10-on-v16.json') if r['id'] in ('G01', 'G03web', 'G04web', 'G06web', 'G08web', 'G09web')]
old += load('results-v09-sim-on-v16.json')
old += [r for r in load('results-v09-on-v16.json') if re.match(r'^F\d\d$', r['id'])]
old += [r for r in load('results-v07-on-v16.json') if re.match(r'^D\d\d$', r['id'])]
old += [r for r in load('results-v08-on-v16.json') if re.match(r'^E\d\d$', r['id'])]
old += [r for r in load('results-v08-bots-on-v16.json') if r['id'] in ('E06', 'E07', 'E08', 'E09', 'E10')]
kept = [r for r in old if r['id'] not in REPLACED]
fails = [r['id'] for r in kept if not r['ok']]
by_ver = {}
for r in kept:
    v = {'L': 'v1.5', 'K': 'v1.4', 'J': 'v1.3', 'I': 'v1.2', 'H': 'v1.1', 'G': 'v1.0', 'F': 'v0.9', 'E': 'v0.8', 'D': 'v0.7'}[r['id'][0]]
    by_ver[v] = by_ver.get(v, 0) + 1


def summ(lst, mid=None):
    sel = [x for x in lst if mid is None or x.get('id') == mid]
    won = [x for x in sel if x['result'] == 'victory']
    times = ', '.join(f"{int(x['time']) // 60}:{int(x['time']) % 60:02d}" for x in won)
    return f"ganó {len(won)} de {len(sel)}" + (f" ({times})" if times else ''), len(won)


c125 = camp('out16-camp125.txt')
s1, w1 = summ(c125, 1)
s2, w2 = summ(c125, 2)
s5, w5 = summ(c125, 5)
s3, w3 = summ(camp('out16-camp3.txt'))
s4, w4 = summ(camp('out16-camp4.txt'))
s6, w6 = summ(camp('out16-camp6.txt'))
camp_ok = all(w > 0 for w in (w1, w2, w3, w4, w5, w6))
sizes = load('results-v16-sizes.json')
big = load('results-v16-sizes-big.json')
sz_ok = all(x['ok'] for x in sizes) and all(x['ok'] for x in big)
b15 = load('duel15-v15.json')
b16 = load('duel16-v16.json')


def bal(d):
    return f"Fácil {d['easy']['w']}-{d['easy']['l']}-{d['easy']['d']}, Normal {d['normal']['w']}-{d['normal']['l']}-{d['normal']['d']}, Difícil {d['hard']['w']}-{d['hard']['l']}-{d['hard']['d']}"


bal_ok = all(b15[k]['w'] == b16[k]['w'] and b15[k]['l'] == b16[k]['l'] for k in ('easy', 'normal', 'hard'))
vers = ', '.join(f'{v}: {n}' for v, n in sorted(by_ver.items(), reverse=True))
sz = lambda lst: ' · '.join(f"{x['name']}: {'bien' if x['ok'] else 'FALLA ' + '; '.join(x['fails'])}" for x in lst)
rows['M08'] = (st(not fails and camp_ok and sz_ok and bal_ok), clean(
    f"Pruebas anteriores en la v1.6: {len(kept) - len(fails)} de {len(kept)} bien ({vers}){' · fallan: ' + ', '.join(fails) if fails else ''} "
    f"(H03, I08, I09 e I09sim siguen reemplazadas por J09, J10 y L01). "
    f"Campaña: M1 {s1}; M2 {s2}; M3 órdenes de jugador {s3}; M4 órdenes de jugador {s4}; M5 {s5}; M6 piloto atento {s6}. "
    f"Equilibrio (piloto de nivel medio contra los bots, 16 partidas por dificultad): v1.5 {bal(b15)}; v1.6 {bal(b16)}. "
    f"5 tamaños: {sz(sizes)}. Con letra grande y colores para daltonismo: {sz(big)}."))
rows['M09'] = (st(web['M09']['ok']), clean(web['M09']['ev']))
if not web['errores']['ok']:
    for k in ('M01', 'M02', 'M03', 'M04', 'M05'):
        rows[k] = ('fail', rows[k][1] + ' · errores en la consola: ' + web['errores']['ev'])

LABEL = {'ok': ('ok', 'Aprobada'), 'fail': ('fail', 'Fallida')}
s = open(PRD, encoding='utf-8').read()
missing = []


def repl(m):
    cid = m.group(1)
    if cid not in rows:
        missing.append(cid)
        return m.group(0)
    status, ev = rows[cid]
    cls, label = LABEL[status]
    return f'<tr><td>{cid}</td><td>{m.group(2)}</td><td><span class="chip {cls}">{label}</span></td><td>{html.escape(ev)}</td></tr>'


s = re.sub(r'<tr><td>(M\d\d)</td><td>(.*?)</td><td><span class="chip [a-z]+">[^<]*</span></td><td>.*?</td></tr>', repl, s)
s = s.replace('13 de noviembre de 2026 · Estado: <b id="estado">Plan</b>', f'{hoy.day} de {MES[hoy.month - 1]} de {hoy.year} · Estado: <b id="estado">Terminada (pruebas abajo)</b>')
s = s.replace('<meta name="fecha" content="13 NOV 2026">', f'<meta name="fecha" content="{hoy.day} {MES3[hoy.month - 1]} {hoy.year}">')
s = s.replace('<tr><td>1.6</td><td>13 nov 2026</td><td>Esta versión.</td></tr>',
              '<tr><td>1.6</td><td>13 nov 2026</td><td>Pantalla de carga real, transiciones, motivos junto a la acción, alcance al colocar, «Acerca de», documento completo y PRD Roblox con imágenes.</td></tr>')
DEC = open(SP + 'prd16-decisions.html', encoding='utf-8').read()
s, n = re.subn(r'<section>\s*<div class="eyebrow">06 · Decisiones</div>.*?</section>', DEC, s, count=1, flags=re.S)
if not n:
    missing.append('decisiones')
open(PRD, 'w', encoding='utf-8').write(s)
counts = {k: sum(1 for v in rows.values() if v[0] == k) for k in LABEL}
print('filas', len(rows), counts, 'sin datos', missing)
for k in sorted(rows):
    if rows[k][0] != 'ok':
        print('NO OK', k, rows[k][1][:700])
if missing:
    sys.exit(1)
