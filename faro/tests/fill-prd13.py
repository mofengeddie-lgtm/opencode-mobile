"""Completa el PRD v1.3 con los resultados reales y la tabla de contenido y precios."""
import html
import json
import os
import re
import sys

SP = os.environ.get('SP', os.path.dirname(os.path.abspath(__file__))) + '/'
PRD = '/home/user/opencode-mobile/faro/docs/prd/PRD_web_v1.3.html'
GAME = '/home/user/opencode-mobile/faro/faro.html'


def load(name):
    return json.loads(open(SP + name).read())


def camp(name):
    s = open(SP + name).read()
    return json.loads(s[s.index('['):])


def clean(t):
    return re.sub(r'\s+', ' ', t).strip()


def esc(t):
    return html.escape(str(t))


sim = {r['id']: r for r in load('results-v13-sim.json')}
old_sim = {r['id']: r for r in load('results-v12repro-sim.json')}
web = {r['id']: r for r in load('results-v13.json')}
# v1.3: la prueba del guardado se repitió después de acelerar la suma de control (última corrida).
if os.path.exists(SP + 'results-v13-J07.json'):
    for r in load('results-v13-J07.json'):
        if r['id'] == 'J07web':
            web['J07web'] = r
sizes = load('results-v13-sizes.json')
rows = {}


def with_v12(rid, r):
    """Resultado de la v1.3 y, para comparar, lo que pasaba con el código de la v1.2."""
    o = old_sim.get(rid)
    ev = clean(r['ev'])
    if o:
        ev += ' · Con el código de la v1.2 (el bug, reproducido antes de arreglarlo): ' + clean(o['ev'].split(' · ')[-1] if ' · ' in o['ev'] else o['ev'])
    return ('ok' if r['ok'] else 'fail', ev)


rows['J01'] = with_v12('J01', sim['J01'])
rows['J02'] = ('ok' if web['J02']['ok'] else 'fail', clean(web['J02']['ev']))
rows['J03'] = with_v12('J03', sim['J03'])
rows['J04'] = with_v12('J04', sim['J04'])
rows['J05'] = with_v12('J05', sim['J05'])
j6 = with_v12('J06sim', sim['J06sim'])
rows['J06'] = ('ok' if sim['J06sim']['ok'] and web['J06web']['ok'] else 'fail', j6[1] + ' · En pantalla: ' + clean(web['J06web']['ev']))
j7ai = with_v12('J07ai', sim['J07ai'])
rows['J07'] = ('ok' if web['J07web']['ok'] and sim['J07ai']['ok'] else 'fail', clean(web['J07web']['ev']) + ' · IA de los bots: ' + j7ai[1])
for k in ('J08', 'J09', 'J10', 'J11'):
    rows[k] = ('ok' if web[k]['ok'] else 'fail', clean(web[k]['ev']))
rows['J12'] = with_v12('J12', sim['J12'])
if not web['errores']['ok']:
    for k in ('J02', 'J06', 'J07', 'J08', 'J09', 'J10', 'J11'):
        rows[k] = ('fail', rows[k][1] + ' · errores en la consola: ' + web['errores']['ev'])

# ---------- J13: pruebas anteriores, campaña y tamaños ----------
REPLACED = {'H03web': 'J09 (la Clasificatoria de la v1.1 pasó a ser la Liga 3 vs 3 con los rangos de tu documento)',
            'I08': 'J10 (el tutorial de la v1.2 cambió por el de tu documento, con la Barcaza)'}
