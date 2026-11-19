"""Arma el sitio web de Faro de Ámbar (una sola página con todo adentro).

Uso:  python3 faro/site/build_site.py
Sale: faro/site/index.html (página completa, sirve en cualquier alojamiento) y
      faro/site/sitio_artifact.html (el mismo contenido sin <html>/<head>/<body>, para publicarlo como artifact).

Las capturas (img/) y las fichas (data.json) salen del juego real con capture.cjs; cada versión nueva se vuelven a
sacar y se vuelve a correr este archivo. El botón «Jugar» abre el juego publicado.
"""
import base64
import html
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
GAME_URL = 'https://claude.ai/artifact/TMa4WhFq9eou5QGKbu61UV'
D = json.load(open(os.path.join(HERE, 'data.json'), encoding='utf-8'))
E = html.escape


def img(name):
    data = open(os.path.join(HERE, 'img', name), 'rb').read()
    return 'data:image/jpeg;base64,' + base64.b64encode(data).decode()


units = [i for i in D['items'] if i['kind'] == 'unit']
blds = [i for i in D['items'] if i['kind'] == 'bld']
FAMS = [('all', 'Todos'), ('inf', 'Infantería'), ('land', 'Tierra'), ('drone', 'Drones'), ('heli', 'Helicópteros'), ('plane', 'Aviación'),
        ('sea', 'Mar'), ('bld', 'Edificios'), ('new', 'Nuevo en la 1.8')]


def fam_of(i):
    # v1.8: el juego separa el aire en drones, helicópteros y aviación; lo estratégico va con su familia.
    if i['fam'] == 'strat':
        return 'sea' if i.get('role') == 'Estratégico' and i['key'] == 'stratsub' else 'land'
    return 'heli' if i['fam'] == 'air' else i['fam']


cards = '\n'.join(
    f'<button type="button" class="unit" data-fam="{fam_of(i)}" data-new="{1 if i["isNew"] else 0}" data-name="{E(i["name"])}" data-role="{E(i["role"])}" data-desc="{E(i["desc"])}">'
    f'<img alt="" loading="lazy" width="112" height="112" src="{i["img"]}"><b>{E(i["name"])}</b><small>{E(i["role"])}</small>'
    f'{"<i class=newtag>Nuevo</i>" if i["isNew"] else ""}</button>' for i in D['items'])
chips = '\n'.join(f'<button type="button" class="chip{" on" if k == "all" else ""}" data-f="{k}" aria-pressed="{"true" if k == "all" else "false"}">{E(n)}</button>' for k, n in FAMS)
maps = '\n'.join(f'<figure class="map"><img alt="" loading="lazy" width="132" height="132" src="{m["img"]}"><figcaption><b>{E(m["name"])}</b></figcaption></figure>' for m in D['maps'])
modes = '\n'.join(f'<li><b>{E(m["name"])}</b><span>{E(m["desc"])}</span></li>' for m in D['modes'])
first = D['items'][next(k for k, i in enumerate(D['items']) if i['isNew'])]

LOG = [
    ('1.8', '18 nov 2026', 'Todo el catálogo del PRD 1.8: 57 tropas y 19 edificios nuevos con su modelo 3D, sistemas nuevos (anfibios, puentes, puertas, búnker, auras, minas, investigación, paracaídas), «Tu ejército» en la portada del juego, Campo de pruebas, Ajustes «A tu manera» y programa revisor.'),
    ('1.7', '15-17 nov 2026', 'Arsenal «Conoce tu ejército», Dron de ataque, Dron kamikaze, Lanzacohetes múltiple y Lancha misilera, Lanzador DF-17 con modelo nuevo, Lanzador nuclear móvil de un solo uso, selección con vida del grupo y orden actual, carga en 3 pasos y tamaño de la interfaz.'),
    ('1.6.1', '16 nov 2026', 'Luz nueva y mar vivo: reflejos que se mueven, espuma en las orillas y sombras que se ven. Áreas táctiles de 44 px.'),
    ('1.6', '13-15 nov 2026', 'Pantalla de carga real, motivos junto a cada acción, alcance al colocar defensas y ventana «Acerca de».'),
    ('1.5', '13 nov 2026', 'Portada nueva, Núcleo nuevo hecho con Blender, edificios con su color y fichas de tropas.'),
    ('1.4', '12 nov 2026', 'Patrullar, mantener posición, tropas veteranas, 12 logros y opciones para el iPad.'),
    ('1.0-1.3', '9-11 nov 2026', 'Alianzas, Dúos, Liga 3 vs 3, mapas nuevos, tutorial con señales y copia del progreso.'),
    ('0.1-0.9', '6-8 nov 2026', 'El juego base: islas de hexágonos, campaña de 6 misiones y el ejército de tierra, mar y aire.'),
]
log = '\n'.join(f'<li><span class="ver">v{E(v)}</span><time>{E(d)}</time><p>{E(t)}</p></li>' for v, d, t in LOG)

