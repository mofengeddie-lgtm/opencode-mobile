"""PRD Roblox v1.6 (escrito por el usuario) → HTML listo para PDF, con las imágenes en su lugar.

Uso: python3 faro/docs/roblox/build_prd_roblox.py   (luego: node faro/docs/pdf.cjs faro/docs/roblox/PRD_Roblox_v1.6.html)
El texto del usuario no se cambia: solo se ponen las capturas en <!-- REFERENCIAS_VISUALES --> y el
esquema de la interfaz en <!-- ESQUEMA_HUD -->.
"""
import os
import sys

import markdown

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
from doc_style import head  # noqa: E402

SRC = os.path.join(HERE, 'PRD_Faro_de_Ambar_v1_6.md')
OUT = os.path.join(HERE, 'PRD_Roblox_v1.6.html')

REFS = '''
<div class="figgrid">
<figure><img src="../img/ref-isla-propia.png" alt="Isla propia de cerca: Núcleo, granjas, Cuartel, fábrica, molino y puerto sobre hexágonos verdes y arena, rodeados de mar">
<figcaption><b>Referencia 1 · Isla propia de cerca</b> (captura enviada por el usuario). Hexágonos verdes con borde de arena, mar azul con reflejos, Núcleo al centro con su rayo, granjas, Cuartel, fábrica, molino y puerto; soldados verdes legibles.</figcaption></figure>
<figure><img src="../img/ref-archipielago.jpg" alt="Vista amplia del archipiélago: varias islas con bases de colores, islas pequeñas con energía y petróleo en el mar">
<figcaption><b>Referencia 2 · Archipiélago</b> (captura enviada por el usuario). Islas separadas por mar navegable, bases de otros jugadores con su color en el borde del territorio, islas chicas con recursos y manchas oscuras de petróleo en el mar.</figcaption></figure>
</div>
<p class="small">Las dos capturas son del prototipo web de Faro de Ámbar. Sirven de referencia de composición, color y legibilidad para la versión de Roblox.</p>
'''

