"""Completa el PRD v0.9 con los resultados reales y lo que cambió durante la versión."""
import os
import html
import json
import re
import sys

SP = os.environ.get('SP', os.path.dirname(os.path.abspath(__file__))) + '/'
PRD = '/home/user/opencode-mobile/faro/docs/prd/PRD_web_v0.9.html'


def load(name):
    return json.loads(open(SP + name).read())


def camp(name):
    s = open(SP + name).read()
    return json.loads(s[s.index('['):])


def clean(t):
    return re.sub(r'\s+', ' ', t).strip()


rows = {}
sim = {r['id']: r for r in load('results-v09-sim.json')}
web = {r['id']: r for r in load('results-v09.json')}
for rid in ('F02', 'F03', 'F05', 'F08', 'F09', 'F10', 'F11', 'F12', 'F13', 'F17'):
    rows[rid] = ('ok' if sim[rid]['ok'] else 'fail', clean(sim[rid]['ev']))
for rid in ('F01', 'F07', 'F15', 'F20'):
    rows[rid] = ('ok' if web[rid]['ok'] else 'fail', clean(web[rid]['ev']))
# Las que juntan lógica y pantalla.
rows['F04'] = ('ok' if sim['F04']['ok'] and web['F04ui']['ok'] else 'fail', clean(sim['F04']['ev'] + '. Barras: ' + web['F04ui']['ev']))
rows['F06'] = ('ok' if sim['F06']['ok'] and web['F06ui']['ok'] else 'fail', clean(sim['F06']['ev'] + '. En pantalla: «' + web['F06ui']['ev'] + '»'))
rows['F14'] = ('ok' if sim['F14']['ok'] and web['F14ui']['ok'] else 'fail', clean(sim['F14']['ev'] + '. En pantalla: ' + web['F14ui']['ev']))
dpr = load('dpr-v09.json')
rows['F16'] = ('ok' if web['F16']['ok'] and dpr['hi'] == 2 and dpr['lo'] == 1 else 'fail',
               clean(web['F16']['ev'] + f" En una pantalla Retina (2×): Alta dibuja a {dpr['hi']}× (antes 1,75×) y Más fluido a {dpr['lo']}×."))

# F18: bots y campaña.
NAMES = {'fighter': 'Caza', 'bomber': 'Bombardero', 'carrier': 'Portaaviones', 'frigate': 'Fragata', 'lander': 'Lancha de desembarco',
         'lighttank': 'Tanque ligero', 'heavytank': 'Tanque pesado', 'missiletruck': 'Camión de misiles', 'apc': 'Transporte blindado',
         'launcher': 'Lanzacohetes', 'medic': 'Médico', 'heli': 'Helicóptero', 'apache': 'Apache', 'airport': 'Aeropuerto',
         'helipad': 'Helipuerto', 'turret4': 'Torreta nivel 4', 'aadef4': 'AIR DEFENSE nivel 4', 'house2': 'Apartamento', 'antinuke': 'Escudo antimisiles'}
bots = load('results-v09-bots.json')
rich = load('results-v09-richbot.json')
games = bots['tot']
nukes = sum(r['nukes'] for r in bots['runs'])
used_units = set(k for k in games if k in ('fighter', 'bomber', 'carrier', 'frigate', 'lander', 'lighttank', 'heavytank', 'missiletruck', 'apc', 'launcher', 'medic', 'heli', 'apache'))
used_units |= set(k for k in rich['tot'] if k in ('fighter', 'bomber', 'carrier', 'lander', 'apache', 'heli'))
for name in ('out-bots.txt', 'out-bots2.txt'):
    for line in open(SP + name):
        if line.startswith('{'):
            used_units |= set(k for k in json.loads(line)['made'] if k in NAMES)
all_new = ['lighttank', 'heavytank', 'missiletruck', 'apc', 'launcher', 'medic', 'frigate', 'lander', 'carrier', 'heli', 'apache', 'fighter', 'bomber']
missing = [NAMES[k] for k in all_new if k not in used_units]
c125 = camp('out-camp125c.txt')
c3 = camp('out-camp3c.txt')
c4 = camp('out-camp4c.txt')
c6 = camp('out-camp6c.txt')


