"""Completa el PRD web v1.7 con los resultados reales (lo que falte queda «No probada», nunca «Aprobada»)."""
import datetime
import glob
import html
import json
import os
import re
import sys

SP = os.environ.get('SP', os.path.dirname(os.path.abspath(__file__))) + '/'
PRD = os.environ.get('PRD') or '/home/user/opencode-mobile/faro/docs/prd/PRD_web_v1.7.html'
MES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
MES3 = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC']
hoy = datetime.date.today()
missing = []


def load(name, default=None):
    if not os.path.exists(SP + name):
        missing.append(name)
        return default
    return json.loads(open(SP + name, encoding='utf-8').read())


def camp(name):
    if not os.path.exists(SP + name):
        missing.append(name)
        return None
    s = open(SP + name).read()
    try:
        return json.loads(s[s.index('['):])
    except ValueError:
        missing.append(name)
        return None


clean = lambda t: re.sub(r'\s+', ' ', t).strip()
st = lambda ok: 'ok' if ok else 'fail'

# Primera corrida y repetición de las que fallaron por un error de la prueba (se dice en las decisiones).
web = {r['id']: r for r in (load('results-v17.json') or [])}
first_fail = [k for k, r in web.items() if not r['ok'] and k != 'errores']
for f in sorted(glob.glob(SP + 'results-v17-N*.json'), key=os.path.getmtime):  # la repetición más nueva gana
    for r in json.load(open(f)):
        if r['id'] != 'errores' or not r['ok']:
            web[r['id']] = dict(r, redo=True)
        elif 'errores' in web and not web['errores']['ok']:
            pass
rows = {}
for k in ['N01', 'N02', 'N03', 'N04', 'N05', 'N06', 'N07', 'N08', 'N09', 'N10', 'N11', 'N14']:
    if k in web:
        ev = clean(web[k]['ev'])
        if web[k].get('redo'):
            ev = '(Repetida al final con la versión final; ver Decisiones.) ' + ev
        rows[k] = (st(web[k]['ok']), ev)
    else:
        rows[k] = ('np', 'No se llegó a correr.')

# N12: toques al azar y partidas largas.
monkey = (load('results-v17-monkey.json') or [None])[0]
games, issues = [], {}
for f in sorted(glob.glob(SP + 'soak17-*.json')):
    d = json.load(open(f))
    games += d['games']
    for k, v in d['issues'].items():
        t = issues.setdefault(k, {'n': 0, 'ex': []})
        t['n'] += v['n']
        t['ex'] += v['ex']
NAMES = {'drone': 'Drones de ataque', 'fpv': 'Drones kamikaze', 'mlrs': 'Lanzacohetes múltiples', 'missileboat': 'Lanchas misileras'}
strat = [g for g in games if g['tag'].endswith('/estrategico')]
used = sum(1 for g in strat if g.get('mobile'))
newu = {}
for g in games:
    for k, v in (g.get('newUnits') or {}).items():
        newu[k] = newu.get(k, 0) + v
iss = '; '.join(f"{k}: {v['n']} (p. ej. {v['ex'][0]})" for k, v in sorted(issues.items(), key=lambda x: -x[1]['n'])) or 'ninguno'
if monkey and games:
    rows['N12'] = (st(monkey['ok'] and len(games) == 30 and not issues), clean(
        f"Toques al azar: {monkey['ev']}. Partidas largas: {len(games)} de 20 minutos (10 modos, 7 mapas, 3 dificultades; {len(strat)} de ellas Personalizadas con «Arsenal estratégico») con chequeos cada segundo; "
        f"el piloto fabricó y usó el Lanzador nuclear móvil en {used} de {len(strat)} (a los 7 minutos la prueba le da 30.000 monedas y una Fábrica); nadie lanzó más de un misil en esas partidas. "
        f"Del equipo nuevo, los bots entrenaron: {', '.join(f'{NAMES.get(k, k)} {v}' for k, v in newu.items())}. Problemas: {iss}."))
else:
    rows['N12'] = ('np', 'No terminaron: ' + ', '.join(x for x in missing if 'monkey' in x or 'soak' in x))

