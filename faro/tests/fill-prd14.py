"""Completa el PRD v1.4 con los resultados reales."""
import datetime
import html
import json
import os
import re
import sys

SP = os.environ.get('SP', os.path.dirname(os.path.abspath(__file__))) + '/'
PRD = os.environ.get('PRD') or '/home/user/opencode-mobile/faro/docs/prd/PRD_web_v1.4.html'
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


sim = {r['id']: r for r in load('results-v14-sim.json')}
cvd = {r['id']: r for r in load('results-v14-cvd.json')}
web = {r['id']: r for r in load('results-v14.json')}
sizes = load('results-v14-sizes.json')
big = load('results-v14-sizes-big.json')
rows = {}
st = lambda ok: 'ok' if ok else 'fail'
screen = web['K15web']
rows['K01'] = (st(sim['K01']['ok'] and screen['ok']), clean(sim['K01']['ev'] + '. En pantalla, con toques (K01 a K05): ' + screen['ev']))
for k in ('K02', 'K03', 'K04', 'K05'):
    rows[k] = (st(sim[k]['ok'] and screen['ok']), clean(sim[k]['ev'] + '. En pantalla: comprobado con toques junto con K01.'))
rows['K06'] = (st(web['K06']['ok']), clean(web['K06']['ev']))
rows['K07'] = (st(web['K07']['ok']), clean(web['K07']['ev']))
rows['K08'] = (st(sim['K08sim']['ok'] and web['K08']['ok']), clean(web['K08']['ev'] + '. Reglas: ' + sim['K08sim']['ev']))
rows['K09'] = (st(web['K09']['ok']), clean(web['K09']['ev']))
big_ok = all(x['ok'] for x in big)
rows['K10'] = (st(cvd['K10cvd']['ok'] and web['K10web']['ok'] and big_ok), clean(
    'Colores: ' + cvd['K10cvd']['ev'] + '. En pantalla: ' + web['K10web']['ev'] +
    '. 5 tamaños con letra grande y colores para daltonismo: ' + ' · '.join(f"{x['name']}: {'bien' if x['ok'] else 'FALLA ' + '; '.join(x['fails'])}" for x in big)))
if not web['errores']['ok']:
    for k in ('K01', 'K06', 'K07', 'K08', 'K09', 'K10'):
        rows[k] = ('fail', rows[k][1] + ' · errores en la consola: ' + web['errores']['ev'])

# ---------- K11: anteriores, campaña, tamaños y equilibrio ----------
REPLACED = {'H03web': 'J09 (Liga 3 vs 3 con los rangos de tu documento, desde la v1.3)', 'I08': 'J10 (tutorial de tu documento con Barcaza, desde la v1.3)'}
old = []
old += load('results-v13-sim-on-v14.json')
old += [r for r in load('results-v13-on-v14.json') if re.match(r'^J\d\d', r['id'])]
old += load('results-v12-sim-on-v14.json')
old += [r for r in load('results-v12-on-v14.json') if re.match(r'^I\d\d$', r['id'])]
old += load('results-v11-sim-on-v14.json')
old += [r for r in load('results-v11-on-v14.json') if r['id'] in ('H01web', 'H03web', 'H05web', 'H06web', 'H07web', 'H08web')]
old += load('results-v10-sim-on-v14.json')
old += [r for r in load('results-v10-on-v14.json') if r['id'] in ('G01', 'G03web', 'G04web', 'G06web', 'G08web', 'G09web')]
old += load('results-v09-sim-on-v14.json')
old += [r for r in load('results-v09-on-v14.json') if re.match(r'^F\d\d$', r['id'])]
old += [r for r in load('results-v07-on-v14.json') if re.match(r'^D\d\d$', r['id'])]
old += [r for r in load('results-v08-on-v14.json') if re.match(r'^E\d\d$', r['id'])]
old += [r for r in load('results-v08-bots-on-v14.json') if r['id'] in ('E06', 'E07', 'E08', 'E09', 'E10')]
kept = [r for r in old if r['id'] not in REPLACED]
fails = [r['id'] for r in kept if not r['ok']]
by_ver = {}
for r in kept:
    v = {'J': 'v1.3', 'I': 'v1.2', 'H': 'v1.1', 'G': 'v1.0', 'F': 'v0.9', 'E': 'v0.8', 'D': 'v0.7'}[r['id'][0]]
    by_ver[v] = by_ver.get(v, 0) + 1


