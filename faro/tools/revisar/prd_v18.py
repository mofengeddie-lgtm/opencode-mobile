"""Arma el PRD web v1.8 (plan) a partir de plan_v18.py y del último informe del revisor.

Uso: python3 prd_v18.py   →  faro/docs/prd/PRD_web_v1.8.html  (después: node faro/docs/pdf.cjs …)
Las pruebas salen «Pendiente»; al terminar las rellena tests/fill-prd18.py con los resultados reales.
"""
import html
import json
import os
import sys

import plan_v18 as PLAN

HERE = os.path.dirname(os.path.abspath(__file__))
FARO = os.path.normpath(os.path.join(HERE, '..', '..'))
OUT = os.path.join(FARO, 'docs', 'prd', 'PRD_web_v1.8.html')
REPORT = os.path.join(HERE, 'salida', 'informe.json')
E = lambda s: html.escape(str(s))
PROD = {'barracks': 'Cuartel', 'factory': 'Fábrica', 'harbor': 'Puerto', 'helipad': 'Helipuerto', 'airport': 'Aeropuerto militar',
        'dronecenter': 'Centro de drones', 'shipyard': 'Astillero mayor'}
FAMS = [('inf', 'Infantería y personal'), ('land', 'Tierra: blindados, artillería y apoyo'), ('drone', 'Drones'), ('heli', 'Helicópteros'),
        ('air', 'Aviación de ala fija'), ('sea', 'Flota naval y drones de mar'), ('strat', 'Estratégico')]

TESTS = [
    ('O01', 'Revisor: tu catálogo completo', '«python3 faro/tools/revisar/revisar.py --estricto» da 110 de 110 «En el juego»: cada tropa y edificio existe, con su modelo 3D, tu nombre (o uno que empieza igual) y el productor que pusiste.'),
    ('O02', 'Revisor: equipamiento militar', 'Los 57 sistemas de tu lista quedan en el juego (como tropa, edificio o arma) salvo los 2 «fuera» con motivo escrito (mina Claymore y satélites).'),
    ('O03', 'Revisor: UI 0.4', 'Las 19 revisiones de tus 14 pantallas dan «En el juego».'),
    ('O04', 'Cada tropa nueva se produce', 'En Campo de pruebas, las 57 tropas nuevas se encargan en su productor, salen al mapa y obedecen una orden de mover (prueba automática, una por una).'),
    ('O05', 'Cada edificio nuevo se construye', 'Los 18 edificios nuevos se colocan en su lugar (tierra, costa o agua poco profunda), se terminan y hacen lo suyo (prueba automática).'),
    ('O06', 'Anfibios', 'Infante de marina, Transporte anfibio y Aerodeslizador cruzan el agua poco profunda; los barcos normales siguen sin pisar tierra y los soldados normales sin pisar agua.'),
    ('O07', 'Puente y puerta', 'El Vehículo lanzapuentes tiende un Puente y la infantería cruza a la otra isla; la Puerta reforzada deja pasar a tus tropas y frena a las enemigas.'),
    ('O08', 'Auras', 'Oficial o Vehículo de mando: +15 % de daño (no se suman entre ellos); suministros: recarga un 20 % más rápida; combustible: +20 % de velocidad; interferencia: defensas enemigas un 40 % más lentas. Medido en la simulación.'),
    ('O09', 'Detección y minas', 'Un submarino enemigo oculto solo se ve con un detector cerca; una mina se ve con el Dragaminas y explota (500 de daño) cuando pasa un barco enemigo.'),
    ('O10', 'Transporte aéreo y paracaídas', 'El Helicóptero de transporte (8) y el Avión de transporte (10) suben soldados y los bajan en cualquier tierra; el Paracaidista cae en el punto de reunión si tienes Aeropuerto.'),
    ('O11', 'Búnker', 'Hasta 4 soldados entran al Búnker; cada uno suma un 25 % de daño; salen vivos si el Búnker cae.'),
    ('O12', 'Centro de investigación', 'Las 3 investigaciones cuestan 2500, tardan y cambian los números prometidos (vida de vehículos, daño de infantería, velocidad de aeronaves).'),
    ('O13', 'Arsenal estratégico ampliado', 'Lanzador nuclear móvil, Submarino estratégico y Complejo estratégico comparten un solo uso; sin el modificador no aparecen ni los usan los bots.'),
    ('O14', 'Portada: «Tu ejército» en el vestíbulo', 'Al abrir el juego, detrás del vestíbulo se ve tu base con tropas, vehículos, barcos y aeronaves en 3D (como tu pantalla 02 y el sitio); se detiene al entrar a la partida. Capturas en iPad horizontal, vertical y celular.'),
    ('O15', 'Campo de pruebas', 'Modo nuevo: empiezas con todos los productores, mucho dinero y energía, sin enemigos que ataquen; todas las tropas y edificios se pueden encargar.'),
    ('O16', 'Ajustes «A tu manera» y Misiones', 'Ajustes con 5 secciones (Interfaz, Sonido, Cámara, Accesibilidad, Controles) y «Restablecer»; pestaña «Misiones» en el vestíbulo. Se guardan y se recuperan.'),
    ('O17', 'Bots con tropas nuevas', 'En Normal y Difícil los bots usan algunas tropas nuevas; 30 partidas largas sin errores, sin bloqueos y sin tropas atascadas.'),
    ('O18', 'Sin regresiones', 'Las pruebas de las versiones anteriores siguen pasando; la campaña y el balance de lo que ya existía quedan iguales (las tropas viejas no cambian sus números).'),
    ('O19', 'Tamaño y velocidad', 'faro.html pesa 6 MB o menos; carga y fluidez en partida no empeoran más de un 15 % frente a la v1.7 (Chromium; el iPad físico lo pruebas tú).'),
    ('O21', 'Zona de creadores con contraseña (agregado)', 'El botón «Creadores» del vestíbulo pide la contraseña que diste; la mala no entra, la buena abre la zona y el modo creador; se vuelve a pedir cada vez que se abre el juego; tras 5 intentos fallidos hay que esperar 60 s; la contraseña no aparece escrita en la página.'),
    ('O20', 'Documento, sitio y PDF', 'El documento completo suma tus documentos e imágenes, el catálogo con estado y el informe del revisor; el sitio se vuelve a armar con todas las tropas y se publica.'),
]


