"""Modelos rehechos según las referencias del 7 de noviembre (diseño propio, estilo del juego).

Torreta naval con miniguns, jeep con artillero, Núcleo fortaleza, barcos, helicóptero, helipuerto,
AIR DEFENSE, lanzamisiles, granja, mina, plataforma, soldados con piernas animables y el skin
Brigada Tóxica (capucha y máscara de gas). Blender: Z arriba, el frente mira a -Y.
"""
import math

from lib import Model

PI = math.pi
H = PI / 2


# ---------------------------------------------------------------------
# Soldados (piernas como partes 'legl' y 'legr' para animarlas al caminar)
# ---------------------------------------------------------------------
def soldier(kind, look=None):
    """Soldado (v0.9, más realista): cabeza chica con cuello, uniforme oliva, chaleco táctico con el color
    del imperio, bolsillos, cinturón, mochila, rodilleras y brazos que sostienen el arma."""
    m = Model(kind if not look else f'{kind}@{look}')
    tox = look == 'toxico'
    pant = 'camo' if tox else 'oliva_osc'
    # Piernas en dos piezas (v0.8): muslo desde la cadera y pierna desde la rodilla, para el
    # movimiento de caminar y correr de CMU (blender/cmu_gait.py).
    for part, sx in (('legl', -1), ('legr', 1)):
        shin = 'shin' + part[-1]
        m.pivot(part, sx * 0.05, 0, 0.19)
        m.pivot(shin, sx * 0.05, 0, 0.105)
        m.box(pant, (0.075, 0.09, 0.095), (sx * 0.05, 0, 0.098), bevel=0.012, part=part)
        m.box(pant, (0.07, 0.085, 0.08), (sx * 0.05, 0, 0.03), bevel=0.012, part=shin)
        m.box('negro', (0.08, 0.115, 0.04), (sx * 0.05, -0.012, 0), bevel=0.01, part=shin)
        m.box('oscuro' if not tox else 'camo2', (0.076, 0.03, 0.035), (sx * 0.05, -0.043, 0.085), bevel=0.006, part=shin)
    hx, hy, hz = 0.09, -0.13, 0.27
    head_z = 0.425
    armed = kind not in ('builder', 'engineer', 'medic')
    sleeve = 'camo' if tox else 'oliva'

    def arm(shoulder, elbow, hand, glove='piel'):
        m.beam(sleeve, shoulder, elbow, t=0.052)
        m.beam(sleeve, elbow, hand, t=0.046)
        m.box(glove, (0.038, 0.04, 0.038), hand, bevel=0.01)

    if tox:
        m.box('camo', (0.21, 0.14, 0.21), (0, 0, 0.19), bevel=0.025)
        for (x, z) in [(-0.06, 0.3), (0.05, 0.22), (0.07, 0.33), (-0.03, 0.21)]:
            m.box('camo2', (0.05, 0.144, 0.05), (x, 0, z), bevel=0.004)
        m.box('EQUIPO', (0.22, 0.15, 0.03), (0, 0, 0.19), bevel=0.008)
        m.box('EQUIPO', (0.2, 0.15, 0.03), (0, 0, 0.36), bevel=0.006)
        m.box('piel', (0.1, 0.105, 0.11), (0, 0, head_z), bevel=0.035)
        # Capucha oscura y máscara de gas amarilla con dos visores y filtro.
        m.sphere('negro', 0.068, (0, 0.012, 0.47), scale=(1.06, 1.08, 1.12))
        m.box('negro', (0.15, 0.07, 0.08), (0, 0.04, 0.39), bevel=0.025)
        m.box('mascara', (0.1, 0.03, 0.08), (0, -0.06, 0.44), bevel=0.018)
        for sx in (-1, 1):
            m.cyl('negro', 0.021, 0.012, (sx * 0.026, -0.075, 0.48), rot=(H, 0, 0), seg=12, base=False)
            m.cyl('vidrio', 0.015, 0.014, (sx * 0.026, -0.079, 0.48), rot=(H, 0, 0), seg=12, base=False)
        m.cyl('negro', 0.026, 0.045, (0, -0.095, 0.435), rot=(H, 0, 0), seg=12, base=False)
        m.cyl('mascara', 0.029, 0.012, (0, -0.12, 0.435), rot=(H, 0, 0), seg=12, base=False)
    else:
        # Uniforme, chaleco con bolsillos, cinturón y mochila.
        m.box('oliva', (0.2, 0.13, 0.2), (0, 0, 0.19), bevel=0.025)
        m.box('EQUIPO', (0.212, 0.148, 0.15), (0, 0, 0.235), bevel=0.02)
        for x in (-0.06, 0.0, 0.06):
            m.box('oliva_osc', (0.045, 0.024, 0.05), (x, -0.08, 0.245), bevel=0.006)
        m.box('oscuro', (0.212, 0.142, 0.03), (0, 0, 0.19), bevel=0.006)
        m.box('oliva_osc', (0.15, 0.07, 0.16), (0, 0.1, 0.22), bevel=0.02)
        m.box('oliva_osc', (0.13, 0.04, 0.03), (0, 0.1, 0.38), bevel=0.008)
        m.box('piel', (0.055, 0.055, 0.03), (0, 0, 0.398), bevel=0.008)
        m.box('piel', (0.1, 0.105, 0.11), (0, 0, head_z), bevel=0.035)
        m.box('negro', (0.016, 0.008, 0.016), (-0.025, -0.054, 0.48), bevel=0.003)
        m.box('negro', (0.016, 0.008, 0.016), (0.025, -0.054, 0.48), bevel=0.003)
    # Brazos: con arma, las dos manos la sostienen; sin arma, cuelgan junto al cuerpo.
    if kind == 'rocket':
        arm((0.11, 0, 0.37), (0.15, -0.05, 0.3), (0.12, -0.1, 0.36))
        arm((-0.11, 0, 0.37), (-0.04, -0.12, 0.31), (0.11, -0.19, 0.36))
    elif armed:
        arm((0.11, 0, 0.37), (0.14, -0.02, 0.27), (hx, hy + 0.06, hz - 0.01))
        arm((-0.11, 0, 0.37), (-0.05, -0.13, 0.29), (hx - 0.01, hy - 0.08, hz + 0.005))
    else:
        for sx in (-1, 1):
            arm((sx * 0.11, 0, 0.37), (sx * 0.13, -0.01, 0.28), (sx * 0.13, -0.04, 0.2))

    def helmet(color, brim=False):
        if tox:
            return
        m.sphere(color, 0.074, (0, 0.004, 0.52), scale=(1.06, 1.1, 0.72))
        m.cyl(color, 0.077, 0.024, (0, 0.004, 0.495), seg=18)
        m.box('oscuro', (0.11, 0.012, 0.018), (0, -0.07, 0.535), bevel=0.003)
        if brim:
            m.cyl(color, 0.09, 0.01, (0, -0.005, 0.495), seg=18)

    def rifle(length, color='negro', scope=False, stock='madera', barrel_r=0.012):
        m.box(color, (0.045, length * 0.55, 0.055), (hx, hy - length * 0.1, hz), bevel=0.008)
        m.box(stock, (0.04, length * 0.25, 0.05), (hx, hy + length * 0.28, hz - 0.01), bevel=0.008)
        m.cyl('metal', barrel_r, length * 0.45, (hx, hy - length * 0.38, hz + 0.028), rot=(H, 0, 0), seg=8, base=False)
        m.box('negro', (0.02, 0.04, 0.05), (hx, hy - length * 0.02, hz - 0.045), rot=(0.3, 0, 0), bevel=0.004)
        if scope:
            m.cyl('oscuro', 0.018, length * 0.22, (hx, hy - length * 0.08, hz + 0.075), rot=(H, 0, 0), seg=10, base=False)

    if kind == 'builder':
        if not tox:
            m.cyl('naranja', 0.07, 0.05, (0, 0, 0.505), seg=18)
            m.cyl('naranja', 0.092, 0.012, (0, -0.01, 0.505), seg=18)
            m.box('naranja', (0.018, 0.1, 0.026), (0, 0, 0.552), bevel=0.006)
        # Chaleco reflectivo, viga de acero al hombro y taladro.
        m.box('naranja', (0.22, 0.152, 0.15), (0, 0, 0.225), bevel=0.02)
        for z in (0.26, 0.32):
            m.box('luz', (0.224, 0.156, 0.016), (0, 0, z), bevel=0.003)
        bx, bz = 0.13, 0.42
        m.box('metal_claro', (0.012, 0.56, 0.05), (bx, 0.02, bz), bevel=0.0)
        m.box('metal_claro', (0.05, 0.56, 0.01), (bx, 0.02, bz), bevel=0.0)
        m.box('metal_claro', (0.05, 0.56, 0.01), (bx, 0.02, bz + 0.05), bevel=0.0)
        m.box('naranja', (0.04, 0.09, 0.055), (-0.13, -0.08, 0.2), bevel=0.01)
        m.cyl('metal', 0.008, 0.06, (-0.13, -0.15, 0.225), rot=(H, 0, 0), seg=8, base=False)
    elif kind == 'engineer':
        if not tox:
            m.cyl('amarillo', 0.07, 0.05, (0, 0, 0.505), seg=18)
            m.cyl('amarillo', 0.092, 0.012, (0, -0.01, 0.505), seg=18)
            m.box('oscuro', (0.1, 0.026, 0.03), (0, -0.056, 0.52), bevel=0.008)
            m.box('vidrio', (0.08, 0.01, 0.018), (0, -0.07, 0.522), bevel=0.003)
        m.box('metal', (0.16, 0.08, 0.18), (0, 0.11, 0.21), bevel=0.02)
        m.box('naranja', (0.045, 0.09, 0.045), (0.05, 0.12, 0.38), bevel=0.008)
        m.box('metal_claro', (0.025, 0.16, 0.025), (0.13, -0.08, 0.2), bevel=0.006)
        m.cyl('metal_claro', 0.03, 0.03, (0.13, -0.17, 0.2), rot=(0, H, 0), seg=10, base=False)
    elif kind == 'medic':
        # Casco blanco con cruz roja, brazalete, botiquín en la mano y mochila médica.
        if not tox:
            m.sphere('blanco', 0.074, (0, 0.004, 0.52), scale=(1.06, 1.1, 0.72))
            m.cyl('blanco', 0.077, 0.024, (0, 0.004, 0.495), seg=18)
            m.box('rojo', (0.04, 0.01, 0.012), (0, -0.07, 0.53), bevel=0.0)
            m.box('rojo', (0.012, 0.01, 0.04), (0, -0.07, 0.53), bevel=0.0)
        m.box('blanco', (0.15, 0.075, 0.16), (0, 0.105, 0.22), bevel=0.02)
        m.box('rojo', (0.06, 0.006, 0.018), (0, 0.145, 0.26), bevel=0.0)
        m.box('rojo', (0.018, 0.006, 0.06), (0, 0.145, 0.26), bevel=0.0)
        m.box('blanco', (0.056, 0.06, 0.03), (-0.13, -0.01, 0.33), bevel=0.004)
        m.box('rojo', (0.03, 0.062, 0.01), (-0.13, -0.01, 0.335), bevel=0.0)
        m.box('blanco', (0.1, 0.05, 0.07), (0.13, -0.05, 0.14), bevel=0.012)
        m.box('rojo', (0.04, 0.052, 0.012), (0.13, -0.05, 0.17), bevel=0.0)
    elif kind == 'rifle':
        helmet('oliva')
        rifle(0.34)
        m.box('oliva_osc', (0.05, 0.05, 0.045), (hx, hy - 0.02, hz - 0.06), bevel=0.01)
    elif kind == 'shotgun':
        if not tox:
            m.cyl('oliva_osc', 0.068, 0.045, (0, 0, 0.5), seg=16)
            m.box('oliva_osc', (0.09, 0.07, 0.01), (0, -0.07, 0.5), bevel=0.004)
        m.box('madera', (0.05, 0.16, 0.065), (hx, hy + 0.02, hz), bevel=0.01)
        m.cyl('metal', 0.02, 0.18, (hx, hy - 0.13, hz + 0.02), rot=(H, 0, 0), seg=10, base=False)
        m.cyl('metal', 0.014, 0.16, (hx, hy - 0.12, hz - 0.012), rot=(H, 0, 0), seg=8, base=False)
        for k in range(4):
            m.box('rojo', (0.01, 0.018, 0.028), (-0.04 + k * 0.022, -0.082, 0.31), rot=(0, 0.5, 0), bevel=0.0)
    elif kind == 'ranger':
        helmet('oliva')
        if not tox:
            m.box('negro', (0.15, 0.016, 0.026), (0, -0.075, 0.535), bevel=0.006)
        m.box('arena', (0.222, 0.155, 0.14), (0, 0, 0.235), bevel=0.02)
        for sx in (-1, 0, 1):
            m.box('oliva_osc', (0.045, 0.02, 0.055), (sx * 0.065, -0.082, 0.25), bevel=0.006)
        rifle(0.38, scope=True)
    elif kind == 'sniper':
        if not tox:
            m.cyl('oliva', 0.11, 0.01, (0, 0, 0.51), seg=18)
            m.cyl('oliva', 0.066, 0.05, (0, 0, 0.51), seg=16, r2=0.058)
        rifle(0.62, scope=True, barrel_r=0.01)
        for sx in (-1, 1):
            m.beam('metal', (hx, hy - 0.3, hz), (hx + sx * 0.03, hy - 0.32, hz - 0.1), t=0.008)
    elif kind == 'breaker':
        helmet('tierra')
        m.box('negro', (0.055, 0.2, 0.07), (hx, hy, hz), bevel=0.012)
        m.cyl('oscuro', 0.045, 0.05, (hx, hy + 0.01, hz - 0.06), rot=(0, H, 0), seg=14, base=False)
        m.cyl('metal', 0.018, 0.14, (hx, hy - 0.15, hz + 0.02), rot=(H, 0, 0), seg=10, base=False)
    elif kind == 'hunter':
        if not tox:
            m.sphere('oscuro', 0.074, (0.008, 0, 0.51), scale=(1.1, 1.1, 0.4))
        rifle(0.64, color='oscuro', scope=True, stock='oscuro', barrel_r=0.014)
        m.cyl('oscuro', 0.026, 0.12, (hx, hy - 0.08, hz + 0.09), rot=(H, 0, 0), seg=12, base=False)
        for sx in (-1, 1):
            m.box('metal', (0.008, 0.008, 0.1), (hx + sx * 0.02, hy - 0.3, hz - 0.05), rot=(0, sx * 0.4, 0), bevel=0.0)
    elif kind == 'rocket':
        helmet('oliva')
        m.cyl('oliva', 0.044, 0.5, (0.11, -0.02, 0.41), rot=(H, 0, 0), seg=14, base=False)
        m.cyl('oscuro', 0.05, 0.05, (0.11, -0.27, 0.41), rot=(H, 0, 0), seg=14, base=False)
        m.cone('rojo', 0.038, 0.09, (0.11, -0.31, 0.41), rot=(H, 0, 0), seg=12)
        m.box('oscuro', (0.03, 0.06, 0.05), (0.11, -0.08, 0.36), bevel=0.006)
    return m


