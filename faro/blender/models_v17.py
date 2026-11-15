"""Modelos de la v1.7: los dos vehículos de la «Dirección visual UI 0.4» del usuario.

- Lanzador DF-17: camión compacto de cinco ejes con el misil a la vista y la punta angular.
- Lanzador nuclear móvil: camión largo de ocho ejes con un único contenedor redondeado.

Son piezas de juego estilizadas: se copia la silueta de las propuestas del usuario, no un vehículo real.
El color del jugador (EQUIPO) va en franjas anchas para que se lea desde la cámara del juego.
"""
import math

from lib import P, Model
from models_ref import wheels

H = math.pi / 2

# Verdes de camuflaje y gris del misil (se suman a la paleta del proyecto).
P.update({'camo_claro': 0xb3b98f, 'camo_medio': 0x74834d, 'camo_osc': 0x3f4a2a,
          'misil': 0xa9b8ad, 'misil_osc': 0x76867c})


def _cab(m, y, w=0.4, h=0.2, d=0.24):
    """Cabina partida en dos, con parabrisas, luces y una franja del color del jugador."""
    for sx in (-1, 1):
        m.box('oliva', (w / 2 - 0.012, d, h), (sx * (w / 4 + 0.004), y, 0.15), bevel=0.025)
        m.box('vidrio', (w / 2 - 0.06, 0.02, 0.075), (sx * (w / 4 + 0.004), y - d / 2 - 0.003, 0.255), rot=(-0.14, 0, 0), bevel=0.004)
        m.box('luz', (0.045, 0.02, 0.026), (sx * (w / 2 - 0.05), y - d / 2 - 0.004, 0.175), bevel=0.004)
        m.box('camo_osc', (0.05, 0.03, 0.05), (sx * (w / 2 + 0.02), y - d / 2 + 0.04, 0.27), bevel=0.008)
    m.box('oscuro', (w + 0.02, 0.05, 0.05), (0, y - d / 2 - 0.012, 0.115), bevel=0.01)
    m.box('EQUIPO', (w + 0.004, 0.07, 0.022), (0, y + 0.02, 0.15 + h), bevel=0.006)
    # Rejilla del frente.
    for k in range(3):
        m.box('negro', (0.12, 0.012, 0.012), (0, y - d / 2 - 0.006, 0.19 + k * 0.022), bevel=0.0)


def _camo_side(m, y0, y1, z, x, patches):
    """Faldones con manchas de camuflaje (planas, de pocas caras)."""
    ln = y1 - y0
    for sx in (-1, 1):
        m.box('camo_medio', (0.03, ln, 0.13), (sx * x, (y0 + y1) / 2, z), bevel=0.008)
        for i, (t, w, col) in enumerate(patches):
            m.box(col, (0.006, w, 0.075 if i % 2 else 0.1), (sx * (x + 0.017), y0 + ln * t, z + 0.02 + (i % 2) * 0.02),
                  rot=(0.22 * (1 if i % 2 else -1), 0, 0), bevel=0.0)