def unit_table(fam: str) -> str:
    rows = [u for u in PLAN.NEW_UNITS if u['fam'] == fam]
    if not rows:
        return ''
    out = ['<table class="cat"><thead><tr><th style="width:17%">Tropa</th><th style="width:11%">Sale de</th><th style="width:9%">Precio</th>'
           '<th style="width:12%">Vida · vel. · pobl.</th><th style="width:16%">Arma</th><th>Lo especial</th></tr></thead><tbody>']
    for u in rows:
        price = f'{u["cost"]:,}'.replace(',', '.') + (f' + {u["energy"]} ⚡' if u['energy'] else '')
        out.append(f'<tr><td><b>{E(u["name"])}</b><div class="small">{E(u["src"])}</div></td><td>{E(PROD[u["prod"]])}</td><td>{price}</td>'
                   f'<td>{u["hp"]} · {str(u["speed"]).replace(".", ",")} · {u["pop"]}</td><td class="small">{E(u["w"])}</td>'
                   f'<td>{E(u["special"])}<div class="small">Modelo: {E(u["model"])}</div></td></tr>')
    out.append('</tbody></table>')
    return '\n'.join(out)


def bld_table() -> str:
    out = ['<table class="cat"><thead><tr><th style="width:18%">Edificio</th><th style="width:10%">Pestaña</th><th style="width:9%">Precio</th>'
           '<th style="width:12%">Vida · tiempo · límite</th><th style="width:14%">Dónde</th><th>Lo que hace</th></tr></thead><tbody>']
    for b in PLAN.NEW_BLD:
        price = f'{b["cost"]:,}'.replace(',', '.') + (f' + {b["energy"]} ⚡' if b['energy'] else '')
        out.append(f'<tr><td><b>{E(b["name"])}</b><div class="small">{E(b["src"])}</div></td><td>{E(b["tab"])}</td><td>{price}</td>'
                   f'<td>{b["hp"]} · {b["build"]} s · {b["limit"]}</td><td>{E(b["on"])}</td>'
                   f'<td>{E(b["special"])}<div class="small">Modelo: {E(b["model"])}</div></td></tr>')
    out.append('</tbody></table>')
    return '\n'.join(out)


