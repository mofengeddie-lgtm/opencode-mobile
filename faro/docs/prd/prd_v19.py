"""Arma el PRD web v1.9 (versión para Poki): plan con las pruebas «Pendiente».

Uso: python3 faro/docs/prd/prd_v19.py [--final tests/results-v19-final.json]
     node faro/docs/pdf.cjs faro/docs/prd/PRD_web_v1.9.html
Las pruebas salen «Pendiente»; al terminar las rellena tests/fill-prd19.py con los resultados reales.
Fuente de los requisitos de Poki: sus páginas para desarrolladores, leídas el 21 nov 2026
(developers.poki.com/guide: requirements-quality, sdk-html5, external-resources-policy, localization, game-thumbnail, inspector).
"""
import html
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
FARO = os.path.normpath(os.path.join(HERE, '..', '..'))
sys.path.insert(0, os.path.join(FARO, 'docs'))
import doc_style  # noqa: E402

OUT = os.path.join(HERE, 'PRD_web_v1.9.html')
E = lambda s: html.escape(str(s))
FECHA = '21 nov 2026'

# Requisitos de Poki → cómo está hoy el juego (v1.8) → qué hace la v1.9.
REQS = [
    ('Obligatorio', 'Escritorio, celular y tableta; en el celular, pantalla completa vertical u horizontal.',
     'Ya se juega en las 5 medidas que probamos (iPad, 16:9, celulares).', 'Se prueban también las medidas de Poki y la tableta.'),
    ('Obligatorio', 'Relación 16:9: el juego llena el cuadro y escala a 640×360, 836×470 o 1031×580.',
     'Nunca se probó en 640×360 (más bajo que un celular horizontal).', 'Ajustar el HUD para que quepa en 640×360 y probar las 3 medidas.'),
    ('Obligatorio', 'Modo incógnito: el localStorage puede fallar; envolverlo en try/catch y seguir jugable.',
     'Casi todo está envuelto, pero nunca se probó con el almacenamiento roto.', 'Revisar los 34 usos y probar el juego con el almacenamiento que falla; aviso de «no se guardará».'),
    ('Obligatorio', 'Sin pedidos externos: fuentes, recursos y librerías dentro del juego.',
     'Carga three.js y GLTFLoader de CDN y las fuentes de Google Fonts.', 'Meter three.js r128, GLTFLoader y las fuentes Barlow y Chakra Petch dentro del archivo.'),
    ('Obligatorio', 'Sin marcas ni anuncios externos, sin enlaces de salida.',
     'No tiene anuncios ni enlaces de salida.', 'Se comprueba solo (prueba de enlaces).'),
    ('Obligatorio', 'Jugable con bloqueador de anuncios, sin mensajes propios sobre eso.',
     '—', 'Si el SDK no carga o falla, el juego sigue igual; sin premio del anuncio y sin aviso propio.'),
    ('SDK', 'gameLoadingFinished al terminar de cargar; gameplayStart en el primer toque (no al cargar); gameplayStop en pausa, menú, fin; nunca dos iguales seguidos; nada durante un anuncio.',
     'No tiene SDK.', 'Módulo nuevo que vigila el orden y no deja mandar dos iguales.'),
    ('SDK', 'commercialBreak solo al volver al juego (cerrar la pausa, empezar otra partida); con el sonido y el teclado apagados.',
     '—', 'Anuncio al salir de la pausa y al empezar partida; música, efectos y controles apagados mientras dura.'),
    ('SDK', 'rewardedBreak opcional: botón con 🎬, nunca verde, al lado de un botón normal igual o más grande; premio solo si el video se vio.',
     '—', '«🎬 Doble premio» en la pantalla final (XP y cristales ×2, una vez por partida).'),
    ('Esperado', 'Evitar que la página de Poki se desplace con espacio, flechas o rueda.',
     'El espacio ya está frenado; flechas y rueda no.', 'Frenar flechas, espacio y rueda sobre el juego.'),
    ('Esperado', 'ESC o espacio para pausar con el teclado (con sus eventos del SDK).',
     'ESC ya pausa (y «P»).', 'La pausa manda gameplayStop; al seguir, anuncio y gameplayStart.'),
    ('Esperado', 'Versión limpia: sin herramientas de desarrollo ni de prueba.',
     'Tiene la zona de creadores (con contraseña).', 'La versión de Poki sale sin zona de creadores; la versión web la conserva.'),
    ('Esperado', 'Guardado del progreso, o avisar si no se guarda.', 'Guarda perfil y partida.', 'Aviso cuando el almacenamiento no funciona.'),
    ('Esperado', 'Archivo chico: los jugadores se van si tarda más de 10 s; meta de Poki para la descarga inicial: menos de 8 MB.',
     'faro.html: 4,08 MB (1,16 MB comprimido); más 0,8 MB de librerías y fuentes que hoy vienen de fuera.', 'Modelos 3D comprimidos (meshopt) si se ven igual; meta ≤ 5 MB y ≤ 1,6 MB comprimido.'),
    ('Recomendado', 'Idiomas: detectar con PokiSDK.getLanguage(); elegir en el menú; textos que aguanten traducciones largas.',
     'Solo español (unos 1.300 textos).', 'Inglés completo además del español; idioma automático y selector en Ajustes.'),
    ('Para publicar', 'Miniatura cuadrada de 628×628 o más, sin texto, sin bordes, que no se confunda con el fondo #83FFE7.',
     '—', 'Dos miniaturas sacadas del juego para que elijas.'),
]

