"""Junta los resultados reales de las pruebas de la v1.8 y arma el PRD final (O01-O20).

Uso: python3 faro/tests/fill-prd18.py [carpeta de resultados del navegador]  (por defecto, el scratchpad de la sesión)
Lee: tests/results-v18-sim.json (O04-O13), results-v18*.json (O14, O15, O16, O19), results-v18-bots.json y soak18-*.json (O17),
results-v18-numbers.json y chain18.log (O18), el informe del revisor (O01-O03) y results-v18-docs.json (O20).
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

# O18: sin regresiones.
num = load(os.path.join(HERE, 'results-v18-numbers.json'))
log = open(os.path.join(SP, 'chain18.log'), encoding='utf-8').read() if os.path.exists(os.path.join(SP, 'chain18.log')) else ''
oks = fails = 0
lines = []
for m in re.finditer(r'^(\S[^\n]*?)(?: exit=(\d+))? (\d+) OK, (\d+) FAIL', log, re.M):
    oks += int(m.group(3))
    fails += int(m.group(4))
    lines.append(f"{m.group(1).strip()}: {m.group(3)} bien" + (f", {m.group(4)} mal" if int(m.group(4)) else ''))
camp = 'campaña terminada' in log
done = 'FIN18' in log
extra = load(os.path.join(HERE, 'results-v18-regress.json')) or {}
if num and done:
    ok18 = num['ok'] and fails == extra.get('planned_fails', 0)
    put('O18', 'ok' if ok18 else 'fail', f"{num['units']} tropas, {num['buildings']} edificios, modos, dificultades y campaña de la v1.7 con los mismos números · "
        f"pruebas de versiones anteriores: {oks} bien, {fails} mal" + (f" ({extra['note']})" if extra.get('note') else '') + (' · campaña: ' + extra['camp'] if extra.get('camp') else ''))
else:
    put('O18', 'np', 'la tanda de pruebas anteriores no terminó' + (f' (van {oks} bien, {fails} mal)' if lines else ''))

# O20: documentos, sitio y PDF.
docs = load(os.path.join(HERE, 'results-v18-docs.json'))
put('O20', ('ok' if docs['ok'] else 'fail') if docs else 'np', docs['ev'] if docs else 'no corrió')

json.dump(R, open(os.path.join(HERE, 'results-v18-final.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
for i, r in R.items():
    print(f"{i} {r['status']:5} {r['evidence'][:150]}")
subprocess.run([sys.executable, os.path.join(FARO, 'tools', 'revisar', 'prd_v18.py'), '--final', os.path.join(HERE, 'results-v18-final.json')], check=True)
