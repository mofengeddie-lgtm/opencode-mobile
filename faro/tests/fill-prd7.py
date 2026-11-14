"""Completa el PRD v0.7 con los resultados reales y los ajustes hechos durante la versión."""
import os
import html
import json
import re
import sys

SP = os.environ.get('SP', os.path.dirname(os.path.abspath(__file__))) + '/'
PRD = '/home/user/opencode-mobile/faro/docs/prd/PRD_web_v0.7.html'
extra = json.loads(open(SP + 'extra-evidence7.json').read())
rows = {}
for r in json.loads(open(SP + 'results-v07.json').read()):
    if r['id'].startswith('D'):
        rows[r['id']] = ('ok' if r['ok'] else 'fail', re.sub(r'\s+', ' ', r['ev']).strip())
errs = [r for r in json.loads(open(SP + 'results-v07.json').read()) if r['id'] == 'errs']
rows['D04'] = ('ok' if extra['d04_ok'] else 'fail', extra['d04'])
rows['D12'] = ('ok' if extra['d12_ok'] else 'fail', extra['d12'])
sizes = json.loads(open(SP + 'results-v07-sizes.json').read())
okn = sum(1 for s in sizes if s['ok'])
rows['D13'] = ('ok' if okn == len(sizes) else 'fail',
               f'{okn}/{len(sizes)} tamaños sin problemas (iPad horizontal y vertical, 16:9, celular horizontal y vertical): '
               'vestíbulo de la Campaña, historia de la misión, panel de tropas con los botones nuevos, panel de la misión plegado y abierto, '
               'Cuartel con «Repetir» y «×5», y pantalla final. Ningún panel tapa a otro ni se sale; botones de 36 px o más; el botón de plegar va sobre el minimapa.'
               + ('' if okn == len(sizes) else ' Fallas: ' + ' | '.join(f"{s['name']}: {'; '.join(s['fails'])}" for s in sizes if not s['ok'])))
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


s = re.sub(r'<tr><td>(D\d\d)</td><td>(.*?)</td><td><span class="chip [a-z]+">[^<]*</span></td><td>.*?</td></tr>', repl, s)
s = s.replace('Estado: <b id="estado">Plan</b>', 'Estado: <b id="estado">Terminada (pruebas abajo)</b>')
if '#pruebas td' not in s:
    s = s.replace('.chip { display: inline-block;', '#pruebas td { overflow-wrap: anywhere; word-break: break-word; }\n.chip { display: inline-block;', 1)

# Historial y tabla de misiones con lo que quedó de verdad.
s = s.replace('<tr><td>0.7</td><td>8 nov 2026</td><td>Esta versión.</td></tr>',
              '<tr><td>0.7</td><td>8 nov 2026</td><td>Campaña «La ruta del Faro» (6 misiones con estrellas y premios), grupos 1-2-3, '
              'avanzar atacando, formación en línea, repetir tropa y botón Constructores.</td></tr>')
MISSIONS = {
    '2': ('Un Almirante con Puerto, 2 Lanchas y 3 soldados ataca hacia el minuto 2: aguanta 6 minutos. Empiezas con 4.000 monedas y una Torreta.'),
    '3': ('El Guardián del Faro empieza con el Faro y 4 guardias. Con tus 3 Artilleros y más tropas, quítaselo y mantenlo 60 s en total.'),
    '4': ('Mar abierto: captura 2 Banderas de otras islas. Puerto y Barcaza listos; las 2 Banderas más cercanas tienen guardias del rival.'),
    '5': ('El rival tiene Núcleo de nivel 2, murallas, Torretas de nivel 2 y 3 y AIR DEFENSE: destruye su Núcleo. Empiezas con 8.000 monedas.'),
    '6': ('Tres imperios (Constructor, Agresivo y Almirante): sé el último Núcleo en pie. Empiezas con 4.000 monedas.'),
}
for num, text in MISSIONS.items():
    s, n = re.subn(rf'(<tr><td>{num}</td><td>[^<]*</td><td>)[^<]*(</td>)', rf'\g<1>{text}\g<2>', s, count=1)
    if not n:
        missing.append('mision' + num)

DECISIONS = """<section>
  <div class="eyebrow">09 · Decisiones</div>
  <h2>Decisiones y ajustes durante la versión</h2>
  <ul>
    <li><b>Misión 2:</b> el Almirante empezaba con un Destructor y en las pruebas ganaba siempre (dispara más lejos que la Torreta y el Núcleo). Se quitó el Destructor; el Almirante lo fabrica más tarde. Tú empiezas con 4.000 monedas y una Torreta. Dificultad Normal.</li>
    <li><b>Misión 3:</b> con el Faro libre se ganaba en 82 s. Ahora el Guardián empieza con el Faro y 4 guardias, y tú con 3 Artilleros: hay que juntar tropas y atacar en grupo.</li>
    <li><b>Misión 4:</b> con tropas listas se ganaba en 53 s. Ahora entrenas tu infantería y las 2 Banderas más cercanas tienen guardias.</li>
    <li><b>Misión 6:</b> con 3 rivales iguales a ti el piloto perdía casi siempre. Ahora empiezas con 4.000 monedas y tu vecino más cercano es el Constructor (ataca más tarde).</li>
    <li><b>Misión 5</b> es la única en Difícil; la 1 en Fácil (vecino tranquilo que no ataca); el resto en Normal.</li>
    <li><b>Panel de la misión en pantallas chicas:</b> plegado arriba a la derecha (en celular vertical, debajo del minimapa). Se abre con «Mostrar».</li>
    <li><b>Teclado:</b> además de Ctrl + número, guarda un grupo con Cmd o Mayús + número, porque Chrome usa Ctrl + número para cambiar de pestaña.</li>
    <li><b>Constructores:</b> el primer toque elige a los que no trabajan; el segundo, a todos.</li>
    <li><b>Minimapa:</b> la fila de grupos estiraba la caja del minimapa y en pantallas chicas corría el botón de plegar; se arregló (lo encontró una prueba de la v0.3).</li>
    <li><b>Historia:</b> textos cortos propios sobre el Faro de Ámbar; se pueden cambiar cuando quieras.</li>
  </ul>
  <h3>Siguiente paso</h3>
  <p>Jugar la campaña en tu iPad y decirme qué misión se siente muy fácil o muy difícil: cada una se ajusta cambiando un número.</p>
</section>"""
s, n = re.subn(r'<section>\s*<div class="eyebrow">09 · Decisiones</div>.*?</section>', DECISIONS, s, count=1, flags=re.S)
if not n:
    missing.append('decisiones')
open(PRD, 'w').write(s)
counts = {k: sum(1 for v in rows.values() if v[0] == k) for k in LABEL}
print('filas', len(rows), counts, 'sin datos', missing, 'errores consola', errs)
if missing or counts['fail']:
    sys.exit(1)