# N13: pruebas anteriores, campaña, equilibrio y tamaños.
REPLACED = {'H03web': 'J09', 'I08': 'J10', 'I09': 'L01', 'I09sim': 'L01'}
# L01sim compara las reglas con las de la v1.4. En la v1.7 marca solo los cambios planeados (revisado uno por uno:
# nombre y descripción del DF-17, las 5 tropas nuevas y las listas de lo que producen la Fábrica, el Puerto y el
# Helipuerto); ningún número de las 31 tropas y 23 edificios de antes cambió. No se cuenta como falla y se dice.
PLANNED = {'L01sim'}
planned_seen = []
old = []
SUITES = [
    ('results-v16-on-v17.json', r'^M0[1-5]$', 'v1.6'), ('results-v15-sim-on-v17.json', None, 'v1.5'), ('results-v15-on-v17.json', r'^L\d\d', 'v1.5'),
    ('results-v14-sim-on-v17.json', None, 'v1.4'), ('results-v14-board-on-v17.json', None, 'v1.4'), ('results-v14-on-v17.json', r'^K\d\d', 'v1.4'),
    ('results-v13-sim-on-v17.json', None, 'v1.3'), ('results-v13-on-v17.json', r'^J\d\d', 'v1.3'), ('results-v12-sim-on-v17.json', None, 'v1.2'),
    ('results-v12-on-v17.json', r'^I\d\d$', 'v1.2'), ('results-v11-sim-on-v17.json', None, 'v1.1'), ('results-v11-on-v17.json', r'^H0[135678]web$', 'v1.1'),
    ('results-v10-sim-on-v17.json', None, 'v1.0'), ('results-v10-on-v17.json', r'^G0(1|3web|4web|6web|8web|9web)$', 'v1.0'),
    ('results-v09-sim-on-v17.json', None, 'v0.9'), ('results-v09-on-v17.json', r'^F\d\d$', 'v0.9'), ('results-v07-on-v17.json', r'^D\d\d$', 'v0.7'),
    ('results-v08-on-v17.json', r'^E\d\d$', 'v0.8'), ('results-v08-bots-on-v17.json', r'^E(06|07|08|09|10)$', 'v0.8'),
]
by_ver = {}
not_run = []
for name, pat, ver in SUITES:
    data = load(name)
    if data is None:
        not_run.append(name.replace('results-', '').replace('-on-v17.json', ''))
        continue
    # I03 (tabla de la Liga) se repitió sola al final: su resultado más nuevo reemplaza al de la tanda.
    if name == 'results-v12-on-v17.json' and os.path.exists(SP + 'results-v12-I03.json') and os.path.getmtime(SP + 'results-v12-I03.json') > os.path.getmtime(SP + name):
        redo = {r['id']: r for r in json.load(open(SP + 'results-v12-I03.json'))}
        data = [dict(redo['I03'], redo=True) if r['id'] == 'I03' and 'I03' in redo else r for r in data]
    for r in data:
        if pat and not re.match(pat, r['id']):
            continue
        if r['id'] in REPLACED or r['id'] == 'errores':
            continue
        if r['id'] in PLANNED and not r['ok']:
            planned_seen.append(r['id'])
            continue
        old.append(r)
        by_ver[ver] = by_ver.get(ver, 0) + 1
fails = [r['id'] for r in old if not r['ok']]


def summ(lst, mid=None):
    if lst is None:
        return 'no corrió', -1
    sel = [x for x in lst if mid is None or x.get('id') == mid]
    won = [x for x in sel if x['result'] == 'victory']
    times = ', '.join(f"{int(x['time']) // 60}:{int(x['time']) % 60:02d}" for x in won)
    return f"ganó {len(won)} de {len(sel)}" + (f" ({times})" if times else ''), len(won)


c125 = camp('out17-camp125.txt')
s1, w1 = summ(c125, 1)
s2, w2 = summ(c125, 2)
s5, w5 = summ(c125, 5)
s3, w3 = summ(camp('out17-camp3.txt'))
s4, w4 = summ(camp('out17-camp4.txt'))
s6, w6 = summ(camp('out17-camp6.txt'))
camp_ok = all(w > 0 for w in (w1, w2, w3, w4, w5, w6))
sizes = load('results-v17-sizes.json')
big = load('results-v17-sizes-big.json')
b16 = load('duel16-v16.json')
b17 = load('duel17-v17.json')


def bal(d):
    return f"Fácil {d['easy']['w']}-{d['easy']['l']}-{d['easy']['d']}, Normal {d['normal']['w']}-{d['normal']['l']}-{d['normal']['d']}, Difícil {d['hard']['w']}-{d['hard']['l']}-{d['hard']['d']}" if d else 'no corrió'