old = []
old += load('results-v12-sim-on-v13.json')
old += [r for r in load('results-v12-on-v13.json') if re.match(r'^I\d\d$', r['id'])]
old += load('results-v11-sim-on-v13.json')
old += [r for r in load('results-v11-on-v13.json') if r['id'] in ('H01web', 'H03web', 'H05web', 'H06web', 'H07web', 'H08web')]
old += load('results-v10-sim-on-v13.json')
old += [r for r in load('results-v10-on-v13.json') if r['id'] in ('G01', 'G03web', 'G04web', 'G06web', 'G08web', 'G09web')]
old += load('results-v09-sim-on-v13.json')
old += [r for r in load('results-v09-on-v13.json') if re.match(r'^F\d\d$', r['id'])]
old += [r for r in load('results-v07-on-v13.json') if re.match(r'^D\d\d$', r['id'])]
old += [r for r in load('results-v08-on-v13.json') if re.match(r'^E\d\d$', r['id'])]
old += [r for r in load('results-v08-bots-on-v13.json') if r['id'] in ('E06', 'E07', 'E08', 'E09', 'E10')]
replaced = [r for r in old if r['id'] in REPLACED]
kept = [r for r in old if r['id'] not in REPLACED]
fails = [r['id'] for r in kept if not r['ok']]
by_ver = {}
for r in kept:
    v = {'I': 'v1.2', 'H': 'v1.1', 'G': 'v1.0', 'F': 'v0.9', 'E': 'v0.8', 'D': 'v0.7'}[r['id'][0]]
    by_ver[v] = by_ver.get(v, 0) + 1


def summ(lst, mid=None):
    sel = [x for x in lst if mid is None or x.get('id') == mid]
    won = [x for x in sel if x['result'] == 'victory']
    times = ', '.join(f"{int(x['time']) // 60}:{int(x['time']) % 60:02d}" for x in won)
    return f"ganó {len(won)} de {len(sel)} ({times})", len(won)


c125 = camp('out13-camp125.txt')
s1, w1 = summ(c125, 1)
s2, w2 = summ(c125, 2)
s5, w5 = summ(c125, 5)
s3, w3 = summ(camp('out13-camp3.txt'))
s4, w4 = summ(camp('out13-camp4.txt'))
s6, w6 = summ(camp('out13-camp6.txt'))
camp_ok = all(w > 0 for w in (w1, w2, w3, w4, w5, w6))
sz_ok = all(x['ok'] for x in sizes)
vers = ', '.join(f'{v}: {n}' for v, n in sorted(by_ver.items(), reverse=True))
rep_txt = '; '.join(f"{r['id']} ({'pasa' if r['ok'] else 'ya no pasa, como se esperaba'}) se reemplaza por {REPLACED[r['id']]}" for r in replaced)
rows['J13'] = ('ok' if not fails and camp_ok and sz_ok else 'fail', clean(
    f"Pruebas anteriores en la v1.3: {len(kept) - len(fails)} de {len(kept)} bien ({vers}){' · fallan: ' + ', '.join(fails) if fails else ''}. "
    f"Cambiaron a propósito: {rep_txt}. "
    f"Campaña (igual que en la v1.2): M1 {s1}; M2 {s2}; M3 órdenes de jugador {s3}; M4 órdenes de jugador {s4}; M5 {s5}; M6 piloto atento {s6}. "
    f"5 tamaños (portada, Rangos y tabla, Taller, mapas, Personalizado, Núcleo, AIR DEFENSE, Casa, Transporte, Bombardero, Aeropuerto, rueda, Mensajes, pausa, marcador, «Construir», tutorial, final y espectador): "
    + ' · '.join(f"{x['name']}: {'bien' if x['ok'] else 'FALLA ' + '; '.join(x['fails'])}" for x in sizes)))
size_kb = os.path.getsize(GAME) / 1024
rows['J14'] = ('ok' if size_kb < 3.5 * 1024 else 'fail', 'faro.html pesa ' + f'{size_kb / 1024:.2f}'.replace('.', ',') + ' MB (meta: menos de 3,5 MB).')

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
    return f'<tr><td>{cid}</td><td>{m.group(2)}</td><td><span class="chip {cls}">{label}</span></td><td>{esc(ev)}</td></tr>'