def summ(lst, mid=None):
    sel = [x for x in lst if mid is None or x.get('id') == mid]
    won = [x for x in sel if x['result'] == 'victory']
    times = ', '.join(f"{int(x['time']) // 60}:{int(x['time']) % 60:02d}" for x in won)
    return f"ganó {len(won)} de {len(sel)} ({times})", len(won)


c125 = camp('out14-camp125.txt')
s1, w1 = summ(c125, 1)
s2, w2 = summ(c125, 2)
s5, w5 = summ(c125, 5)
s3, w3 = summ(camp('out14-camp3.txt'))
s4, w4 = summ(camp('out14-camp4.txt'))
s6, w6 = summ(camp('out14-camp6.txt'))
camp_ok = all(w > 0 for w in (w1, w2, w3, w4, w5, w6))
sz_ok = all(x['ok'] for x in sizes)
b13 = load('duel14-v13.json')
b14 = load('duel14-v14.json')


def bal(d):
    return f"Fácil {d['easy']['w']}-{d['easy']['l']}-{d['easy']['d']}, Normal {d['normal']['w']}-{d['normal']['l']}-{d['normal']['d']}, Difícil {d['hard']['w']}-{d['hard']['l']}-{d['hard']['d']}"


def htime(d):
    ts = [int(o.split('@')[1]) for o in d['hard']['out'] if 'defeat' in o]
    return sum(ts) / len(ts) / 60 if ts else 0


bal_ok = (b14['easy']['w'] >= b13['easy']['w'] - 2 and abs(b14['normal']['w'] - b13['normal']['w']) <= 3 and b14['hard']['w'] <= b13['hard']['w'] + 2)
vers = ', '.join(f'{v}: {n}' for v, n in sorted(by_ver.items(), reverse=True))
rows['K11'] = (st(not fails and camp_ok and sz_ok and bal_ok and sim['K11vet']['ok']), clean(
    f"Equilibrio con las estrellas (un piloto de nivel medio contra los bots, 16 partidas por dificultad; victorias-derrotas-empates del piloto): v1.3 {bal(b13)}; v1.4 {bal(b14)}; "
    f"la Difícil lo vence en {htime(b13):.1f} min de media con la v1.3 y en {htime(b14):.1f} min con la v1.4. {sim['K11vet']['ev']}. "
    f"Pruebas anteriores en la v1.4: {len(kept) - len(fails)} de {len(kept)} bien ({vers}){' · fallan: ' + ', '.join(fails) if fails else ''} "
    f"(H03 e I08 siguen reemplazadas por J09 y J10). "
    f"Campaña: M1 {s1}; M2 {s2}; M3 órdenes de jugador {s3}; M4 órdenes de jugador {s4}; M5 {s5}; M6 piloto atento {s6}. "
    f"5 tamaños: " + ' · '.join(f"{x['name']}: {'bien' if x['ok'] else 'FALLA ' + '; '.join(x['fails'])}" for x in sizes)))
size_kb = os.path.getsize(GAME) / 1024
rows['K12'] = (st(size_kb < 3.5 * 1024), 'faro.html pesa ' + f'{size_kb / 1024:.2f}'.replace('.', ',') + ' MB (meta: menos de 3,5 MB).')

# ---------- K13: arreglo hallado en las pruebas (subir a la Barcaza) ----------
board = load('results-v14-board.json')[0]
board13 = load('results-v13-board.json')[0]
j10 = re.findall(r'J10 extra (\d): resultado: (\w+)[^(]*\((\d+) s de prueba\) (\d)', open(SP + 'chain14b.log').read())
j10_won = sum(1 for x in j10 if x[3] == '1')
j10_txt = ', '.join(f"{'victoria' if x[3] == '1' else 'sin terminar'} en {x[2]} s" for x in j10)
web13 = {r['id']: r for r in load('results-v13-on-v14.json')}
j10_main = web13.get('J10', {'ok': False})
def board_sum(ev):
    parts = ev.split('; ')
    far = [x for x in parts if 'a 3 casillas' in x]
    tap = [x for x in parts if 'orilla tapada' in x]
    def one(lst):
        ok = [x for x in lst if '3 de 3 a bordo en' in x and 'min' not in x.split('a bordo')[1]]
        ts = [int(t) for t in re.findall(r'a bordo en (\d+) s', ' '.join(ok))]
        if len(ok) == len(lst):
            return f"en los {len(lst)} mapas subieron los 3 Artilleros, en {min(ts)} a {max(ts)} s"
        if not ok:
            return f"en los {len(lst)} mapas nadie subió en 2 minutos"
        return f"subieron los 3 en {len(ok)} de {len(lst)} mapas; en los otros {len(lst) - len(ok)} quedaron en tierra 2 minutos"
    return f"Barcaza a 3 casillas de la costa: {one(far)}; Barcaza junto a la costa pero con la orilla ocupada por Granjas: {one(tap)}"


