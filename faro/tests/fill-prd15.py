"""Completa el PRD v1.5 con los resultados reales."""
import datetime
import glob
import html
import json
import os
import re
import sys

SP = os.environ.get('SP', os.path.dirname(os.path.abspath(__file__))) + '/'
PRD = os.environ.get('PRD') or '/home/user/opencode-mobile/faro/docs/prd/PRD_web_v1.5.html'
GAME = '/home/user/opencode-mobile/faro/faro.html'
MES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
MES3 = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC']
hoy = datetime.date.today()


def load(name):
    return json.loads(open(SP + name).read())


def camp(name):
    s = open(SP + name).read()
    return json.loads(s[s.index('['):])


def clean(t):
    return re.sub(r'\s+', ' ', t).strip()


def esc(t):
    return html.escape(str(t))


st = lambda ok: 'ok' if ok else 'fail'
sim = {r['id']: r for r in load('results-v15-sim.json')}
sim14 = {r['id']: r for r in load('results-v15-sim-on-v14.json')}
web = {r['id']: r for r in load('results-v15.json')}
monkey = load('results-v15-monkey.json')[0]
rows = {}
rows['L01'] = (st(web['L01']['ok'] and sim['L01sim']['ok']), clean(web['L01']['ev'] + '. Reglas: ' + sim['L01sim']['ev']))
rows['L02'] = (st(web['L02']['ok']), clean(web['L02']['ev']))
rows['L03'] = (st(web['L03']['ok'] and sim['L03model']['ok']), clean('Modelos: ' + sim['L03model']['ev'] + '. En pantalla: ' + web['L03']['ev'] + '. Vida, mejoras y Cúpula: mismas reglas (ver L01).'))
rows['L04'] = (st(web['L04']['ok']), clean(web['L04']['ev']))
rows['L05'] = (st(web['L05']['ok']), clean(web['L05']['ev']))
rows['L06'] = (st(web['L06']['ok']), clean(web['L06']['ev']))
rows['L07'] = (st(monkey['ok']), clean(monkey['ev']))


# ---------- L08: partidas largas ----------
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


g15, i15 = soak('soak15')
g14, i14 = soak('soak14')
res15 = {}
for g in g15:
    res15[g['result']] = res15.get(g['result'], 0) + 1
names = {'victory': 'victorias del piloto', 'defeat': 'derrotas', 'sin terminar': 'sin terminar a los 20 min', 'error': 'con error'}
iss = lambda d: '; '.join(f"{k}: {v['n']}" for k, v in sorted(d.items(), key=lambda x: -x[1]['n'])) or 'ninguno'
rows['L08'] = (st(len(g15) == 30 and not i15 and not any(g['result'] == 'error' for g in g15)), clean(
    f"30 partidas de 20 minutos (10 modos, 7 mapas, 3 dificultades; 6 jugadores bot, uno de ellos en tu lugar), con chequeos cada segundo: "
    f"{len(g15)} jugadas ({', '.join(f'{v} {names.get(k, k)}' for k, v in res15.items())}); problemas con la v1.5: {iss(i15)}. "
    f"Las mismas 30 partidas con el código de la v1.4: {len(g14)} jugadas; problemas: {iss(i14)} "
    f"(el Ingeniero que espera en el lugar hasta juntar el dinero para fundar es a propósito; lo demás son los errores de L09)."))

# ---------- L09: lista de errores encontrados ----------
row9 = web.get('L09e', {'ok': False, 'ev': 'sin datos'})
row9f = web.get('L09f', {'ok': False, 'ev': 'sin datos'})
l9ok = sim['L09a']['ok'] and not sim14['L09a']['ok'] and sim['L09b']['ok'] and not sim14['L09b']['ok'] and row9['ok'] and row9f['ok'] and sim['L09d']['ok']
rows['L09'] = (st(l9ok), clean(
    f"1) Dúos en Arrecife Doble: v1.5 — {sim['L09a']['ev']}; v1.4 — {sim14['L09a']['ev']}. "
    f"2) Reparar algo rodeado: v1.5 — {sim['L09b']['ev']}; v1.4 — {sim14['L09b']['ev']}. "
    f"3) «Avanzar atacando» quieto ante enemigos inalcanzables (salió en las partidas largas, ver L08): sigue llegando — {sim['L09d']['ev']}. "
    f"4) Fila de jugadores: {row9['ev']}. "
    f"5) Encontrado con los toques al azar: {row9f['ev']}."))