s = re.sub(r'<tr><td>(J\d\d)</td><td>(.*?)</td><td><span class="chip [a-z]+">[^<]*</span></td><td>.*?</td></tr>', repl, s)
s = s.replace('10 de noviembre de 2026 · Estado: <b id="estado">Plan</b>', '11 de noviembre de 2026 · Estado: <b id="estado">Terminada (pruebas abajo)</b>')
s = s.replace('<meta name="fecha" content="10 NOV 2026">', '<meta name="fecha" content="11 NOV 2026">')
s = s.replace('<tr><td>1.3</td><td>10 nov 2026</td><td>Esta versión.</td></tr>',
              '<tr><td>1.3</td><td>10-11 nov 2026</td><td>Los 29 puntos de tu revisión: 11 bugs, guardado y bots más livianos, panel compacto y botones de 44 px, '
              'rangos y Liga 3 vs 3 de tu documento, temporadas, tutorial con Barcaza, copia del progreso, Muro a 30 y tabla de precios.</td></tr>')
s = s.replace('<p>Cada bug se reproduce primero (que falle con la v1.2) y después se comprueba arreglado. Chromium con tamaño de iPad y de celular, toques simulados, partidas simuladas y todas las pruebas anteriores.</p>',
              '<p>Cada bug se reprodujo primero con el código de la v1.2 (las 7 pruebas de lógica fallaron con la v1.2) y después se comprobó arreglado. '
              'Chromium con tamaño de iPad y de celular, toques simulados, partidas simuladas y todas las pruebas anteriores.</p>')

# ---------- tabla de contenido y precios ----------
C = json.loads(open(SP + 'content13.json').read())
DOC_B = {'core': 'Gratis', 'farm': '800', 'wind': '150 (Molino)', 'house': '5.000', 'barracks': '200', 'factory': '400 + 50 E', 'harbor': '3.000',
         'helipad': '40.000', 'wall': '30', 'turret': '250', 'aadef': '300', 'pump': '3.200', 'rig': '15.000'}
DOC_U = {'builder': '200', 'engineer': '600', 'rifle': '700', 'shotgun': '950', 'ranger': '1.000', 'sniper': '1.200', 'breaker': '1.250', 'hunter': '1.800',
         'rocket': '2.500', 'tank': '300 + 30 E', 'aa': '200 + 20 E', 'speedboat': '1.800', 'boatEng': '2.600', 'barge': '4.100', 'destroyer': '6.000',
         'sub': '6.800', 'heli': '26.000', 'apache': '35.000'}


def money(n, e=0):
    t = 'Gratis' if not n else f'{n:,}'.replace(',', '.')
    return t + (f' + {e} E' if e else '')


brows = ''.join(f"<tr><td>{esc(b['name'])}</td><td>{money(b['cost'], b['e'])}</td><td>{DOC_B.get(b['k'], '—')}</td><td>{b['limit'] or '—'}</td></tr>" for b in C['blds'])
urows = ''.join(f"<tr><td>{esc(u['name'])}</td><td>{money(u['cost'], u['e'])}</td><td>{DOC_U.get(u['k'], '—')}</td><td>{u['pop']}</td><td>{esc(u['where'] or '—')}</td></tr>" for u in C['units'])
in_doc_b = sum(1 for b in C['blds'] if b['k'] in DOC_B)
in_doc_u = sum(1 for u in C['units'] if u['k'] in DOC_U)
CONTENT = f"""<section>
  <div class="eyebrow">06 · Contenido y precios</div>
  <h2>Todo lo que tiene el juego (para que lo apruebes)</h2>
  <p>{len(C['blds'])} edificios, {len(C['units'])} unidades, {len(C['modes'])} modos en el vestíbulo ({esc(', '.join(C['modes']))}) y {len(C['maps'])} mapas ({esc(', '.join(C['maps']))}), más la campaña de 6 misiones.
  La columna «Tu documento» es la tabla de precios del PRD 1.5 (muchos marcados EJEMPLO); «—» quiere decir que tu documento no lo tiene. E = energía.
  {in_doc_b} de los {len(C['blds'])} edificios y {in_doc_u} de las {len(C['units'])} unidades están en tu documento.</p>
  <h3>Edificios</h3>
  <table><thead><tr><th>Edificio</th><th>En el juego</th><th>Tu documento</th><th>Límite</th></tr></thead><tbody>{brows}</tbody></table>
  <h3>Unidades</h3>
  <table><thead><tr><th>Unidad</th><th>En el juego</th><th>Tu documento</th><th>Comunidad</th><th>Se hace en</th></tr></thead><tbody>{urows}</tbody></table>
  <p>Los precios del juego son más bajos que los de tu documento porque las partidas son más cortas (unos 10-25 minutos) y están probados con los bots y la campaña. Dime cuáles cambiar o si los apruebas así.</p>
</section>"""

