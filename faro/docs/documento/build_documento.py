"""Documento completo de Faro de Ámbar: historia desde la v0.1, cómo está hecho, catálogo y TODO el código.

Uso (desde la raíz del repositorio):
    python3 faro/docs/documento/build_documento.py
    node faro/docs/pdf.cjs faro/docs/documento/Documento_Completo_Faro_de_Ambar.html

Se arma leyendo el proyecto, así que siempre está al día: cada versión nueva agrega sus mejoras en
`registro.md` y vuelve a correr este script (regla del proyecto, ver faro/AGENTS.md).
"""
import datetime
import glob
import html
import json
import os
import re
import subprocess
import sys

import markdown

HERE = os.path.dirname(os.path.abspath(__file__))
FARO = os.path.abspath(os.path.join(HERE, '..', '..'))
sys.path.insert(0, os.path.dirname(HERE))
from doc_style import head  # noqa: E402

OUT = os.path.join(HERE, 'Documento_Completo_Faro_de_Ambar.html')
MES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
MES3 = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC']
esc = html.escape


def md(text):
    return markdown.markdown(text, extensions=['tables', 'fenced_code', 'sane_lists'], output_format='html5')


def rel(p):
    return os.path.relpath(p, os.path.dirname(FARO))


# ---------- datos del juego (desde 00-config.js) ----------
def catalog():
    js = r'''
const fs = require('fs'); const vm = require('vm');
const dir = process.argv[1];
const ctx = { console, Math, JSON, Set, Map, Array, Object, Number, String, Infinity, isFinite };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(dir + '00-config.js', 'utf8') + ';globalThis.OUT={U:UNITS,B:BUILDINGS,M:MODES,P:MAPS,V:GAME_VERSION};', ctx);
const o = ctx.OUT;
const pick = (x) => JSON.parse(JSON.stringify(x, (k, v) => (typeof v === 'function' ? undefined : v)));
process.stdout.write(JSON.stringify({ U: pick(o.U), B: pick(o.B), M: pick(o.M), P: pick(o.P), V: o.V }));
'''
    out = subprocess.run(['node', '-e', js, os.path.join(FARO, 'src', 'js') + '/'], capture_output=True, text=True, check=True).stdout
    return json.loads(out)


# ---------- PRD de cada versión ----------
def prds():
    rows = []
    for f in glob.glob(os.path.join(FARO, 'docs', 'prd', 'PRD_web_v*.html')):
        v = re.search(r'v(\d+\.\d+)\.html$', f).group(1)
        s = open(f, encoding='utf-8').read()
        fecha = (re.search(r'<meta name="fecha" content="([^"]+)"', s) or re.search(r'<p class="meta">([^·<]+)', s))
        estado = re.search(r'id="estado">([^<]+)<', s)
        tiles = re.findall(r'<div class="tile"><b>(.*?)</b>', s)
        chips = re.findall(r'class="chip (ok|fail|pend|np)"', s)
        rows.append({
            'v': v, 'key': tuple(int(x) for x in v.split('.')), 'file': os.path.basename(f),
            'fecha': html.unescape(fecha.group(1)).strip() if fecha else '',
            'estado': html.unescape(estado.group(1)) if estado else '',
            'tiles': [html.unescape(re.sub('<[^>]+>', '', t)) for t in tiles],
            'ok': chips.count('ok'), 'fail': chips.count('fail'), 'pend': chips.count('pend') + chips.count('np'),
            'pdf': os.path.exists(f.replace('.html', '.pdf')),
        })
    return sorted(rows, key=lambda r: r['key'])