def summ(lst, mid=None):
    sel = [x for x in lst if mid is None or x.get('id') == mid]
    won = [x for x in sel if x['result'] == 'victory']
    times = ', '.join(f"{int(x['time']) // 60}:{int(x['time']) % 60:02d}" for x in won)
    return f"ganó {len(won)} de {len(sel)} ({times})", len(won), len(sel)


s1, w1, n1 = summ(c125, 1)
s2, w2, n2 = summ(c125, 2)
s5, w5, n5 = summ(c125, 5)
s3, w3, n3 = summ(c3)
s4, w4, n4 = summ(c4)
s6, w6, n6 = summ(c6)
camp_ok = all(w > 0 for w in (w1, w2, w3, w4, w5, w6))
bots_txt = ', '.join(f"{NAMES.get(k, k)} {v}" for k, v in games.items())
rich_txt = ', '.join(f"{NAMES.get(k, k)} {v}" for k, v in rich['tot'].items() if k in NAMES)
f18_ok = camp_ok and not missing
rows['F18'] = ('ok' if f18_ok else 'fail', clean(
    f"Bots en Difícil, 6 partidas de 30 min (3 mapas × 2 semillas), lo nuevo que hicieron: {bots_txt}; misiles nucleares lanzados: {nukes}. "
    f"Bot con dinero y todos los edificios (3 semillas): {rich_txt}. Unidades nuevas que no usaron en estas pruebas: {', '.join(missing) if missing else 'ninguna'}. "
    f"Campaña con las reglas y bots nuevos: M1 piloto bot {s1}; M2 piloto bot {s2}; M3 órdenes de jugador {s3}; M4 órdenes de jugador {s4}; M5 piloto bot {s5}; M6 piloto bot atento {s6}."))

# F19: pruebas anteriores y 5 tamaños.
v07 = load('results-v07.json')
v08 = load('results-v08-on-v09.json') + [r for r in load('results-v08-bots-on-v09.json') if r['id'] in ('E06', 'E07', 'E08', 'E09', 'E10')]
sizes = load('results-v09-sizes.json')
old = [r for r in v07 + v08 if re.match(r'^[DE]\d\d$', r['id'])]
old_ok = all(r['ok'] for r in old)
sz_ok = all(x['ok'] for x in sizes)
rows['F19'] = ('ok' if old_ok and sz_ok else 'fail', clean(
    f"Pruebas de la v0.7 y v0.8 en la v0.9: {sum(r['ok'] for r in old)} de {len(old)} bien ({', '.join(r['id'] + ('' if r['ok'] else ' FALLA') for r in old)}); "
    f"D04 (campaña) se repitió en F18; D13 y E13 (tamaños) se rehicieron con las pantallas nuevas (abajo); E01 (texturas) se retiró porque volvió el suelo de la v0.6; "
    f"no se repitieron D12 (pruebas de la v0.6, ya cubiertas en la v0.7 y v0.8) ni E11 (duelos contra el bot de la v0.7, que en la v0.8 quedó en 57 %). "
    f"5 tamaños (iPad horizontal y vertical, 16:9, celular horizontal y vertical) con portada, panel del Núcleo, AIR DEFENSE nivel 4 con radar y misil, Casa, Transporte con soldados y construir de un toque: "
    + ' · '.join(f"{x['name']}: {'bien' if x['ok'] else 'FALLA ' + '; '.join(x['fails'])}" for x in sizes)))

LABEL = {'ok': ('ok', 'Aprobada'), 'fail': ('fail', 'Fallida'), 'nt': ('np', 'No probada')}
s = open(PRD).read()
missing_rows = []


def repl(m):
    cid = m.group(1)
    if cid not in rows:
        missing_rows.append(cid)
        return m.group(0)
    st, ev = rows[cid]
    cls, label = LABEL[st]
    return f'<tr><td>{cid}</td><td>{m.group(2)}</td><td><span class="chip {cls}">{label}</span></td><td>{html.escape(ev)}</td></tr>'


