"""Junta los resultados reales de las pruebas de la v1.9 y arma el PRD final (P01-P19).

Uso: python3 faro/tests/fill-prd19.py [carpeta del scratchpad con las salidas de la tanda]
Lee: tests/results-v19.json y <sp>/results-v19-final-run.json (P01-P07, P11, P14, P16), tamaños (P08), revisor de idioma
(P10), comparación en español (P12), tamaño y carga (P13), miniaturas (P15), la tanda de pruebas anteriores (P17) y
tests/results-v19-docs.json (P18) y el Laboratorio juntado de la v1.8.1 (P19: tests/results-v19-lab.json y results-v19-same.json). Escribe tests/results-v19-final.json y vuelve a armar docs/prd/PRD_web_v1.9.html.
Una prueba que no corrió queda «No probada»: nunca «Aprobada».
"""
import glob
import gzip
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
    R[i] = {'status': status, 'evidence': re.sub(r'\s+', ' ', ev).strip()}


def load(path):
    try:
        return json.load(open(path, encoding='utf-8'))
    except (OSError, ValueError):
        return None


def sp(name):
    return load(os.path.join(SP, name))


# P01-P07, P11, P14, P16: pruebas de navegador (vale la corrida más nueva de cada una).
br = {}
for f in sorted([os.path.join(HERE, 'results-v19.json'), os.path.join(SP, 'results-v19-final-run.json')], key=lambda p: os.path.getmtime(p) if os.path.exists(p) else 0):
    for x in load(f) or []:
        br[x['id']] = x
for i in ('P01', 'P02', 'P03', 'P04', 'P05', 'P06', 'P07', 'P11', 'P14', 'P16'):
    x = br.get(i)
    put(i, ('ok' if x['ok'] else 'fail') if x else 'np', x['ev'] if x else 'no corrió')

# P08: medidas de Poki, celulares y tableta.
pk = sp('results-v19-sizes-poki-final.json') or sp('results-v19-sizes-poki.json')
five = sp('results-v19-sizes.json')
big = sp('results-v19-sizes-big.json')
sz = lambda lst: ' · '.join(f"{x['name']}: {'bien' if x['ok'] else 'FALLA ' + '; '.join(x['fails'])}" for x in lst) if lst else 'no corrió'
if pk and five:
    ok8 = all(x['ok'] for x in pk) and all(x['ok'] for x in five) and (not big or all(x['ok'] for x in big))
    put('P08', 'ok' if ok8 else 'fail', f"Poki: {sz(pk)} · celulares y tabletas (ipad-h y ipad-v son la tableta): {sz(five)} · con letra grande: {sz(big)}")
else:
    put('P08', 'np', 'faltan resultados de tamaños')

# P09: la píldora de Poki solo existe dentro de poki.com.
put('P09', 'np', 'La píldora la dibuja la página de Poki, no el juego: fuera de poki.com no aparece y aquí no se puede probar. '
    'El juego deja libre la esquina de arriba en el celular (barra de recursos a la izquierda y botones a la derecha) y tiene '
    'Platform.movePill para correrla si hiciera falta. Lo confirmas tú en el Poki Inspector, modo celular.')

# P10: revisor de idioma.
cl = load(os.path.join(FARO, 'tools', 'idioma', 'salida', 'claves.json'))
pa = load(os.path.join(FARO, 'tools', 'idioma', 'salida', 'pantallas.json'))
if cl and pa:
    n = cl['total']
    put('P10', 'ok' if not cl['missing'] and pa['withSpanish'] == 0 and not pa['errors'] else 'fail',
        f"diccionario: {n - len(cl['missing'])} de {n} claves traducidas (código {cl['code']}, datos {cl['data']}, HTML {cl['html']}) · "
        f"{pa['screens']} pantallas recorridas en inglés (vestíbulo y sus pestañas, ventanas, tienda, las fichas del Arsenal, ajustes, partida, "
        f"construir, fichas, pausa, final, misión 1 y avisos): {pa['withSpanish']} con español a la vista, {len(pa['errors'])} errores")