def wheels(m, positions, r=0.085, w=0.07, part='main'):
    for (x, y) in positions:
        m.cyl('goma', r, w, (x, y, r), rot=(0, H, 0), seg=16, base=False, part=part)
        m.cyl('metal', r * 0.55, w + 0.01, (x, y, r), rot=(0, H, 0), seg=10, base=False, part=part)


def tracks(m, x, length=0.92, n=6, r=0.048):
    for sx in (-1, 1):
        m.box('goma', (0.13, length, 0.14), (sx * x, 0, 0.02), bevel=0.05)
        for k in range(n):
            m.cyl('metal', r, 0.135, (sx * x, -length * 0.4 + k * length * 0.8 / (n - 1), 0.075), rot=(0, H, 0),
                  seg=12, base=False)


def launcher_face(m, cx, cy, cz, half_y, th, cols, rows, dx, dz, part):
    """Celdas de misiles con una X blanca en la cara delantera de una caja inclinada th (rot X)."""
    c, s = math.cos(th), math.sin(th)

    def fp(x, zc, dy):
        y0, z0 = -half_y - dy, zc
        return (cx + x, cy + y0 * c - z0 * s, cz + y0 * s + z0 * c)
    for ix in range(cols):
        for iz in range(rows):
            x = (ix - (cols - 1) / 2) * dx
            z = (iz - (rows - 1) / 2) * dz
            m.beam('oscuro', fp(x, z, -0.004), fp(x, z, 0.012), t=dx * 0.82, part=part)
            for sgn in (-1, 1):
                m.beam('blanco', fp(x - dx * 0.28, z - sgn * dz * 0.28, 0.014), fp(x + dx * 0.28, z + sgn * dz * 0.28, 0.014),
                       t=0.011, part=part)