s = re.sub(r'<tr><td>(F\d\d)</td><td>(.*?)</td><td><span class="chip [a-z]+">[^<]*</span></td><td>.*?</td></tr>', repl, s)
# F20: pedido durante la versión.
if '<td>F20</td>' not in s:
    st, ev = rows['F20']
    cls, label = LABEL[st]
    s = s.replace('    </tbody>\n  </table>\n</section>\n\n<section>\n  <div class="eyebrow">09 · Decisiones</div>',
                  f'<tr><td>F20</td><td>Suelo de la v0.6 (pedido durante la versión): colores lisos por terreno, sin texturas.</td><td><span class="chip {cls}">{label}</span></td><td>{html.escape(ev)}</td></tr>\n'
                  '    </tbody>\n  </table>\n</section>\n\n<section>\n  <div class="eyebrow">09 · Decisiones</div>', 1)
s = s.replace('Estado: <b id="estado">Plan</b>', 'Estado: <b id="estado">Terminada (pruebas abajo)</b>')
if '#pruebas td' not in s:
    s = s.replace('.chip { display: inline-block;', '#pruebas td { overflow-wrap: anywhere; word-break: break-word; }\n.chip { display: inline-block;', 1)
s = s.replace('<tr><td>0.9</td><td>8 nov 2026</td><td>Esta versión.</td></tr>',
              '<tr><td>0.9</td><td>8 nov 2026</td><td>Tus 30 mejoras: ejército de tierra, mar y aire nuevo, misil nuclear, escudos, comunidad 180, '
              'construir de un toque, soldados realistas, portada, radar de AIR DEFENSE y vuelta al suelo de la v0.6.</td></tr>')

# Lo que de verdad quedó en algunos puntos de la tabla.
FIX = {
    '2': 'Portada nueva del vestíbulo: una escena 3D hecha con los modelos del juego (Núcleo, Faro, tanques, soldados, helicópteros y un caza), dibujada una sola vez. Modelos en Blender. <b>Meshy</b>: la clave que guardaste en el formulario seguro respondió «clave no válida», así que no se usó. <b>Tripo</b> y <b>Pixabay</b>: no se usaron (sin clave / no deja descargar desde aquí).',
    '14': '<b>Más fluido</b>: materiales más livianos (Lambert) en todos los modelos y el suelo, sin sombras, y las barras de vida se dibujan cada dos cuadros con más de 40 tropas. <b>Alta</b>: llega a 2× en pantallas Retina (antes 1,75×) y un reflejo del cielo algo más fuerte. «Automática» sigue cuidando los cuadros por segundo.',
    '16': 'Modelo nuevo (radar, lanzador y contenedores; nivel 4 con el misil en su rampa). Ahora el radar <b>fija el blanco</b> (0,5 s) antes de disparar, <b>prioriza aeronaves</b> y lanza <b>ráfagas de 2 misiles</b>. Ficha de radar con alcance, recarga, daño por ráfaga, detección de furtivos y qué está siguiendo; marcas amarillas/rojas sobre el blanco y aro rojo de alerta si un radar enemigo fija tu aeronave.',
    '17': 'Soldados rehechos en Blender: cabeza más chica con cuello, uniforme, chaleco táctico del color de tu imperio con bolsillos, cinturón, mochila, rodilleras y brazos que sostienen el arma con las dos manos. Nuevo Médico con casco blanco y cruz roja.',
    '22': 'Núcleo con banderas de tu imperio en las torres y portón. Panel con casillas de estado (monedas, comunidad, láser, escudo de emergencia y Cúpula) y, en todos los edificios, el recuadro «Al mejorar» con lo que vas a ganar antes de pagar.',
    '26': 'Tierra fértil en manchas más grandes: al menos 8 casillas fértiles a 4 casillas de cada Núcleo (antes unas 4). La Granja ya ocupaba casi toda la casilla y no se cambió.',
    '29': 'Icono sobre el helicóptero mientras dispara (mira) o lanza misiles/cohetes, además de las balas, cohetes con estela y fogonazos.',
}
for num, text in FIX.items():
    s, n = re.subn(rf'(<tr><td>{num}</td><td>[^<]*(?:<[^>]+>[^<]*)*?</td><td>).*?(</td></tr>)', lambda m: m.group(1) + text + m.group(2), s, count=1)
    if not n:
        missing_rows.append('punto ' + num)