rows['L10'] = (st(web['L10']['ok']), clean(web['L10']['ev']))

# ---------- L11: anteriores, campaña, tamaños y equilibrio ----------
REPLACED = {'H03web': 'J09', 'I08': 'J10', 'I09': 'L01', 'I09sim': 'L01'}
old = []
old += load('results-v14-sim-on-v15.json')
old += [r for r in load('results-v14-board-on-v15.json')]
old += [r for r in load('results-v14-on-v15.json') if re.match(r'^K\d\d', r['id'])]
old += load('results-v13-sim-on-v15.json')
old += [r for r in load('results-v13-on-v15.json') if re.match(r'^J\d\d', r['id'])]
old += load('results-v12-sim-on-v15.json')
old += [r for r in load('results-v12-on-v15.json') if re.match(r'^I\d\d$', r['id'])]
old += load('results-v11-sim-on-v15.json')
old += [r for r in load('results-v11-on-v15.json') if r['id'] in ('H01web', 'H03web', 'H05web', 'H06web', 'H07web', 'H08web')]
old += load('results-v10-sim-on-v15.json')
old += [r for r in load('results-v10-on-v15.json') if r['id'] in ('G01', 'G03web', 'G04web', 'G06web', 'G08web', 'G09web')]
old += load('results-v09-sim-on-v15.json')
old += [r for r in load('results-v09-on-v15.json') if re.match(r'^F\d\d$', r['id'])]
old += [r for r in load('results-v07-on-v15.json') if re.match(r'^D\d\d$', r['id'])]
old += [r for r in load('results-v08-on-v15.json') if re.match(r'^E\d\d$', r['id'])]
old += [r for r in load('results-v08-bots-on-v15.json') if r['id'] in ('E06', 'E07', 'E08', 'E09', 'E10')]
kept = [r for r in old if r['id'] not in REPLACED]
fails = [r['id'] for r in kept if not r['ok']]
by_ver = {}
for r in kept:
    v = {'K': 'v1.4', 'J': 'v1.3', 'I': 'v1.2', 'H': 'v1.1', 'G': 'v1.0', 'F': 'v0.9', 'E': 'v0.8', 'D': 'v0.7'}[r['id'][0]]
    by_ver[v] = by_ver.get(v, 0) + 1


def summ(lst, mid=None):
    sel = [x for x in lst if mid is None or x.get('id') == mid]
    won = [x for x in sel if x['result'] == 'victory']
    times = ', '.join(f"{int(x['time']) // 60}:{int(x['time']) % 60:02d}" for x in won)
    return f"ganó {len(won)} de {len(sel)}" + (f" ({times})" if times else ''), len(won)


c125 = camp('out15-camp125.txt')
s1, w1 = summ(c125, 1)
s2, w2 = summ(c125, 2)
s5, w5 = summ(c125, 5)
s3, w3 = summ(camp('out15-camp3.txt'))
s4, w4 = summ(camp('out15-camp4.txt'))
s6, w6 = summ(camp('out15-camp6.txt'))
camp_ok = all(w > 0 for w in (w1, w2, w3, w4, w5, w6))
sizes = load('results-v15-sizes.json')
big = load('results-v15-sizes-big.json')
sz_ok = all(x['ok'] for x in sizes) and all(x['ok'] for x in big)
b14 = load('duel14-v14.json')
b15 = load('duel15-v15.json')


def bal(d):
    return f"Fácil {d['easy']['w']}-{d['easy']['l']}-{d['easy']['d']}, Normal {d['normal']['w']}-{d['normal']['l']}-{d['normal']['d']}, Difícil {d['hard']['w']}-{d['hard']['l']}-{d['hard']['d']}"


