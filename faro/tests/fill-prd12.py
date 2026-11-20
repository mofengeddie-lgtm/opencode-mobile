"""Completa el PRD v1.2 con los resultados reales."""
import html
import json
import os
import re
import sys

SP = os.environ.get('SP', os.path.dirname(os.path.abspath(__file__))) + '/'
PRD = '/home/user/opencode-mobile/faro/docs/prd/PRD_web_v1.2.html'
GAME = '/home/user/opencode-mobile/faro/faro.html'


def load(name):
    return json.loads(open(SP + name).read())


def camp(name):
    s = open(SP + name).read()
    return json.loads(s[s.index('['):])


def clean(t):
    return re.sub(r'\s+', ' ', t).strip()


sim = {r['id']: r for r in load('results-v12-sim.json')}
web = {r['id']: r for r in load('results-v12.json')}
sizes = load('results-v12-sizes.json')
rows = {}


def one(r):
    return ('ok' if r['ok'] else 'fail', clean(r['ev']))


for k in ('I01', 'I02', 'I03', 'I04', 'I05', 'I07', 'I08'):
    rows[k] = one(web[k])
rows['I06'] = one(sim['I06'])
rows['I09'] = ('ok' if sim['I09sim']['ok'] and web['I09']['ok'] else 'fail',
               clean('Por fecha: ' + sim['I09sim']['ev'] + '. En pantalla: ' + web['I09']['ev']))
if not web['errores']['ok']:
    for k in ('I01', 'I02', 'I03', 'I04', 'I05', 'I07', 'I08', 'I09'):
        rows[k] = ('fail', rows[k][1] + ' · errores en la consola: ' + web['errores']['ev'])

old = []
old += load('results-v11-sim-on-v12.json')
old += [r for r in load('results-v11-on-v12.json') if r['id'] in ('H01web', 'H03web', 'H05web', 'H06web', 'H07web', 'H08web')]
old += load('results-v10-sim-on-v12.json')
old += [r for r in load('results-v10-on-v12.json') if r['id'] in ('G01', 'G03web', 'G04web', 'G06web', 'G08web', 'G09web')]
old += load('results-v09-sim-on-v12.json')
old += [r for r in load('results-v09-on-v12.json') if re.match(r'^F\d\d$', r['id'])]
old += [r for r in load('results-v07-on-v12.json') if re.match(r'^D\d\d$', r['id'])]
old += [r for r in load('results-v08-on-v12.json') if re.match(r'^E\d\d$', r['id'])]
old += [r for r in load('results-v08-bots-on-v12.json') if r['id'] in ('E06', 'E07', 'E08', 'E09', 'E10')]
fails = [r['id'] for r in old if not r['ok']]
by_ver = {}
for r in old:
    v = {'H': 'v1.1', 'G': 'v1.0', 'F': 'v0.9', 'E': 'v0.8', 'D': 'v0.7'}[r['id'][0]]
    by_ver[v] = by_ver.get(v, 0) + 1


def summ(lst, mid=None):
    sel = [x for x in lst if mid is None or x.get('id') == mid]
    won = [x for x in sel if x['result'] == 'victory']
    times = ', '.join(f"{int(x['time']) // 60}:{int(x['time']) % 60:02d}" for x in won)
    return f"ganó {len(won)} de {len(sel)} ({times})", len(won)


c125 = camp('out12-camp125.txt')
s1, w1 = summ(c125, 1)
s2, w2 = summ(c125, 2)
s5, w5 = summ(c125, 5)
s3, w3 = summ(camp('out12-camp3.txt'))
s4, w4 = summ(camp('out12-camp4.txt'))
s6, w6 = summ(camp('out12-camp6.txt'))
camp_ok = all(w > 0 for w in (w1, w2, w3, w4, w5, w6))
sz_ok = all(x['ok'] for x in sizes)
vers = ', '.join(f'{v}: {n}' for v, n in sorted(by_ver.items(), reverse=True))
rows['I10'] = ('ok' if not fails and camp_ok and sz_ok else 'fail', clean(
    f"Pruebas anteriores en la v1.2: {len(old) - len(fails)} de {len(old)} bien ({vers}){' · fallan: ' + ', '.join(fails) if fails else ''}. "
    f"Campaña: M1 {s1}; M2 {s2}; M3 órdenes de jugador {s3}; M4 órdenes de jugador {s4}; M5 {s5}; M6 piloto atento {s6}. "
    f"5 tamaños con portada, Rangos y tabla, Taller, mapas con miniaturas, Personalizado, Núcleo, AIR DEFENSE, Casa, Transporte, Bombardero, Aeropuerto, "
    f"rueda (en el centro y en una esquina), Mensajes, pausa con Temporada y Música, marcador, barra de «Construir», tutorial con señales, final con gráficas y espectador: "
    + ' · '.join(f"{x['name']}: {'bien' if x['ok'] else 'FALLA ' + '; '.join(x['fails'])}" for x in sizes)))
size_kb = os.path.getsize(GAME) / 1024
rows['I11'] = ('ok' if size_kb < 3.5 * 1024 else 'fail', 'faro.html pesa ' + f'{size_kb / 1024:.2f}'.replace('.', ',') + ' MB (meta: menos de 3,5 MB).')

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