else:
    put('P10', 'np', 'no corrió el revisor de idioma')

# P12: el español queda igual que en la v1.8. Antes de comparar se quitan los cambios planeados: el número de versión,
# las etiquetas de novedades de la portada y el selector de idioma de la pausa.
p12 = sp('results-v19-p12.json')
if p12:
    def norm(t):
        t = re.sub(r'v1\.[89]\b|1\.[89]\b', 'vX', t)
        t = t.replace('Todo tu catálogo: 93 tropas Tu ejército en la portada Campo de pruebas Ajustes a tu manera Programa revisor', '[novedades]')
        t = t.replace('93 tropas y 42 edificios Tu ejército en la portada Campo de pruebas Español e inglés Ajustes a tu manera', '[novedades]')
        t = t.replace('93 tropas y 42 edificios Tu ejército en la portada Laboratorio de pruebas Español e inglés Ajustes a tu manera', '[novedades]')
        t = re.sub(r'IDIOMA · LANGUAGE Español English (Automático: el idioma de tu navegador o de Poki\.|Elegido por ti\.) ?', '', t)
        return re.sub(r'\s+', ' ', t).strip()
    a, c = p12['a'], p12['c']
    raw_same = sum(1 for k in a if a[k] == c.get(k))
    diff = [k for k in a if norm(a[k]) != norm(c.get(k, ''))]
    put('P12', 'ok' if not diff else 'fail',
        f"{len(a)} pantallas en español (vestíbulo y sus partes, partida, construir, fichas, pausa y final) comparadas texto por texto con la v1.8: "
        f"{raw_same} idénticas tal cual; quitando lo planeado (número de versión, etiquetas de novedades de la portada y el selector de idioma de la pausa) "
        f"{len(a) - len(diff)} de {len(a)} idénticas" + (f" · distintas: {', '.join(diff)}" if diff else ''))
else:
    put('P12', 'np', 'no corrió')

# P13: tamaño y carga.
web = os.path.join(FARO, 'faro.html')
poki = os.path.join(FARO, 'poki', 'index.html')
zipf = os.path.join(FARO, 'poki', 'faro-poki.zip')
lt = sp('results-v19-load.json')
cmp = sp('meshcmp/cmp.json') or load(os.path.join(SP, 'meshcmp', 'cmp.json'))
if os.path.exists(poki) and lt:
    size = os.path.getsize(poki)
    gz = len(gzip.compress(open(poki, 'rb').read(), 9))
    same = sum(1 for x in (cmp or []) if x.get('same'))
    ok13 = size <= 5_000_000 and gz <= 1_600_000 and lt['pct'] <= 10 and (not cmp or same == len(cmp))
    put('P13', 'ok' if ok13 else 'fail',
        f"versión de Poki: {size / 1e6:.2f} MB ({gz / 1e6:.2f} MB comprimida; .zip {os.path.getsize(zipf) / 1e6:.2f} MB) con three.js, fuentes y diccionario adentro · "
        f"carga hasta el vestíbulo (medida dentro de la página, 6 veces cada una, mediana): v1.8 {lt['med18']} ms, v1.9 {lt['med19']} ms ({lt['pct']:+d} %) · "
        f"modelos comprimidos con meshopt sin cuantizar: 2,44 → 2,00 MB, {same} de {len(cmp or [])} con los mismos triángulos, piezas y tamaño · "
        f"la versión cuantizada (1,60 MB) se descartó: la carga pasaba de 7 s a 90 s en Chromium sin tarjeta gráfica")
else:
    put('P13', 'np', 'faltan medidas')

# P15: miniaturas.
th = load(os.path.join(HERE, 'results-v19-thumbs.json'))
if th:
    ok15 = all(v['size'][0] >= 628 and v['size'][0] == v['size'][1] and v['near_poki_pct'] < 5 for v in th.values())
    put('P15', 'ok' if ok15 else 'fail', ' · '.join(f"{k}.png: {v['size'][0]}×{v['size'][1]}, sin texto ni bordes, {v['near_poki_pct']} % de píxeles parecidos al fondo #83FFE7 de Poki" for k, v in th.items())
        + ' · revisadas también a 128×128 sobre el color de Poki: el Núcleo se distingue en las dos (docs/poki/).')