# ---------------------------------------------------------------------
# Vehículos
# ---------------------------------------------------------------------
def jeep():
    """Vehículo ancho tipo Humvee con un artillero en la torreta del techo."""
    m = Model('jeep')
    wheels(m, [(-0.25, -0.27), (0.25, -0.27), (-0.25, 0.27), (0.25, 0.27)], r=0.1, w=0.09)
    m.box('EQUIPO_OSC', (0.42, 0.86, 0.1), (0, 0.01, 0.09), bevel=0.03)
    for sx in (-1, 1):
        for y in (-0.27, 0.27):
            m.box('EQUIPO', (0.13, 0.27, 0.045), (sx * 0.25, y, 0.2), bevel=0.015)
    m.box('EQUIPO', (0.5, 0.3, 0.09), (0, -0.27, 0.19), bevel=0.025)
    m.box('oscuro', (0.36, 0.02, 0.1), (0, -0.425, 0.12), bevel=0.005)
    for k in range(6):
        m.box('negro', (0.012, 0.024, 0.07), (-0.125 + k * 0.05, -0.437, 0.135), bevel=0.0)
    for sx in (-1, 1):
        m.box('luz', (0.06, 0.02, 0.04), (sx * 0.19, -0.428, 0.2), bevel=0.006)
        m.box('luz', (0.03, 0.02, 0.02), (sx * 0.12, -0.428, 0.25), bevel=0.004)
    m.box('negro', (0.46, 0.04, 0.05), (0, -0.44, 0.07), bevel=0.01)
    m.box('EQUIPO', (0.48, 0.42, 0.16), (0, 0.11, 0.22), bevel=0.03)
    m.box('luz', (0.42, 0.02, 0.1), (0, -0.1, 0.25), rot=(-0.28, 0, 0), bevel=0.005)
    m.box('oscuro', (0.03, 0.02, 0.11), (0, -0.103, 0.25), rot=(-0.28, 0, 0), bevel=0.0)
    for sx in (-1, 1):
        m.box('luz', (0.012, 0.13, 0.08), (sx * 0.242, 0.0, 0.27), bevel=0.003)
        m.box('luz', (0.012, 0.12, 0.08), (sx * 0.242, 0.2, 0.27), bevel=0.003)
    m.box('EQUIPO_OSC', (0.46, 0.44, 0.03), (0, 0.11, 0.38), bevel=0.01)
    m.box('EQUIPO_OSC', (0.46, 0.14, 0.13), (0, 0.38, 0.19), bevel=0.02)
    m.box('oscuro', (0.1, 0.03, 0.08), (0.15, 0.455, 0.22), bevel=0.01)
    # Torreta con artillero (gira hacia el enemigo).
    m.pivot('turret', 0, 0.12, 0.41)
    m.cyl('oscuro', 0.12, 0.035, (0, 0.12, 0.41), seg=16, part='turret')
    m.box('EQUIPO_OSC', (0.22, 0.02, 0.06), (0, 0.02, 0.44), bevel=0.006, part='turret')
    for sx in (-1, 1):
        m.box('EQUIPO_OSC', (0.02, 0.1, 0.06), (sx * 0.11, 0.07, 0.44), bevel=0.006, part='turret')
    m.box('oliva_osc', (0.13, 0.09, 0.11), (0, 0.13, 0.43), bevel=0.02, part='turret')
    m.box('piel', (0.085, 0.08, 0.085), (0, 0.13, 0.54), bevel=0.02, part='turret')
    m.sphere('oliva', 0.056, (0, 0.13, 0.62), scale=(1, 1.05, 0.65), part='turret')
    m.cyl('oliva', 0.058, 0.02, (0, 0.13, 0.6), seg=14, part='turret')
    for sx in (-1, 1):
        m.beam('oliva_osc', (sx * 0.07, 0.12, 0.52), (sx * 0.03, 0.02, 0.5), t=0.035, part='turret')
    m.cyl('oscuro', 0.012, 0.06, (0, 0.03, 0.46), seg=8, part='turret')
    m.box('negro', (0.04, 0.16, 0.045), (0, -0.02, 0.5), bevel=0.008, part='turret')
    m.box('oliva_osc', (0.05, 0.05, 0.05), (0.04, 0.03, 0.49), bevel=0.008, part='turret')
    m.tube('metal', (0, -0.1, 0.523), (0, -0.28, 0.523), r=0.009, part='turret')
    return m


def tank():
    m = Model('tank')
    tracks(m, 0.27, 0.92, 6, 0.05)
    for sx in (-1, 1):
        m.box('EQUIPO_OSC', (0.03, 0.8, 0.09), (sx * 0.345, 0.0, 0.08), bevel=0.01)
        m.box('oliva', (0.16, 0.88, 0.03), (sx * 0.27, 0, 0.17), bevel=0.01)
    m.box('oliva', (0.48, 0.84, 0.16), (0, 0.02, 0.09), bevel=0.04)
    m.box('oliva_osc', (0.46, 0.2, 0.1), (0, -0.39, 0.12), rot=(0.55, 0, 0), bevel=0.03)
    for sx in (-1, 1):
        m.box('luz', (0.05, 0.02, 0.025), (sx * 0.17, -0.47, 0.18), bevel=0.004)
    m.box('EQUIPO', (0.5, 0.18, 0.025), (0, 0.29, 0.25), bevel=0.008)
    m.box('oscuro', (0.22, 0.12, 0.06), (0, 0.35, 0.25), bevel=0.015)
    m.pivot('turret', 0, 0.04, 0.25)
    m.box('EQUIPO', (0.36, 0.44, 0.13), (0, 0.07, 0.25), bevel=0.05, part='turret')
    m.box('EQUIPO_OSC', (0.3, 0.14, 0.1), (0, -0.16, 0.26), rot=(0.25, 0, 0), bevel=0.03, part='turret')
    m.box('oscuro', (0.38, 0.12, 0.08), (0, 0.27, 0.26), bevel=0.02, part='turret')
    m.cyl('oscuro', 0.035, 0.6, (0, -0.47, 0.31), rot=(H, 0, 0), seg=12, base=False, part='turret')
    m.cyl('oscuro', 0.045, 0.08, (0, -0.74, 0.31), rot=(H, 0, 0), seg=12, base=False, part='turret')
    m.cyl('oliva_osc', 0.06, 0.04, (0.09, 0.12, 0.38), seg=14, part='turret')
    m.box('luz', (0.05, 0.02, 0.025), (-0.1, -0.1, 0.36), bevel=0.004, part='turret')
    for sx in (-1, 1):
        m.tube('negro', (sx * 0.13, 0.25, 0.38), (sx * 0.15, 0.3, 0.85), r=0.006, seg=6, part='turret')
    return m


def arty():
    """Lanzamisiles sobre orugas: cabina adelante y caja lanzadora que gira."""
    m = Model('arty')
    tracks(m, 0.24, 0.94, 6, 0.046)
    m.box('oliva_osc', (0.4, 0.92, 0.1), (0, 0, 0.12), bevel=0.02)
    m.box('EQUIPO', (0.42, 0.26, 0.2), (0, -0.33, 0.2), bevel=0.04)
    m.box('vidrio', (0.36, 0.02, 0.08), (0, -0.462, 0.31), rot=(-0.2, 0, 0), bevel=0.005)
    m.box('oscuro', (0.3, 0.02, 0.07), (0, -0.462, 0.225), bevel=0.005)
    for k in range(4):
        m.box('luz', (0.24, 0.012, 0.008), (0, -0.473, 0.205 + k * 0.016), bevel=0.0)
    for sx in (-1, 1):
        m.box('luz', (0.04, 0.02, 0.03), (sx * 0.17, -0.462, 0.27), bevel=0.004)
    m.pivot('turret', 0, 0.16, 0.22)
    m.box('oliva_osc', (0.3, 0.32, 0.06), (0, 0.16, 0.22), bevel=0.02, part='turret')
    th = -0.38
    m.box('EQUIPO', (0.38, 0.5, 0.22), (0, 0.13, 0.27), rot=(th, 0, 0), bevel=0.03, part='turret')
    launcher_face(m, 0, 0.13, 0.38, 0.25, th, 3, 2, 0.11, 0.09, 'turret')
    for sx in (-1, 1):
        m.beam('oscuro', (sx * 0.12, 0.3, 0.25), (sx * 0.12, 0.28, 0.42), t=0.03, part='turret')
    return m


