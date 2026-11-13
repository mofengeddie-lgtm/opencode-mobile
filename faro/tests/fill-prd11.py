"""Completa el PRD v1.1 con los resultados reales."""
import html
import json
import os
import re
import sys

SP = os.environ.get('SP', os.path.dirname(os.path.abspath(__file__))) + '/'
PRD = '/home/user/opencode-mobile/faro/docs/prd/PRD_web_v1.1.html'
GAME = '/home/user/opencode-mobile/faro/faro.html'


def load(name):
    return json.loads(open(SP + name).read())


def camp(name):
    s = open(SP + name).read()
    return json.loads(s[s.index('['):])


def clean(t):
    return re.sub(r'\s+', ' ', t).strip()


sim = {r['id']: r for r in load('results-v11-sim.json')}
web = {r['id']: r for r in load('results-v11.json')}
sizes = load('results-v11-sizes.json')
rows = {}


def both(a, b, joiner='. En pantalla: '):
    return ('ok' if a['ok'] and b['ok'] else 'fail', clean(a['ev'] + joiner + b['ev']))


rows['H01'] = both(sim['H01'], web['H01web'])
rows['H02'] = ('ok' if sim['H02']['ok'] else 'fail', clean(sim['H02']['ev']))
rows['H03'] = ('ok' if web['H03web']['ok'] else 'fail', clean(web['H03web']['ev']))
rows['H04'] = ('ok' if sim['H04']['ok'] else 'fail', clean(sim['H04']['ev']))
rows['H05'] = ('ok' if web['H05web']['ok'] else 'fail', clean(web['H05web']['ev']))
rows['H06'] = both(sim['H06'], web['H06web'])
rows['H07'] = both(sim['H07'], web['H07web'])
rows['H08'] = both(sim['H08'], web['H08web'])

old = []
old += load('results-v10-sim-on-v11.json')
old += [r for r in load('results-v10-on-v11.json') if r['id'] in ('G01', 'G03web', 'G04web', 'G06web', 'G08web', 'G09web')]
old += load('results-v09-sim-on-v11.json')
old += [r for r in load('results-v09-on-v11.json') if re.match(r'^F\d\d$', r['id'])]
old += [r for r in load('results-v07.json') if re.match(r'^D\d\d$', r['id'])]
old += [r for r in load('results-v08-on-v09.json') if re.match(r'^E\d\d$', r['id'])]
old += [r for r in load('results-v08-bots-on-v11.json') if r['id'] in ('E06', 'E07', 'E08', 'E09', 'E10')]
fails = [r['id'] for r in old if not r['ok']]


def summ(lst, mid=None):
    sel = [x for x in lst if mid is None or x.get('id') == mid]
    won = [x for x in sel if x['result'] == 'victory']
    times = ', '.join(f"{int(x['time']) // 60}:{int(x['time']) % 60:02d}" for x in won)
    return f"ganó {len(won)} de {len(sel)} ({times})", len(won)


c125 = camp('out11-camp125.txt')
s1, w1 = summ(c125, 1)
s2, w2 = summ(c125, 2)
s5, w5 = summ(c125, 5)
s3, w3 = summ(camp('out11-camp3.txt'))
s4, w4 = summ(camp('out11-camp4.txt'))
s6, w6 = summ(camp('out11-camp6.txt'))
camp_ok = all(w > 0 for w in (w1, w2, w3, w4, w5, w6))
sz_ok = all(x['ok'] for x in sizes)
rows['H09'] = ('ok' if not fails and camp_ok and sz_ok else 'fail', clean(
    f"Pruebas anteriores en la v1.1: {len(old) - len(fails)} de {len(old)} bien (v1.0: 12; v0.9: 18; v0.8: 10; v0.7: 10){' · fallan: ' + ', '.join(fails) if fails else ''}. "
    f"Campaña: M1 {s1}; M2 {s2}; M3 órdenes de jugador {s3}; M4 órdenes de jugador {s4}; M5 {s5}; M6 piloto atento {s6}. "
    f"5 tamaños con portada, Rangos, Núcleo, AIR DEFENSE, Casa, Transporte, Bombardero, Aeropuerto, marcador con «Aliarse», barra de «Construir», final con gráficas y barra de espectador: "
    + ' · '.join(f"{x['name']}: {'bien' if x['ok'] else 'FALLA ' + '; '.join(x['fails'])}" for x in sizes)))
size_kb = os.path.getsize(GAME) / 1024
rows['H10'] = ('ok' if size_kb < 3.5 * 1024 else 'fail', f"faro.html pesa {size_kb / 1024:.2f} MB (meta: menos de 3,5 MB).")

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


