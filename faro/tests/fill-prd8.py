"""Completa el PRD v0.8 con los resultados reales y lo que cambió durante la versión."""
import os
import html
import json
import re
import sys

SP = os.environ.get('SP', os.path.dirname(os.path.abspath(__file__))) + '/'
PRD = '/home/user/opencode-mobile/faro/docs/prd/PRD_web_v0.8.html'
rows = {}
for name in ('results-v08.json', 'results-v08-bots.json'):
    for r in json.loads(open(SP + name).read()):
        if r['id'].startswith('E'):
            rows[r['id']] = ('ok' if r['ok'] else 'fail', re.sub(r'\s+', ' ', r['ev']).strip())
errs = [r for r in json.loads(open(SP + 'results-v08.json').read()) if r['id'] == 'errs']
extra = json.loads(open(SP + 'extra-evidence8.json').read())
rows['E11'] = ('ok' if extra['e11_ok'] else 'fail', extra['e11'])
rows['E13'] = ('ok' if extra['e13_ok'] else 'fail', extra['e13'])
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


s = re.sub(r'<tr><td>(E\d\d)</td><td>(.*?)</td><td><span class="chip [a-z]+">[^<]*</span></td><td>.*?</td></tr>', repl, s)
s = s.replace('Estado: <b id="estado">Plan</b>', 'Estado: <b id="estado">Terminada (pruebas abajo)</b>')
if '#pruebas td' not in s:
    s = s.replace('.chip { display: inline-block;', '#pruebas td { overflow-wrap: anywhere; word-break: break-word; }\n.chip { display: inline-block;', 1)
s = s.replace('<tr><td>0.8</td><td>8 nov 2026</td><td>Esta versión.</td></tr>',
              '<tr><td>0.8</td><td>8 nov 2026</td><td>Suelo con texturas de Poly Haven, avisos en el borde, barra de producción, iconos, ficha del enemigo, '
              'bots más listos y soldados con el movimiento de CMU.</td></tr>')

# Lo que quedó de verdad en los bots y las animaciones.
s = s.replace("""      <tr><td>Ataque ordenado</td><td>Sus oleadas usan «avanzar atacando» y formación en línea, igual que tus controles nuevos.</td></tr>""",
              """      <tr><td>Ataque ordenado</td><td>Se forman en línea mientras se reúnen y avanzan atacando, juntas, para llegar a la vez. Pasados 15 minutos, las oleadas salen con todo el ejército de casa (los guardias se quedan en sus Banderas).</td></tr>""")
s = s.replace("""    <li>El movimiento de caminar y correr de la base de datos de CMU se pasa a ese esqueleto y se exporta con cada soldado (Constructor, Ingeniero, los 7 de combate y la Brigada Tóxica).</li>""",
              """    <li>Blender lee los archivos de CMU (02_01 caminar y 35_17 correr), mide en cada cuadro la cadera, la rodilla, la inclinación del torso y el rebote, y guarda un ciclo de 24 muestras (2,4 KB). El juego aplica esas curvas a las piernas de todos los soldados (Constructor, Ingeniero, los 7 de combate y la Brigada Tóxica), al ritmo de su velocidad para que los pies no patinen.</li>""")
s = s.replace("""    <li>Los soldados reciben un esqueleto simple en Blender (cadera, piernas, rodillas, torso, brazos y cabeza).</li>""",
              """    <li>Los soldados se rehicieron en Blender con piernas de dos piezas: muslo (gira en la cadera) y pierna (gira en la rodilla).</li>""")

DECISIONS = """<section>
  <div class="eyebrow">09 · Decisiones</div>
  <h2>Decisiones y ajustes durante la versión</h2>
  <ul>
    <li><b>Sonidos:</b> Pixabay no deja descargar desde aquí. Si me mandas los archivos, los pongo; mientras tanto siguen los sintetizados.</li>
    <li><b>Animaciones:</b> el juego arma sus propias piezas de cada modelo, así que en lugar de un esqueleto con huesos dentro del archivo, el movimiento de CMU se guarda como curvas que se aplican a muslo, pierna y torso. Es más liviano para el iPad y se ve igual.</li>
    <li><b>Bots, lo que se probó y se quitó:</b> un «asalto decisivo» junto con cambios de economía hizo al bot más débil en 40 duelos (ganaba 10 y perdía 14). Se quitó y se dejó solo la oleada con todo pasados 15 minutos.</li>
    <li><b>Bots, lo que se midió:</b> la formación en línea en el ataque final lo dispersaba; ahora se forman en línea al reunirse y atacan juntos. El fuego concentrado y la Torreta de defensa sí lo hacen más fuerte (sin ellos perdía más duelos). Los guardias de las Banderas ya no salen a defender ni a atacar, para no perder ingresos.</li>
    <li><b>Meta del 60 % (E11), no alcanzada:</b> el bot nuevo gana el 57 % de las partidas con ganador. Lo que más pesa es que ninguno de los dos rompe bien las defensas del otro (31 de 80 duelos sin ganador) y que a veces el rival toma el Faro antes y gana un 50 % más de monedas. Disputar el Faro antes y asedios mejores pueden ir en la próxima versión.</li>
    <li><b>Texturas:</b> se probaron tres niveles de contraste; el más fuerte parecía manchado y costaba leer el mapa. Quedó uno intermedio, con el color de cada terreno mandando.</li>
    <li><b>Tamaño:</b> el juego pesa 2,5 MB (meta: menos de 2,6 MB).</li>
    <li><b>Créditos:</b> Poly Haven (CC0) y CMU (conversión BVH de B. Hahne) en el README.</li>
  </ul>
  <h3>Siguiente paso</h3>
  <p>Jugar la v0.8 en tu iPad: mirar si el suelo y el movimiento de los soldados se ven bien, si los cuadros por segundo siguen sobre 50 y si los bots dan más pelea. Si quieres, la próxima versión puede seguir con los bots (disputar el Faro y asediar mejor) para llegar a la meta del 60 %.</p>
</section>"""
s, n = re.subn(r'<section>\s*<div class="eyebrow">09 · Decisiones</div>.*?</section>', DECISIONS, s, count=1, flags=re.S)
if not n:
    missing.append('decisiones')
open(PRD, 'w').write(s)
counts = {k: sum(1 for v in rows.values() if v[0] == k) for k in LABEL}
print('filas', len(rows), counts, 'sin datos', missing, 'errores consola', errs)
if missing:
    sys.exit(1)