DECISIONS = """<section>
  <div class="eyebrow">05 · Decisiones</div>
  <h2>Ajustes durante la versión</h2>
  <ul>
    <li><b>Pruebas que cambiaron a propósito:</b> la prueba de la Clasificatoria de la v1.1 (H03) y la del tutorial de la v1.2 (I08) ya no aplican porque esas partes cambiaron según tu documento; las reemplazan J09 y J10.</li>
    <li><b>Liga 3 vs 3:</b> tus puntos de la Clasificatoria se conservan y ahora valen para los 6 rangos. Una partida de la Clasificatoria guardada se abre como Liga. Rivales en Difícil desde Sargento.</li>
    <li><b>Protección de rango:</b> al subir de rango, la primera derrota no te baja de él (te deja justo en el mínimo del rango); la protección se gasta con esa derrota.</li>
    <li><b>Almirante del Faro:</b> en Roblox serán los 50 mejores; aquí, sin servidores, desde 2.400 puntos.</li>
    <li><b>Temporadas:</b> de 2 meses; la Temporada 1 es noviembre-diciembre de 2026 y termina el 1 de enero. El nivel no se pierde: solo el pase vuelve a empezar. La opción de la pausa ahora se llama «Decoración de temporada» para no confundirla.</li>
    <li><b>Tutorial:</b> se juega en «Mar abierto» (el bot siempre queda en otra isla) y empieza con 6.000 monedas para que alcance para el Puerto y la Barcaza.</li>
    <li><b>Guardado:</b> el mapa se vuelve a crear con su semilla y una suma de control comprueba que sea el mismo; las partidas guardadas con la v1.2 se siguen abriendo. En una de las corridas finales la prueba J07 falló por tiempo: cada guardado bajó de 10,9 a 6,9 ms, no a la mitad. La causa era que la suma de control del mapa se recalculaba en cada guardado. Ahora se calcula una vez por partida y J07 se repitió con ese arreglo.</li>
    <li><b>Panel de selección:</b> «Más detalles» empieza plegado en todas las pantallas; lo que elijas vale hasta que cierres el juego.</li>
    <li><b>Muro a 30:</b> los bots no construyen muros, así que no cambia cómo juegan; la campaña dio los mismos resultados.</li>
    <li><b>Copia del progreso:</b> es un texto que empieza con «FARO1.» y lleva una suma de control; si se corta al copiarlo, no se carga.</li>
  </ul>
</section>"""
s, n1 = re.subn(r'(<section>\s*<div class="eyebrow">05 · Por decidir</div>)', DECISIONS.replace('\\', '\\\\') + '\n\n' + CONTENT.replace('\\', '\\\\') + '\n\n<section>\n  <div class="eyebrow">07 · Por decidir</div>', s, count=1)
s = s.replace('<section>\n  <div class="eyebrow">07 · Por decidir</div>\n  <div class="eyebrow">05 · Por decidir</div>', '<section>\n  <div class="eyebrow">07 · Por decidir</div>')
s = s.replace('<p>Programar la v1.3, probar cada punto y entregarte el PDF con los resultados y la tabla de contenido y precios.</p>',
              '<p>Jugar la v1.3 en tu iPad: el tutorial nuevo con la Barcaza, el panel con «Más detalles», la Liga 3 vs 3 (desde el nivel 10) y la «Copia de tu progreso». '
              'Y decirme qué decides sobre los puntos de arriba (sobre todo la tabla de precios).</p>')
if not n1:
    missing.append('secciones')
open(PRD, 'w').write(s)
counts = {k: sum(1 for v in rows.values() if v[0] == k) for k in LABEL}
print('filas', len(rows), counts, 'sin datos', missing)
for k in sorted(rows):
    if rows[k][0] != 'ok':
        print('NO OK', k, rows[k][1][:500])
if missing:
    sys.exit(1)