# ---------- archivos ----------
CODE_FILES = (
    ['src/index.template.html'] + sorted(os.path.relpath(p, FARO) for p in glob.glob(os.path.join(FARO, 'src', 'js', '*.js'))) +
    ['build.mjs'] + sorted(os.path.relpath(p, FARO) for p in glob.glob(os.path.join(FARO, 'blender', '*.py'))) +
    ['docs/pdf.cjs', 'docs/doc_style.py', 'docs/roblox/build_prd_roblox.py', 'docs/documento/build_documento.py',
     'site/build_site.py', 'site/capture.cjs'] +
    # v1.8: programa revisor (compara el juego con los documentos del usuario).
    ['tools/revisar/revisar.py', 'tools/revisar/plan_v18.py', 'tools/revisar/datos.cjs', 'tools/revisar/fotos.cjs',
     'tools/revisar/extraer_refs.py', 'tools/revisar/prd_v18.py', 'README.md', 'AGENTS.md'] +
    # v1.9: versión para Poki: idiomas, modelos comprimidos, miniaturas y paquete.
    ['src/i18n/en.json', 'tools/idioma/envolver.cjs', 'tools/idioma/claves.cjs', 'tools/idioma/revisar_pantallas.cjs',
     'tools/modelos/comprimir.mjs', 'tools/poki/miniaturas.cjs', 'tools/poki/empaquetar.py', 'docs/prd/prd_v19.py']
)
DESC = {
    'src/index.template.html': 'Estructura de la página y todos los estilos de la interfaz.',
    'build.mjs': 'Une el código, los modelos y los recursos en un solo archivo: faro.html.',
    'README.md': 'Presentación del prototipo, controles, novedades de cada versión y créditos.',
    'AGENTS.md': 'Reglas de trabajo del proyecto (PRD y PDF en cada versión, documento completo).',
    'docs/pdf.cjs': 'Convierte un documento HTML en PDF A4 con encabezado y número de página.',
    'docs/doc_style.py': 'Estilo común de los documentos.',
    'docs/roblox/build_prd_roblox.py': 'Arma el PDF del PRD Roblox v1.6 con sus imágenes.',
    'docs/documento/build_documento.py': 'Arma este documento.',
    'site/build_site.py': 'Arma el sitio web del juego (una sola página con las capturas y el ejército).',
    'site/capture.cjs': 'Saca del juego real las capturas y las fichas que usa el sitio web.',
    'tools/revisar/revisar.py': 'Programa revisor: ¿el juego tiene lo de los documentos del usuario? Informe en HTML, PDF y JSON.',
    'tools/revisar/plan_v18.py': 'Nombre del usuario → clave del juego, plan de la v1.8, equipamiento y revisiones de la UI 0.4.',
    'tools/revisar/datos.cjs': 'Lee del archivo del juego los datos de tropas, edificios y modelos 3D.',
    'tools/revisar/fotos.cjs': 'Abre el juego en Chromium y guarda la miniatura 3D de cada tropa y edificio.',
    'tools/revisar/extraer_refs.py': 'Saca las imágenes de los modelos del usuario de su PDF v1.8.',
    'tools/revisar/prd_v18.py': 'Arma el PRD v1.8 a partir del plan y del informe del revisor.',
    'src/i18n/en.json': 'Diccionario inglés: clave = texto en español, valor = traducción (1.697 textos).',
    'tools/idioma/envolver.cjs': 'Envuelve los textos en español del código con T$ y L$ para poder traducirlos.',
    'tools/idioma/claves.cjs': 'Revisor de idioma (1): junta todas las claves y dice cuáles faltan en el diccionario.',
    'tools/idioma/revisar_pantallas.cjs': 'Revisor de idioma (2): recorre el juego en inglés y busca español a la vista.',
    'tools/modelos/comprimir.mjs': 'Comprime los modelos 3D con meshopt sin cuantizar (sin pérdida).',
    'tools/poki/miniaturas.cjs': 'Saca del juego las dos miniaturas para Poki (1024×1024).',
    'tools/poki/empaquetar.py': 'Arma la versión para Poki y el .zip que se sube.',
    'docs/prd/prd_v19.py': 'Arma el PRD v1.9 (plan y resultados).',
}

