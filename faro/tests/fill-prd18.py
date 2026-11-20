"""Junta los resultados reales de las pruebas de la v1.8 y arma el PRD final (O01-O20).

Uso: python3 faro/tests/fill-prd18.py [carpeta de resultados del navegador]  (por defecto, el scratchpad de la sesión)
Lee: tests/results-v18-sim.json (O04-O13), results-v18*.json (O14, O15, O16, O19), results-v18-bots.json y soak18-*.json (O17),
results-v18-numbers.json y las salidas de la tanda en el scratchpad (O18), el informe del revisor (O01-O03) y results-v18-docs.json (O20).
Escribe tests/results-v18-final.json y vuelve a armar docs/prd/PRD_web_v1.8.html con prd_v18.py --final.
Una prueba que no corrió queda «No probada»: nunca «Aprobada».
"""
import glob
import json
import os
import re
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
FARO = os.path.normpath(os.path.join(HERE, '..'))
SP = sys.argv[1] if len(sys.argv) > 1 else '/tmp/claude-0/-home-user-opencode-mobile/0f78d3e3-e6a8-58dd-9fa1-10429825d51c/scratchpad'
R = {}


def put(i, status, ev):
    R[i] = {'status': status, 'evidence': ev}


def load(path):
    try:
        return json.load(open(path, encoding='utf-8'))
    except (OSError, ValueError):
        return None


# O01-O03: programa revisor.
rep = load(os.path.join(FARO, 'tools', 'revisar', 'salida', 'informe.json'))
strict = load(os.path.join(HERE, 'results-v18-revisar.json'))
if rep:
    s = rep['summary']
    ok1 = s['catalog_ok'] == s['catalog_total'] and (strict or {}).get('exit') == 0
    put('O01', 'ok' if ok1 else 'fail', f"revisar.py --estricto: salida {(strict or {}).get('exit', '?')} · {s['catalog_ok']} de {s['catalog_total']} «En el juego» "
        f"({s['units_ok']} de {s['units_total']} tropas, {s['bld_ok']} de {s['bld_total']} edificios), {s['models_ok']} con modelo 3D · juego v{rep['game']['version']} · {rep['at']}")
    fuera = [e['name'] for e in rep['equipment'] if e['state'] == 'fuera']
    bad = [e['name'] for e in rep['equipment'] if e['state'] in ('falta', 'fuente')]
    put('O02', 'ok' if not bad else 'fail', f"{s['equip_ok'] - len(fuera)} sistemas en el juego (tropa, edificio o arma) + {len(fuera)} fuera con motivo ({', '.join(fuera)})"
        + (f" · faltan: {', '.join(bad)}" if bad else ''))
    uib = [u['screen'] for u in rep['ui'] if u['state'] != 'ok']
    put('O03', 'ok' if not uib else 'fail', f"{s['ui_ok']} de {s['ui_total']} revisiones de tus pantallas" + (f" · faltan: {', '.join(uib)}" if uib else ''))
else:
    for i in ('O01', 'O02', 'O03'):
        put(i, 'np', 'sin informe del revisor')

# O04-O13: reglas en Node.
sim = load(os.path.join(HERE, 'results-v18-sim.json'))
for i in ('O04', 'O05', 'O06', 'O07', 'O08', 'O09', 'O10', 'O11', 'O12', 'O13'):
    r = (sim or {}).get('results', {}).get(i)
    put(i, r['status'] if r else 'np', r['evidence'] if r else 'no corrió')

# O14, O15, O16, O19: navegador (pueden estar en varios archivos de resultados; vale el más nuevo de cada prueba).
br = {}
for f in sorted(glob.glob(os.path.join(FARO, 'tests', 'results-v18*.json')), key=os.path.getmtime):
    d = load(f)
    if isinstance(d, list):
        for x in d:
            if x.get('id', '').startswith('O'):
                br[x['id']] = x
for i in ('O14', 'O15', 'O16', 'O19', 'O21'):
    x = br.get(i)
    put(i, ('ok' if x['ok'] else 'fail') if x else 'np', x['ev'] if x else 'no corrió')

# O17: bots con tropas nuevas y partidas largas.
bots = load(os.path.join(HERE, 'results-v18-bots.json'))
soak = [load(f) for f in sorted(glob.glob(os.path.join(HERE, 'soak18-*.json')))]
soak = [x for x in soak if x]
if bots and soak:
    games = sum(len(x['games']) for x in soak)
    issues = {}
    for x in soak:
        for k, v in x['issues'].items():
            issues[k] = issues.get(k, 0) + v['n']
    pct = lambda d: f"{round(bots[d]['share'] * 100)} %"
    ok17 = bots['ok'] and games >= 30 and not issues
    put('O17', 'ok' if ok17 else 'fail', f"tropas nuevas en los bots: Normal {bots['normal']['newUnits']} ({pct('normal')}), Difícil {bots['hard']['newUnits']} ({pct('hard')}), Fácil {bots['easy']['newUnits']} · "
        f"{games} partidas largas de 20 min con chequeos cada segundo: " + ('sin problemas' if not issues else ', '.join(f'{k}: {v}' for k, v in issues.items())))