# ---------------------------------------------------------------------
# Barcos
# ---------------------------------------------------------------------
def speedboat():
    """Bote neumático rápido con consola, asientos, arco trasero y ametralladora en proa."""
    m = Model('speedboat')
    m.hull('oscuro', [(0.42, 0.16, 0.1, -0.04, 0.08), (0.1, 0.17, 0.1, -0.06, 0.08), (-0.2, 0.15, 0.06, -0.05, 0.09),
                      (-0.42, 0.06, 0.02, -0.01, 0.1), (-0.5, 0.01, 0.01, 0.04, 0.1)])
    pts = [(0.2, 0.44), (0.2, 0.1), (0.18, -0.2), (0.1, -0.42), (0.0, -0.53)]
    for sx in (-1, 1):
        for (x1, y1), (x2, y2) in zip(pts, pts[1:]):
            m.tube('gris', (sx * x1, y1, 0.1), (sx * x2, y2, 0.11), r=0.062, seg=12)
        m.sphere('gris', 0.062, (sx * 0.2, 0.44, 0.1))
        m.tube('EQUIPO', (sx * 0.21, 0.42, 0.158), (sx * 0.2, -0.18, 0.165), r=0.013, seg=8)
    m.box('concreto', (0.3, 0.8, 0.012), (0, 0.0, 0.08), bevel=0.0)
    m.box('blanco_sucio', (0.16, 0.12, 0.12), (0, 0.0, 0.09), bevel=0.02)
    m.box('vidrio', (0.15, 0.012, 0.07), (0, -0.066, 0.2), rot=(-0.5, 0, 0), bevel=0.003)
    for (x, y) in [(-0.07, 0.16), (0.07, 0.16), (0, 0.3)]:
        m.box('EQUIPO', (0.1, 0.1, 0.07), (x, y, 0.09), bevel=0.02)
    for sx in (-1, 1):
        m.tube('metal_claro', (sx * 0.15, 0.36, 0.1), (sx * 0.13, 0.32, 0.42), r=0.012, seg=8)
    m.tube('metal_claro', (-0.13, 0.32, 0.42), (0.13, 0.32, 0.42), r=0.012, seg=8)
    m.tube('metal_claro', (0, 0.32, 0.42), (0, 0.32, 0.55), r=0.006, seg=6)
    m.sphere('luz', 0.018, (0, 0.32, 0.56))
    m.box('negro', (0.08, 0.08, 0.12), (0, 0.5, 0.05), bevel=0.02)
    m.box('negro', (0.03, 0.03, 0.12), (0, 0.5, -0.06), bevel=0.0)
    m.cyl('oscuro', 0.02, 0.06, (0, -0.25, 0.09), seg=8)
    m.box('negro', (0.035, 0.12, 0.04), (0, -0.27, 0.15), bevel=0.008)
    m.tube('metal', (0, -0.33, 0.17), (0, -0.46, 0.17), r=0.008, seg=6)
    return m


def boat_engineer():
    """Barco constructor tipo buque de apoyo: puente adelante, cubierta larga y grúa."""
    m = Model('boatEng')
    m.hull('amarillo', [(0.56, 0.24, 0.18, -0.05, 0.12), (0.0, 0.25, 0.18, -0.07, 0.13), (-0.34, 0.22, 0.12, -0.06, 0.15),
                        (-0.58, 0.05, 0.02, 0.0, 0.2)])
    for sx in (-1, 1):
        m.box('EQUIPO', (0.012, 1.0, 0.035), (sx * 0.25, 0.0, 0.08), rot=(0, 0, sx * 0.04), bevel=0.0)
    m.box('concreto', (0.46, 0.62, 0.012), (0, 0.22, 0.125), bevel=0.0)
    m.box('amarillo', (0.42, 0.3, 0.16), (0, -0.26, 0.13), bevel=0.03)
    m.box('amarillo', (0.36, 0.24, 0.12), (0, -0.25, 0.29), bevel=0.03)
    m.box('luz', (0.34, 0.012, 0.05), (0, -0.372, 0.33), bevel=0.003)
    m.box('luz', (0.38, 0.012, 0.04), (0, -0.412, 0.2), bevel=0.003)
    for sx in (-1, 1):
        m.box('luz', (0.012, 0.18, 0.04), (sx * 0.182, -0.25, 0.34), bevel=0.003)
    m.box('EQUIPO', (0.38, 0.26, 0.025), (0, -0.25, 0.41), bevel=0.008)
    m.tube('blanco', (0, -0.22, 0.43), (0, -0.22, 0.66), r=0.012, seg=8)
    m.box('blanco', (0.16, 0.02, 0.02), (0, -0.22, 0.58), bevel=0.0)
    m.sphere('blanco', 0.032, (0.1, -0.18, 0.46))
    m.sphere('blanco', 0.026, (-0.1, -0.18, 0.46))
    m.cyl('naranja', 0.05, 0.1, (0.13, 0.08, 0.13), seg=12)
    m.tube('naranja', (0.13, 0.08, 0.23), (0.13, 0.46, 0.58), r=0.022, seg=8)
    m.tube('oscuro', (0.13, 0.46, 0.58), (0.13, 0.46, 0.33), r=0.004, seg=6)
    m.box('metal', (0.05, 0.05, 0.04), (0.13, 0.46, 0.29), bevel=0.008)
    for (x, y, mat) in [(-0.12, 0.13, 'EQUIPO_OSC'), (-0.12, 0.31, 'blanco_sucio'), (0.0, 0.43, 'EQUIPO')]:
        m.box(mat, (0.12, 0.15, 0.09), (x, y, 0.13), bevel=0.01)
    return m


def barge():
    """Barcaza tipo aerodeslizador: faldón de goma, rampa adelante y dos hélices grandes atrás."""
    m = Model('barge')
    m.box('goma', (0.8, 1.32, 0.12), (0, 0, -0.04), bevel=0.06)
    m.box('gris', (0.72, 1.22, 0.08), (0, 0, 0.06), bevel=0.03)
    m.box('oscuro', (0.5, 0.86, 0.012), (0, -0.06, 0.14), bevel=0.0)
    for k in range(4):
        m.box('amarillo', (0.44, 0.03, 0.004), (0, -0.4 + k * 0.22, 0.152), bevel=0.0)
    for sx in (-1, 1):
        m.box('gris', (0.09, 1.1, 0.13), (sx * 0.31, -0.02, 0.14), bevel=0.02)
        m.box('EQUIPO', (0.095, 1.0, 0.03), (sx * 0.31, -0.02, 0.25), bevel=0.006)
        for k in range(3):
            m.box('luz', (0.012, 0.05, 0.02), (sx * 0.357, -0.4 + k * 0.35, 0.2), bevel=0.0)
    m.box('gris', (0.5, 0.06, 0.13), (0, -0.62, 0.11), rot=(0.45, 0, 0), bevel=0.01)
    m.box('blanco_sucio', (0.15, 0.22, 0.15), (0.29, -0.2, 0.27), bevel=0.02)
    m.box('luz', (0.13, 0.012, 0.04), (0.29, -0.312, 0.36), bevel=0.0)
    m.box('EQUIPO', (0.16, 0.23, 0.02), (0.29, -0.2, 0.42), bevel=0.005)
    for sx in (-1, 1):
        x, y, z = sx * 0.18, 0.52, 0.38
        m.cyl('gris', 0.16, 0.09, (x, y, z), rot=(H, 0, 0), seg=22, base=False)
        m.cyl('oscuro', 0.13, 0.095, (x, y, z), rot=(H, 0, 0), seg=22, base=False)
        for k in range(3):
            a = k * PI / 3
            m.beam('metal_claro', (x + math.cos(a) * 0.12, y - 0.05, z + math.sin(a) * 0.12),
                   (x - math.cos(a) * 0.12, y - 0.05, z - math.sin(a) * 0.12), t=0.025)
        m.cyl('metal', 0.03, 0.03, (x, y - 0.06, z), rot=(H, 0, 0), seg=10, base=False)
        m.beam('gris', (x, y, 0.14), (x, y, z - 0.15), t=0.04)
        m.box('EQUIPO_OSC', (0.015, 0.08, 0.2), (x, y + 0.1, 0.24), bevel=0.0)
    return m