s = re.sub(r'<tr><td>(I\d\d)</td><td>(.*?)</td><td><span class="chip [a-z]+">[^<]*</span></td><td>.*?</td></tr>', repl, s)
s = s.replace('9 de noviembre de 2026 · Estado: <b id="estado">Plan</b>', '10 de noviembre de 2026 · Estado: <b id="estado">Terminada (pruebas abajo)</b>')
s = s.replace('<tr><td>1.2</td><td>9 nov 2026</td><td>Esta versión.</td></tr>',
              '<tr><td>1.2</td><td>9-10 nov 2026</td><td>Rueda de selección, Mensajes con aliados, tabla de la Clasificatoria, colecciones «Frente 1940» y «Marea», '
              'planos, fragmentos y Taller, mapas «Mesetas de Cobre» y «Dunas Rojas», miniaturas, tutorial que señala y temporadas.</td></tr>')
s = s.replace('<p>Chromium con tamaño de iPad y toques simulados, partidas simuladas y todas las pruebas anteriores.</p>',
              '<p>Chromium con tamaño de iPad y toques simulados (incluido mantener pulsado con el dedo), partidas simuladas y todas las pruebas anteriores. '
              'Las pruebas encontraron 6 fallos del juego (y un detalle) que se arreglaron antes de aprobarlas (ver Decisiones). Las tablas muestran la última corrida completa, hecha con el juego ya arreglado.</p>')
DECISIONS = f"""<section>
  <div class="eyebrow">05 · Decisiones</div>
  <h2>Decisiones y ajustes durante la versión</h2>
  <ul>
    <li><b>Nombres propios:</b> las colecciones, los mapas, los comandantes de la tabla y las temporadas tienen nombres nuestros; del juego de Roblox solo se tomaron las mecánicas.</li>
    <li><b>Tabla con bots:</b> sin servidores no hay otros jugadores reales; la tabla dice claramente que son comandantes bot.</li>
    <li><b>Cofres:</b> los cristales que antes daban los aspectos repetidos ahora se convierten en fragmentos; los precios de los cofres no cambian. Cuando ya tienes casi todo, los planos que tocarían salen como fragmentos (no hay planos de lo que ya es tuyo).</li>
    <li><b>Ventaja de altura:</b> solo en «Mesetas de Cobre», para no cambiar el equilibrio de los mapas que ya existían. «Dunas Rojas» usa los colores de desierto; el suelo de los demás mapas sigue siendo el de la v0.6.</li>
    <li><b>Mensajes rápidos:</b> en el plan puse «¡Voy!» y «¡Defiende!»; quedaron «¡Gracias!», «¡Bien hecho!» y «¡Cuidado!», más «¡Ayuda!» y «¡Ataquemos!» de la v1.1. El PRD ya está corregido.</li>
    <li><b>Fallos que encontraron las pruebas (arreglados):</b>
      <ul>
        <li>Los botones de Temporada de la pausa no hacían nada: habían quedado conectados dentro del botón de música del vestíbulo.</li>
        <li>El tutorial se trababa: después de tocar «Construir» el juego sigue en modo construir (para poner más), y así tocar el Cuartel no lo elegía. Ahora el tutorial señala «Terminar».</li>
        <li>Tocar el techo o el cuerpo de un edificio no lo elegía (solo valía su casilla del suelo). Ahora sí, en todo el juego: ayuda mucho en el iPad.</li>
        <li>El último paso del tutorial («Toca el Núcleo enemigo») señalaba un lugar fuera de la pantalla. Ahora, si el lugar no se ve, el aro marca ese punto en el minimapa.</li>
        <li>Al empezar el tutorial, mientras la cámara iba hacia tu Núcleo, el aro quedó un momento detrás del panel «Construir», y tocarlo tocaba el panel (empezaba a construir una Bomba de petróleo). Ahora, si un panel tapa el lugar, el aro marca ese punto en el minimapa.</li>
        <li>En una corrida, la rueda se abrió al arrastrar el mapa: en el navegador de pruebas (muy lento) el aviso del movimiento del dedo llegó después de los 0,45 s. Ahora, si el dedo ya se movía antes de abrirse la rueda, cuenta como arrastre y la rueda se cierra.</li>
        <li>Detalle: la rueda contaba también los constructores de barco, pero solo elige los de tierra; ahora cuenta igual que elige.</li>
      </ul></li>
    <li><b>Tutorial:</b> el juego empieza con un Constructor, así que normalmente el primer paso es «Abre la pestaña Energía». En la prueba se quitó el Constructor para comprobar también los dos primeros pasos (tocar el Núcleo y entrenar uno).</li>
    <li><b>Temporadas:</b> hoy (10 de noviembre) no toca ninguna; en la pausa puedes poner Calabazas o Invierno para verlas.</li>
    <li><b>Campaña:</b> los resultados son los mismos que en la v1.1 (las misiones que no se ganan siempre, M3 y M5, ya eran así).</li>
    <li><b>Tamaño:</b> {str(round(size_kb / 1024, 2)).replace('.', ',')} MB (meta: menos de 3,5 MB).</li>
  </ul>
  <h3>Siguiente paso</h3>
  <p>Jugar la v1.2 en tu iPad: mantener pulsado el mapa para la rueda, mandar mensajes a un aliado en Dúos, mirar la tabla de Rangos, abrir cofres y fabricar en el Taller, jugar «Mesetas de Cobre» y probar el tutorial y las temporadas desde la pausa. Dime qué más quieres.</p>
</section>"""
s, n = re.subn(r'<section>\s*<div class="eyebrow">05 · Decisiones</div>.*?</section>', DECISIONS, s, count=1, flags=re.S)
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
