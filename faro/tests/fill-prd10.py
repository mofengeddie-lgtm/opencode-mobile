"""Completa el PRD v1.0 con los resultados reales."""
import html
import json
import os
import re
import sys

SP = os.environ.get('SP', os.path.dirname(os.path.abspath(__file__))) + '/'
PRD = '/home/user/opencode-mobile/faro/docs/prd/PRD_web_v1.0.html'
GAME = '/home/user/opencode-mobile/faro/faro.html'


def load(name):
    return json.loads(open(SP + name).read())


def camp(name):
    s = open(SP + name).read()
    return json.loads(s[s.index('['):])


def clean(t):
    return re.sub(r'\s+', ' ', t).strip()


rows = {}
sim = {r['id']: r for r in load('results-v10-sim.json')}
web = {r['id']: r for r in load('results-v10.json')}
sizes = load('results-v10-sizes.json')

rows['G01'] = ('ok' if web['G01']['ok'] else 'fail', clean(web['G01']['ev']))
rows['G02'] = ('ok' if sim['G02']['ok'] else 'fail', clean(sim['G02']['ev']))
rows['G03'] = ('ok' if sim['G03']['ok'] and web['G03web']['ok'] else 'fail', clean(sim['G03']['ev'] + '. En pantalla: ' + web['G03web']['ev']))
rows['G04'] = ('ok' if sim['G04']['ok'] and web['G04web']['ok'] else 'fail', clean(sim['G04']['ev'] + '. En pantalla: ' + web['G04web']['ev']))

# G05: duelos contra el Difícil de la v0.9 y tiempo para derrotar al piloto.
ds = [load(f'duel-hard-{k}.json') for k in (1, 2, 3, 4)]
nw = sum(d['newW'] for d in ds)
ow = sum(d['oldW'] for d in ds)
dr = sum(d['draws'] for d in ds)
pct = round(nw / (nw + ow) * 100) if nw + ow else 0
base = load('duel-diff-base-hard.json')['hard']
new = load('duel-diff-v10.json')['hard']


def avg(r):
    t = [int(s.split('@')[1]) for s in r['out']]
    return sum(t) / len(t) / 60


bavg, navg = avg(base), avg(new)
g05_ok = pct >= 60 and navg < 9 and new['w'] == 0 and sim['G05t']['ok']
rows['G05'] = ('ok' if g05_ok else 'fail', clean(
    f"(1) Difícil v1.0 contra Difícil v0.9, misma economía, 72 duelos de 25 min (3 mapas × 12 semillas × los dos lados): ganó {nw}, perdió {ow}, {dr} sin ganador → {pct} % de los duelos con ganador. "
    f"(2) Piloto automático de nivel medio contra Difícil, {new['n']} duelos con las mismas semillas: con el juego de la v0.9 perdía {base['l']} de {base['n']} en {bavg:.1f} min de media; con la v1.0 pierde {new['l']} de {new['n']} en {navg:.1f} min. "
    f"(3) {sim['G05t']['ev']}"))

rows['G06'] = ('ok' if web['G06web']['ok'] else 'fail', clean(web['G06web']['ev']))
rows['G07'] = ('ok' if sim['G07']['ok'] else 'fail', clean(sim['G07']['ev']))
rows['G08'] = ('ok' if sim['G08']['ok'] and web['G08web']['ok'] else 'fail', clean(sim['G08']['ev'] + '. En pantalla: ' + web['G08web']['ev']))
sz_ok = all(x['ok'] for x in sizes)
rows['G09'] = ('ok' if web['G09web']['ok'] and sz_ok else 'fail', clean(
    web['G09web']['ev'] + '. 5 tamaños: ' + ' · '.join(f"{x['name']}: {'bien' if x['ok'] else 'FALLA ' + '; '.join(x['fails'])}" for x in sizes)))

# G10: pruebas anteriores, campaña y tamaños.
v09s = load('results-v09-sim-on-v10.json')
v09w = [r for r in load('results-v09-on-v10.json') if re.match(r'^F\d\d$', r['id'])]
v07 = [r for r in load('results-v07.json') if re.match(r'^D\d\d$', r['id'])]
v08 = [r for r in load('results-v08-on-v09.json') if re.match(r'^E\d\d$', r['id'])]
v08b = [r for r in load('results-v08-bots-on-v10.json') if r['id'] in ('E06', 'E07', 'E08', 'E09', 'E10')]
old = v09s + v09w + v07 + v08 + v08b
old_ok = all(r['ok'] for r in old)
fails = [r['id'] for r in old if not r['ok']]


def summ(lst, mid=None):
    sel = [x for x in lst if mid is None or x.get('id') == mid]
    won = [x for x in sel if x['result'] == 'victory']
    times = ', '.join(f"{int(x['time']) // 60}:{int(x['time']) % 60:02d}" for x in won)
    return f"ganó {len(won)} de {len(sel)} ({times})", len(won)