def destroyer():
    m = Model('destroyer')
    m.hull('gris', [(0.88, 0.22, 0.15, -0.06, 0.15), (0.4, 0.26, 0.17, -0.09, 0.16), (-0.3, 0.25, 0.14, -0.09, 0.17),
                    (-0.7, 0.14, 0.05, -0.05, 0.19), (-0.98, 0.015, 0.01, 0.04, 0.23)])
    for sx in (-1, 1):
        m.box('EQUIPO', (0.012, 1.4, 0.03), (sx * 0.245, -0.03, 0.12), rot=(0, 0, sx * 0.05), bevel=0.0)
    m.box('metal_claro', (0.44, 1.5, 0.015), (0, -0.05, 0.16), bevel=0.0)
    m.box('gris', (0.34, 0.54, 0.14), (0, 0.12, 0.17), bevel=0.02)
    m.box('metal_claro', (0.28, 0.36, 0.14), (0, 0.04, 0.31), bevel=0.02)
    m.box('gris', (0.22, 0.2, 0.1), (0, -0.0, 0.45), bevel=0.02)
    m.box('luz', (0.24, 0.012, 0.03), (0, -0.142, 0.39), bevel=0.0)
    for sx in (-1, 1):
        m.box('luz', (0.012, 0.28, 0.02), (sx * 0.172, 0.08, 0.27), bevel=0.0)
        m.box('oscuro', (0.012, 0.12, 0.1), (sx * 0.142, -0.06, 0.34), rot=(0, sx * 0.25, 0), bevel=0.0)
    base, top = 0.55, 0.98
    for (x, y) in [(-0.06, -0.06), (0.06, -0.06), (0.06, 0.06), (-0.06, 0.06)]:
        m.beam('oscuro', (x, y + 0.0, base), (x * 0.25, y * 0.25, top), t=0.014)
    for z in (0.66, 0.78, 0.88):
        k = 1 - (z - base) / (top - base) * 0.75
        m.box('oscuro', (0.12 * k + 0.014, 0.012, 0.012), (0, -0.06 * k, z), bevel=0.0)
        m.box('oscuro', (0.12 * k + 0.014, 0.012, 0.012), (0, 0.06 * k, z), bevel=0.0)
    m.box('oscuro', (0.24, 0.012, 0.012), (0, 0, 0.84), bevel=0.0)
    m.sphere('blanco', 0.04, (0, 0, 1.01))
    m.box('gris', (0.14, 0.16, 0.18), (0, 0.36, 0.31), bevel=0.03)
    m.box('negro', (0.12, 0.14, 0.02), (0, 0.36, 0.49), bevel=0.0)
    m.cyl('blanco', 0.04, 0.06, (0, 0.5, 0.31), seg=12)
    m.sphere('blanco', 0.04, (0, 0.5, 0.37))
    for ix in range(4):
        for iy in range(2):
            m.box('oscuro', (0.05, 0.05, 0.012), (-0.09 + ix * 0.06, -0.22 + iy * 0.06, 0.163), bevel=0.0)
    m.box('oscuro', (0.36, 0.28, 0.01), (0, 0.62, 0.162), bevel=0.0)
    m.box('blanco', (0.03, 0.14, 0.004), (-0.05, 0.62, 0.17), bevel=0.0)
    m.box('blanco', (0.03, 0.14, 0.004), (0.05, 0.62, 0.17), bevel=0.0)
    m.box('blanco', (0.1, 0.03, 0.004), (0, 0.62, 0.17), bevel=0.0)
    m.pivot('turret', 0, -0.46, 0.17)
    m.cyl('gris', 0.1, 0.04, (0, -0.46, 0.17), seg=16, part='turret')
    m.box('metal_claro', (0.18, 0.2, 0.1), (0, -0.47, 0.2), bevel=0.05, part='turret')
    m.box('metal_claro', (0.14, 0.08, 0.08), (0, -0.58, 0.2), rot=(0.4, 0, 0), bevel=0.02, part='turret')
    m.tube('oscuro', (0, -0.6, 0.26), (0, -0.92, 0.27), r=0.022, seg=10, part='turret')
    return m


# ---------------------------------------------------------------------
# Helicóptero
# ---------------------------------------------------------------------
def helicopter():
    """Helicóptero con cabina grande, patines y una minigun en cada ala corta."""
    m = Model('heli')
    m.box('EQUIPO', (0.27, 0.5, 0.24), (0, 0.03, 0.1), bevel=0.08)
    m.sphere('vidrio', 0.155, (0, -0.21, 0.23), scale=(0.92, 1.05, 0.9))
    m.box('EQUIPO_OSC', (0.2, 0.22, 0.08), (0, 0.06, 0.33), bevel=0.03)
    m.box('oscuro', (0.06, 0.08, 0.04), (0.08, 0.13, 0.4), bevel=0.01)
    m.tube('EQUIPO_OSC', (0, 0.26, 0.24), (0, 0.84, 0.3), r=0.045, r2=0.024, seg=10)
    m.box('EQUIPO_OSC', (0.02, 0.14, 0.18), (0, 0.82, 0.34), rot=(0.3, 0, 0), bevel=0.01)
    m.box('EQUIPO_OSC', (0.22, 0.06, 0.015), (0, 0.76, 0.29), bevel=0.005)
    m.cyl('oscuro', 0.07, 0.01, (0.03, 0.86, 0.35), rot=(0, H, 0), seg=14, base=False)
    for sx in (-1, 1):
        m.tube('oscuro', (sx * 0.17, -0.3, 0.0), (sx * 0.17, 0.3, 0.0), r=0.015, seg=8)
        m.tube('oscuro', (sx * 0.17, -0.3, 0.0), (sx * 0.17, -0.36, 0.05), r=0.015, seg=8)
        m.tube('oscuro', (sx * 0.17, -0.13, 0.0), (sx * 0.1, -0.12, 0.11), r=0.01, seg=6)
        m.tube('oscuro', (sx * 0.17, 0.16, 0.0), (sx * 0.1, 0.15, 0.11), r=0.01, seg=6)
        m.box('oliva_osc', (0.16, 0.07, 0.02), (sx * 0.2, 0.03, 0.19), bevel=0.006)
        x, y, z = sx * 0.29, 0.03, 0.16
        m.cyl('oscuro', 0.036, 0.1, (x, y + 0.02, z), rot=(H, 0, 0), seg=10, base=False)
        for k in range(6):
            a = k * PI / 3
            m.tube('negro', (x + math.cos(a) * 0.018, y - 0.03, z + math.sin(a) * 0.018),
                   (x + math.cos(a) * 0.018, y - 0.22, z + math.sin(a) * 0.018), r=0.006, seg=6)
        m.cyl('metal', 0.03, 0.015, (x, y - 0.2, z), rot=(H, 0, 0), seg=10, base=False)
        # v0.9: lleva el equipo del Apache viejo: cohetes bajo el ala y un artillero en cada puerta.
        m.cyl('oliva_osc', 0.034, 0.17, (sx * 0.2, 0.06, 0.135), rot=(H, 0, 0), seg=10, base=False)
        for k in range(3):
            a = k * 2 * PI / 3 + PI / 6
            m.cyl('blanco', 0.01, 0.01, (sx * 0.2 + math.cos(a) * 0.017, -0.03, 0.135 + math.sin(a) * 0.017),
                  rot=(H, 0, 0), seg=6, base=False)
        m.box('negro', (0.012, 0.16, 0.13), (sx * 0.136, 0.08, 0.13), bevel=0.0)
        m.box('oliva', (0.06, 0.06, 0.08), (sx * 0.1, 0.08, 0.14), bevel=0.015)
        m.sphere('oliva', 0.032, (sx * 0.1, 0.08, 0.21), scale=(1, 1, 0.85))
        m.box('piel', (0.03, 0.02, 0.025), (sx * 0.112, 0.06, 0.19), bevel=0.005)
        m.tube('negro', (sx * 0.11, 0.06, 0.16), (sx * 0.22, 0.0, 0.13), r=0.008, seg=6)
        m.box('oscuro', (0.03, 0.05, 0.03), (sx * 0.13, 0.06, 0.155), bevel=0.005)
    m.box('luz', (0.03, 0.02, 0.02), (0, -0.36, 0.08), bevel=0.004)
    m.cyl('oscuro', 0.035, 0.06, (0, 0.05, 0.41), seg=10)
    m.pivot('rotor', 0, 0.05, 0.48)
    m.cyl('oscuro', 0.045, 0.04, (0, 0.05, 0.47), seg=12, part='rotor')
    m.box('oscuro', (1.34, 0.07, 0.012), (0, 0.05, 0.48), bevel=0.004, part='rotor')
    m.box('oscuro', (0.07, 1.0, 0.012), (0, 0.05, 0.482), bevel=0.004, part='rotor')
    return m