else:
    put('P15', 'np', 'no se hicieron')

# P17: sin regresiones (pruebas anteriores, campaña, números, revisor).
REPLACED = {'H03web': 'J09', 'I08': 'J10', 'I09': 'L01', 'I09sim': 'L01'}
PLANNED = {
    'L01sim': 'L01sim (reglas iguales a la v1.4) marca los cambios planeados de la v1.8 (nombres de tu catálogo y tropas nuevas)',
    'N05': 'N05 (Arsenal) espera los conteos de la v1.7',
}
SUITES = [
    ('results-v17-on-v19.json', r'^N\d\d$', 'v1.7'), ('results-v16-on-v19.json', r'^M0[1-5]$', 'v1.6'),
    ('results-v15-on-v19.json', r'^L\d\d', 'v1.5'), ('results-v14-on-v19.json', r'^K\d\d', 'v1.4'),
    ('results-v13-on-v19.json', r'^J\d\d', 'v1.3'), ('results-v12-on-v19.json', r'^I\d\d$', 'v1.2'),
    ('results-v11-on-v19.json', r'^H0[135678]web$', 'v1.1'), ('results-v10-on-v19.json', r'^G0(1|3web|4web|6web|8web|9web)$', 'v1.0'),
    ('results-v09-on-v19.json', r'^F\d\d$', 'v0.9'), ('results-v08-on-v19.json', r'^E\d\d$', 'v0.8'), ('results-v07-on-v19.json', r'^D\d\d$', 'v0.7'),
]
SIMS = [('test-v18-sim', 'v1.8'), ('test-v15-sim', 'v1.5'), ('test-v14-sim', 'v1.4'), ('test-v14-board', 'v1.4'), ('test-v13-sim', 'v1.3'),
        ('test-v12-sim', 'v1.2'), ('test-v11-sim', 'v1.1'), ('test-v10-sim', 'v1.0'), ('test-v09-sim-b', 'v0.9'), ('test-v08-bots-b', 'v0.8')]
old, planned_seen, not_run, by_ver = [], [], [], {}


def take(r, ver):
    if r['id'] in REPLACED or r['id'] == 'errores':
        return
    if r['id'] in PLANNED and not r['ok']:
        planned_seen.append(r['id'])
        return
    old.append(dict(r, ver=ver))
    by_ver[ver] = by_ver.get(ver, 0) + 1


# Repeticiones a solas de las que dependen del tiempo (vale la más nueva).
REDO = {'results-v17-on-v19.json': ['results-v17-N10.json']}
redone = []
for name, pat, ver in SUITES:
    data = sp(name)
    if not isinstance(data, list):
        not_run.append(name.replace('results-', '').replace('-on-v19.json', ''))
        continue
    for rn in REDO.get(name, []):
        rd = sp(rn)
        if isinstance(rd, list) and os.path.getmtime(os.path.join(SP, rn)) > os.path.getmtime(os.path.join(SP, name)):
            redo = {x['id']: x for x in rd if x.get('id') != 'errores'}
            for x in data:
                if x['id'] in redo and x['ok'] != redo[x['id']]['ok']:
                    redone.append(f"{x['id']} {'bien' if redo[x['id']]['ok'] else 'mal'} al repetirla sola (en la tanda: {'bien' if x['ok'] else 'mal'})")
            data = [redo.get(x['id'], x) for x in data]
    for x in data:
        if pat and re.match(pat, x['id']):
            take(x, ver)
