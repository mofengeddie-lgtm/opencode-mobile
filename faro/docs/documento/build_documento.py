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
    ['docs/pdf.cjs', 'docs/doc_style.py', 'docs/roblox/build_prd_roblox.py', 'docs/documento/build_documento.py', 'README.md', 'AGENTS.md']
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
}


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
</style>'''
    title = f'Faro de Ámbar · Documento completo v{cat["V"]}'
    doc = head(title, f'{hoy.day} {MES3[hoy.month - 1]} {hoy.year}', 'Documento completo') + extra + '\n'.join(parts) + '\n</body>\n</html>\n'
    open(OUT, 'w', encoding='utf-8').write(doc)
    print(f'[Documento] ✅ {rel(OUT)} · {len(doc) // 1024} KB · {len(files)} archivos, {total_lines} líneas de código')


if __name__ == '__main__':
    main()