s = s.replace('<p>Los bots también usan lo nuevo: construyen Aeropuerto, Portaaviones y vehículos nuevos según su personalidad, y el misil nuclear solo desde Normal y muy tarde en la partida.</p>',
              '<p>Los bots también usan lo nuevo (ver F18): vehículos y barcos nuevos, Médico, helicópteros, Aeropuerto con Cazas y Bombarderos, Torreta y AIR DEFENSE de nivel 4, '
              'y el misil nuclear muy tarde en la partida. Con más de 15.000 monedas guardadas invierten en aire y defensa antiaérea; para cruzar el mar usan la Lancha de desembarco pasados 10 minutos.</p>')

DECISIONS = f"""<section>
  <div class="eyebrow">09 · Decisiones</div>
  <h2>Decisiones y ajustes durante la versión</h2>
  <ul>
    <li><b>Suelo:</b> me pediste volver al suelo de la v0.6 porque no te gustaron las «manchas» de las texturas. Se borraron las texturas de Poly Haven y su código; el suelo vuelve a tener un color liso por terreno (F20). El juego bajó de 2,9 MB a 2,3 MB.</li>
    <li><b>Apache:</b> no tiene límite (solo la comunidad), y los bots ahora pueden tener tantos Apaches como Helicópteros cuando tienen dinero.</li>
    <li><b>Nombres:</b> los vehículos reales inspiran los modelos, pero en el juego llevan nombres propios (Caza furtivo, Bombardero furtivo, Portaaviones, Lanzacohetes) para no usar marcas.</li>
    <li><b>Misil nuclear:</b> arma de juego muy cara (20.000) y lenta de recargar (3 min), con aviso al rival y defensa posible (Escudo antimisiles); la explosión es un efecto de luz y humo.</li>
    <li><b>Meshy:</b> la clave guardada respondió «clave no válida» (las claves de Meshy empiezan con «msy_»). Si quieres usarlo, vuelve a guardarla por el formulario seguro; mientras tanto, todo se hizo en Blender.</li>
    <li><b>Campaña:</b> con bots más fuertes y aviones, la misión 6 tarda más: la estrella de tiempo pasa de 18 a 25 minutos, y el consejo avisa que tengas AIR DEFENSE. En la misión 5 la muralla del rival sigue con 5 tramos, como en la v0.7 (con más tierra fértil, ahora también puede ir sobre ella).</li>
    <li><b>Tierra fértil:</b> si el agua tapaba una mancha, el mapa completa las casillas fértiles al lado, para que siempre haya al menos 8 cerca de cada Núcleo.</li>
    <li><b>Tamaño:</b> {round(2340 / 1024, 2):.2f} MB con 75 modelos (meta: menos de 3,5 MB).</li>
    <li><b>Puntos 8, 18 y 26:</b> se programaron como decía la tabla (comunidad por bajas hasta 180, escudo propio en cada edificio, manchas fértiles más grandes); si los querías distinto, se cambia.</li>
  </ul>
  <h3>Siguiente paso</h3>
  <p>Jugar la v0.9 en tu iPad: mirar si el suelo quedó como te gustaba, si el ejército nuevo y el misil nuclear se sienten bien, y cuántos cuadros por segundo da en «Más fluido» y en «Alta». Con eso decidimos la próxima versión.</p>
</section>"""
s, n = re.subn(r'<section>\s*<div class="eyebrow">09 · Decisiones</div>.*?</section>', DECISIONS, s, count=1, flags=re.S)
if not n:
    missing_rows.append('decisiones')
open(PRD, 'w').write(s)
counts = {k: sum(1 for v in rows.values() if v[0] == k) for k in LABEL}
print('filas', len(rows), counts, 'sin datos', missing_rows)
for k in sorted(rows):
    if rows[k][0] != 'ok':
        print('NO OK', k, rows[k][1][:300])
if missing_rows:
    sys.exit(1)