# v1.8: qué muestra cada imagen del PDF «Equipamiento militar 2» del usuario (las capturas y fotos de prensa no se
# copian al proyecto porque son de otros sitios; aquí queda qué muestran y qué tropa salió de cada una).
EQUIP_PAGES = [
    ('4', 'Imagen 1', 'Guía (en chino) de 23 términos de arte para juegos: píxel, low-poly, vóxel, acuarela, etc.', 'Referencia de estilo; el juego sigue con bloques tipo Roblox.'),
    ('5', 'Imágenes 2 y 3', 'Dos escenas de islas hexagonales con base, faro, granjas y mar.', 'Confirman el aspecto del mapa (que no se cambia).'),
    ('6', 'Imagen 4', 'Guía de ángulos de cámara: cenital, isométrica, 2.5D, lateral, primera y tercera persona.', 'La cámara del juego ya es isométrica giratoria.'),
    ('7', 'Imagen 5', 'Guía de interfaz: 9-slice, zona segura y dibujo vectorial.', 'Zona segura y botones que no se deforman (ya en la UI).'),
    ('8', 'Imagen 6', 'Guía de sprites, texturas, polígonos y shaders.', 'Referencia técnica.'),
    ('9', 'Imagen 7', 'Lanzador de misil grande sobre camión (desfile).', 'Lanzador nuclear móvil.'),
    ('9', 'Imagen 8', 'Lanzadores DF-17 en desfile.', 'Lanzador DF-17.'),
    ('10', 'Imagen 9', 'Búsqueda: drones MQ-9, misiles hipersónicos DF-17, logística e ingeniería.', 'Dron de ataque, Lanzador DF-17, Camión de suministros, Ambulancia, Vehículo de recuperación.'),
    ('10', 'Imagen 10', 'Búsqueda: aviación de combate F-35, poder naval (Ford), drones.', 'Avión de combate furtivo, Portaaviones, drones.'),
    ('11', 'Imágenes 11 y 12', 'Búsqueda: portaaviones Ford, drones MQ-9, tanques Abrams, F-35.', 'Portaaviones, Dron de ataque, Tanque pesado, Avión de combate furtivo.'),
    ('12', 'Imagen 13', 'Búsqueda: tanques y blindados (Abrams).', 'Tanque pesado, Blindado ligero, Vehículo de combate de infantería.'),
    ('12', 'Imagen 14', 'Búsqueda: cañones láser en destructores; fuerzas espaciales y satélites.', 'Torre láser. Satélites: fuera del juego.'),
    ('13', 'Imagen 15', 'Búsqueda: buques de desembarco anfibio y aerodeslizadores (LCAC).', 'Buque de desembarco, Aerodeslizador militar.'),
    ('13', 'Imagen 16', 'Búsqueda: helicópteros de ataque (Apache) y equipo individual del soldado (visión nocturna).', 'Apache Guardián, Soldado.'),
    ('14', 'Imagen 17', 'Búsqueda: submarinos nucleares (interior y exterior); helicópteros de ataque.', 'Submarino, Submarino estratégico.'),
    ('14', 'Imagen 18', 'Búsqueda: bombarderos furtivos B-2, aviones de carga C-17, escudos antimisiles (Cúpula de Hierro, Patriot).', 'Bombardero furtivo, Avión de transporte militar, Escudo antimisiles, Defensa de punto.'),
    ('15', 'Imagen 19', 'Búsqueda: artillería autopropulsada, HIMARS y A-10.', 'Obús autopropulsado, Lanzacohetes múltiple, Avión de apoyo terrestre.'),
]
UI04 = [('ui04-02.jpg', '01 Carga'), ('ui04-03.jpg', '02 Vestíbulo'), ('ui04-04.jpg', '03 Modos'), ('ui04-05.jpg', '04 Partida'),
        ('ui04-06.jpg', '05 Construcción'), ('ui04-07.jpg', '06 Producción'), ('ui04-08.jpg', '07 Puerto y transporte'), ('ui04-09.jpg', '08 Aviación'),
        ('ui04-10.jpg', '09 Arsenal'), ('ui04-11.jpg', '10 Lanzador estratégico'), ('ui04-12.jpg', '11 Inventario'), ('ui04-13.jpg', '12 Misiones'),
        ('ui04-14.jpg', '13 Ajustes'), ('ui04-15.jpg', '14 Resultado'), ('ref-nuclear-movil.jpg', 'Referencia 1 · Lanzador nuclear móvil'),
        ('ref-df-17.jpg', 'Referencia 2 · DF-17')]