def equip_table() -> str:
    out = ['<table class="cat"><thead><tr><th style="width:9%">Grupo</th><th style="width:34%">Sistema de tu lista</th><th style="width:14%">Fuente</th><th>En el juego</th></tr></thead><tbody>']
    names = {u['key']: u['name'] for u in PLAN.NEW_UNITS}
    names.update({b['key']: b['name'] for b in PLAN.NEW_BLD})
    names.update({v: k for k, v in PLAN.USER_MAP.items() if v not in names})
    names.update({'fighter': 'Avión de combate furtivo', 'bomber': 'Bombardero furtivo', 'launcher': 'Lanzador DF-17', 'antinuke': 'Escudo antimisiles',
                  'missileboat': 'Lancha misilera', 'fpv': 'Dron kamikaze', 'drone': 'Dron de ataque', 'mlrs': 'Lanzacohetes múltiple'})
    for grp, name, kind, key, src in PLAN.EQUIP:
        where = E(key) if kind == 'fuera' else (('Arma de: ' if kind == 'arma' else '') + E(names.get(key, key)))
        tag = '<span class="chip pend">Fuera</span> ' if kind == 'fuera' else ''
        source = src.replace('texto:', 'texto «') + ('»' if src.startswith('texto:') else '')
        out.append(f'<tr><td>{E(grp)}</td><td>{E(name)}</td><td class="small">{E(source)}</td><td>{tag}{where}</td></tr>')
    out.append('</tbody></table>')
    return '\n'.join(out)


# Resultado del revisor sobre el juego publicado antes de esta versión (v1.7, 18 nov 2026).
BEFORE = {'catalog': (38, 110), 'units': (24, 78), 'bld': (14, 32), 'equip': (25, 57), 'ui': (13, 19)}
FINAL = None  # resultados de las pruebas (id → {status, evidence}) cuando se arma el PRD final
CHIP = {'ok': ('ok', 'Aprobada'), 'fail': ('fail', 'Fallida'), 'np': ('np', 'No probada'), 'pend': ('pend', 'Pendiente')}


def report_block() -> str:
    if not os.path.exists(REPORT):
        return '<p class="note">Todavía no hay informe del revisor.</p>'
    r = json.load(open(REPORT))
    s = r['summary']
    miss = {}
    for i in r['catalog']:
        if i['state'] == 'falta':
            miss.setdefault(i['group'], []).append(i['name'])
    warn = [f'{i["name"]}: {", ".join(i["problems"])}' for i in r['catalog'] if i['state'] == 'aviso']
    tiles = [('Tu catálogo', s['catalog_ok'], s['catalog_total']), ('Tropas', s['units_ok'], s['units_total']), ('Edificios', s['bld_ok'], s['bld_total']),
             ('Equipamiento', s['equip_ok'], s['equip_total']), ('Pantallas UI 0.4', s['ui_ok'], s['ui_total'])]
    out = []
    if FINAL is not None:
        names = [('Tu catálogo', 'catalog'), ('Tropas', 'units'), ('Edificios', 'bld'), ('Equipamiento', 'equip'), ('Pantallas UI 0.4', 'ui')]
        out.append('<h3>Antes · juego v1.7</h3><div class="tiles t5">' + ''.join(f'<div class="tile"><b>{BEFORE[k][0]} de {BEFORE[k][1]}</b><span>{E(t)}</span></div>' for t, k in names) + '</div>')
        out.append(f'<h3>Después · juego v{E(r["game"]["version"])}</h3>')
    out += ['<div class="tiles t5">'] + [f'<div class="tile"><b>{a} de {b}</b><span>{E(t)}</span></div>' for t, a, b in tiles] + ['</div>']
    out.append(f'<p class="small">Informe del {E(r["at"])} sobre el juego v{E(r["game"]["version"])} publicado ({r["game"]["units"]} tropas, '
               f'{r["game"]["buildings"]} edificios, {r["game"]["models"]} modelos 3D). «En el juego» = existe, con modelo, tu nombre y tu productor.</p>')
    out.append('<table><thead><tr><th style="width:30%">Grupo de tu catálogo</th><th>Lo que falta hoy</th></tr></thead><tbody>')
    for g, names in miss.items():
        out.append(f'<tr><td><b>{E(g)}</b> · {len(names)}</td><td>{E(", ".join(names))}</td></tr>')
    out.append('</tbody></table>')
    if warn:
        out.append('<p><b>Con aviso</b> (existen, pero algo no coincide con tu catálogo): ' + E('; '.join(warn)) + '.</p>')
    ui_miss = [f'{u["screen"]}: {u["what"]}' for u in r['ui'] if u['state'] != 'ok']
    if ui_miss:
        out.append('<p><b>UI 0.4 que falta:</b> ' + E('; '.join(ui_miss)) + '.</p>')
    return '\n'.join(out)


def test_rows() -> str:
    rows = []
    for c, t, d in TESTS:
        r = (FINAL or {}).get(c, {'status': 'pend', 'evidence': '—'})
        cls, label = CHIP[r['status']]
        rows.append(f'<tr><td>{c}</td><td><b>{E(t)}</b><br>{E(d)}</td><td><span class="chip {cls}">{label}</span></td><td class="small">{E(r["evidence"])}</td></tr>')
    return '\n'.join(rows)