TESTS = [
    ('P01', 'Versión para Poki sin pedidos externos', '«node faro/build.mjs --poki» arma faro/poki/index.html. Abierta con la red cortada (solo el archivo), carga, se juega una partida y no intenta ningún pedido a otro sitio (la única excepción es el script del SDK de Poki).'),
    ('P02', 'Eventos del SDK en orden', 'Con un SDK de prueba que anota todo: gameLoadingFinished una vez al cargar; gameplayStart recién con el primer toque; gameplayStop en pausa, fin y vuelta al vestíbulo; nunca dos iguales seguidos; ningún evento mientras dura un anuncio (recorrido completo y 15 min de toques al azar).'),
    ('P03', 'Anuncios entre partidas', 'commercialBreak al salir de la pausa y al empezar una partida, nunca al ir al vestíbulo; durante el anuncio la música y los efectos quedan en silencio, el tiempo de la partida no avanza y los toques y teclas no hacen nada; al terminar todo vuelve.'),
    ('P04', 'Anuncio con premio', 'En la pantalla final de una partida normal: «🎬 Doble premio» (no verde, con 🎬) junto a un botón normal igual o más grande y arriba o al lado; si el video se vio, XP y cristales de la partida ×2 y una sola vez, con aviso de premio; si no (bloqueador), nada y sin mensaje. No aparece en Campo de pruebas ni en el tutorial.'),
    ('P05', 'SDK real de Poki', 'Con el script real (game-cdn.poki.com) el juego inicia, carga y se juega; si el script no llega o init falla, el juego sigue igual.'),
    ('P06', 'La página no se mueve', 'Dentro de una página larga (como en Poki), espacio, flechas y rueda sobre el juego no desplazan la página.'),
    ('P07', 'Modo incógnito', 'Con un almacenamiento que falla en cada lectura y escritura, el juego carga, se juega una partida entera, avisa que el progreso no se guardará y no hay errores en la consola.'),
    ('P08', 'Medidas de Poki', 'En 640×360, 836×470 y 1031×580 (escritorio), celular vertical y horizontal y tableta: vestíbulo, partida, construir, ficha, pausa y final caben, sin piezas encimadas ni cortadas; letra de 11 px o más.'),
    ('P09', 'Píldora de Poki en el celular', 'La zona de la píldora de Poki (arriba, 46 × 62 px a 24 px del borde) no tapa botones del juego en celular; si los tapa, se corre con movePill. (Lo confirmas tú en el Poki Inspector, modo celular.)'),
    ('P10', 'Todo en inglés', 'Con el juego en inglés, un revisor recorre vestíbulo (todas sus pestañas), construir, las 135 fichas de tropas y edificios, ajustes, pausa, final, campaña, tutorial y avisos: 0 textos en español a la vista. El diccionario cubre el 100 % de los textos del código.'),
    ('P11', 'Elegir idioma', 'Con PokiSDK.getLanguage() = «es» sale en español; con «en», «fr» u otro, en inglés; el selector de Ajustes cambia el idioma al instante y queda guardado. La versión web usa el idioma del navegador.'),
    ('P12', 'El español queda igual', 'En español, los textos de las pantallas principales son idénticos a la v1.8 (comparación automática texto por texto).'),
    ('P13', 'Tamaño y carga', 'Versión de Poki ≤ 5 MB y ≤ 1,6 MB comprimida; carga hasta el vestíbulo no más de un 10 % más lenta que la v1.8 (Chromium). Si los modelos se comprimen: mismos triángulos y la imagen igual a ojo y por diferencia de píxeles.'),
    ('P14', 'Versión limpia', 'La versión de Poki no tiene zona de creadores ni enlaces de salida, y no escribe mensajes de depuración en la consola al jugar.'),
    ('P15', 'Miniaturas', 'Dos miniaturas de 1024×1024 sacadas del juego: sin texto, sin bordes, buen contraste con #83FFE7; se ven claras también a 128×128.'),
    ('P16', 'La versión web sigue bien', 'La versión publicada en su enlace funciona igual que la v1.8 y ya no depende de CDN ni de Google Fonts.'),
    ('P17', 'Sin regresiones', 'Las pruebas de las versiones anteriores (en español) siguen pasando; campaña ganable; números de tropas y edificios iguales; revisor 110 de 110.'),
    ('P18', 'Documento, sitio y PDF', 'Documento completo, registro y sitio con la v1.9; PRD final con resultados reales; guía paso a paso para subir el juego a Poki.'),
]