else:
    put('O17', 'np', 'faltan resultados: ' + ('bots' if not bots else '') + (' partidas largas' if not soak else ''))

# O18: sin regresiones. Pruebas de las versiones anteriores (navegador y Node), campaña, números y tamaños de pantalla.
# H03, I08, I09 e I09sim ya estaban reemplazadas desde la v1.5 (por J09, J10 y L01): no se cuentan.
REPLACED = {'H03web': 'J09', 'I08': 'J10', 'I09': 'L01', 'I09sim': 'L01'}
# Cambios planeados de la v1.8 (revisados uno por uno; no son fallas, pero se dicen):
# L01sim compara las reglas con la v1.4: marca los 6 nombres nuevos de tu documento y las 57 tropas y 19 edificios nuevos.
# N05 cuenta las tarjetas del Arsenal con las reglas de filtro de la v1.7: la v1.8 suma tropas, edificios y filtros nuevos.
PLANNED = {
    'L01sim': 'L01sim (reglas iguales a la v1.4) marca solo los cambios planeados de la v1.8: los 6 nombres de tu documento y las tropas y edificios nuevos',
    'N05': 'N05 (Arsenal) espera los conteos de la v1.7 (93 tropas y 41 edificios): ahora hay 134 tarjetas y filtros nuevos (drones con las aeronaves, estratégicos)',
    # N14 mide contra la v1.6.1 con la meta de peso de la v1.7 (3,5 MB). El plan de la v1.8 la cambió por O19
    # (6 MB o menos y no más de 15 % peor que la v1.7). Se dice su número real.
    'N14': 'N14 (rendimiento de la v1.7) usa la meta vieja de 3,5 MB y compara contra la v1.6.1: el plan de la v1.8 la cambió por O19 (6 MB o menos y comparación con la v1.7); faro.html pesa 4,08 MB porque los 76 modelos nuevos suman 3,26 MB de modelos en total',
}
SUITES = [
    ('results-v17-on-v18.json', r'^N\d\d$', 'v1.7'), ('results-v16-on-v18.json', r'^M0[1-5]$', 'v1.6'),
    ('results-v15-on-v18.json', r'^L\d\d', 'v1.5'), ('results-v14-on-v18.json', r'^K\d\d', 'v1.4'),
    ('results-v13-on-v18.json', r'^J\d\d', 'v1.3'), ('results-v12-on-v18.json', r'^I\d\d$', 'v1.2'),
    ('results-v11-on-v18.json', r'^H0[135678]web$', 'v1.1'), ('results-v10-on-v18.json', r'^G0(1|3web|4web|6web|8web|9web)$', 'v1.0'),
    ('results-v09-on-v18.json', r'^F\d\d$', 'v0.9'), ('results-v08-on-v18.json', r'^E\d\d$', 'v0.8'), ('results-v07-on-v18.json', r'^D\d\d$', 'v0.7'),
]
# Repeticiones a solas de las que dependen del tiempo (vale la más nueva).
REDO = {'results-v17-on-v18.json': ['results-v17-N04N14.json'], 'results-v14-on-v18.json': ['results-v14-K15.json'],
        'results-v13-on-v18.json': ['results-v13-J06.json']}
SIMS = [('test-v15-sim', 'v1.5'), ('test-v14-sim', 'v1.4'), ('test-v14-board', 'v1.4'), ('test-v13-sim', 'v1.3'), ('test-v12-sim', 'v1.2'),
        ('test-v11-sim', 'v1.1'), ('test-v10-sim', 'v1.0'), ('test-v09-sim-b', 'v0.9'), ('test-v08-bots-b', 'v0.8')]


def spj(name):
    return load(os.path.join(SP, name))


old, planned_seen, redone, not_run = [], [], [], []
by_ver = {}


def take(r, ver):
    if r['id'] in REPLACED or r['id'] == 'errores':
        return
    if r['id'] in PLANNED and not r['ok']:
        planned_seen.append(r['id'])
        return
    old.append(dict(r, ver=ver))
    by_ver[ver] = by_ver.get(ver, 0) + 1


for name, pat, ver in SUITES:
    data = spj(name)
    if not isinstance(data, list):
        not_run.append(name.replace('results-', '').replace('-on-v18.json', ''))
        continue
    for rn in REDO.get(name, []):
        rd = spj(rn)
        if isinstance(rd, list) and os.path.getmtime(os.path.join(SP, rn)) > os.path.getmtime(os.path.join(SP, name)):
            redo = {x['id']: x for x in rd if x.get('id') != 'errores'}
            for x in data:
                if x['id'] in redo and x['id'] not in PLANNED:
                    if x['ok'] != redo[x['id']]['ok'] or not x['ok']:
                        redone.append(f"{x['id']} {'bien' if redo[x['id']]['ok'] else 'mal'} al repetirla sola (en la tanda: {'bien' if x['ok'] else 'mal'})")
            data = [redo.get(x['id'], x) for x in data]
    for x in data:
        if pat and not re.match(pat, x['id']):
            continue
        take(x, ver)