rows['K13'] = (st(board['ok'] and not board13['ok'] and len(j10) >= 3 and j10_won == len(j10) and j10_main['ok']), clean(
    'Con la v1.4 (arreglada): ' + board_sum(board['ev']) + '. Las mismas situaciones con la v1.3: ' + board_sum(board13['ev']) +
    f". Tutorial completo en el navegador (J10, mapa al azar en cada intento), siguiendo solo el aro y el texto: {j10_won} de {len(j10)} intentos extra terminaron ({j10_txt}), y la prueba J10 de la lista también ({'victoria' if j10_main['ok'] else 'sin terminar'})."))

LABEL = {'ok': ('ok', 'Aprobada'), 'fail': ('fail', 'Fallida')}
s = open(PRD).read()
missing = []
K13_ROW = '<tr><td>K13</td><td>Arreglo hallado en las pruebas: los soldados que suben a una Barcaza (o a otro transporte) ya no se quedan esperando para siempre cuando no pueden llegar a su orilla; el transporte va a buscarlos.</td><td><span class="chip pend">Pendiente</span></td><td></td></tr>'
if '<td>K13</td>' not in s:
    i = s.index('<tr><td>K12</td>')
    j = s.index('</tr>', i) + len('</tr>')
    s = s[:j] + '\n' + K13_ROW + s[j:]


def repl(m):
    cid = m.group(1)
    if cid not in rows:
        missing.append(cid)
        return m.group(0)
    status, ev = rows[cid]
    cls, label = LABEL[status]
    return f'<tr><td>{cid}</td><td>{m.group(2)}</td><td><span class="chip {cls}">{label}</span></td><td>{esc(ev)}</td></tr>'


s = re.sub(r'<tr><td>(K\d\d)</td><td>(.*?)</td><td><span class="chip [a-z]+">[^<]*</span></td><td>.*?</td></tr>', repl, s)
s = s.replace('12 de noviembre de 2026 · Estado: <b id="estado">Plan</b>', f'{hoy.day} de {MES[hoy.month - 1]} de {hoy.year} · Estado: <b id="estado">Terminada (pruebas abajo)</b>')
s = s.replace('<meta name="fecha" content="12 NOV 2026">', f'<meta name="fecha" content="{hoy.day} {MES3[hoy.month - 1]} {hoy.year}">')
s = s.replace('<tr><td>1.4</td><td>12 nov 2026</td><td>Esta versión.</td></tr>',
              f'<tr><td>1.4</td><td>12-{hoy.day} nov 2026</td><td>Patrullar, mantener posición, tropas veteranas, reparación sola, producción continua, 12 logros, Top jugadores, '
              'desafío semanal, ahorro de batería, colores para daltonismo y letra grande.</td></tr>')