def chip(st):
    return {'ok': '<span class="chip ok">Aprobada</span>', 'fail': '<span class="chip fail">Fallida</span>',
            'np': '<span class="chip pend">No probada</span>'}.get(st, '<span class="chip pend">Pendiente</span>')


def flow_svg():
    # Diagrama del orden de los eventos del SDK en una sesión de juego.
    box = lambda x, y, w, t, sub, fill: (f'<rect x="{x}" y="{y}" width="{w}" height="46" rx="8" fill="{fill}" stroke="#1b6b63"/>'
                                         f'<text x="{x + w / 2}" y="{y + 20}" text-anchor="middle" font-size="12" font-weight="700" fill="#17313a">{t}</text>'
                                         f'<text x="{x + w / 2}" y="{y + 36}" text-anchor="middle" font-size="10" fill="#1b6b63">{sub}</text>')
    arrow = lambda x1, y1, x2, y2, lab: (f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="#d99a2b" stroke-width="2" marker-end="url(#a)"/>'
                                         f'<text x="{(x1 + x2) / 2}" y="{(y1 + y2) / 2 - 6}" text-anchor="middle" font-size="9.5" fill="#5d6b70">{lab}</text>')
    parts = [
        box(10, 20, 120, 'Carga', 'gameLoadingFinished', '#f1f3f1'),
        box(160, 20, 120, 'Vestíbulo', '(no es juego)', '#f1f3f1'),
        box(320, 20, 150, 'Anuncio', 'commercialBreak', '#fbf5e8'),
        box(510, 20, 190, 'Partida', 'primer toque: gameplayStart', '#d5f0dd'),
        box(320, 130, 150, 'Pausa', 'gameplayStop', '#f8e8d6'),
        box(550, 130, 150, 'Final', 'gameplayStop', '#f8e8d6'),
        box(550, 230, 150, '🎬 Doble premio', 'rewardedBreak (opcional)', '#fbf5e8'),
        arrow(130, 43, 158, 43, ''), arrow(280, 43, 318, 43, '«Jugar»'), arrow(470, 43, 508, 43, ''),
        arrow(530, 66, 472, 128, ''), '<text x="508" y="112" font-size="9.5" fill="#5d6b70">ESC / pausa</text>',
        arrow(395, 130, 395, 68, ''), '<text x="402" y="104" font-size="9.5" fill="#5d6b70">seguir</text>',
        arrow(625, 66, 625, 128, ''), '<text x="632" y="102" font-size="9.5" fill="#5d6b70">fin</text>',
        arrow(625, 176, 625, 228, ''), '<text x="632" y="206" font-size="9.5" fill="#5d6b70">en la pantalla final</text>',
    ]
    return ('<svg viewBox="0 0 710 286" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Orden de los eventos del SDK de Poki">'
            '<defs><marker id="a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0 L10 5 L0 10 z" fill="#d99a2b"/></marker></defs>'
            + ''.join(parts) + '</svg>')