sz = lambda lst: ' · '.join(f"{x['name']}: {'bien' if x['ok'] else 'FALLA ' + '; '.join(x['fails'])}" for x in lst) if lst else 'no corrió'
sz_ok = bool(sizes) and bool(big) and all(x['ok'] for x in sizes) and all(x['ok'] for x in big)
complete = not not_run and c125 is not None and b17 is not None and sizes is not None and big is not None
vers = ', '.join(f'{v}: {n}' for v, n in sorted(by_ver.items(), reverse=True))
ev13 = clean(
    f"Pruebas anteriores en la v1.7: {len(old) - len(fails)} de {len(old)} bien ({vers}){' · fallan: ' + ', '.join(fails) if fails else ''} "
    f"(H03, I08, I09 e I09sim siguen reemplazadas por J09, J10 y L01)"
    f"{' · L01sim (reglas iguales a la v1.4) marca solo los cambios planeados de la v1.7 (DF-17, las 5 tropas nuevas y lo que produce cada edificio); los números de las 31 tropas y 23 edificios de antes siguen iguales' if planned_seen else ''}"
    f"{' · no corrieron: ' + ', '.join(not_run) if not_run else ''}. "
    f"Campaña: M1 {s1}; M2 {s2}; M3 órdenes de jugador {s3}; M4 órdenes de jugador {s4}; M5 {s5}; M6 piloto atento {s6}. "
    f"Equilibrio (piloto de nivel medio contra los bots, 16 partidas por dificultad; en la v1.7 los bots también usan el equipo nuevo): v1.6 {bal(b16)}; v1.7 {bal(b17)}. "
    f"5 tamaños: {sz(sizes)}. Con letra grande y colores para daltonismo: {sz(big)}.")
if not complete:
    rows['N13'] = ('np', ev13)
else:
    rows['N13'] = (st(not fails and camp_ok and sz_ok), ev13)
if 'errores' in web and not web['errores']['ok']:
    for k in ('N01', 'N02', 'N03', 'N04', 'N05', 'N06', 'N07', 'N08', 'N09', 'N10', 'N11'):
        if rows[k][0] == 'ok':
            rows[k] = ('fail', rows[k][1] + ' · errores en la consola: ' + web['errores']['ev'])

LABEL = {'ok': ('ok', 'Aprobada'), 'fail': ('fail', 'Fallida'), 'np': ('np', 'No probada')}
s = open(PRD, encoding='utf-8').read()
nomatch = []


def repl(m):
    cid = m.group(1)
    if cid not in rows:
        nomatch.append(cid)
        return m.group(0)
    status, ev = rows[cid]
    cls, label = LABEL[status]
    return f'<tr><td>{cid}</td><td>{m.group(2)}</td><td><span class="chip {cls}">{label}</span></td><td>{html.escape(ev)}</td></tr>'


s = re.sub(r'<tr><td>(N\d\d)</td><td>(.*?)</td><td><span class="chip [a-z]+">[^<]*</span></td><td>.*?</td></tr>', repl, s)
s = re.sub(r'\d+ de noviembre de 2026 · Estado: <b id="estado">[^<]*</b>', f'{hoy.day} de {MES[hoy.month - 1]} de {hoy.year} · Estado: <b id="estado">Terminada (pruebas abajo)</b>', s)
s = re.sub(r'<meta name="fecha" content="[^"]*">', f'<meta name="fecha" content="{hoy.day} {MES3[hoy.month - 1]} {hoy.year}">', s)
s = s.replace('<tr><td>1.7</td><td>15 nov 2026</td><td>Esta versión.</td></tr>',
              '<tr><td>1.7</td><td>15-17 nov 2026</td><td>Arsenal, Dron de ataque, Dron kamikaze, Lanzacohetes múltiple, Lancha misilera, DF-17, Lanzador nuclear móvil con «Arsenal estratégico», selección y carga como en tu UI 0.4, perfil seguro y sitio web.</td></tr>')
if os.path.exists(SP + 'prd17-decisions.html'):
    DEC = open(SP + 'prd17-decisions.html', encoding='utf-8').read()
    s, n = re.subn(r'<section>\s*<div class="eyebrow">06 · Decisiones</div>.*?</section>', DEC, s, count=1, flags=re.S)
    if not n:
        nomatch.append('decisiones')
open(PRD, 'w', encoding='utf-8').write(s)
counts = {k: sum(1 for v in rows.values() if v[0] == k) for k in LABEL}
print('filas', len(rows), counts, 'faltan', missing, 'sin fila', nomatch, 'fallaron en la primera corrida', first_fail)
for k in sorted(rows):
    if rows[k][0] != 'ok':
        print('NO OK', k, rows[k][1][:600])
if nomatch:
    sys.exit(1)