def df17():
    """Lanzador DF-17 (antes «Lanzador de misiles»): misil a la vista con punta en cuña sobre un camión compacto."""
    m = Model('launcher')
    ys = [-0.42, -0.25, 0.04, 0.22, 0.4]
    wheels(m, [(sx * 0.2, y) for y in ys for sx in (-1, 1)], r=0.085, w=0.085)
    m.box('oscuro', (0.34, 1.08, 0.07), (0, 0.0, 0.11), bevel=0.015)
    _cab(m, -0.43, w=0.4, h=0.19, d=0.22)
    # Caja baja con faldones de camuflaje y una franja del color del jugador a cada lado.
    m.box('oliva_osc', (0.4, 0.8, 0.07), (0, 0.13, 0.17), bevel=0.018)
    _camo_side(m, -0.27, 0.53, 0.17, 0.2, [(0.14, 0.14, 'camo_claro'), (0.36, 0.1, 'camo_osc'), (0.58, 0.16, 'camo_claro'), (0.84, 0.1, 'camo_osc')])
    for sx in (-1, 1):
        m.box('EQUIPO', (0.022, 0.78, 0.022), (sx * 0.2, 0.13, 0.3), bevel=0.004)
    m.box('camo_osc', (0.3, 0.1, 0.1), (0, 0.5, 0.24), bevel=0.02)
    # Cuna del misil y misil (parte «turret»: gira para apuntar, como el lanzador anterior).
    m.pivot('turret', 0, 0.13, 0.25)
    m.box('oscuro', (0.11, 0.92, 0.03), (0, 0.1, 0.25), bevel=0.006, part='turret')
    for y in (-0.2, 0.12, 0.44):
        m.box('camo_osc', (0.17, 0.045, 0.06), (0, y, 0.27), bevel=0.01, part='turret')
    m.tube('misil', (0, 0.56, 0.385), (0, -0.2, 0.385), r=0.07, seg=12, part='turret')
    m.tube('misil_osc', (0, 0.6, 0.385), (0, 0.56, 0.385), r=0.055, seg=10, part='turret')
    m.tube('EQUIPO', (0, 0.3, 0.385), (0, 0.24, 0.385), r=0.073, seg=12, part='turret')
    # Punta en cuña (planeador): ancha y chata, termina en filo.
    m.hull('misil', [(-0.2, 0.07, 0.07, 0.318, 0.452), (-0.38, 0.1, 0.085, 0.345, 0.42), (-0.62, 0.012, 0.012, 0.372, 0.386)],
           part='turret')
    m.box('misil_osc', (0.26, 0.11, 0.012), (0, -0.33, 0.378), rot=(0, 0, 0), bevel=0.0, part='turret')
    # Aletas de cola.
    m.box('misil_osc', (0.24, 0.09, 0.012), (0, 0.5, 0.379), bevel=0.0, part='turret')
    m.box('misil_osc', (0.012, 0.09, 0.2), (0, 0.5, 0.285), bevel=0.0, part='turret')
    return m


def nuke_launcher():
    """Lanzador nuclear móvil: ocho ejes y un solo contenedor redondeado, más largo que el camión."""
    m = Model('nukelauncher')
    ys = [-0.6, -0.44, -0.25, -0.09, 0.09, 0.25, 0.44, 0.6]
    wheels(m, [(sx * 0.22, y) for y in ys for sx in (-1, 1)], r=0.085, w=0.085)
    m.box('oscuro', (0.38, 1.44, 0.07), (0, 0.02, 0.11), bevel=0.015)
    _cab(m, -0.66, w=0.44, h=0.17, d=0.22)
    m.box('oliva_osc', (0.44, 1.12, 0.08), (0, 0.16, 0.17), bevel=0.02)
    _camo_side(m, -0.4, 0.72, 0.17, 0.22, [(0.1, 0.16, 'camo_claro'), (0.3, 0.12, 'camo_osc'), (0.5, 0.18, 'camo_claro'),
                                            (0.7, 0.12, 'camo_osc'), (0.9, 0.14, 'camo_claro')])
    # Rejillas laterales.
    for sx in (-1, 1):
        for y in (-0.1, 0.34):
            for k in range(3):
                m.box('negro', (0.008, 0.07, 0.01), (sx * 0.242, y, 0.2 + k * 0.022), bevel=0.0)
    # Soportes del contenedor.
    for y in (-0.42, 0.0, 0.42, 0.7):
        m.box('camo_osc', (0.3, 0.06, 0.09), (0, y, 0.24), bevel=0.012)
    # Contenedor único: tramos de camuflaje, dos aros del color del jugador y tapa redonda adelante (sobre la cabina).
    z, r = 0.44, 0.155
    bands = [(0.78, 0.5, 'oliva'), (0.5, 0.3, 'camo_claro'), (0.3, 0.02, 'camo_medio'), (0.02, -0.2, 'camo_claro'),
             (-0.2, -0.5, 'oliva'), (-0.5, -0.7, 'camo_medio')]
    for (a, b, col) in bands:
        m.tube(col, (0, a, z), (0, b, z), r=r, seg=18)
    for y in (0.5, -0.2):
        m.tube('EQUIPO', (0, y + 0.025, z), (0, y - 0.025, z), r=r + 0.006, seg=18)
    for y in (0.3, 0.02, -0.5):
        m.tube('camo_osc', (0, y + 0.01, z), (0, y - 0.01, z), r=r + 0.004, seg=18)
    m.sphere('oliva', r, (0, -0.7, z), scale=(1, 0.9, 1), seg=16)
    m.tube('camo_osc', (0, 0.8, z), (0, 0.78, z), r=r * 0.92, seg=18)
    # Rieles superiores del contenedor.
    for sx in (-1, 1):
        m.beam('camo_osc', (sx * 0.07, 0.76, z + r - 0.008), (sx * 0.07, -0.62, z + r - 0.008), t=0.022)
    return m