def user_docs_html():
    """Capítulos 09-11 (v1.8): documentos e imágenes del usuario, su catálogo con estado y el informe del revisor."""
    rd = os.path.join(FARO, 'docs', 'roblox')
    refs = os.path.join(rd, 'modelos-0.2')
    out = []
    names = {'builder': 'Constructor', 'engineer': 'Ingeniero', 'rifle': 'Artillero', 'shotgun': 'Escopetero', 'ranger': 'Ranger', 'sniper': 'Francotirador',
             'breaker': 'Rompedor', 'hunter': 'Cazador', 'rocket': 'Cohetero', 'tank': 'Tanque', 'aa': 'Camión antiaéreo', 'speedboat': 'Lancha rápida',
             'boatEng': 'Barco constructor', 'barge': 'Barcaza', 'destroyer': 'Destructor', 'sub': 'Submarino', 'heli': 'Helicóptero', 'apache': 'Apache Guardián',
             'core': 'Núcleo', 'farm': 'Granja', 'wind': 'Molino', 'house': 'Casa', 'pump': 'Bomba de petróleo', 'rig': 'Plataforma petrolera',
             'barracks': 'Cuartel', 'factory': 'Fábrica', 'harbor': 'Puerto', 'helipad': 'Helipuerto', 'wall': 'Muro', 'turret': 'Torreta', 'aadef': 'Antiaéreo'}
    figs = ''.join(f'<figure><img src="../roblox/modelos-0.2/{k}.jpg" alt=""><figcaption>{esc(n)}</figcaption></figure>' for k, n in names.items()
                   if os.path.exists(os.path.join(refs, k + '.jpg')))
    ui = ''.join(f'<figure><img src="../roblox/ui-0.4/{f}" alt=""><figcaption>{esc(t)}</figcaption></figure>' for f, t in UI04 if os.path.exists(os.path.join(rd, 'ui-0.4', f)))
    eqmd = open(os.path.join(rd, 'Equipamiento_Militar_2.md'), encoding='utf-8').read().split('\n', 2)[-1]
    eqrows = ''.join(f'<tr><td>{p}</td><td>{esc(i)}</td><td>{esc(w)}</td><td>{esc(t)}</td></tr>' for p, i, w, t in EQUIP_PAGES)
    out.append(f'''<section><div class="eyebrow">09 · Tus documentos</div><h2>Tus documentos e imágenes</h2>
  <p>Todo lo que mandaste para el juego, guardado en <code>faro/docs/roblox/</code>. Los textos se guardan sin cambios; las imágenes de tus modelos se sacaron de tu PDF v1.8 con <code>tools/revisar/extraer_refs.py</code>.</p>
  <table><thead><tr><th style="width:30%">Documento</th><th>Qué trae</th></tr></thead><tbody>
  <tr><td>PRD Roblox v1.6 (13 nov 2026)</td><td>Plan de 5 etapas para Roblox Studio + Luau.</td></tr>
  <tr><td>PRD Roblox v1.8 (14 nov 2026)</td><td>Auditoría del código Luau, catálogo de 78 tropas y 32 edificios (secciones 37-54), DF-5C y lanzador de un misil, UI del arsenal y mejoras profesionales. Con 31 imágenes de modelos 0.2 y 2 escenas.</td></tr>
  <tr><td>Dirección visual UI 0.4 (14 nov 2026)</td><td>14 pantallas de interfaz y 2 propuestas de vehículos.</td></tr>
  <tr><td>Equipamiento militar 2 (15 nov 2026)</td><td>Lista de equipo militar moderno: texto y 19 imágenes en 15 páginas.</td></tr>
  </tbody></table>
  <h3>Tus modelos 0.2 (PDF v1.8, páginas 3 a 12)</h3>
  <div class="figs f6">{figs}</div>
  <h3>Tus escenas (PDF v1.8, páginas 13 y 14)</h3>
  <div class="figs"><figure><img src="../roblox/modelos-0.2/escena-base.jpg" alt=""><figcaption>Vista propuesta · Base terrestre</figcaption></figure>
    <figure><img src="../roblox/modelos-0.2/escena-costa.jpg" alt=""><figcaption>Vista propuesta · Costa y puerto</figcaption></figure></div>
  <h3>Tu Dirección visual UI 0.4</h3>
  <div class="figs f4">{ui}</div>
  <h3>Tu lista «Equipamiento militar moderno» (texto completo)</h3>
  {md(eqmd)}
  <h3>Qué muestra cada imagen de ese PDF</h3>
  <p>Las capturas de búsquedas y las fotos de prensa no se copian al proyecto (son de otros sitios). Esto es lo que muestra cada una y qué tropa del juego salió de ella.</p>
  <table><thead><tr><th style="width:7%">Pág.</th><th style="width:14%">Imagen</th><th>Qué muestra</th><th style="width:32%">En el juego</th></tr></thead><tbody>{eqrows}</tbody></table>
  </section>''')
    rep = os.path.join(FARO, 'tools', 'revisar', 'salida', 'informe.json')
    if os.path.exists(rep):
        r = json.load(open(rep, encoding='utf-8'))
        S = r['summary']
        st = {'ok': 'En el juego', 'aviso': 'Con aviso', 'falta': 'Falta', 'fuera': 'Fuera', 'fuente': 'No está en tu archivo'}
        rows = []
        for i in r['catalog']:
            img = f'<img class="mini" src="../roblox/modelos-0.2/{i["key"]}.jpg" alt="">' if i['key'] and os.path.exists(os.path.join(refs, i['key'] + '.jpg')) else ''
            rows.append(f'<tr><td>{img}{esc(i["name"])}</td><td>{esc(i["group"])}</td><td><code>{esc(i["key"] or "—")}</code></td><td>{esc(i["game_name"] or "—")}</td>'
                        f'<td>{esc(i["producer"] or "—")}</td><td>{"sí" if i["model"] else "no"}</td><td>{st.get(i["state"], i["state"])}</td></tr>')
        ex = ''.join(f'<tr><td>{esc(e["name"])}</td><td>{esc(e["kind"])}</td><td><code>{esc(e["key"])}</code></td></tr>' for e in r['extras'])
        out.append(f'''<section><div class="eyebrow">10 · Tu catálogo</div><h2>Tu catálogo con su estado en el juego</h2>
  <p>Las {S['catalog_total']} entradas de las secciones 37-54 de tu PRD 1.8, en tu orden, con la clave que tienen en el juego, el nombre que se ve, el productor que pusiste, si tienen modelo 3D y su estado. Sale del último informe del programa revisor ({esc(r['at'])}, juego v{esc(r['game']['version'])}).</p>
  <table class="cat"><thead><tr><th>Tu nombre</th><th>Grupo</th><th>Clave</th><th>En el juego</th><th>Productor</th><th>3D</th><th>Estado</th></tr></thead><tbody>{''.join(rows)}</tbody></table>
  <h3>Tropas y edificios del juego que no están en tu catálogo</h3>
  <p>Vienen de versiones anteriores o de tu lista de equipamiento. Se quedan; los puedes quitar o renombrar cuando quieras.</p>
  <table><thead><tr><th>Nombre</th><th>Tipo</th><th>Clave</th></tr></thead><tbody>{ex}</tbody></table></section>''')
        out.append(f'''<section><div class="eyebrow">11 · Programa revisor</div><h2>El programa revisor y su último informe</h2>
  <p>Desde la v1.8, <code>faro/tools/revisar/revisar.py</code> lee tus archivos (PRD 1.8, equipamiento, UI 0.4 e imágenes de tus modelos) y el archivo real del juego, y dice qué está y qué falta. Escribe <code>salida/informe.html</code>, <code>informe.pdf</code> e <code>informe.json</code>, con tus imágenes al lado de las miniaturas del juego.</p>
  <div class="tiles"><div class="tile"><b>{S['catalog_ok']} de {S['catalog_total']}</b><span>tu catálogo</span></div><div class="tile"><b>{S['equip_ok']} de {S['equip_total']}</b><span>equipamiento militar</span></div>
    <div class="tile"><b>{S['ui_ok']} de {S['ui_total']}</b><span>pantallas UI 0.4</span></div></div>
  <pre><code>python3 faro/tools/revisar/revisar.py            # revisa faro/faro.html
python3 faro/tools/revisar/revisar.py --fotos    # además saca las miniaturas 3D del juego
python3 faro/tools/revisar/revisar.py --estricto # termina con error si falta algo</code></pre>
  <p>Revisa archivos y datos: que cada elemento exista, con modelo, tu nombre y tu productor, y que la interfaz tenga lo de tus pantallas. Cómo funciona cada tropa en una partida lo comprueban las pruebas del PRD.</p></section>''')
    return '\n'.join(out)