def main():
    final = None
    if '--final' in sys.argv:
        final = json.load(open(sys.argv[sys.argv.index('--final') + 1], encoding='utf-8'))
    title = 'PRD web v1.9 · Faro de Ámbar · Versión para Poki' + (' (resultados)' if final else ' (plan)')
    req_rows = ''.join(f'<tr><td><b>{E(k)}</b></td><td>{E(r)}</td><td>{E(now)}</td><td>{E(do)}</td></tr>' for k, r, now, do in REQS)
    if final:
        n_ok = sum(1 for t in TESTS if final.get(t[0], {}).get('status') == 'ok')
        tests_head = f'9. Pruebas de aceptación · {n_ok} de {len(TESTS)} aprobadas'
        test_rows = ''.join(f'<tr><td>{i}</td><td><b>{E(n)}</b><br>{E(d)}</td><td>{chip(final.get(i, {}).get("status"))}</td>'
                            f'<td class="small">{E(final.get(i, {}).get("evidence", "no corrió"))}</td></tr>' for i, n, d in TESTS)
        test_table = f'<table><thead><tr><th style="width:6%">N.º</th><th style="width:40%">Prueba</th><th style="width:10%">Estado</th><th>Evidencia</th></tr></thead><tbody>{test_rows}</tbody></table>'
    else:
        tests_head = '9. Pruebas de aceptación'
        test_rows = ''.join(f'<tr><td>{i}</td><td><b>{E(n)}</b></td><td>{E(d)}</td><td>{chip(None)}</td></tr>' for i, n, d in TESTS)
        test_table = f'<table><thead><tr><th style="width:6%">N.º</th><th style="width:22%">Prueba</th><th>Qué se comprueba</th><th style="width:10%">Estado</th></tr></thead><tbody>{test_rows}</tbody></table>'
    body = f'''{doc_style.head(title, FECHA)}
<section class="first">
<div class="eyebrow">Faro de Ámbar · prototipo web · {'resultados' if final else 'plan'}</div>
<h1>PRD web v1.9</h1>
<p class="sub">Versión para Poki: lista para subir, con anuncios de Poki, en español e inglés</p>
<p class="meta">{FECHA} · sigue a la v1.8 · {'pruebas con resultados reales' if final else 'todas las pruebas en «Pendiente» hasta correrlas'}</p>
<div class="tiles">
<div class="tile"><b>Poki</b><span>SDK con eventos en orden, anuncios entre partidas y «🎬 Doble premio».</span></div>
<div class="tile"><b>Todo adentro</b><span>three.js, el cargador y las fuentes dentro del archivo: cero pedidos a otros sitios.</span></div>
<div class="tile"><b>Inglés</b><span>Todo el juego en inglés además del español; idioma automático y selector.</span></div>
<div class="tile"><b>Pantallas de Poki</b><span>640×360, 836×470, 1031×580, celular y tableta; la página no se mueve.</span></div>
<div class="tile"><b>Incógnito</b><span>Sigue jugable aunque el navegador no deje guardar; avisa.</span></div>
<div class="tile"><b>Más liviano</b><span>Modelos 3D comprimidos si se ven igual; meta ≤ 5 MB.</span></div>
</div>
<h3>1. Pedido</h3>
<p>Tu pedido: exportar el juego primero a <b>Poki</b> («Lo voy a exportar primero en POKI GAMES»), y al proponerte esta versión: «Dale, siempre tenemos que mejorar». Reglas del proyecto que se mantienen: PRD y PDF antes de programar; PRD final con resultados reales; nada sin probar se marca «Aprobada»; el suelo de colores lisos y el mapa no cambian; documento, registro y sitio se actualizan; se corre el programa revisor.</p>
<h3>2. Qué no cambia</h3>
<ul>
<li>Las reglas, las 93 tropas, los 42 edificios, los números, los mapas, la campaña y los bots quedan iguales.</li>
<li>La versión web de siempre (su enlace) sigue existiendo, con zona de creadores y sin anuncios.</li>
<li>En Poki, los anuncios de Poki son la única forma de ganar dinero: nada de compras dentro del juego (el juego no tiene ninguna).</li>
</ul>
<div class="note">Lo que esta máquina no puede probar: un iPad o un celular de verdad, y el <b>Poki Inspector</b> (necesita tu cuenta de Poki for Developers). Esas pruebas quedan para ti, con la guía de la sección 8.</div>
</section>
<section>
<h2>3. Lo que pide Poki y cómo queda el juego</h2>
<p class="small">Leído en las páginas para desarrolladores de Poki el {FECHA} (requisitos y calidad, SDK HTML5, recursos externos, idiomas, miniaturas, Inspector).</p>
<table><thead><tr><th style="width:12%">Tipo</th><th style="width:33%">Poki pide</th><th style="width:24%">El juego hoy (v1.8)</th><th>La v1.9 hace</th></tr></thead><tbody>{req_rows}</tbody></table>
</section>
<section>
<h2>4. SDK de Poki</h2>
<p>Un módulo nuevo (<code>src/js/088-platform.js</code>) habla con Poki. Si el SDK no está (versión web, bloqueador de anuncios, sin conexión), cada llamada no hace nada y el juego sigue igual. El módulo recuerda el último evento para no mandar nunca dos iguales seguidos y no deja pasar ninguno mientras dura un anuncio.</p>
<figure>{flow_svg()}<figcaption>Orden de los eventos en una sesión: el anuncio va siempre camino a jugar (empezar partida o salir de la pausa), nunca camino al menú. Desde la pausa o el final se puede volver al vestíbulo sin anuncio.</figcaption></figure>
<table><thead><tr><th style="width:30%">Momento del juego</th><th>Qué se manda a Poki</th></tr></thead><tbody>
<tr><td>Terminó la carga (vestíbulo listo)</td><td><code>gameLoadingFinished()</code>, una vez.</td></tr>
<tr><td>«Jugar», misión, Clasificatoria, Campo de pruebas, «Volver a la partida», «Revancha»</td><td><code>commercialBreak()</code> (con todo en silencio); después la partida empieza y <code>gameplayStart()</code> sale con el primer toque o tecla.</td></tr>
<tr><td>Pausa (botón, ESC o «P»), ajustes desde la partida, ventana de ayuda</td><td><code>gameplayStop()</code>.</td></tr>
<tr><td>Seguir jugando desde la pausa</td><td><code>commercialBreak()</code> y luego <code>gameplayStart()</code>.</td></tr>
<tr><td>Fin de la partida (victoria, derrota, abandono), mirar como espectador</td><td><code>gameplayStop()</code>.</td></tr>
<tr><td>«🎬 Doble premio» en la pantalla final</td><td><code>rewardedBreak()</code>; premio solo si devuelve que sí.</td></tr>
<tr><td>Volver al vestíbulo</td><td><code>gameplayStop()</code> si estaba jugando; nada más.</td></tr>
</tbody></table>
<h3>Durante un anuncio</h3>
<ul><li>Música y efectos en silencio (y vuelven como estaban).</li><li>La partida no avanza y una capa invisible frena toques, clics y teclas.</li><li>Si el anuncio no se muestra (Poki decide cuándo), todo sigue al instante.</li></ul>
<h3>Anuncio con premio</h3>
<p>En la pantalla final aparece «🎬 Doble premio» al lado del botón normal «Continuar», que es igual o más grande y va primero. No es verde y lleva el ícono 🎬. Si el video se vio, la XP y los cristales de esa partida se duplican, una sola vez, con un aviso y un sonido de premio. Con bloqueador no hay premio ni mensaje (Poki avisa por su lado). No aparece en el Campo de pruebas, en el tutorial ni en el modo creador.</p>
</section>
<section>
<h2>5. Inglés</h2>
<p>Poki lo recomienda para juegos con mucho texto, y este tiene unos 1.300 textos (nombres, descripciones, botones, avisos, tutorial, campaña, ayuda).</p>
<ul>
<li><b>Un solo diccionario</b> (<code>src/i18n/en.json</code>), como pide Poki: la clave es el texto en español; el valor, en inglés. Los textos con números usan marcas (<code>{{0}}</code>) para que el orden pueda cambiar.</li>
<li><b>Nombres y descripciones</b> de las 93 tropas y 42 edificios, misiones, logros, rangos y pasos del tutorial: tablas en inglés que reemplazan a las españolas al elegir el idioma.</li>
<li><b>Idioma al abrir</b>: en Poki, <code>PokiSDK.getLanguage()</code>: «es» → español; cualquier otro → inglés. En la web, el idioma del navegador. <b>Selector</b> en Ajustes · Interfaz; la elección queda guardada y manda sobre lo automático.</li>
<li><b>Revisor de idioma</b> (<code>tools/idioma/</code>): cuenta los textos del código sin traducción y, en el navegador, recorre las pantallas en inglés buscando español a la vista.</li>
<li>En español todo queda exactamente como en la v1.8 (se compara automáticamente).</li>
</ul>
<h2>6. Archivo para Poki</h2>
<ul>
<li><code>node faro/build.mjs --poki</code> arma <code>faro/poki/index.html</code>: el juego entero en un archivo, con el script del SDK de Poki en el encabezado. Lo subes comprimido en .zip.</li>
<li>three.js r128, GLTFLoader y las fuentes (Barlow y Chakra Petch, de los paquetes de npm @fontsource) van adentro, también en la versión web.</li>
<li>Modelos 3D: compresión meshopt, que three.js r128 ya sabe leer. Bajan de 2,56 MB a 1,68 MB (medido). Se usa solo si cada modelo da los mismos triángulos y se ve igual; si no, quedan como están.</li>
<li>Sin zona de creadores; sin mensajes de depuración; páginas que no se mueven con espacio, flechas ni rueda.</li>
<li>Pantallas: se ajusta el HUD para 640×360 (la medida más chica de Poki) sin cambiar la de las demás.</li>
</ul>
</section>
<section>
<h2>7. Orden de trabajo</h2>
<ol>
<li>Librerías y fuentes adentro; versión de Poki en el build.</li>
<li>Módulo del SDK con los eventos, anuncios, silencio y bloqueo de controles; «🎬 Doble premio».</li>
<li>Incógnito, página que no se mueve, medidas de Poki y píldora.</li>
<li>Sistema de idiomas y traducción completa al inglés; revisor de idioma.</li>
<li>Modelos comprimidos (si pasan la comparación).</li>
<li>Miniaturas, pruebas P01–P18, PRD final, documento, sitio, publicar y guardar.</li>
</ol>
<h2>8. Para subirlo a Poki (lo haces tú)</h2>
<ol>
<li>Entra a Poki for Developers con tu cuenta y crea el juego.</li>
<li>Sube <code>faro/poki/faro-poki.zip</code> (el .zip con <code>index.html</code> adentro).</li>
<li>Ábrelo en el <b>Poki Inspector</b>: revisa la lista de QA, el registro de eventos, las advertencias y el modo celular con el código QR.</li>
<li>Sube una de las dos miniaturas y los textos que ya te pasé; pide la prueba con jugadores.</li>
</ol>
<div class="note">Lo que mide Poki en la prueba con jugadores: clics en la miniatura, tiempo en la página y cuántos llegan a jugar (el primer <code>gameplayStart()</code>). Por eso importa que cargue rápido y que se llegue a jugar con pocos toques.</div>
</section>
<section>
<h2>{tests_head}</h2>
<p class="small">Pruebas en Chromium sin tarjeta gráfica, con un SDK de prueba que anota los eventos y, en P05, con el SDK real. El iPad, los celulares y el Poki Inspector los pruebas tú.</p>
{test_table}
</section>
</body></html>'''
    open(OUT, 'w', encoding='utf-8').write(body)
    print('[PRD] ✅', OUT)


if __name__ == '__main__':
    main()