for t, ver in SIMS:
    f = os.path.join(SP, f'out18-{t}.txt')
    if not os.path.exists(f):
        not_run.append(t)
        continue
    for m in re.finditer(r'^(OK|FAIL) +(\S+)', open(f, encoding='utf-8').read(), re.M):
        take({'id': m.group(2), 'ok': m.group(1) == 'OK'}, ver)
fails = [r['id'] for r in old if not r['ok']]


def camp(name):
    f = os.path.join(SP, name)
    if not os.path.exists(f):
        return None
    s = open(f, encoding='utf-8').read()
    try:
        return json.loads(s[s.index('['):])
    except ValueError:
        return None


def summ(lst, mid=None):
    if lst is None:
        return 'no corrió', -1
    sel = [x for x in lst if mid is None or x.get('id') == mid]
    won = [x for x in sel if x['result'] == 'victory']
    times = ', '.join(f"{int(x['time']) // 60}:{int(x['time']) % 60:02d}" for x in won)
    return f"ganó {len(won)} de {len(sel)}" + (f" ({times})" if times else ''), len(won)


c125 = camp('out18-camp125.txt')
s1, w1 = summ(c125, 1)
s2, w2 = summ(c125, 2)
s5, w5 = summ(c125, 5)
s3, w3 = summ(camp('out18-camp3.txt'))
s4, w4 = summ(camp('out18-camp4.txt'))
s6, w6 = summ(camp('out18-camp6.txt'))
camp_ok = all(w > 0 for w in (w1, w2, w3, w4, w5, w6))
b17, b18 = spj('duel17-v17.json'), spj('duel18-v18.json')
bal = lambda d: (f"Fácil {d['easy']['w']}-{d['easy']['l']}-{d['easy']['d']}, Normal {d['normal']['w']}-{d['normal']['l']}-{d['normal']['d']}, "
                 f"Difícil {d['hard']['w']}-{d['hard']['l']}-{d['hard']['d']}") if d else 'no corrió'
sizes, big = spj('results-v18-sizes.json'), spj('results-v18-sizes-big.json')
sz = lambda lst: ' · '.join(f"{x['name']}: {'bien' if x['ok'] else 'FALLA ' + '; '.join(x['fails'])}" for x in lst) if lst else 'no corrió'
sz_ok = bool(sizes) and bool(big) and all(x['ok'] for x in sizes) and all(x['ok'] for x in big)
num = load(os.path.join(HERE, 'results-v18-numbers.json'))
vers = ', '.join(f'{v}: {n}' for v, n in sorted(by_ver.items(), key=lambda kv: [int(p) for p in kv[0][1:].split('.')], reverse=True))
extra = load(os.path.join(HERE, 'results-v18-regress.json')) or {}
ev18 = re.sub(r'\s+', ' ', (
    f"Pruebas anteriores en la v1.8: {len(old) - len(fails)} de {len(old)} bien ({vers})" + (f" · fallan: {', '.join(fails)}" if fails else '') +
    " (H03, I08, I09 e I09sim siguen reemplazadas por J09, J10 y L01)" +
    (' · ' + ' · '.join(PLANNED[k] for k in sorted(set(planned_seen))) if planned_seen else '') +
    (' · repetidas a solas: ' + '; '.join(redone) if redone else '') +
    (' · no corrieron: ' + ', '.join(not_run) if not_run else '') + '. ' +
    (f"Números: {num['units']} tropas y {num['buildings']} edificios de la v1.7, modos y dificultades iguales ({'sí' if num['ok'] else 'NO'}). " if num else 'Números: no corrió. ') +
    f"Campaña: M1 {s1}; M2 {s2}; M3 órdenes de jugador {s3}; M4 órdenes de jugador {s4}; M5 {s5}; M6 piloto atento {s6}. "
    f"Equilibrio (piloto de nivel medio contra los bots, 16 partidas por dificultad; en la v1.8 los bots también usan tropas nuevas): v1.7 {bal(b17)}; v1.8 {bal(b18)}. "
    f"5 tamaños: {sz(sizes)}. Con letra grande y colores para daltonismo: {sz(big)}." + (f" {extra['note']}" if extra.get('note') else ''))).strip()
complete = not not_run and c125 is not None and b18 is not None and sizes is not None and big is not None and num is not None
put('O18', ('ok' if not fails and camp_ok and sz_ok and num['ok'] else 'fail') if complete else 'np', ev18)

# O20: documentos, sitio y PDF.
docs = load(os.path.join(HERE, 'results-v18-docs.json'))
put('O20', ('ok' if docs['ok'] else 'fail') if docs else 'np', docs['ev'] if docs else 'no corrió')

json.dump(R, open(os.path.join(HERE, 'results-v18-final.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
for i, r in R.items():
    print(f"{i} {r['status']:5} {r['evidence'][:150]}")
subprocess.run([sys.executable, os.path.join(FARO, 'tools', 'revisar', 'prd_v18.py'), '--final', os.path.join(HERE, 'results-v18-final.json')], check=True)