LOGO = ('<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M32 3 57 17.5v29L32 61 7 46.5v-29z" fill="#1a2834" stroke="#f2ab38" stroke-width="3"/>'
        '<path d="M26 50h12l-2-24h-8z" fill="#eef1f3"/><path d="M27.2 40h9.6l.5 5h-10.6zM28 31h8l.4 4h-8.8z" fill="#c0392b"/>'
        '<rect x="27" y="20" width="10" height="6" rx="1" fill="#f2ab38"/><path d="M25 20h14l-7-7z" fill="#c0392b"/></svg>')

CSS = """
/* Mesa de mando: página oscura como el juego; arriba la captura grande con el haz del faro que barre,
   después el ciclo de una partida (construir, proteger, conquistar), el ejército como en el Arsenal y la bitácora. */
:root {
  --night: #0c141b; --deck: #111c25; --raise: #1a2834; --raise-2: #233544;
  --line: rgba(205, 226, 240, 0.14); --foam: #edf3f7; --mist: #9aaebd;
  --amber: #f2ab38; --amber-ink: #2a1902; --sea: #7fd4ff; --good: #5ee07a;
  --display: 'Chakra Petch', 'Rajdhani', 'Segoe UI', system-ui, sans-serif;
  --body: 'Barlow', 'Segoe UI', system-ui, -apple-system, sans-serif;
  --r: 12px;
  color-scheme: dark;
}
* { box-sizing: border-box; }
html { scroll-behavior: smooth; scroll-padding-top: calc(env(safe-area-inset-top, 0px) + 72px); }
body { margin: 0; background: var(--night); color: var(--foam); font: 400 17px/1.55 var(--body); -webkit-font-smoothing: antialiased; }
body::before { content: ""; position: fixed; inset: 0 0 auto; height: env(safe-area-inset-top, 0px); z-index: 10; background: var(--night); }
.wrap { max-width: 1120px; margin-inline: auto; padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); }
a { color: var(--sea); }
:focus-visible { outline: 2px solid var(--amber); outline-offset: 3px; border-radius: 6px; }
h1, h2, h3 { font-family: var(--display); text-wrap: balance; margin: 0; }
h2 { font-size: clamp(28px, 4.4vw, 42px); line-height: 1.08; letter-spacing: 0.01em; }
h3 { font-size: 22px; letter-spacing: 0.02em; }
p { margin: 0; text-wrap: pretty; }
.eyebrow { font: 600 12.5px/1.2 var(--body); letter-spacing: 0.14em; text-transform: uppercase; color: var(--amber); }
.lead { color: var(--mist); max-width: 62ch; }
.btn { display: inline-flex; align-items: center; justify-content: center; gap: 10px; min-height: 48px; padding: 0 22px; border-radius: 10px; border: 1px solid var(--line); background: var(--raise); color: var(--foam); font: 600 16px var(--body); text-decoration: none; cursor: pointer; }
.btn:hover { background: var(--raise-2); }
.btn.gold { background: var(--amber); color: var(--amber-ink); border-color: transparent; font-family: var(--display); letter-spacing: 0.06em; text-transform: uppercase; }
.btn.gold:hover { filter: brightness(1.07); }
.btn.big { min-height: 60px; padding: 0 34px; font-size: 20px; }
.btn svg { width: 20px; height: 20px; flex: none; }

/* ---------- barra de arriba ---------- */
.top { position: sticky; top: env(safe-area-inset-top, 0px); z-index: 9; background: rgba(12, 20, 27, 0.9); -webkit-backdrop-filter: blur(10px); backdrop-filter: blur(10px); border-bottom: 1px solid var(--line); }
.top .wrap { display: flex; align-items: center; gap: 16px; min-height: 64px; }
.brand { display: flex; align-items: center; gap: 10px; font: 700 20px var(--display); color: var(--foam); text-decoration: none; white-space: nowrap; }
.brand svg { width: 36px; height: 36px; }
.brand span { color: var(--amber); }
.top nav { display: flex; gap: 4px; margin-inline: auto; }
.top nav a { display: inline-flex; align-items: center; min-height: 44px; padding: 0 12px; border-radius: 8px; color: var(--mist); text-decoration: none; font-weight: 600; font-size: 15px; }
.top nav a:hover { color: var(--foam); background: var(--raise); }
.top .btn { min-height: 44px; }
@media (max-width: 820px) { .top nav { display: none; } .top .btn { margin-left: auto; } }

/* ---------- portada ---------- */
.hero { position: relative; overflow: hidden; background: radial-gradient(ellipse at 78% 0%, #1d3a4c 0%, var(--night) 62%); }
.hero .wrap { position: relative; display: grid; grid-template-columns: minmax(0, 5fr) minmax(0, 7fr); gap: clamp(20px, 4vw, 48px); align-items: center; padding-block: clamp(28px, 6vw, 72px); }
.hero-copy { display: grid; gap: 18px; min-width: 0; justify-items: start; }
.hero h1 { font-size: clamp(46px, 8.2vw, 96px); line-height: 0.94; letter-spacing: 0.005em; }
.hero h1 span { color: var(--amber); display: block; }
.hero .lead { font-size: clamp(17px, 2vw, 20px); color: #d3e0e8; }
.cta { display: flex; gap: 10px; flex-wrap: wrap; }
.facts { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 8px; }
.facts li { display: flex; align-items: baseline; gap: 6px; padding: 7px 12px; border-radius: 8px; border: 1px solid var(--line); background: rgba(12, 21, 29, 0.6); font-size: 14px; color: var(--mist); }
.facts b { font: 600 17px var(--display); color: var(--foam); font-variant-numeric: tabular-nums; }
.screen { position: relative; margin: 0; border-radius: var(--r); overflow: hidden; border: 1px solid var(--line); box-shadow: 0 24px 60px rgba(0, 0, 0, 0.5); aspect-ratio: 16 / 9; max-width: 100%; background: #16405a; }
.screen img { display: block; width: 100%; height: 100%; object-fit: cover; }
/* El haz del faro: sale de la columna de luz de la captura y barre despacio. */
.beam { position: absolute; left: 50.5%; top: 2%; width: 150%; height: 150%; transform-origin: 0 0; pointer-events: none; mix-blend-mode: screen; opacity: 0.55;
  background: conic-gradient(from 0deg at 0 0, rgba(255, 221, 150, 0) 0deg, rgba(255, 221, 150, 0.5) 7deg, rgba(255, 221, 150, 0) 15deg, rgba(255, 221, 150, 0) 360deg);
  animation: sweep 9s ease-in-out infinite alternate; }
@keyframes sweep { from { transform: rotate(18deg); } to { transform: rotate(118deg); } }
@media (prefers-reduced-motion: reduce) { .beam { animation: none; transform: rotate(62deg); } html { scroll-behavior: auto; } }
.screen figcaption { position: absolute; left: 10px; bottom: 10px; padding: 5px 10px; border-radius: 7px; background: rgba(12, 20, 27, 0.82); font-size: 12.5px; color: var(--mist); }
@media (max-width: 900px) { .hero .wrap { grid-template-columns: minmax(0, 1fr); } }

/* ---------- secciones ---------- */
section { padding-block: clamp(40px, 7vw, 84px); }
section.alt { background: var(--deck); border-block: 1px solid var(--line); }
.head { display: grid; gap: 10px; margin-bottom: clamp(20px, 3vw, 32px); }
.loop { display: grid; gap: clamp(28px, 5vw, 56px); }
.step { display: grid; grid-template-columns: minmax(0, 5fr) minmax(0, 6fr); gap: clamp(16px, 4vw, 44px); align-items: center; }
.step:nth-child(even) .shot { order: -1; }
.step-copy { display: grid; gap: 10px; min-width: 0; }
.hexn { width: 48px; height: 54px; display: grid; place-items: center; background: var(--amber); color: var(--amber-ink); font: 700 22px var(--display); clip-path: polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%); }
.step-copy h3 { font-size: clamp(26px, 3.4vw, 34px); }
.step-copy p { color: var(--mist); max-width: 52ch; }
.shot { margin: 0; border-radius: var(--r); overflow: hidden; border: 1px solid var(--line); aspect-ratio: 16 / 9; max-width: 100%; background: #16405a; }
.shot img { display: block; width: 100%; height: 100%; object-fit: cover; }
@media (max-width: 820px) { .step { grid-template-columns: minmax(0, 1fr); } .step:nth-child(even) .shot { order: 0; } }

/* ---------- ejército ---------- */
.chips { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 14px; }
.chip { min-height: 44px; padding: 0 14px; border-radius: 9px; border: 1px solid var(--line); background: var(--raise); color: var(--mist); font: 600 14.5px var(--body); cursor: pointer; }
.chip.on { color: var(--amber); border-color: var(--amber); background: rgba(242, 171, 56, 0.1); }
.army { display: grid; grid-template-columns: minmax(0, 1fr) minmax(260px, 320px); gap: 14px; align-items: start; }
.units { display: grid; grid-template-columns: repeat(auto-fill, minmax(104px, 1fr)); gap: 8px; min-width: 0; }
/* v1.8: el filtro oculta tarjetas con [hidden]; sin esta regla, «display: grid» las dejaba a la vista. */
.unit[hidden] { display: none; }
.unit { position: relative; display: grid; justify-items: center; gap: 2px; padding: 8px 6px 10px; border-radius: 10px; border: 1px solid transparent; background: var(--raise); color: var(--foam); text-align: center; cursor: pointer; font: inherit; min-width: 0; }
.unit:hover { border-color: var(--line); }
.unit.on { border-color: var(--sea); box-shadow: 0 0 0 1px var(--sea); }
.unit img { width: 76px; height: 76px; }
.unit b { font-size: 13px; line-height: 1.2; overflow-wrap: anywhere; }
.unit small { font-size: 12px; color: var(--amber); }
.newtag { position: absolute; top: 6px; left: 6px; padding: 1px 6px; border-radius: 5px; background: var(--sea); color: #06222e; font: 700 10px var(--body); font-style: normal; letter-spacing: 0.05em; text-transform: uppercase; }
.sheet { position: sticky; top: calc(env(safe-area-inset-top, 0px) + 80px); display: grid; gap: 8px; padding: 16px; border-radius: var(--r); border: 1px solid var(--line); background: rgba(255, 255, 255, 0.03); }
.sheet img { width: 132px; height: 132px; justify-self: center; }
.sheet .eyebrow { color: var(--sea); }
.sheet p { color: var(--mist); font-size: 15.5px; }
.count { font: 500 15px var(--display); color: var(--mist); font-variant-numeric: tabular-nums; }
@media (max-width: 760px) { .army { grid-template-columns: minmax(0, 1fr); } .sheet { position: static; order: -1; grid-template-columns: 96px minmax(0, 1fr); align-items: center; column-gap: 14px; } .sheet img { width: 96px; height: 96px; grid-row: span 3; } }

/* ---------- mapas y modos ---------- */
.maps { display: grid; grid-template-columns: repeat(auto-fill, minmax(128px, 1fr)); gap: 10px; }
.map { margin: 0; display: grid; gap: 6px; padding: 8px; border-radius: 10px; border: 1px solid var(--line); background: var(--raise); text-align: center; }
.map img { width: 100%; height: auto; aspect-ratio: 1; border-radius: 8px; }
.map figcaption { font-size: 13.5px; line-height: 1.25; }
.modes { list-style: none; margin: 22px 0 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 0 28px; }
.modes li { display: grid; gap: 2px; padding: 12px 0; border-bottom: 1px solid var(--line); }
.modes b { font: 600 17px var(--display); }
.modes span { color: var(--mist); font-size: 15px; }

/* ---------- bitácora ---------- */
.log { list-style: none; margin: 0; padding: 0; display: grid; }
.log li { display: grid; grid-template-columns: 84px 130px minmax(0, 1fr); gap: 4px 16px; align-items: baseline; padding: 14px 0; border-bottom: 1px solid var(--line); }
.log .ver { font: 700 18px var(--display); color: var(--amber); font-variant-numeric: tabular-nums; }
.log time { color: var(--mist); font-size: 14.5px; font-variant-numeric: tabular-nums; }
.log p { color: var(--foam); font-size: 16px; }
.log li:first-child .ver::after { content: 'ahora'; margin-left: 8px; padding: 1px 6px; border-radius: 5px; background: var(--good); color: #06220f; font: 700 10px var(--body); letter-spacing: 0.05em; text-transform: uppercase; vertical-align: middle; }
@media (max-width: 640px) { .log li { grid-template-columns: auto minmax(0, 1fr); } .log p { grid-column: 1 / -1; } }

/* ---------- cómo se juega ---------- */
.how { display: grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); gap: 12px; }
.how article { display: grid; gap: 8px; align-content: start; padding: 18px; border-radius: var(--r); background: var(--raise); border: 1px solid var(--line); }
.how svg { width: 40px; height: 40px; color: var(--sea); }
.how h3 { font-size: 19px; }
.how p { color: var(--mist); font-size: 15.5px; }
.note { margin-top: 18px; color: var(--mist); font-size: 15px; }
.note b { color: var(--foam); }

/* ---------- cierre ---------- */
.end { text-align: center; background: radial-gradient(ellipse at 50% 100%, #1d3a4c 0%, var(--night) 70%); }
.end .wrap { display: grid; gap: 18px; justify-items: center; }
footer { border-top: 1px solid var(--line); padding-block: 22px calc(22px + env(safe-area-inset-bottom, 0px)); color: var(--mist); font-size: 14px; }
footer .wrap { display: flex; gap: 10px 24px; flex-wrap: wrap; justify-content: space-between; }
"""