v18 = os.path.join(SP, 'out19-run-v18.txt')
if os.path.exists(v18):
    o18 = {m.group(2): m.group(1) == 'OK' for m in re.finditer(r'^(OK|FAIL) +(O\d\d)', open(v18, encoding='utf-8').read(), re.M)}
    # O21 necesita la contraseña de creadores en CREATOR_PW (nunca guardada en el proyecto): se corrió aparte con ella.
    redo = os.path.join(SP, 'out19-redo-o21.txt')
    if os.path.exists(redo):
        o18.update({m.group(2): m.group(1) == 'OK' for m in re.finditer(r'^(OK|FAIL) +(O\d\d)', open(redo, encoding='utf-8').read(), re.M)})
    # O15 y O16 (Campo de pruebas y Ajustes) otra vez sobre el archivo final, con el Laboratorio juntado.
    fin = os.path.join(SP, 'out19f-run-v18.txt')
    if os.path.exists(fin):
        o18.update({m.group(2): m.group(1) == 'OK' for m in re.finditer(r'^(OK|FAIL) +(O\d\d)', open(fin, encoding='utf-8').read(), re.M)})
    for k, v in o18.items():
        take({'id': k, 'ok': v}, 'v1.8')
else:
    not_run.append('v18')
for t, ver in SIMS:
    f = os.path.join(SP, f'out19-{t}.txt')
    if not os.path.exists(f):
        not_run.append(t)
        continue
    txt = open(f, encoding='utf-8').read()
    for m in re.finditer(r'^(?:(OK|FAIL) +(\S+)|(✅|❌) (O\d\d):)', txt, re.M):
        ok = (m.group(1) or m.group(3)) in ('OK', '✅')
        take({'id': m.group(2) or m.group(4), 'ok': ok}, ver)
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
    return f"ganó {len(won)} de {len(sel)}", len(won)


c125 = camp('out19-camp125.txt')
s1, w1 = summ(c125, 1)
s2, w2 = summ(c125, 2)
s5, w5 = summ(c125, 5)
s3, w3 = summ(camp('out19-camp3.txt'))
s4, w4 = summ(camp('out19-camp4.txt'))
s6, w6 = summ(camp('out19-camp6.txt'))
camp_ok = all(w > 0 for w in (w1, w2, w3, w4, w5, w6))
num = sp('results-v18-numbers-on-v19.json')
d18, d19 = sp('duel18-v18.json'), sp('duel19-v19.json')
bal = lambda d: (f"Fácil {d['easy']['w']}-{d['easy']['l']}-{d['easy']['d']}, Normal {d['normal']['w']}-{d['normal']['l']}-{d['normal']['d']}, "
                 f"Difícil {d['hard']['w']}-{d['hard']['l']}-{d['hard']['d']}") if d else 'no corrió'
soak = [load(f) for f in sorted(glob.glob(os.path.join(HERE, 'soak19-*.json')))]
soak = [x for x in soak if x]
games = sum(len(x['games']) for x in soak)
issues = {}
for x in soak:
    for k, v in x['issues'].items():
        issues[k] = issues.get(k, 0) + v['n']
mk = sp('results-v19-monkey.json')
if isinstance(mk, list):
    # La prueba de toques al azar (L07 de la v1.5) guarda una lista; vale si todas sus entradas están bien.
    mk = {'ok': bool(mk) and all(x.get('ok') for x in mk)}