HUD_SVG = '''
<figure><svg viewBox="0 0 1180 820" role="img" aria-label="Esquema del HUD en iPad horizontal" xmlns="http://www.w3.org/2000/svg" font-family="DejaVu Sans, Arial, sans-serif">
  <defs><linearGradient id="mar" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4fb3d9"/><stop offset="1" stop-color="#2a8fbf"/></linearGradient></defs>
  <rect width="1180" height="820" fill="url(#mar)"/>
  <ellipse cx="590" cy="420" rx="330" ry="210" fill="#9ccb6b" stroke="#e8d59a" stroke-width="22"/>
  <text x="590" y="410" text-anchor="middle" font-size="30" font-weight="700" fill="#17313a">MAPA</text>
  <text x="590" y="446" text-anchor="middle" font-size="19" fill="#17313a">Centro libre para observar y dar órdenes</text>
  <g fill="#1d2a33" fill-opacity="0.93" stroke="#d99a2b" stroke-width="2">
    <rect x="12" y="12" width="560" height="64" rx="12"/>
    <rect x="586" y="12" width="450" height="64" rx="12"/>
    <rect x="1050" y="12" width="118" height="64" rx="12"/>
    <rect x="12" y="92" width="236" height="250" rx="12"/>
    <rect x="12" y="588" width="236" height="220" rx="12"/>
    <rect x="908" y="92" width="260" height="620" rx="12"/>
    <rect x="262" y="560" width="632" height="248" rx="12"/>
  </g>
  <g fill="#ffffff" font-size="17">
    <text x="30" y="40" font-weight="700" fill="#f2ab38">RECURSOS</text>
    <text x="30" y="64">Monedas · Tropas · Energía · Tiempo</text>
    <text x="604" y="40" font-weight="700" fill="#f2ab38">PARTICIPANTES</text>
    <text x="604" y="64">Colores de cada imperio · marcador</text>
    <text x="1068" y="50" font-weight="700" fill="#f2ab38">Pausa</text>
    <text x="30" y="122" font-weight="700" fill="#f2ab38">OBJETIVOS</text>
    <text x="30" y="148">Primeros pasos o misión</text>
    <text x="30" y="172">Avisos de la partida</text>
    <text x="30" y="618" font-weight="700" fill="#f2ab38">MINIMAPA (plegable)</text>
    <text x="30" y="644">Grupos 1-2-3</text>
    <text x="30" y="668">Ejército · Barcos · Aéreos</text>
    <text x="30" y="692">Recuadro · Núcleo</text>
    <text x="926" y="122" font-weight="700" fill="#f2ab38">CONSTRUCCIÓN (plegable)</text>
    <text x="926" y="150">Pestañas: Economía, Energía,</text>
    <text x="926" y="174">Producción, Defensa</text>
    <text x="926" y="208">Tarjeta: miniatura, coste en</text>
    <text x="926" y="232">amarillo, qué da y límite</text>
    <text x="280" y="590" font-weight="700" fill="#f2ab38">SELECCIÓN Y PRODUCCIÓN</text>
    <text x="280" y="618">Ficha: nombre, nivel, vida en verde</text>
    <text x="280" y="644">Botones: Mejorar · Punto de reunión · Demoler</text>
    <text x="280" y="670">Cola con tiempo y «×» · Repetir · Siempre</text>
    <text x="280" y="696">Tarjetas de tropas con coste y población</text>
  </g>
  <g fill="#f2ab38"><rect x="262" y="736" width="140" height="56" rx="10"/><rect x="414" y="736" width="140" height="56" rx="10" fill-opacity="0.35"/><rect x="566" y="736" width="140" height="56" rx="10" fill-opacity="0.35"/></g>
  <text x="332" y="770" text-anchor="middle" font-size="15" font-weight="700" fill="#1a1206">44 × 44 px mín.</text>
</svg>
<figcaption><b>Esquema del HUD en iPad horizontal</b> (sección 4): recursos y participantes arriba; objetivos y minimapa plegable a la izquierda; construcción plegable a la derecha; selección y producción abajo; el centro queda para el mapa. Toda zona táctil mide 44 × 44 px o más.</figcaption></figure>
<figure><img src="../img/hud-v15-ipad.png" alt="Captura del prototipo web v1.5 en iPad horizontal con el Cuartel seleccionado">
<figcaption><b>Cómo se ve hoy en el prototipo web (v1.5)</b>: la misma distribución, con el Cuartel elegido (cola con tiempo, lo que cambia al mejorar y tarjetas de tropas).</figcaption></figure>
'''


def main():
    md = open(SRC, encoding='utf-8').read()
    assert '<!-- REFERENCIAS_VISUALES -->' in md and '<!-- ESQUEMA_HUD -->' in md
    md = md.replace('<!-- REFERENCIAS_VISUALES -->', '\n' + REFS + '\n')
    md = md.replace('<!-- ESQUEMA_HUD -->', '\n' + HUD_SVG + '\n')
    body = markdown.markdown(md, extensions=['tables', 'fenced_code', 'sane_lists'], output_format='html5')
    # Portada: el primer h1 y los dos párrafos que siguen forman la cabecera.
    body = body.replace('<h1>Faro de Ámbar</h1>\n<p>PRD y plan de inicio</p>',
                        '<div class="eyebrow">Faro de Ámbar · Plan para Roblox</div>\n<h1>Faro de Ámbar</h1>\n<p class="sub">PRD y plan de inicio · versión 1.6</p>', 1)
    body = body.replace('<p>Versión 1.6 · 13 de noviembre de 2026 · Diseño visual y desarrollo futuro pendiente</p>',
                        '<p class="meta">Versión 1.6 · 13 de noviembre de 2026 · Diseño visual y desarrollo futuro pendiente · Documento escrito por el usuario; imágenes y esquema añadidos en sus lugares marcados</p>', 1)
    html = head('Faro de Ámbar · PRD Roblox v1.6', '13 NOV 2026', 'Plan para Roblox') + body + '\n</body>\n</html>\n'
    open(OUT, 'w', encoding='utf-8').write(html)
    print('[PRD Roblox] ✅', OUT, f'{len(html) // 1024} KB')


if __name__ == '__main__':
    main()