def shots_html() -> str:
    img = os.path.join(FARO, 'docs', 'prd', 'img-v18')
    figs = [('vestibulo-ipad-horizontal.png', 'Vestíbulo v1.8 en iPad horizontal: tu base en vivo en la portada.'),
            ('vestibulo-ipad-vertical.png', 'iPad vertical.'), ('vestibulo-celular.png', 'Celular vertical.')]
    have = [(f, t) for f, t in figs if os.path.exists(os.path.join(img, f))]
    if FINAL is None or not have:
        return ''
    return '<div class="figs f3">' + ''.join(f'<figure><img src="img-v18/{f}" alt=""><figcaption>{E(t)}</figcaption></figure>' for f, t in have) + '</div>'


def main() -> None:
    global FINAL
    if '--final' in sys.argv:
        FINAL = json.load(open(sys.argv[sys.argv.index('--final') + 1], encoding='utf-8'))
    n_u, n_b = len(PLAN.NEW_UNITS), len(PLAN.NEW_BLD)
    tests = test_rows()
    estado = 'Plan · pendiente de programar' if FINAL is None else 'Terminada (pruebas abajo)'
    oks = sum(1 for r in (FINAL or {}).values() if r['status'] == 'ok')
    fam_sections = '\n'.join(f'<h3>{E(name)} · {sum(1 for u in PLAN.NEW_UNITS if u["fam"] == f)}</h3>{unit_table(f)}' for f, name in FAMS)
    renames = ', '.join(f'{E(k)} → «{E(v)}»' for k, v in PLAN.RENAMES.items())
    doc = f"""<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="fecha" content="18 NOV 2026">
<title>Faro de Ámbar · PRD prototipo web v1.8</title>
<style>
@page {{ size: A4; }}
:root {{ --ink: #17313a; --teal: #1b6b63; --amber: #d99a2b; --soft: #f1f3f1; --line: #d9dfdc; --muted: #5d6b70; }}
* {{ box-sizing: border-box; }}
body {{ margin: 0; font-family: 'DejaVu Sans', 'Helvetica Neue', Arial, sans-serif; color: var(--ink); font-size: 10.5pt; line-height: 1.5; }}
h1 {{ font-size: 30pt; margin: 0 0 4px; line-height: 1.1; }}
h2 {{ font-size: 19pt; margin: 0 0 10px; line-height: 1.2; page-break-after: avoid; }}
h3 {{ color: var(--teal); font-size: 12pt; margin: 16px 0 6px; page-break-after: avoid; }}
p {{ margin: 0 0 8px; }}
.eyebrow {{ font-size: 8.5pt; letter-spacing: 0.06em; color: var(--muted); text-transform: uppercase; margin-bottom: 2px; }}
.sub {{ color: var(--teal); font-size: 15pt; margin: 0 0 12px; }}
.meta {{ color: var(--muted); font-size: 9pt; margin-bottom: 16px; }}
.tiles {{ display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin: 0 0 18px; }}
.tiles.t5 {{ grid-template-columns: repeat(5, 1fr); gap: 6px; margin-bottom: 8px; }}
.tile {{ background: var(--soft); border-radius: 8px; padding: 10px 12px; }}
.tile b {{ display: block; color: var(--teal); font-size: 11pt; }}
.t5 .tile b {{ font-size: 12pt; white-space: nowrap; }}
.tile span {{ font-size: 9pt; }}
section {{ page-break-before: always; }}
section.first {{ page-break-before: auto; }}
table {{ width: 100%; border-collapse: collapse; margin: 6px 0 12px; font-size: 9pt; page-break-inside: auto; }}
table.cat {{ font-size: 8pt; }}
th {{ background: var(--teal); color: #fff; text-align: left; padding: 6px 8px; font-weight: 700; }}
td {{ padding: 5px 7px; border-bottom: 1px solid var(--line); vertical-align: top; }}
tr {{ page-break-inside: avoid; }}
tbody tr:nth-child(odd) td {{ background: var(--soft); }}
ul {{ margin: 0 0 8px; padding-left: 18px; }}
li {{ margin-bottom: 3px; }}
.chip {{ white-space: nowrap; display: inline-block; padding: 1px 7px; border-radius: 10px; font-size: 8pt; font-weight: 700; }}
.pend {{ background: #e3e7e5; color: #3d4a4f; }}
.ok {{ background: #d5f0dd; color: #165a2b; }}
.fail {{ background: #f8d6d6; color: #8a1f1f; }}
.np {{ background: #f6e6c4; color: #6b4a0b; }}
.note {{ border-left: 3px solid var(--amber); padding: 6px 10px; background: #fbf5e8; margin: 8px 0 12px; font-size: 9.5pt; }}
.small {{ font-size: 8pt; color: var(--muted); }}
.figs {{ display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin: 8px 0 12px; }}
.figs.f4 {{ grid-template-columns: repeat(4, 1fr); }}
.figs.f3 {{ grid-template-columns: 2fr 1fr 0.75fr; align-items: start; }}
.figs figure {{ margin: 0; }}
.figs img {{ width: 100%; display: block; border-radius: 6px; border: 1px solid var(--line); }}
.figs figcaption {{ font-size: 8.5pt; color: var(--muted); margin-top: 3px; }}
#pruebas td:first-child {{ white-space: nowrap; }}
</style>
</head>
<body>

<section class="first">
  <div class="eyebrow">Faro de Ámbar · Prototipo web</div>
  <h1>Faro de Ámbar</h1>
  <p class="sub">PRD del prototipo web · versión 1.8</p>
  <p class="meta">18 de noviembre de 2026 · Estado: <b id="estado">{estado}</b> · Fuente: tu pedido «falta mucho de la documentación y de las imágenes que te di: son todas las tropas nuevas; revísalas otra vez y agrega las que faltan; la imagen de la portada se ve en la web pero no en el juego, repárala; y sigue mejorando todo; antes, un PRD y un PDF completos, y un programa solo para revisar si el juego tiene los elementos de mis archivos, con los datos, la información y las imágenes».</p>
  <div class="tiles">
    <div class="tile"><b>Todas tus tropas</b><span>{n_u} tropas y {n_b} edificios nuevos, con modelo 3D de Blender cada uno: tu catálogo de 110 pasa a estar completo en el juego.</span></div>
    <div class="tile"><b>Tu ejército en la portada</b><span>La escena con la base y todo el ejército que ves en el sitio (y en tu pantalla 02) pasa a estar detrás del vestíbulo del juego. Más un modo «Campo de pruebas».</span></div>
    <div class="tile"><b>Programa revisor</b><span>Lee tus archivos y el juego, y dice qué está y qué falta, con tus imágenes al lado de las del juego. Informe en HTML, PDF y JSON.</span></div>
  </div>

  <h3>1. Lo que pasó y lo que pides</h3>
  <p>Revisé otra vez tus archivos: el catálogo de tu PRD 1.8 (secciones 37 a 54: 78 tropas y 32 edificios), tu PDF «Equipamiento militar 2» (texto y las 19 imágenes de sus 15 páginas), tu Dirección visual UI 0.4 (14 pantallas y 2 vehículos) y las imágenes de modelos de tu PDF v1.8 (31 modelos 0.2 y 2 escenas). Tienes razón: en la v1.7 solo entró un primer lote. El juego publicado tiene 36 tropas y 23 edificios, y la documentación no traía tus imágenes.</p>
  <p>«La imagen de la portada»: en el sitio se ve una escena armada con la base y todo el ejército; en el juego, el vestíbulo tiene un fondo plano. Tu pantalla 02 de la UI 0.4 pide justo eso: «Tu ejército» detrás del vestíbulo. Eso se arregla en esta versión.</p>
  <div class="figs">
    <figure><img src="../roblox/ui-0.4/ui04-03.jpg" alt="Tu pantalla 02 Vestíbulo"><figcaption>Tu pantalla 02 · Vestíbulo (UI 0.4): el ejército en 3D detrás del menú. Es la guía de la portada nueva.</figcaption></figure>
    <figure><img src="../roblox/modelos-0.2/escena-base.jpg" alt="Tu escena Base terrestre"><figcaption>Tu escena «Base terrestre» (PDF v1.8, página 13): base, tropas y vehículos juntos.</figcaption></figure>
  </div>
</section>

<section>
  <h2>2. {'Qué tenía el juego y qué tiene ahora' if FINAL is not None else 'Qué tiene hoy el juego'} (programa revisor)</h2>
  <p>{'Resultado real del programa revisor antes de esta versión (juego v1.7) y sobre el juego terminado. «En el juego» = existe, con modelo 3D, tu nombre y tu productor; cómo funciona cada uno en una partida lo dicen las pruebas de la sección 9.' if FINAL is not None else 'Este es el resultado real del programa revisor sobre el juego publicado (v1.7), antes de cambiar nada. Lo vuelvo a correr al final y el PRD final trae el nuevo resultado.'}</p>
  {report_block()}
  <h3>Cómo se revisa</h3>
  <ul>
    <li><b>Tus archivos</b>: lee las tablas de tu PRD 1.8 tal como están (nombre, función, forma y productor), tu lista de equipamiento (busca cada sistema en el texto; los de las capturas se anotan con su número de imagen) y las pantallas de la UI 0.4.</li>
    <li><b>El juego</b>: lee el archivo real faro.html (los datos de tropas y edificios, los 3D incrustados y los textos de la interfaz). Con «--fotos» lo abre en Chromium y saca la miniatura 3D de cada elemento.</li>
    <li><b>Estado</b>: «En el juego» (existe, con modelo, tu nombre o uno que empieza igual, y tu productor), «Con aviso» (existe pero algo no coincide, y dice qué), «Falta».</li>
  </ul>
</section>

<section>
  <h2>3. Tropas nuevas · {n_u}</h2>
  <p>Una tropa por cada fila de tu catálogo que falta, más las de tu lista de equipamiento que no tenían lugar (Equipo antitanque, Ametrallador pesado, Soldado antidrones, Perro robot, Lanzacohetes termobárico, Avión artillado y Submarino estratégico). Los números son una propuesta para probar: tú decides el balance. Precio en monedas y energía (⚡); velocidad en casillas por segundo.</p>
  {fam_sections}
</section>

<section>
  <h2>4. Edificios nuevos · {n_b}</h2>
  <p>Los 16 que faltan de tu catálogo, más dos de tu lista de equipamiento (Defensa de punto y Torre láser). Pestaña nueva «Apoyo» en Construir; el Astillero mayor y el Centro de drones van en «Producción».</p>
  {bld_table()}
  <h3>Cambios a lo que ya existe</h3>
  <ul>
    <li><b>Nombres de tu catálogo</b>: {renames}. «AIR DEFENSE» se queda (lo elegiste en la v0.9).</li>
    <li><b>Productores de tu catálogo</b>: el Dron de ataque y el Dron kamikaze salen también del Centro de drones; la Fragata y el Portaaviones también del Astillero mayor. Siguen saliendo de donde salían.</li>
    <li><b>Lo que ya existía no cambia sus números</b> (precio, vida, daño): así la campaña y las partidas de antes se juegan igual.</li>
  </ul>
</section>

<section>
  <h2>5. Tu lista «Equipamiento militar moderno»</h2>
  <p>Cada sistema de tu PDF y su lugar en el juego. 55 entran como tropa, edificio o arma; 2 quedan fuera con su motivo. Las fotos de prensa y las capturas de búsquedas de tu PDF no se copian al proyecto (son de otros sitios): el documento dice qué muestra cada página y qué tropa salió de ella.</p>
  {equip_table()}
</section>

<section>
  <h2>6. Sistemas nuevos del juego</h2>
  <p>Lo que hace falta programar para que cada tropa nueva haga lo suyo, no solo que exista.</p>
  <table><thead><tr><th style="width:24%">Sistema</th><th>Regla</th></tr></thead><tbody>
    <tr><td><b>Anfibio</b></td><td>Nuevo tipo de movimiento: tierra y agua poco profunda de la costa (Infante de marina, Transporte anfibio, Aerodeslizador). El agua profunda sigue siendo solo de barcos.</td></tr>
    <tr><td><b>Auras</b></td><td>Mando: +15 % de daño a las tropas propias cerca (Oficial 2 casillas, Vehículo de mando 3, Centro de mando 3 con +10 %, Crucero a barcos); no se suman, vale la mayor. Suministros: recarga un 20 % más rápida (Camión de suministros, Dron de carga, Depósito, Buque logístico). Combustible: +20 % de velocidad a vehículos (Camión cisterna). Interferencia: defensas enemigas un 40 % más lentas (Avión de apoyo electrónico).</td></tr>
    <tr><td><b>Curar y reparar</b></td><td>Ambulancia y Helicóptero de rescate curan infantería; Vehículo de recuperación y Taller reparan vehículos; Avión de reabastecimiento repara aeronaves; Buque logístico, Buque hospital y Muelle logístico reparan barcos.</td></tr>
    <tr><td><b>Detección</b></td><td>Submarinos, minas y el Dron submarino van ocultos: solo se ven (y se les puede disparar) con un detector cerca: Operador de comunicaciones, Radar móvil, Perro robot, Patrullera, Dron naval, Submarino de reconocimiento, Helicóptero naval, Avión de vigilancia, Estación de radar y Torre de observación.</td></tr>
    <tr><td><b>Minas navales</b></td><td>El Buque minador siembra hasta 8 minas ocultas; una mina explota con el primer barco enemigo a 1 casilla (500 de daño). El Dragaminas, el Zapador y el Vehículo de despeje las quitan.</td></tr>
    <tr><td><b>Transporte aéreo y paracaídas</b></td><td>Helicóptero de transporte (8 plazas) y Avión de transporte (10) suben soldados en su base o en tierra y los bajan en cualquier tierra. El Paracaidista sale del Cuartel; si tienes Aeropuerto militar cae en paracaídas en el punto de reunión que ves.</td></tr>
    <tr><td><b>Búnker</b></td><td>Edificio con guarnición: entran hasta 4 soldados; cada uno suma un 25 % al daño del Búnker; si el Búnker cae, salen con la vida que tenían.</td></tr>
    <tr><td><b>Puerta y puente</b></td><td>Puerta reforzada: muro que deja pasar a tus tropas y aliados. Puente modular: se pone en agua poco profunda junto a tierra; por ahí cruzan las tropas de tierra (de todos), los barcos ya no pasan por esa casilla; se puede destruir. El Vehículo lanzapuentes lo tiende sin Constructor.</td></tr>
    <tr><td><b>Centro de investigación</b></td><td>Tres investigaciones de 2500 monedas y 45 s cada una: Blindaje (+10 % de vida a vehículos), Puntería (+10 % de daño a infantería) y Motores (+15 % de velocidad a aeronaves).</td></tr>
    <tr><td><b>Arsenal estratégico ampliado</b></td><td>Con el modificador «Arsenal estratégico»: Lanzador nuclear móvil, Submarino estratégico y Complejo estratégico (silo DF-5C) comparten el mismo uso único por jugador (1/1 → 0/1), con la misma preparación, confirmación y aviso de la v1.7.</td></tr>
    <tr><td><b>Defensa de punto y antidrones</b></td><td>Corbeta, Crucero, Fragata de escolta y la Defensa de punto derriban misiles y cohetes que pasan cerca (con espera entre disparos). Soldado antidrones, Dron interceptor y Torre láser hacen más daño a drones.</td></tr>
    <tr><td><b>Constructores nuevos</b></td><td>Topadora blindada: construye y repara como un Ingeniero. Vehículo de despeje: rompe muros y obras.</td></tr>
    <tr><td><b>Bots</b></td><td>En Normal y Difícil, los bots usan algunas tropas nuevas según su forma de jugar (sin cambiar cuánto gastan).</td></tr>
  </tbody></table>
</section>

<section>
  <h2>7. Portada, vestíbulo y Campo de pruebas</h2>
  <h3>«Tu ejército» detrás del vestíbulo</h3>
  <ul>
    <li>Al abrir el juego, detrás del vestíbulo se arma una escena 3D con el mismo motor de la partida: tu Núcleo con edificios alrededor, soldados en fila, tanques, artillería, barcos en la costa y aeronaves volando. Cámara que gira despacio, como la imagen de tu pantalla 02 y del sitio.</li>
    <li>Cada vez que vuelves al vestíbulo cambian algunas tropas del desfile (muestra también las nuevas). Etiqueta «Tu ejército» arriba, como en tu maqueta.</li>
    <li>Con «Ahorro de batería» o «Más fluido» la escena es más chica y se mueve menos; al entrar a una partida se apaga para no gastar.</li>
  </ul>
  {shots_html()}
  <h3>Campo de pruebas</h3>
  <p>Modo nuevo en «Elige un modo»: un mapa tranquilo con todos los productores ya construidos, 500.000 monedas y energía de sobra; los bots no atacan. Sirve para mirar y probar cada tropa y edificio. No cuenta para rangos ni misiones.</p>
  <h3>Zona de creadores con contraseña (agregado durante la v1.8)</h3>
  <p>Pediste, mientras se hacía esta versión, una zona solo para los creadores que pida contraseña al entrar. En el menú del vestíbulo hay un botón «Creadores»: pide la contraseña que diste y, si es correcta, abre la zona con el modo creador (monedas y energía infinitas, construcción rápida). Se vuelve a pedir cada vez que se abre el juego; después de 5 intentos fallidos hay que esperar 60 s. El juego guarda solo una huella (SHA-256) de la contraseña, no la contraseña. En una página web esto frena a los jugadores, pero no a quien sepa leer el código; en Roblox la contraseña se comprobará en el servidor.</p>
  <h3>Ajustes «A tu manera» y Misiones (tu UI 0.4)</h3>
  <ul>
    <li>Ajustes con secciones como tu pantalla 13: Interfaz (tamaño, letra grande), Sonido (música, efectos), Cámara (giro, cámara al ataque), Accesibilidad (daltonismo, reducir destellos, ahorro de batería) y Controles (ayuda táctil). Botón «Restablecer». Se abre desde el vestíbulo y desde la pausa.</li>
    <li>Pestaña «Misiones» en el vestíbulo, como en tu pantalla 02 (las misiones ya existían dentro de otro botón).</li>
    <li>Arsenal con los filtros de tu PRD 1.8 (sección 56): Infantería, Tierra, Drones, Helicópteros, Aviación, Mar, Edificios y Estratégico.</li>
  </ul>
</section>

<section>
  <h2>8. Documentación y programa revisor</h2>
  <h3>Lo que se suma al documento completo</h3>
  <ul>
    <li><b>Tus documentos e imágenes</b>: los 31 modelos 0.2 y las 2 escenas de tu PDF v1.8, tus 14 pantallas UI 0.4 y tus 2 vehículos, la lista de equipamiento entera y, página por página, qué muestra cada imagen de tu PDF de equipamiento.</li>
    <li><b>Catálogo completo con estado</b>: las 110 entradas de tu catálogo con la clave del juego, el productor, el modelo y su estado, más las tropas extra.</li>
    <li><b>Informe del revisor</b>: el resultado final con tus imágenes y las miniaturas del juego.</li>
    <li>El registro de la v1.8 y el código nuevo (incluido el programa revisor).</li>
  </ul>
  <h3>Programa revisor (faro/tools/revisar)</h3>
  <table><thead><tr><th style="width:28%">Archivo</th><th>Para qué</th></tr></thead><tbody>
    <tr><td>revisar.py</td><td>El programa. «python3 revisar.py» revisa faro.html y escribe salida/informe.html, informe.pdf e informe.json. Opciones: --juego (otra versión), --fotos (miniaturas 3D del juego), --sin-pdf, --estricto (falla si falta algo).</td></tr>
    <tr><td>plan_v18.py</td><td>Tu nombre → clave del juego, el plan de cada tropa y edificio, tu lista de equipamiento y las revisiones de la UI 0.4.</td></tr>
    <tr><td>datos.cjs</td><td>Saca del archivo del juego los datos de tropas, edificios y modelos 3D.</td></tr>
    <tr><td>fotos.cjs</td><td>Abre el juego en Chromium y guarda la miniatura 3D de cada elemento.</td></tr>
    <tr><td>extraer_refs.py</td><td>Saca tus imágenes de modelos de tu PDF v1.8.</td></tr>
  </tbody></table>
  <h3>Modelos 3D</h3>
  <p>{n_u + n_b} modelos nuevos con Blender en el estilo de tus modelos 0.2: bloques, soldados verdes, vehículos verde militar, flota gris, color del equipo en paneles y banderas. Cada uno con sus partes que se mueven (torreta, rotor, hélices). El archivo del juego crece unos 2 MB.</p>
</section>

<section>
  <h2>9. Pruebas de aceptación{f' · {oks} de {len(TESTS)} aprobadas' if FINAL is not None else ''}</h2>
  <p>{'Resultado real de cada prueba, con su evidencia. Las pruebas en Chromium (sin tarjeta gráfica) no sustituyen una prueba en tu iPad: eso lo pruebas tú.' if FINAL is not None else 'Se llenan al terminar con el resultado real. Las pruebas en Chromium no sustituyen una prueba en tu iPad.'}</p>
  <table id="pruebas"><thead><tr><th style="width:7%">N.º</th><th>Prueba</th><th style="width:12%">Estado</th><th style="width:26%">Evidencia</th></tr></thead><tbody>
{tests}
  </tbody></table>
  <h3>Riesgos y decisiones abiertas</h3>
  <ul>
    <li><b>Balance</b>: los números de las {n_u + n_b} piezas nuevas son una propuesta; los ajusto con la simulación de bots, pero el balance final lo decides tú.</li>
    <li><b>Tamaño y velocidad</b>: con unas 75 piezas más, el archivo y la carga crecen. Si la prueba O19 falla, bajo el detalle de los modelos antes de publicar.</li>
    <li><b>Puente</b>: lo puede cruzar cualquiera (también el enemigo), como un puente real; se puede destruir.</li>
    <li><b>Fuera</b>: la mina Claymore (no hay minas en tierra) y los satélites (no hay espacio en el juego).</li>
    <li><b>Roblox</b>: esto sigue siendo el prototipo web. Empezar en Roblox Studio lo decides tú.</li>
  </ul>
</section>

</body>
</html>
"""
    with open(OUT, 'w', encoding='utf-8') as f:
        f.write(doc)
    print(f'[PRD] ✅ {OUT}')


if __name__ == '__main__':
    main()