rev_out = open(os.path.join(SP, 'out19-revisor.txt'), encoding='utf-8').read() if os.path.exists(os.path.join(SP, 'out19-revisor.txt')) else ''
rev = load(os.path.join(FARO, 'tools', 'revisar', 'salida', 'informe.json'))
rev_ok = bool(rev) and rev['summary']['catalog_ok'] == rev['summary']['catalog_total']
extra = load(os.path.join(HERE, 'results-v19-regress.json')) or {}
vers = ', '.join(f'{v}: {n}' for v, n in sorted(by_ver.items(), key=lambda kv: [int(p) for p in kv[0][1:].split('.')], reverse=True))
ev17 = (f"Pruebas anteriores en la v1.9: {len(old) - len(fails)} de {len(old)} bien ({vers})" + (f" · fallan: {', '.join(fails)}" if fails else '') +
        ' (H03, I08, I09 e I09sim siguen reemplazadas por J09, J10 y L01; M01, la pantalla de error cuando no llega el motor 3D, ya no aplica: el motor viene dentro del archivo, lo cubren P01 y P16)' +
        (' · repetidas a solas: ' + '; '.join(redone) if redone else '') +
        (' · ' + ' · '.join(PLANNED[k] for k in sorted(set(planned_seen))) if planned_seen else '') +
        (' · no corrieron: ' + ', '.join(not_run) if not_run else '') + '. ' +
        (f"Números de tropas y edificios iguales a la v1.7 ({'sí' if num['ok'] else 'NO'}). " if num else 'Números: no corrió. ') +
        f"Campaña: M1 {s1}; M2 {s2}; M3 {s3}; M4 {s4}; M5 {s5}; M6 {s6}. "
        f"Equilibrio (16 partidas por dificultad): v1.8 {bal(d18)}; v1.9 {bal(d19)}. "
        f"{games} partidas largas de 20 min: " + ('sin problemas' if games and not issues else ', '.join(f'{k}: {v}' for k, v in issues.items()) or 'no corrieron') + '. '
        f"Toques al azar 15 min: {'bien' if mk and mk.get('ok') else 'no corrió' if not mk else 'FALLA'}. "
        f"Revisor del catálogo: {rev['summary']['catalog_ok'] if rev else '?'} de {rev['summary']['catalog_total'] if rev else '?'}." + (f" {extra['note']}" if extra.get('note') else ''))
complete = not not_run and c125 is not None and d19 is not None and num is not None and games > 0
put('P17', ('ok' if not fails and camp_ok and num['ok'] and not issues and rev_ok else 'fail') if complete else 'np', ev17)

# P18: documento, sitio y PDF.
docs = load(os.path.join(HERE, 'results-v19-docs.json'))
put('P18', ('ok' if docs['ok'] else 'fail') if docs else 'np', docs['ev'] if docs else 'no corrió')

# P19: el Laboratorio de la v1.8.1 (publicada aparte) juntado en la v1.9.
lab = load(os.path.join(HERE, 'results-v19-lab.json'))
lab_en = sp('results-v19-lab-en.json')
lab181 = sp('results-v19-lab-v181.json')
same = load(os.path.join(HERE, 'results-v19-same.json'))
if lab:
    short = lambda r: f"{sum(1 for x in r['results'] if x['ok'])} de {len(r['results'])}" + (f" (fallan: {', '.join(r['failed'])})" if r['failed'] else '')
    ev = ' · '.join(f"{x['id']}: {x['ev']}" for x in lab['results'] if x['id'] != 'errores')
    ev += f" · consola: {next((x['ev'] for x in lab['results'] if x['id'] == 'errores'), '?')}"
    ev += f" · en español: {short(lab)}"
    if lab_en:
        ev += f" · en inglés: {short(lab_en)} (panel: «{lab_en['panelText'][:90].replace(chr(10), ' / ')}…»)"
    same_text = None
    if lab181:
        same_text = lab181.get('panelText') == lab.get('panelText')
        ev += f" · la misma prueba en la v1.8.1 publicada: {short(lab181)}; texto del panel en español idéntico al de la v1.8.1: {'sí' if same_text else 'NO'}"
    if same:
        ev += f" · {same['ev']}"
    ok19 = lab['ok'] and (lab_en is None or lab_en['ok']) and (same_text is not False) and (same is None or same['ok'])
    complete = lab_en is not None and lab181 is not None and same is not None
    put('P19', ('ok' if ok19 else 'fail') if complete or not ok19 else 'np', ev + ('' if complete else ' · faltan corridas (inglés, v1.8.1 o comparación de partidas)'))
else:
    put('P19', 'np', 'no corrió')

json.dump(R, open(os.path.join(HERE, 'results-v19-final.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
for i in sorted(R):
    print(f"{i} {R[i]['status']:5} {R[i]['evidence'][:150]}")
subprocess.run([sys.executable, os.path.join(FARO, 'docs', 'prd', 'prd_v19.py'), '--final', os.path.join(HERE, 'results-v19-final.json')], check=True)