DECISIONS = """<section>
  <div class="eyebrow">06 · Decisiones</div>
  <h2>Decisiones y ajustes durante la versión</h2>
  <ul>
    <li><b>Colores para daltonismo:</b> primero probé la paleta de Okabe e Ito (muy usada para esto), pero con la simulación el par más parecido quedaba en 11-12 de diferencia. Busqué 6 colores con la simulación de los 3 tipos de daltonismo y solo colores claros (para verse sobre el fondo oscuro): el par más parecido queda en 19,6 o más. Los nombres de los rivales cambian con los colores (Rojo, Amarillo, Lavanda, Rosa y Aguamarina).</li>
    <li><b>Formas en el minimapa:</b> con esa opción, cada jugador tiene su forma (círculo, cuadrado, triángulo, rombo, estrella y cruz) en su Núcleo y sus tropas.</li>
    <li><b>Veteranas:</b> las estrellas cuentan eliminaciones de tropas y edificios enemigos; se ven sobre la barra de vida y en la ficha (con cuántas faltan para la siguiente).</li>
    <li><b>Reparación sola:</b> es para tus Constructores e Ingenieros; los bots ya reparaban a su manera y no se tocó. No interrumpe obras: solo trabaja quien está libre.</li>
    <li><b>Producción continua:</b> usa la última tropa que entrenaste en ese edificio; si falta dinero, energía o comunidad, espera y dice por qué.</li>
    <li><b>Logros:</b> «Primer Faro» se da solo a quien ya terminó el Tutorial; el premio del Tutorial no se repite. Todos se revisan al terminar cada partida.</li>
    <li><b>Top jugadores y desafío semanal:</b> sin servidores, los demás son comandantes bot marcados como bots; en Roblox serán jugadores reales.</li>
    <li><b>Letra grande:</b> agranda el contenido de los paneles sin cambiar su tamaño (si no entra, el panel se desplaza); así nada tapa el mapa.</li>
    <li><b>Misión 5, algo más difícil:</b> el piloto automático ganó 1 de 3 (con la v1.3, 2 de 3); en las otras 2 aguantó los 30 minutos de la simulación sin perder. Para saber por qué, repetí las mismas 3 partidas: con la reparación sola apagada perdió esas 2, así que la reparación sola ayuda. Lo más probable es que la diferencia venga de las estrellas que ganan las oleadas enemigas. Si quieres, en la próxima versión se pueden quitar las estrellas a los bots de la campaña. Las misiones 1 a 4 se ganaron en todos los intentos (M3, 5 de 5).</li>
    <li><b>Arreglo de la Barcaza (K13):</b> en las pruebas, el tutorial se quedó una vez en «Los soldados suben a la Barcaza: espera». La causa: si la Barcaza queda lejos de la costa o la orilla junto a ella está ocupada por edificios, los soldados no tenían por dónde llegar y esperaban para siempre. El fallo ya estaba en la v1.3 (pasaba o no según el mapa al azar). Ahora, si los soldados ya llegaron lo más cerca que pueden, el transporte quieto va a buscarlos a la orilla libre más cercana. Vale para tus transportes y para los de los bots.</li>
    <li><b>Letra grande, dos arreglos:</b> la prueba de 5 tamaños con «Letra grande» encontró que en el iPad vertical el cartel del tutorial se salía de la pantalla, porque su lugar se calculaba con el tamaño de la letra normal. Ahora se mide el cartel de verdad y siempre queda dentro. La misma prueba encontró que en el celular vertical, con letra grande, los botones de la pausa se salían por la derecha; ahora se acomodan al ancho (la fila de temporadas pasa a 2 columnas).</li>
    <li><b>Misión 6:</b> el piloto atento ganó 4 de 6 (con la v1.3 y con la v1.4 antes del arreglo de la Barcaza, 5 de 6). La partida que ahora pierde (la del mapa 3) la ganaba antes del arreglo: repetida con el arreglo solo para tus transportes, se gana otra vez (en 29:31). O sea, ahora los bots también suben bien a sus soldados y atacan más por mar. Lo dejé así porque era un fallo de los bots; si prefieres la misión 6 como antes, puedo dejar el arreglo solo para tus transportes.</li>
    <li><b>Pruebas que se ajustaron (no el juego):</b> la prueba de logros contaba mal las líneas «Logro:» porque aparecen juntas en una sola línea; la del botón «Patrullando» leía el texto antes de que se dibujara el panel. Además, la prueba de pantalla K15web falló una vez porque yo corría otra simulación al mismo tiempo y el panel del Cuartel no alcanzó a mostrar «Esperando»; repetida sola, pasó. Las pruebas del navegador se corren de a una por eso.</li>
  </ul>
  <h3>Sigue pendiente de tu decisión (de la v1.3)</h3>
  <p>La tabla de precios, el tamaño del juego, el Tanque ligero y el precio de la Casa, y lo que tu documento dejó «POR DECIDIR». No se cambió nada de eso.</p>
  <h3>Siguiente paso</h3>
  <p>Jugar la v1.4 en tu iPad: probar «Patrullar» y «Mantener posición», ver las estrellas de tus tropas, el desafío de esta semana, los logros del Inventario y las opciones de la pausa. Dime qué más quieres.</p>
</section>"""
s, n = re.subn(r'<section>\s*<div class="eyebrow">06 · Decisiones</div>.*?</section>', DECISIONS, s, count=1, flags=re.S)
if not n:
    missing.append('decisiones')
open(PRD, 'w').write(s)
counts = {k: sum(1 for v in rows.values() if v[0] == k) for k in LABEL}
print('filas', len(rows), counts, 'sin datos', missing)
for k in sorted(rows):
    if rows[k][0] != 'ok':
        print('NO OK', k, rows[k][1][:600])
if missing:
    sys.exit(1)