PLAY = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4.5v15l13-7.5z"/></svg>'
n_u, n_b = len(units), len(blds)

BODY = f"""
<header class="top"><div class="wrap">
  <a class="brand" href="#inicio">{LOGO}<b>Faro de <span>Ámbar</span></b></a>
  <nav aria-label="Secciones"><a href="#juego">El juego</a><a href="#ejercito">Ejército</a><a href="#mapas">Mapas</a><a href="#novedades">Novedades</a><a href="#como">Cómo se juega</a></nav>
  <a class="btn gold" href="{GAME_URL}" target="_blank" rel="noopener">{PLAY}Jugar</a>
</div></header>

<main id="inicio">
<div class="hero"><div class="wrap">
  <div class="hero-copy">
    <span class="eyebrow">Estrategia en tiempo real · gratis en el navegador</span>
    <h1>Faro de <span>Ámbar</span></h1>
    <p class="lead">Construye tu isla, arma un ejército de tierra, mar y aire, y toma el Faro antes que los otros cinco imperios.</p>
    <div class="cta">
      <a class="btn gold big" href="{GAME_URL}" target="_blank" rel="noopener">{PLAY}Jugar ahora</a>
      <a class="btn big" href="#ejercito">Ver el ejército</a>
    </div>
    <ul class="facts" aria-label="El juego en números">
      <li><b>{n_u}</b> tropas</li><li><b>{n_b}</b> edificios</li><li><b>{len(D['maps'])}</b> mapas</li><li><b>6</b> imperios por partida</li><li>Versión <b>{E(D['version'])}</b></li>
    </ul>
  </div>
  <figure class="screen"><img alt="Una isla con su Núcleo, granjas, fábrica y helipuerto, rodeada de barcos, tanques y helicópteros" width="1440" height="810" src="{img('hero-base.jpg')}"><span class="beam" aria-hidden="true"></span><figcaption>Captura real del juego, versión {E(D['version'])}</figcaption></figure>
</div></div>

<section id="juego"><div class="wrap">
  <div class="head"><span class="eyebrow">El juego</span><h2>Construye. Protege. Conquista.</h2>
    <p class="lead">Cada partida empieza con un Núcleo y un Constructor en una isla de hexágonos. Lo demás lo decides tú.</p></div>
  <div class="loop">
    <div class="step"><div class="step-copy"><span class="hexn">1</span><h3>Construye</h3>
      <p>Granjas, minas y energía te dan monedas. Con ellas levantas el Cuartel, la Fábrica, el Puerto, el Helipuerto y el Aeropuerto. Cada edificio sube hasta nivel 3.</p></div>
      <figure class="shot"><img alt="La base con la barra de recursos arriba y el panel del grupo elegido abajo" loading="lazy" width="1040" height="585" src="{img('interfaz.jpg')}"></figure></div>
    <div class="step"><div class="step-copy"><span class="hexn">2</span><h3>Protege</h3>
      <p>Torretas, AIR DEFENSE, muros y el Escudo antimisiles cuidan tu Núcleo. Si el Núcleo cae, quedas fuera: defiéndelo cuando lleguen los tanques rivales.</p></div>
      <figure class="shot"><img alt="Tanques y soldados enemigos atacan la base mientras las torretas y los helicópteros responden" loading="lazy" width="1040" height="585" src="{img('batalla-1.jpg')}"></figure></div>
    <div class="step"><div class="step-copy"><span class="hexn">3</span><h3>Conquista</h3>
      <p>Cruza el mar con Barcazas y escolta de Destructores. Captura Banderas, toma el Faro del centro y destruye los Núcleos de los demás imperios.</p></div>
      <figure class="shot"><img alt="La flota junto al Puerto: portaaviones, destructor, fragata, lancha misilera y una barcaza" loading="lazy" width="1040" height="585" src="{img('flota.jpg')}"></figure></div>
  </div>
</div></section>

<section id="ejercito" class="alt"><div class="wrap">
  <div class="head"><span class="eyebrow">Ejército</span><h2>Conoce tu ejército</h2>
    <p class="lead">Todo lo que existe hoy en el juego, con su modelo real. Toca una tarjeta para leer para qué sirve.</p>
    <span class="count" id="count">{n_u} tropas · {n_b} edificios</span></div>
  <div class="chips" role="group" aria-label="Filtrar el ejército">{chips}</div>
  <div class="army">
    <div class="units" id="units">{cards}</div>
    <aside class="sheet" id="sheet" aria-live="polite">
      <img alt="" id="s-img" width="132" height="132" src="{first['img']}">
      <span class="eyebrow" id="s-role">Nuevo · {E(first['role'])}</span>
      <h3 id="s-name">{E(first['name'])}</h3>
      <p id="s-desc">{E(first['desc'])}</p>
    </aside>
  </div>
</div></section>

<section id="mapas"><div class="wrap">
  <div class="head"><span class="eyebrow">Mapas y modos</span><h2>Siete mapas, siete maneras de jugar</h2>
    <p class="lead">Cada mapa se arma distinto en cada partida. También hay Campaña de 6 misiones, Tutorial, Desafío semanal y partidas personalizadas.</p></div>
  <div class="maps">{maps}</div>
  <ul class="modes">{modes}</ul>
</div></section>

<section id="novedades" class="alt"><div class="wrap">
  <div class="head"><span class="eyebrow">Novedades</span><h2>Bitácora de versiones</h2>
    <p class="lead">El juego empezó el 6 de noviembre de 2026 y cambia casi todos los días.</p></div>
  <ol class="log" reversed>{log}</ol>
</div></section>

<section id="como"><div class="wrap">
  <div class="head"><span class="eyebrow">Cómo se juega</span><h2>Pensado para el iPad</h2>
    <p class="lead">También se juega con ratón y teclado en la computadora, y en el celular.</p></div>
  <div class="how">
    <article><svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M24 6v36M6 24h36M24 6l-5 5M24 6l5 5M24 42l-5-5M24 42l5-5M6 24l5-5M6 24l5 5M42 24l-5-5M42 24l-5 5"/></svg>
      <h3>Mueve el mapa</h3><p>Arrastra con un dedo. Con dos dedos acercas, alejas y giras la vista.</p></article>
    <article><svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="18" cy="18" r="9"/><path d="M26 26l14 14M34 40h6v-6"/></svg>
      <h3>Elige y ordena</h3><p>Toca una tropa y después un destino o un enemigo. Con doble toque eliges todas las del mismo tipo.</p></article>
    <article><svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M24 5l16 9.5v19L24 43 8 33.5v-19z"/><path d="M24 17v14M17 24h14"/></svg>
      <h3>Construye</h3><p>Elige un edificio, toca una casilla dorada y confirma con «Construir». El Constructor libre más cercano va solo.</p></article>
    <article><svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 42V8M14 9h22l-6 8 6 8H14"/></svg>
      <h3>Gana</h3><p>Destruye todos los Núcleos rivales. En «Rey del Faro» gana quien mantenga el Faro 3 minutos.</p></article>
  </div>
  <p class="note">Se abre en <b>Chrome, Safari o Edge</b>, sin instalar nada. En el iPad se ve mejor en horizontal. Tu progreso se guarda en el navegador donde juegas.</p>
</div></section>

<section class="end"><div class="wrap">
  <h2>El Faro guía a tu ejército</h2>
  <p class="lead">Una partida contra bots dura entre 10 y 25 minutos.</p>
  <a class="btn gold big" href="{GAME_URL}" target="_blank" rel="noopener">{PLAY}Jugar ahora</a>
</div></section>
</main>

<footer><div class="wrap">
  <span>Faro de Ámbar · prototipo web, versión {E(D['version'])}</span>
  <span>Modelos hechos con Blender · cielo de Poly Haven (CC0) · movimiento de CMU Mocap · motor three.js</span>
</div></footer>

<script>
(function () {{
  var units = [].slice.call(document.querySelectorAll('#units .unit'));
  var chips = [].slice.call(document.querySelectorAll('.chip'));
  var total = '{n_u} tropas · {n_b} edificios';
  function pick(btn) {{
    units.forEach(function (u) {{ u.classList.toggle('on', u === btn); }});
    document.getElementById('s-img').src = btn.querySelector('img').src;
    document.getElementById('s-role').textContent = (btn.dataset.new === '1' ? 'Nuevo · ' : '') + btn.dataset.role;
    document.getElementById('s-name').textContent = btn.dataset.name;
    document.getElementById('s-desc').textContent = btn.dataset.desc;
  }}
  units.forEach(function (u) {{ u.addEventListener('click', function () {{ pick(u); }}); }});
  chips.forEach(function (c) {{
    c.addEventListener('click', function () {{
      var f = c.dataset.f, n = 0;
      chips.forEach(function (x) {{ x.classList.toggle('on', x === c); x.setAttribute('aria-pressed', String(x === c)); }});
      units.forEach(function (u) {{
        var show = f === 'all' || (f === 'new' ? u.dataset.new === '1' : u.dataset.fam === f);
        u.hidden = !show;
        if (show) n++;
      }});
      document.getElementById('count').textContent = f === 'all' ? total : n + ' en este filtro';
      var first = units.filter(function (u) {{ return !u.hidden; }})[0];
      if (first) pick(first);
    }});
  }});
  var start = units.filter(function (u) {{ return u.dataset.new === '1'; }})[0] || units[0];
  if (start) start.classList.add('on');
}})();
</script>
"""

HEAD = ('<title>Sitio de Faro de Ámbar</title>\n<meta name="claude:viewport-fit-sides" content="cover">\n'
        '<link rel="preconnect" href="https://fonts.googleapis.com">\n<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n'
        '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600&family=Chakra+Petch:wght@500;600;700&display=swap">\n'
        f'<style>{CSS}</style>\n')
open(os.path.join(HERE, 'sitio_artifact.html'), 'w', encoding='utf-8').write(HEAD + BODY)
full = ('<!doctype html>\n<html lang="es">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
        '<meta name="description" content="Faro de Ámbar: juego de estrategia en tiempo real sobre islas de hexágonos. Gratis en el navegador.">\n'
        + HEAD + '</head>\n<body>\n' + BODY + '</body>\n</html>\n')
open(os.path.join(HERE, 'index.html'), 'w', encoding='utf-8').write(full)
print(f'[Sitio] ✅ index.html {len(full) // 1024} KB · {n_u} tropas · {n_b} edificios · {len(D["maps"])} mapas')