def first_comment(path):
    for line in open(path, encoding='utf-8'):
        t = line.strip()
        if t.startswith('//'):
            return t.lstrip('/ ').strip()
        if t.startswith('"""') and len(t) > 6:
            return t.strip('"').strip()
        if t.startswith('#') and not t.startswith('#!'):
            return t.lstrip('# ').strip()
        if t and not t.startswith(('/*', '*', '"""', "'use strict'", '<!')):
            break
    return ''


def nlines(path):
    with open(path, encoding='utf-8') as fh:
        return sum(1 for _ in fh)


def main():
    cat = catalog()
    P = prds()
    hoy = datetime.date.today()
    fecha = f'{hoy.day} de {MES[hoy.month - 1]} de {hoy.year}'
    files = [(f, nlines(os.path.join(FARO, f))) for f in CODE_FILES if os.path.exists(os.path.join(FARO, f))]
    game_lines = sum(n for f, n in files if f.startswith('src/'))
    total_lines = sum(n for f, n in files)
    models = sorted(glob.glob(os.path.join(FARO, 'assets', 'models', '*.glb')))
    tests = sorted(glob.glob(os.path.join(FARO, 'tests', '*')))
    test_lines = sum(nlines(t) for t in tests if t.endswith(('.cjs', '.py', '.md')))
    ok_total = sum(p['ok'] for p in P)
    parts = []

    # ---------- portada ----------
    parts.append(f'''<section class="first">
  <div class="eyebrow">Faro de Ámbar · Documento completo del proyecto</div>
  <h1>Faro de Ámbar</h1>
  <p class="sub">Todo el juego, de la v0.1 a la v{esc(cat['V'])}</p>
  <p class="meta">{fecha} · Versión actual del prototipo web: <b>{esc(cat['V'])}</b> · Se vuelve a generar en cada versión</p>
  <div class="tiles">
    <div class="tile"><b>{len(P) + 2} versiones</b><span>v0.1 y v0.2 (antes de los PRD) y {len(P)} con su PRD, de la v{P[0]['v']} a la v{P[-1]['v']}.</span></div>
    <div class="tile"><b>{game_lines:,} líneas de juego</b><span>{total_lines:,} líneas con herramientas y documentos; {len(models)} modelos 3D hechos con Blender.</span></div>
    <div class="tile"><b>{ok_total} pruebas aprobadas</b><span>Sumando los PRD; además {len(tests)} archivos de prueba en <code>faro/tests/</code>.</span></div>
  </div>
  <h3>Qué hay en este documento</h3>
  <ol>
    <li>Qué es Faro de Ámbar y cómo se juega</li>
    <li>Línea de tiempo de todas las versiones</li>
    <li>Registro de mejoras (se amplía en cada versión)</li>
    <li>Novedades detalladas de cada versión</li>
    <li>Catálogo actual: tropas, edificios, modos y mapas</li>
    <li>Cómo está hecho: archivos, recursos y forma de construirlo</li>
    <li>Cómo se prueba</li>
    <li>Plan para Roblox (PRD v1.6 del usuario)</li>
    <li>Anexo: el código completo, archivo por archivo</li>
  </ol>
  <div class="note">Regla del proyecto: cada versión nueva agrega sus mejoras al registro (sección 3) y vuelve a generar este documento. Los PRD y PDF de cada versión siguen siendo documentos aparte, en <code>faro/docs/prd/</code>.</div>
</section>''')

    # ---------- 1. qué es ----------
    readme = open(os.path.join(FARO, 'README.md'), encoding='utf-8').read()
    intro = readme.split('## Novedades de la')[0]
    intro = re.sub(r'^# .*\n', '', intro)
    parts.append(f'<section><div class="eyebrow">01 · El juego</div><h2>Qué es Faro de Ámbar y cómo se juega</h2>{md(intro)}</section>')

    # ---------- 2. línea de tiempo ----------
    rows = ['<tr><td>0.1</td><td>6 nov 2026</td><td>Primera versión jugable, entonces llamada «HEXBOX».</td><td>—</td></tr>',
            '<tr><td>0.2</td><td>7 nov 2026</td><td>Transporte, Pozo petrolero, Batería antiaérea y Lanzamisiles.</td><td>—</td></tr>']
    for p in P:
        res = f"{p['ok']} aprobadas" + (f", {p['fail']} fallidas" if p['fail'] else '') + (f", {p['pend']} pendientes" if p['pend'] else '')
        rows.append(f"<tr><td>{p['v']}</td><td>{esc(p['fecha'])}</td><td>{esc(' · '.join(p['tiles'])) or esc(p['estado'])}</td><td>{res}</td></tr>")
    parts.append(f'''<section><div class="eyebrow">02 · Historia</div><h2>Línea de tiempo de todas las versiones</h2>
  <p>Cada versión desde la 0.3 empezó con un PRD (el plan) y terminó con su PDF con los resultados reales de las pruebas.</p>
  <table><thead><tr><th style="width:8%">Versión</th><th style="width:16%">Fecha</th><th>Qué trajo</th><th style="width:22%">Pruebas del PRD</th></tr></thead><tbody>{''.join(rows)}</tbody></table></section>''')

    # ---------- 3. registro ----------
    reg = open(os.path.join(HERE, 'registro.md'), encoding='utf-8').read()
    reg = re.sub(r'^# .*\n', '', reg)
    parts.append(f'<section><div class="eyebrow">03 · Registro</div><h2>Registro de mejoras</h2>{md(reg)}</section>')

    # ---------- 4. novedades detalladas ----------
    nov = '## Novedades de la' + readme.split('## Novedades de la', 1)[1]
    nov = nov.split('## Editar el juego')[0]
    nov = nov.replace('## ', '### ')
    parts.append(f'<section><div class="eyebrow">04 · Detalle</div><h2>Novedades detalladas de cada versión</h2>{md(nov)}</section>')

    # ---------- 5. catálogo ----------
    U = cat['U']
    B = cat['B']
    prod_of = {}
    for bk, b in B.items():
        for t in b.get('produces', []) or []:
            prod_of.setdefault(t, []).append(b.get('name', bk))
    cls_name = {'inf': 'Infantería', 'veh': 'Vehículo', 'ship': 'Barco', 'sub': 'Submarino', 'air': 'Aéreo'}
    urows = []
    for k, u in U.items():
        w = u.get('weapon') or {}
        dps = f"{w['dmg'] / w['cd']:.0f}" if w.get('dmg') and w.get('cd') else '—'
        urows.append(f"<tr><td>{esc(u.get('name', k))}</td><td>{cls_name.get(u.get('cls'), u.get('cls', ''))}</td><td>{u.get('cost', '')}</td><td>{u.get('hp', '')}</td><td>{dps}</td><td>{w.get('range', '—')}</td><td>{u.get('speed', '')}</td><td>{u.get('pop', '')}</td><td>{esc(', '.join(prod_of.get(k, [])))}</td></tr>")
    brows = []
    for k, b in B.items():
        brows.append(f"<tr><td>{esc(b.get('name', k))}</td><td>{b.get('cost', '')}</td><td>{b.get('hp', '')}</td><td>{b.get('build', '')}</td><td>{b.get('maxLevel', '')}</td><td>{esc(b.get('desc', ''))}</td></tr>")
    mrows = ''.join(f"<tr><td>{esc(m.get('name', k))}</td><td>{m.get('players', '')}</td><td>{esc(m.get('desc', ''))}</td></tr>" for k, m in cat['M'].items())
    prow = ''.join(f"<tr><td>{esc(m.get('name', k))}</td><td>{esc(m.get('desc', '') or '')}</td></tr>" for k, m in cat['P'].items())
    parts.append(f'''<section><div class="eyebrow">05 · Catálogo</div><h2>Catálogo actual (v{esc(cat['V'])})</h2>
  <p>Sacado directamente de <code>src/js/00-config.js</code>, así que siempre coincide con el juego. Daño/s = daño por disparo ÷ tiempo entre disparos (sin bonificaciones contra cada tipo).</p>
  <h3>Tropas ({len(U)})</h3>
  <table><thead><tr><th>Tropa</th><th>Tipo</th><th>Coste</th><th>Vida</th><th>Daño/s</th><th>Alcance</th><th>Velocidad</th><th>Comunidad</th><th>Se entrena en</th></tr></thead><tbody>{''.join(urows)}</tbody></table>
  <h3>Edificios ({len(B)})</h3>
  <table><thead><tr><th>Edificio</th><th>Coste</th><th>Vida</th><th>Obra (s)</th><th>Nivel máx.</th><th>Qué hace</th></tr></thead><tbody>{''.join(brows)}</tbody></table>
  <h3>Modos ({len(cat['M'])})</h3>
  <table><thead><tr><th>Modo</th><th>Jugadores</th><th>Reglas</th></tr></thead><tbody>{mrows}</tbody></table>
  <h3>Mapas ({len(cat['P'])})</h3>
  <table><thead><tr><th>Mapa</th><th>Cómo es</th></tr></thead><tbody>{prow}</tbody></table></section>''')

    # ---------- 6. cómo está hecho ----------
    frows = ''.join(f"<tr><td><code>faro/{esc(f)}</code></td><td>{n:,}</td><td>{esc(DESC.get(f) or first_comment(os.path.join(FARO, f)))}</td></tr>" for f, n in files)
    msize = sum(os.path.getsize(m) for m in models)
    mlist = ', '.join(os.path.basename(m)[:-4] for m in models)
    built = os.path.join(FARO, 'faro.html')
    bsize = os.path.getsize(built) / 1048576 if os.path.exists(built) else 0
    parts.append(f'''<section><div class="eyebrow">06 · Cómo está hecho</div><h2>Archivos, recursos y forma de construirlo</h2>
  <p>El juego es una sola página web (<code>faro/faro.html</code>, {bsize:.2f} MB) que <code>build.mjs</code> arma uniendo el código de <code>src/</code>, los modelos 3D, la animación de caminar y el cielo. Usa three.js r128 para el 3D. Funciona en Safari y Chrome, también en el iPad, sin instalar nada.</p>
  <h3>Archivos de código ({len(files)})</h3>
  <table><thead><tr><th style="width:36%">Archivo</th><th style="width:10%">Líneas</th><th>Qué contiene</th></tr></thead><tbody>{frows}</tbody></table>
  <h3>Recursos</h3>
  <ul>
    <li><b>{len(models)} modelos 3D</b> (GLB, {msize / 1024:.0f} KB) generados con Blender por los scripts de <code>faro/blender/</code>: {esc(mlist)}.</li>
    <li><b>Animación de caminar y correr</b> (<code>assets/anim/cmu_gait.json</code>) sacada de la base de captura de movimiento de CMU.</li>
    <li><b>Cielo de ambiente</b> (<code>assets/env/sky_env.jpg</code>) de Poly Haven, licencia CC0.</li>
  </ul>
  <h3>Cómo se construye</h3>
  <pre><code>node faro/build.mjs                                        # genera faro/faro.html
python3 faro/blender/generate_models.py faro/assets/models  # modelos 3D (módulo bpy de Blender)
node faro/docs/pdf.cjs faro/docs/prd/PRD_web_vX.Y.html      # PDF de un PRD
python3 faro/docs/documento/build_documento.py              # este documento (y luego pdf.cjs)</code></pre>
  </section>''')

    # ---------- 7. pruebas ----------
    trows = ''.join(f"<tr><td><code>{esc(os.path.basename(t))}</code></td><td>{nlines(t) if t.endswith(('.cjs', '.py', '.md')) else ''}</td><td>{esc(first_comment(t))}</td></tr>" for t in tests)
    parts.append(f'''<section><div class="eyebrow">07 · Pruebas</div><h2>Cómo se prueba</h2>
  <p>Cada versión se prueba con partidas simuladas (la lógica del juego corre en Node, sin gráficos) y en Chromium con tamaño de iPad y de celular, tocando la pantalla como lo haría una persona. Las pruebas de versiones anteriores se vuelven a correr en cada versión. Chromium dibuja sin tarjeta gráfica: sus cuadros por segundo solo sirven para comparar versiones, no para saber cómo va en un iPad.</p>
  <p>En los PRD hay <b>{ok_total} pruebas aprobadas</b> en total. Los {len(tests)} archivos de prueba ({test_lines:,} líneas) están en <code>faro/tests/</code>; por su tamaño, aquí se listan y su código queda en esa carpeta.</p>
  <table><thead><tr><th style="width:30%">Archivo</th><th style="width:9%">Líneas</th><th>Qué prueba</th></tr></thead><tbody>{trows}</tbody></table></section>''')

    # ---------- 8. Roblox ----------
    parts.append('''<section><div class="eyebrow">08 · Roblox</div><h2>Plan para Roblox (PRD v1.6 del usuario)</h2>
  <p>El usuario escribió el <b>PRD y plan de inicio v1.6</b> para llevar Faro de Ámbar a <b>Roblox Studio + Luau</b>. Está completo en <code>faro/docs/roblox/</code> (Markdown original y PDF con sus imágenes). El prototipo web sigue siendo el banco de pruebas de reglas y controles; el desarrollo en Roblox empieza cuando el usuario lo indique.</p>
  <table><thead><tr><th style="width:20%">Etapa</th><th style="width:34%">Herramientas</th><th>Para qué</th></tr></thead><tbody>
  <tr><td>1. Empezar</td><td>Roblox Studio + Luau + Rojo + Git</td><td>Base del juego, mecánicas, código organizado y versiones.</td></tr>
  <tr><td>2. Intermedio</td><td>Blender + Animation Editor + SurfaceAppearance</td><td>Personajes, vehículos, edificios, animaciones y materiales.</td></tr>
  <tr><td>3. Completar</td><td>Roblox Studio + Luau + DataStoreService</td><td>Menús, inventario, misiones, controles y guardado del progreso.</td></tr>
  <tr><td>4. Pulir</td><td>MicroProfiler + Developer Console + simuladores</td><td>Errores, rendimiento, multijugador y móvil.</td></tr>
  <tr><td>5. Publicar</td><td>Roblox Studio + Creator Hub + Analytics</td><td>Publicar, revisar y mejorar con los resultados.</td></tr>
  </tbody></table>
  <div class="note">Lo que el prototipo web ya probó (reglas, controles en iPad, bots, campaña, Barcaza, Cúpula, progreso) sirve de referencia para las pruebas CA-01 a CA-16 del plan de Roblox. Los modelos GLB de <code>faro/assets/models/</code> se pueden importar en Roblox Studio (3D Importer).</div>
  </section>''')

    # ---------- 9-11 (v1.8): tus documentos, tu catálogo y el revisor ----------
    parts.append(user_docs_html())

    # ---------- anexo: código ----------
    parts.append(f'''<section><div class="eyebrow">Anexo</div><h2>El código completo, archivo por archivo</h2>
  <p>{len(files)} archivos, {total_lines:,} líneas, en el orden en que se arma el juego: la página, la lógica y el dibujo (<code>src/js/</code>, que se ejecutan en orden de nombre), el armado, los modelos de Blender, las herramientas de documentos y las reglas del proyecto. El archivo final <code>faro.html</code> no se imprime porque es este mismo código unido a los modelos.</p>
  <ul>{''.join(f'<li><code>faro/{esc(f)}</code> · {n:,} líneas</li>' for f, n in files)}</ul></section>''')
    for f, n in files:
        text = open(os.path.join(FARO, f), encoding='utf-8').read().rstrip('\n').split('\n')
        width = len(str(len(text)))
        body = '\n'.join(f'<span class="ln">{i:>{width}}</span> {esc(line)}' for i, line in enumerate(text, 1))
        parts.append(f'<div class="codefile"><h3>faro/{esc(f)} <span class="small">· {n:,} líneas</span></h3><pre class="code">{body}</pre></div>')

    extra = '''<style>
  .codefile { page-break-before: always; }
  .codefile h3 { margin-top: 0; }
  pre.code { font-size: 6.4pt; line-height: 1.28; padding: 6px 8px; background: #fbfbfa; }
  pre.code .ln { color: #9aa6a3; user-select: none; }
  .figs { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; margin: 8px 0 12px; }
  .figs.f4 { grid-template-columns: repeat(4, 1fr); }
  .figs.f6 { grid-template-columns: repeat(6, 1fr); }
  .figs figure { margin: 0; page-break-inside: avoid; }
  .figs img { width: 100%; display: block; border-radius: 6px; border: 1px solid #d9dfdc; }
  .figs figcaption { font-size: 7.5pt; color: #5d6b70; margin-top: 2px; }
  table.cat { font-size: 7.5pt; }
  img.mini { width: 26px; height: 26px; object-fit: contain; vertical-align: middle; margin-right: 4px; border-radius: 4px; background: #22262a; }
  .tiles { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin: 8px 0; }
  .tile { background: #f1f3f1; border-radius: 8px; padding: 8px 10px; }
  .tile b { display: block; color: #1b6b63; font-size: 13pt; }
</style>'''
    title = f'Faro de Ámbar · Documento completo v{cat["V"]}'
    doc = head(title, f'{hoy.day} {MES3[hoy.month - 1]} {hoy.year}', 'Documento completo') + extra + '\n'.join(parts) + '\n</body>\n</html>\n'
    open(OUT, 'w', encoding='utf-8').write(doc)
    print(f'[Documento] ✅ {rel(OUT)} · {len(doc) // 1024} KB · {len(files)} archivos, {total_lines} líneas de código')


if __name__ == '__main__':
    main()