bal_ok = (b15['easy']['w'] >= b14['easy']['w'] - 2 and abs(b15['normal']['w'] - b14['normal']['w']) <= 3 and b15['hard']['w'] <= b14['hard']['w'] + 2)
vers = ', '.join(f'{v}: {n}' for v, n in sorted(by_ver.items(), reverse=True))
sz = lambda lst: ' · '.join(f"{x['name']}: {'bien' if x['ok'] else 'FALLA ' + '; '.join(x['fails'])}" for x in lst)
rows['L11'] = (st(not fails and camp_ok and sz_ok and bal_ok), clean(
    f"Pruebas anteriores en la v1.5: {len(kept) - len(fails)} de {len(kept)} bien ({vers}){' · fallan: ' + ', '.join(fails) if fails else ''} "
    f"(H03, I08, I09 e I09sim quedan reemplazadas por J09, J10 y L01). "
    f"Campaña: M1 {s1}; M2 {s2}; M3 órdenes de jugador {s3}; M4 órdenes de jugador {s4}; M5 {s5}; M6 piloto atento {s6}. "
    f"Equilibrio (piloto de nivel medio contra los bots, 16 partidas por dificultad; victorias-derrotas-empates del piloto): v1.4 {bal(b14)}; v1.5 {bal(b15)}. "
    f"5 tamaños: {sz(sizes)}. Con letra grande y colores para daltonismo: {sz(big)}."))
size_kb = os.path.getsize(GAME) / 1024
rows['L12'] = (st(size_kb < 3.5 * 1024), 'faro.html pesa ' + f'{size_kb / 1024:.2f}'.replace('.', ',') + ' MB (meta: menos de 3,5 MB).')
if not web['errores']['ok']:
    for k in ('L01', 'L02', 'L03', 'L04', 'L05', 'L06'):
        rows[k] = ('fail', rows[k][1] + ' · errores en la consola: ' + web['errores']['ev'])

LABEL = {'ok': ('ok', 'Aprobada'), 'fail': ('fail', 'Fallida')}
s = open(PRD).read()
missing = []


def repl(m):
    cid = m.group(1)
    if cid not in rows:
        missing.append(cid)
        return m.group(0)
    status, ev = rows[cid]
    cls, label = LABEL[status]
    return f'<tr><td>{cid}</td><td>{m.group(2)}</td><td><span class="chip {cls}">{label}</span></td><td>{esc(ev)}</td></tr>'


s = re.sub(r'<tr><td>(L\d\d)</td><td>(.*?)</td><td><span class="chip [a-z]+">[^<]*</span></td><td>.*?</td></tr>', repl, s)
s = s.replace('13 de noviembre de 2026 · Estado: <b id="estado">Plan</b>', f'{hoy.day} de {MES[hoy.month - 1]} de {hoy.year} · Estado: <b id="estado">Terminada (pruebas abajo)</b>')
s = s.replace('<meta name="fecha" content="13 NOV 2026">', f'<meta name="fecha" content="{hoy.day} {MES3[hoy.month - 1]} {hoy.year}">')
s = s.replace('<tr><td>1.5</td><td>13 nov 2026</td><td>Esta versión.</td></tr>',
              f'<tr><td>1.5</td><td>13 nov 2026</td><td>Sin decoraciones de temporada, portada nueva, Núcleo nuevo, banderines y niveles en los edificios, anillos e iconos en las tropas, fichas más útiles y 4 errores arreglados.</td></tr>')
DECISIONS = open(SP + 'prd15-decisions.html').read()
s, n = re.subn(r'<section>\s*<div class="eyebrow">06 · Decisiones</div>.*?</section>', DECISIONS, s, count=1, flags=re.S)
if not n:
    missing.append('decisiones')
open(PRD, 'w').write(s)
counts = {k: sum(1 for v in rows.values() if v[0] == k) for k in LABEL}
print('filas', len(rows), counts, 'sin datos', missing)
for k in sorted(rows):
    if rows[k][0] != 'ok':
        print('NO OK', k, rows[k][1][:700])
if missing:
    sys.exit(1)