c125 = camp('out10-camp125.txt')
s1, w1 = summ(c125, 1)
s2, w2 = summ(c125, 2)
s5, w5 = summ(c125, 5)
s3, w3 = summ(camp('out10-camp3.txt'))
s4, w4 = summ(camp('out10-camp4.txt'))
s6, w6 = summ(camp('out10-camp6.txt'))
camp_ok = all(w > 0 for w in (w1, w2, w3, w4, w5, w6))
rows['G10'] = ('ok' if old_ok and camp_ok and sz_ok else 'fail', clean(
    f"Pruebas anteriores en la v1.0: {sum(r['ok'] for r in old)} de {len(old)} bien (v0.9: {len(v09s)} de lógica y {len(v09w)} del navegador; v0.7: {len(v07)}; v0.8: {len(v08) + len(v08b)})"
    f"{' · fallan: ' + ', '.join(fails) if fails else ''}. F02 se ajustó al nuevo máximo de 240 y F07 (construir de un toque) ahora confirma cada obra con «Construir», como pide G01. "
    f"Campaña con las reglas y bots nuevos: M1 {s1}; M2 {s2}; M3 órdenes de jugador {s3}; M4 órdenes de jugador {s4}; M5 {s5}; M6 piloto atento {s6}. "
    f"5 tamaños con Núcleo nivel 3, AIR DEFENSE con «Lanzar los 3», Casa, Transporte, Bombardero, Aeropuerto y la barra de «Construir»: {'todo bien' if sz_ok else 'con fallas'}."))
size_kb = os.path.getsize(GAME) / 1024
rows['G11'] = ('ok' if size_kb < 3.5 * 1024 else 'fail', f"faro.html pesa {size_kb / 1024:.2f} MB (meta: menos de 3,5 MB), con 75 modelos de Blender.")

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


s = re.sub(r'<tr><td>(G\d\d)</td><td>(.*?)</td><td><span class="chip [a-z]+">[^<]*</span></td><td>.*?</td></tr>', repl, s)
s = s.replace('Estado: <b id="estado">Plan</b>', 'Estado: <b id="estado">Terminada (pruebas abajo)</b>')
s = s.replace('<tr><td>1.0</td><td>8 nov 2026</td><td>Esta versión.</td></tr>',
              '<tr><td>1.0</td><td>9 nov 2026</td><td>Botón «Construir» y constructor que llega, comunidad 240, radiación, «Mejorar todo» y mejoras automáticas, '
              '«Lanzar los 3», Difícil más fuerte, Aeropuerto, Caza y Bombardero nuevos y portada nueva.</td></tr>')

DECISIONS = f"""<section>
  <div class="eyebrow">06 · Decisiones</div>
  <h2>Decisiones y ajustes durante la versión</h2>
  <ul>
    <li><b>Punto 1 y la v0.9:</b> vuelve el botón «Construir»; se mantiene poder poner varias obras seguidas y el botón de salir dice «Terminar» después de la primera.</li>
    <li><b>Punto 7:</b> antes el constructor trabajaba desde la casilla de al lado, todavía lejos; ahora termina de acercarse hasta tocar la obra (1,2 de distancia al centro) y recién ahí avanza, con una animación de martilleo.</li>
    <li><b>Radiación:</b> quema por segundo el 4 % de la vida a las tropas enemigas, el 0,5 % a sus edificios y el 0,25 % al Núcleo, durante 60 s; no daña a tus tropas, así que puedes entrar después. Al principio quemaba el 0,8 % a todo edificio, pero en la misión 6 un solo misil del bot más la radiación llegaba a decidir la partida, así que se bajó (sobre todo en el Núcleo).</li>
    <li><b>Mejoras automáticas:</b> guardan {1500:,} monedas de reserva y mejoran como mucho tantos edificios a la vez como Constructores tengas. Siempre hace falta que el constructor llegue.</li>
    <li><b>Difícil:</b> recibe ×1,7 de monedas (antes ×1,3), piensa cada 0,8 s (antes 1,1), ataca antes (80 s) y usa tácticas propias. Con un primer ajuste (×1,55) el piloto caía en 9,9 min y no llegaba a la meta; con ×1,7 cae en menos de 9. También probé pensar cada 0,7 s y atacar a los 70 s, pero así el bot nuevo le ganaba menos al de la v0.9, y lo dejé en 0,8 s y 80 s. Como el piloto automático ya perdía todo contra el Difícil anterior, se midió contra el Difícil de la v0.9 y por el tiempo que tarda en derrotar al piloto (G05). La primera medición del piloto daba números distintos en cada corrida porque mi script usaba azar sin semilla; se corrigió y se repitió con el juego de la v0.9 y el de la v1.0 con las mismas semillas. Fácil y Normal no cambian.</li>
    <li><b>Una frase por salva:</b> si caen varios misiles juntos, el bot avisa una sola vez.</li>
    <li><b>Tus fuentes:</b> Poly Haven sigue solo en el cielo (el suelo es el de la v0.6, como pediste); Pixabay no deja descargar desde aquí; CMU sigue en el caminar y correr.</li>
    <li><b>Tamaño:</b> {size_kb / 1024:.2f} MB (meta: menos de 3,5 MB).</li>
  </ul>
  <h3>Siguiente paso</h3>
  <p>Jugar la v1.0 en tu iPad: probar el botón «Construir», ver a los constructores llegar y martillar, subir la base a 240, usar «Mejorar todo», lanzar los 3 misiles y jugar en Difícil. Dime qué te parece la dificultad y los aviones.</p>
</section>"""
s, n = re.subn(r'<section>\s*<div class="eyebrow">06 · Decisiones</div>.*?</section>', DECISIONS, s, count=1, flags=re.S)
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