# ---------------------------------------------------------------------
# Edificios
# ---------------------------------------------------------------------
def crystal(m, z, size=0.2):
    m.pivot('crystal', 0, 0, z)
    m.cone('EQUIPO', size, size * 1.35, (0, 0, z), seg=4, part='crystal')
    m.cone('EQUIPO', size, size * 1.35, (0, 0, z), rot=(PI, 0, 0), seg=4, part='crystal')


def core(level):
    """Núcleo: fortaleza hexagonal con muros, torres y el cristal ámbar en el centro."""
    m = Model(f'core_{level}')
    m.hexprism('oscuro', 0.98, 0.12)
    m.hexprism('piedra', 0.92, 0.08, (0, 0, 0.12))
    wall_h = (0.16, 0.22, 0.28)[level - 1]
    rw = 0.76
    z0 = 0.2
    cs = [(math.cos(PI / 6 + k * PI / 3) * rw, math.sin(PI / 6 + k * PI / 3) * rw) for k in range(6)]
    for k in range(6):
        (x1, y1), (x2, y2) = cs[k], cs[(k + 1) % 6]
        ang = math.atan2(y2 - y1, x2 - x1)
        gate = k in (3, 4)
        pieces = [(0.0, 0.36), (0.64, 1.0)] if gate else [(0.0, 1.0)]
        for (a, b) in pieces:
            px1, py1 = x1 + (x2 - x1) * a, y1 + (y2 - y1) * a
            px2, py2 = x1 + (x2 - x1) * b, y1 + (y2 - y1) * b
            ln = math.hypot(px2 - px1, py2 - py1)
            cx, cy = (px1 + px2) / 2, (py1 + py2) / 2
            m.box('piedra_clara', (ln, 0.08, wall_h), (cx, cy, z0), rot=(0, 0, ang), bevel=0.012)
            m.box('EQUIPO', (ln, 0.086, 0.03), (cx, cy, z0 + wall_h * 0.45), rot=(0, 0, ang), bevel=0.004)
            n = max(1, int(ln / 0.09))
            for i in range(n):
                t = (i + 0.5) / n
                mx, my = px1 + (px2 - px1) * t, py1 + (py2 - py1) * t
                if i % 2 == 0:
                    m.box('piedra_clara', (0.045, 0.085, 0.04), (mx, my, z0 + wall_h), rot=(0, 0, ang), bevel=0.006)
        if level == 3:
            m.box('oro', (math.hypot(x2 - x1, y2 - y1) * 0.98, 0.09, 0.015), ((x1 + x2) / 2, (y1 + y2) / 2, z0 + wall_h - 0.015),
                  rot=(0, 0, ang), bevel=0.0)
    towers = [0, 2, 4] if level == 1 else range(6)
    th = (0.32, 0.4, 0.52)[level - 1]
    for k in towers:
        x, y = cs[k]
        m.cyl('piedra_clara', 0.12, th, (x, y, z0), seg=6, smooth=False)
        m.cyl('oscuro', 0.135, 0.04, (x, y, z0 + th), seg=6, smooth=False)
        if level == 3:
            m.cone('EQUIPO', 0.15, 0.2, (x, y, z0 + th + 0.04), seg=6)
        else:
            for j in range(3):
                a = j * 2 * PI / 3
                m.box('piedra_clara', (0.05, 0.05, 0.05), (x + math.cos(a) * 0.09, y + math.sin(a) * 0.09, z0 + th + 0.04), bevel=0.006)
        m.box('luz', (0.03, 0.012, 0.05), (x, y - 0.118, z0 + th * 0.6), bevel=0.0)
    m.hexprism('oscuro', 0.44, 0.1, (0, 0, z0))
    m.cyl('luz', 0.32, 0.012, (0, 0, z0 + 0.1), seg=6, smooth=False)
    ped = (0.32, 0.55, 0.8)[level - 1]
    m.cyl('EQUIPO_OSC', 0.2, ped, (0, 0, z0 + 0.11), seg=6, r2=0.14, smooth=False)
    if level >= 2:
        for k in range(3):
            a = k * 2 * PI / 3 + PI / 6
            m.beam('piedra_clara', (math.cos(a) * 0.3, math.sin(a) * 0.3, z0 + 0.1), (math.cos(a) * 0.12, math.sin(a) * 0.12, z0 + ped * 0.8), t=0.06)
    if level == 3:
        m.cyl('oro', 0.18, 0.04, (0, 0, z0 + ped * 0.55), seg=6, smooth=False)
        m.cyl('oro', 0.16, 0.04, (0, 0, z0 + ped + 0.06), seg=6, smooth=False)
    # v0.9: banderas del imperio en las torres y portón en la entrada.
    for k in towers:
        x, y = cs[k]
        zt = z0 + th + (0.24 if level == 3 else 0.09)
        m.beam('metal', (x, y, zt - 0.06), (x, y, zt + 0.16), t=0.012)
        m.box('EQUIPO', (0.01, 0.11, 0.065), (x, y + 0.058, zt + 0.12), bevel=0.0)
    (gx1, gy1), (gx2, gy2) = cs[3], cs[4]
    gang = math.atan2(gy2 - gy1, gx2 - gx1)
    m.box('madera', (0.2, 0.03, wall_h * 0.85), ((gx1 + gx2) / 2, (gy1 + gy2) / 2, z0), rot=(0, 0, gang), bevel=0.006)
    m.box('metal', (0.21, 0.035, 0.018), ((gx1 + gx2) / 2, (gy1 + gy2) / 2, z0 + wall_h * 0.6), rot=(0, 0, gang), bevel=0.0)
    size = (0.2, 0.24, 0.28)[level - 1]
    crystal(m, z0 + ped + 0.11 + size * 1.35, size)
    return m


def farm():
    """Granja: establo rojo, silo y parcelas de trigo dentro de una cerca."""
    m = Model('farm')
    m.box('tierra', (1.2, 0.92, 0.04), (0.08, 0.12, 0), bevel=0.01)
    for k in range(4):
        m.box('trigo', (0.86, 0.12, 0.08), (0.14, -0.15 + k * 0.19, 0.04), bevel=0.035)
    x1, x2, y1, y2 = -0.36, 0.64, -0.3, 0.6
    posts = []
    for i in range(7):
        posts.append((x1 + (x2 - x1) * i / 6, y1))
        posts.append((x1 + (x2 - x1) * i / 6, y2))
    for i in range(1, 5):
        posts.append((x2, y1 + (y2 - y1) * i / 5))
        posts.append((x1, y1 + (y2 - y1) * i / 5))
    for (x, y) in posts:
        m.box('madera', (0.025, 0.025, 0.13), (x, y, 0.0), bevel=0.0)
    for z in (0.06, 0.11):
        m.beam('madera_clara', (x1, y1, z), (x2, y1, z), t=0.015)
        m.beam('madera_clara', (x1, y2, z), (x2, y2, z), t=0.015)
        m.beam('madera_clara', (x2, y1, z), (x2, y2, z), t=0.015)
        m.beam('madera_clara', (x1, y1 + 0.2, z), (x1, y2, z), t=0.015)
    m.box('rojo', (0.4, 0.44, 0.3), (-0.5, -0.42, 0), bevel=0.02)
    m.wedge('EQUIPO', (0.46, 0.5, 0.2), (-0.5, -0.42, 0.3), rot=(0, 0, H))
    m.box('blanco', (0.16, 0.012, 0.2), (-0.5, -0.642, 0.0), bevel=0.003)
    m.box('oscuro', (0.12, 0.014, 0.17), (-0.5, -0.645, 0.0), bevel=0.003)
    for sx in (-1, 1):
        m.box('luz', (0.06, 0.012, 0.06), (-0.5 + sx * 0.13, -0.642, 0.15), bevel=0.002)
    m.box('ladrillo', (0.06, 0.06, 0.14), (-0.42, -0.32, 0.38), bevel=0.006)
    m.cyl('blanco', 0.11, 0.55, (-0.12, -0.54, 0), seg=14)
    m.cone('EQUIPO_OSC', 0.12, 0.14, (-0.12, -0.54, 0.55), seg=14, smooth=True)
    m.box('trigo', (0.12, 0.08, 0.08), (-0.25, -0.2, 0.0), bevel=0.02)
    return m