s = re.sub(r'<tr><td>(H\d\d)</td><td>(.*?)</td><td><span class="chip [a-z]+">[^<]*</span></td><td>.*?</td></tr>', repl, s)
s = s.replace('Estado: <b id="estado">Plan</b>', 'Estado: <b id="estado">Terminada (pruebas abajo)</b>')
s = s.replace('<tr><td>1.1</td><td>9 nov 2026</td><td>Esta versión.</td></tr>',
              '<tr><td>1.1</td><td>9 nov 2026</td><td>Alianzas, Dúos, Clasificatoria con 10 rangos, órdenes a aliados, defensa de punto del Escudo antimisiles, '
              'música propia, modo espectador y resumen final con gráficas.</td></tr>')
# Quito una afirmación que no pude comprobar en el juego de Roblox.
s = s.replace('Para ganar hay que quedar solo (como en el original, la alianza no da la victoria compartida en todos contra todos).',
              'Para ganar hay que quedar solo: si solo quedan aliados, la alianza se rompe y siguen peleando.')
DECISIONS = f"""<section>
  <div class="eyebrow">07 · Decisiones</div>
  <h2>Decisiones y ajustes durante la versión</h2>
  <ul>
    <li><b>Original, no copia:</b> se tomaron las mecánicas (alianzas, dúos, clasificatoria, defensa antimisiles, música), con nombres, rangos, arte y melodías propios.</li>
    <li><b>Comparación:</b> no pude abrir roblox.com desde aquí; usé los resúmenes del buscador de los registros de cambios del creador. En el plan había escrito que en el original la alianza no da victoria compartida: no lo pude comprobar, así que lo quité; en nuestro juego, si solo quedan aliados, la alianza se rompe.</li>
    <li><b>Alianzas:</b> cada bot decide según su forma de ser (el Constructor acepta más fácil, el Agresivo casi nunca), si hay un rival en común más fuerte, si está en apuros y si lo atacaste hace poco. Entre preguntas al mismo bot hay que esperar 1 minuto.</li>
    <li><b>Dúos:</b> en los primeros mapas la pareja quedaba a la misma distancia que un rival; ahora cada pareja tiene su zona del mapa (tu pareja a unas 11-12 casillas y el rival más cerca a más de 21).</li>
    <li><b>Clasificatoria sin servidores:</b> rivales bots y puntos guardados en tu aparato; desde Oro los rivales juegan en Difícil. «Top jugadores» y «Servidores» siguen para Roblox Studio.</li>
    <li><b>Gráficas:</b> cada línea lleva el color de su imperio (el mismo de todo el juego), pero dos de esos colores se confunden con daltonismo, así que cada línea también tiene su propio trazo, su nombre al final y la leyenda; además hay una tabla.</li>
    <li><b>Música:</b> la intensidad de la batalla depende del tiempo real y no de los cuadros por segundo, para que en un iPad lento suene igual.</li>
    <li><b>Posiciones del final:</b> ahora solo dice «Ganador» si queda un equipo; antes lo ponía aunque otros siguieran en pie.</li>
    <li><b>Corrección del informe de la v1.0:</b> ahí puse que la misión 5 se ganó 3 de 3, pero esa medición se hizo antes del último ajuste de la radiación. Con el código final de la v1.0 (igual que en la v1.1) el piloto la gana 2 de 3: en una semilla lanza un misil, la radiación ya no quema tanto el Núcleo y el rival lo vence a los 26 min. La misión se sigue pudiendo ganar.</li>
    <li><b>Marcador en celular horizontal:</b> se salía por abajo en pantallas muy bajas; ahora se desplaza.</li>
    <li><b>Halloween:</b> no se agregaron decoraciones de temporada porque ya pasó la fecha.</li>
    <li><b>Tamaño:</b> {size_kb / 1024:.2f} MB (meta: menos de 3,5 MB).</li>
  </ul>
  <h3>Siguiente paso</h3>
  <p>Jugar la v1.1 en tu iPad: probar aliarte en Conquista, jugar Dúos y la Clasificatoria, escuchar la música y, si pierdes, seguir mirando. Dime qué más le ves que falta.</p>
</section>"""
s, n = re.subn(r'<section>\s*<div class="eyebrow">07 · Decisiones</div>.*?</section>', DECISIONS, s, count=1, flags=re.S)
if not n:
    missing.append('decisiones')
open(PRD, 'w').write(s)
counts = {k: sum(1 for v in rows.values() if v[0] == k) for k in LABEL}
print('filas', len(rows), counts, 'sin datos', missing)
for k in sorted(rows):
    if rows[k][0] != 'ok':
        print('NO OK', k, rows[k][1][:400])
if missing:
    sys.exit(1)