def mine():
    """Mina de oro: rocas, entrada de madera iluminada, rieles y vagoneta con oro."""
    m = Model('mine')
    m.ico('piedra', 0.6, (0.06, 0.2, 0.1), scale=(1.15, 0.9, 0.75), sub=1)
    m.ico('piedra_clara', 0.3, (-0.42, 0.3, 0.05), scale=(1, 1, 0.85), sub=1)
    m.ico('piedra', 0.24, (0.48, -0.05, 0.04), scale=(1, 1, 0.8), sub=1)
    m.box('negro', (0.32, 0.2, 0.3), (0.0, -0.36, 0.0), bevel=0.02)
    m.box('luz', (0.2, 0.012, 0.2), (0.0, -0.463, 0.03), bevel=0.0)
    m.box('madera', (0.05, 0.05, 0.36), (-0.18, -0.47, 0.0), bevel=0.01)
    m.box('madera', (0.05, 0.05, 0.36), (0.18, -0.47, 0.0), bevel=0.01)
    m.box('madera', (0.46, 0.07, 0.07), (0.0, -0.47, 0.33), bevel=0.01)
    for sx in (-1, 1):
        m.beam('metal', (sx * 0.06, -0.47, 0.012), (sx * 0.06, -0.92, 0.012), t=0.015)
    for k in range(5):
        m.box('madera', (0.18, 0.03, 0.012), (0, -0.5 - k * 0.1, 0.0), bevel=0.0)
    m.box('metal', (0.17, 0.22, 0.1), (0, -0.74, 0.04), bevel=0.02)
    for sx in (-1, 1):
        for y in (-0.67, -0.81):
            m.cyl('oscuro', 0.025, 0.02, (sx * 0.08, y, 0.03), rot=(0, H, 0), seg=10, base=False)
    for k, (x, y) in enumerate([(-0.04, -0.76), (0.04, -0.72), (0.0, -0.8), (0.02, -0.74)]):
        m.ico('oro', 0.045, (x, y, 0.15 + (k % 2) * 0.02), sub=0)
    for (x, y, z) in [(0.3, 0.22, 0.42), (-0.1, 0.36, 0.5), (0.42, -0.05, 0.22), (-0.38, 0.22, 0.28)]:
        m.ico('oro', 0.06, (x, y, z), sub=0)
    m.tube('oscuro', (0.3, -0.48, 0.0), (0.3, -0.48, 0.38), r=0.012, seg=6)
    m.sphere('luz', 0.03, (0.3, -0.48, 0.4))
    return m


def rig():
    """Plataforma petrolera: patas, torre de perforación, grúas, helipuerto y módulo de vivienda."""
    m = Model('rig')
    legs = [(-0.42, -0.42), (0.42, -0.42), (-0.42, 0.42), (0.42, 0.42)]
    for (x, y) in legs:
        m.cyl('amarillo', 0.08, 0.76, (x, y, -0.36), seg=14)
        m.cyl('blanco', 0.083, 0.05, (x, y, 0.0), seg=14)
    for i in range(4):
        (xa, ya), (xb, yb) = legs[[0, 1, 3, 2][i]], legs[[1, 3, 2, 0][i]]
        m.beam('metal', (xa, ya, 0.12), (xb, yb, 0.12), t=0.03)
        m.beam('metal', (xa, ya, -0.1), (xb, yb, 0.3), t=0.02)
    m.box('metal', (1.18, 1.18, 0.1), (0, 0, 0.38), bevel=0.03)
    m.box('oscuro', (1.2, 1.2, 0.03), (0, 0, 0.36), bevel=0.0)
    bx, by, bz, top = -0.22, -0.18, 0.48, 1.42
    base = [(bx - 0.15, by - 0.15), (bx + 0.15, by - 0.15), (bx + 0.15, by + 0.15), (bx - 0.15, by + 0.15)]
    m.box('oscuro', (0.38, 0.38, 0.06), (bx, by, bz), bevel=0.01)
    for (x, y) in base:
        m.beam('metal_claro', (x, y, bz + 0.06), (bx + (x - bx) * 0.2, by + (y - by) * 0.2, top), t=0.024)
    for z in (0.75, 1.0, 1.22):
        k = 1 - (z - bz) / (top - bz) * 0.8
        pts = [(bx + (x - bx) * k, by + (y - by) * k) for (x, y) in base]
        for i in range(4):
            (xa, ya), (xb, yb) = pts[i], pts[(i + 1) % 4]
            m.beam('metal_claro', (xa, ya, z), (xb, yb, z), t=0.014)
    m.box('EQUIPO', (0.1, 0.1, 0.06), (bx, by, top), bevel=0.01)
    m.box('EQUIPO', (0.42, 0.34, 0.26), (0.28, 0.3, 0.48), bevel=0.03)
    for z in (0.56, 0.66):
        m.box('luz', (0.38, 0.012, 0.03), (0.28, 0.128, z), bevel=0.0)
    m.cyl('oscuro', 0.21, 0.025, (0.28, 0.3, 0.74), seg=20)
    m.box('blanco', (0.025, 0.14, 0.006), (0.23, 0.3, 0.765), bevel=0.0)
    m.box('blanco', (0.025, 0.14, 0.006), (0.33, 0.3, 0.765), bevel=0.0)
    m.box('blanco', (0.1, 0.025, 0.006), (0.28, 0.3, 0.765), bevel=0.0)
    for (px, py, ex, ey) in [(0.46, -0.4, 0.8, -0.7), (-0.46, 0.42, -0.78, 0.72)]:
        m.cyl('amarillo', 0.05, 0.22, (px, py, 0.48), seg=12)
        m.tube('amarillo', (px, py, 0.68), (ex, ey, 1.0), r=0.02, seg=8)
        m.tube('oscuro', (ex, ey, 1.0), (ex, ey, 0.62), r=0.004, seg=6)
        m.box('metal', (0.05, 0.05, 0.04), (ex, ey, 0.58), bevel=0.008)
    for (x, y, mat) in [(0.25, -0.38, 'EQUIPO_OSC'), (0.25, -0.22, 'blanco_sucio'), (-0.4, 0.15, 'EQUIPO')]:
        m.box(mat, (0.14, 0.12, 0.1), (x, y, 0.48), bevel=0.01)
    m.tube('metal', (0.55, 0.0, 0.5), (0.85, 0.0, 0.72), r=0.015, seg=6)
    m.cone('naranja', 0.04, 0.12, (0.86, 0.0, 0.72), seg=8)
    return m


def helipad():
    """Helipuerto redondo con la H, anillo amarillo, marcas y baranda."""
    m = Model('helipad')
    m.cyl('concreto', 0.88, 0.06, (0, 0, 0), seg=32)
    m.cyl('EQUIPO', 0.82, 0.055, (0, 0, 0.06), seg=32)
    m.cyl('oscuro', 0.75, 0.06, (0, 0, 0.06), seg=32)
    m.cyl('amarillo', 0.44, 0.008, (0, 0, 0.12), seg=32)
    m.cyl('oscuro', 0.37, 0.01, (0, 0, 0.12), seg=32)
    m.box('blanco', (0.06, 0.34, 0.006), (-0.11, 0, 0.13), bevel=0.0)
    m.box('blanco', (0.06, 0.34, 0.006), (0.11, 0, 0.13), bevel=0.0)
    m.box('blanco', (0.2, 0.06, 0.006), (0, 0, 0.13), bevel=0.0)
    for k in range(10):
        a = k * PI / 5 + 0.2
        m.box('blanco', (0.16, 0.03, 0.006), (math.cos(a) * 0.58, math.sin(a) * 0.58, 0.12), rot=(0, 0, a + H), bevel=0.0)
    n = 16
    pts = [(math.cos(k * 2 * PI / n) * 0.85, math.sin(k * 2 * PI / n) * 0.85) for k in range(n)]
    for k, (x, y) in enumerate(pts):
        m.beam('EQUIPO_OSC', (x, y, 0.06), (x, y, 0.22), t=0.016)
        if k in (12, 13):
            continue
        (x2, y2) = pts[(k + 1) % n]
        m.beam('EQUIPO_OSC', (x, y, 0.22), (x2, y2, 0.22), t=0.014)
        m.beam('metal_claro', (x, y, 0.14), (x2, y2, 0.14), t=0.008)
    for k in range(8):
        a = k * PI / 4 + PI / 8
        m.sphere('luz', 0.022, (math.cos(a) * 0.79, math.sin(a) * 0.79, 0.125))
    return m


def turret(level):
    """Torreta tipo naval: base blindada, cañón largo y sensor arriba; miniguns en nivel 2 y 3."""
    m = Model(f'turret_{level}')
    m.hexprism('piedra', 0.5, 0.1)
    hb = 0.22 + (level - 1) * 0.05
    m.cyl('metal_claro', 0.42, hb, (0, 0, 0.1), seg=6, r2=0.36, rot=(0, 0, PI / 6), smooth=False)
    m.cyl('oscuro', 0.37, 0.02, (0, 0, 0.1 + hb), seg=6, rot=(0, 0, PI / 6), smooth=False)
    for sx in (-1, 1):
        m.box('metal', (0.12, 0.012, hb * 0.6), (sx * 0.09, -0.36, 0.14), rot=(-0.2, 0, 0), bevel=0.004)
        m.box('oscuro', (0.03, 0.014, 0.02), (sx * 0.09, -0.368, 0.14 + hb * 0.35), rot=(-0.2, 0, 0), bevel=0.0)
    top = 0.12 + hb
    m.pivot('turret', 0, 0, top)
    m.box('metal_claro', (0.42, 0.46, 0.2), (0, 0.05, top), bevel=0.04, part='turret')
    m.box('metal_claro', (0.36, 0.16, 0.16), (0, -0.2, top), rot=(0.5, 0, 0), bevel=0.03, part='turret')
    m.box('EQUIPO', (0.43, 0.2, 0.035), (0, 0.12, top + 0.12), bevel=0.006, part='turret')
    m.box('metal', (0.3, 0.012, 0.09), (0.0, 0.284, top + 0.06), bevel=0.003, part='turret')
    m.box('oscuro', (0.14, 0.1, 0.11), (0, -0.28, top + 0.06), bevel=0.02, part='turret')
    m.tube('metal', (0, -0.32, top + 0.11), (0, -0.82, top + 0.11), r=0.028, seg=12, part='turret')
    m.cyl('negro', 0.04, 0.07, (0, -0.84, top + 0.11), rot=(H, 0, 0), seg=12, base=False, part='turret')
    m.box('metal', (0.12, 0.08, 0.06), (0, 0.12, top + 0.2), bevel=0.01, part='turret')
    m.box('metal_claro', (0.13, 0.11, 0.1), (0, 0.12, top + 0.26), bevel=0.02, part='turret')
    m.box('vidrio', (0.08, 0.01, 0.06), (0, 0.064, top + 0.28), bevel=0.003, part='turret')
    m.tube('oscuro', (0.05, 0.16, top + 0.36), (0.05, 0.16, top + 0.48), r=0.005, seg=6, part='turret')
    sides = [1] if level == 2 else [1, -1] if level >= 3 else []
    if level >= 4:
        # Nivel 4: tercera minigun arriba y radar antiaéreo que gira.
        x, z = 0.0, top + 0.38
        m.box('metal', (0.12, 0.16, 0.06), (x, -0.04, top + 0.3), bevel=0.015, part='turret')
        m.cyl('oscuro', 0.042, 0.08, (x, 0.02, z), rot=(H, 0, 0), seg=12, base=False, part='turret')
        for k in range(6):
            a = k * PI / 3
            m.tube('negro', (x + math.cos(a) * 0.024, -0.06, z + math.sin(a) * 0.024),
                   (x + math.cos(a) * 0.024, -0.4, z + math.sin(a) * 0.024), r=0.008, seg=6, part='turret')
        m.cyl('metal', 0.04, 0.02, (x, -0.36, z), rot=(H, 0, 0), seg=12, base=False, part='turret')
        m.pivot('rotor', 0.14, 0.22, top + 0.44)
        m.box('oscuro', (0.2, 0.025, 0.1), (0.14, 0.22, top + 0.44), bevel=0.006, part='rotor')
        m.box('EQUIPO', (0.18, 0.01, 0.08), (0.14, 0.208, top + 0.445), bevel=0.0, part='rotor')
    for sx in sides:
        x = sx * 0.3
        m.box('metal', (0.1, 0.18, 0.1), (x, -0.02, top + 0.04), bevel=0.02, part='turret')
        m.cyl('oscuro', 0.042, 0.08, (x, 0.06, top + 0.1), rot=(H, 0, 0), seg=12, base=False, part='turret')
        for k in range(6):
            a = k * PI / 3
            m.tube('negro', (x + math.cos(a) * 0.024, -0.04, top + 0.1 + math.sin(a) * 0.024),
                   (x + math.cos(a) * 0.024, -0.38, top + 0.1 + math.sin(a) * 0.024), r=0.008, seg=6, part='turret')
        m.cyl('metal', 0.04, 0.02, (x, -0.33, top + 0.1), rot=(H, 0, 0), seg=12, base=False, part='turret')
        m.cyl('metal', 0.04, 0.02, (x, -0.16, top + 0.1), rot=(H, 0, 0), seg=12, base=False, part='turret')
        m.box('oliva_osc', (0.07, 0.1, 0.07), (x + sx * 0.08, 0.06, top + 0.02), bevel=0.01, part='turret')
    return m


def aadef():
    """AIR DEFENSE: caja de misiles con celdas marcadas y un radar aparte que gira."""
    m = Model('aadef')
    m.box('concreto', (0.92, 0.92, 0.08), (0, 0, 0), bevel=0.02)
    for (x, y) in [(-0.4, -0.4), (0.4, -0.4), (-0.4, 0.4), (0.4, 0.4)]:
        m.box('oscuro', (0.08, 0.08, 0.1), (x, y, -0.02), bevel=0.01)
    m.box('amarillo', (0.3, 0.02, 0.004), (-0.1, -0.44, 0.08), bevel=0.0)
    m.box('oliva_osc', (0.26, 0.24, 0.08), (0.27, 0.27, 0.08), bevel=0.02)
    for k in range(3):
        m.box('amarillo', (0.03, 0.12, 0.012), (0.21 + k * 0.05, 0.12, 0.08), rot=(0.5, 0, 0), bevel=0.0)
    m.cyl('oscuro', 0.03, 0.12, (0.27, 0.27, 0.16), seg=8)
    m.pivot('rotor', 0.27, 0.27, 0.28)
    m.box('EQUIPO', (0.26, 0.03, 0.17), (0.27, 0.27, 0.26), bevel=0.01, part='rotor')
    m.box('blanco_sucio', (0.23, 0.012, 0.14), (0.27, 0.252, 0.275), bevel=0.0, part='rotor')
    m.cyl('oscuro', 0.17, 0.1, (-0.1, -0.08, 0.08), seg=16)
    m.pivot('turret', -0.1, -0.08, 0.18)
    m.box('oliva_osc', (0.3, 0.28, 0.06), (-0.1, -0.08, 0.18), bevel=0.02, part='turret')
    for sx in (-1, 1):
        m.beam('oscuro', (-0.1 + sx * 0.13, -0.02, 0.22), (-0.1 + sx * 0.13, -0.04, 0.36), t=0.035, part='turret')
    th = -0.55
    m.box('EQUIPO', (0.4, 0.42, 0.26), (-0.1, -0.06, 0.24), rot=(th, 0, 0), bevel=0.03, part='turret')
    launcher_face(m, -0.1, -0.06, 0.37, 0.21, th, 3, 2, 0.115, 0.1, 'turret')
    return m
