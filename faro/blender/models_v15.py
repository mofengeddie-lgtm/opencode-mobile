"""Modelos de la v1.5: Núcleo nuevo (ciudadela con torre central que crece en cada nivel).

El Faro del mapa es una torre blanca y roja; para no confundirlos, el Núcleo es una ciudadela con
una torre de piedra, franjas y techos del color del jugador y el cristal en lo alto.
"""
import math

from lib import Model
from models_ref import crystal

PI = math.pi


def core15(level):
    """Núcleo v1.5: muros con torres, torre central que crece por nivel y cristal del color del jugador."""
    m = Model(f'core_{level}')
    # Base: zócalo oscuro con un borde del color del jugador.
    m.hexprism('EQUIPO_OSC', 0.995, 0.05, (0, 0, 0.05))
    m.hexprism('oscuro', 0.98, 0.12)
    m.hexprism('piedra', 0.92, 0.08, (0, 0, 0.12))
    wall_h = (0.17, 0.23, 0.29)[level - 1]
    rw = 0.76
    z0 = 0.2
    cs = [(math.cos(PI / 6 + k * PI / 3) * rw, math.sin(PI / 6 + k * PI / 3) * rw) for k in range(6)]
    # Muros con almenas y una franja del color del jugador; la entrada mira al frente.
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
            m.box('piedra_clara', (ln, 0.085, wall_h), (cx, cy, z0), rot=(0, 0, ang), bevel=0.012)
            m.box('EQUIPO', (ln, 0.092, 0.04), (cx, cy, z0 + wall_h * 0.42), rot=(0, 0, ang), bevel=0.004)
            n = max(1, int(ln / 0.09))
            for i in range(n):
                t = (i + 0.5) / n
                mx, my = px1 + (px2 - px1) * t, py1 + (py2 - py1) * t
                if i % 2 == 0:
                    m.box('piedra_clara', (0.045, 0.09, 0.045), (mx, my, z0 + wall_h), rot=(0, 0, ang), bevel=0.006)
        if level == 3:
            m.box('oro', (math.hypot(x2 - x1, y2 - y1) * 0.98, 0.095, 0.016), ((x1 + x2) / 2, (y1 + y2) / 2, z0 + wall_h - 0.016),
                  rot=(0, 0, ang), bevel=0.0)
    # Torres de las esquinas con techo del color del jugador (3 en nivel 1, 6 desde el 2).
    towers = [0, 2, 4] if level == 1 else range(6)
    th = (0.34, 0.42, 0.52)[level - 1]
    for k in towers:
        x, y = cs[k]
        m.cyl('piedra_clara', 0.125, th, (x, y, z0), seg=6, smooth=False)
        m.cyl('oscuro', 0.14, 0.04, (x, y, z0 + th), seg=6, smooth=False)
        m.cone('EQUIPO', 0.15, 0.2 + 0.04 * level, (x, y, z0 + th + 0.04), seg=6)
        m.box('luz', (0.035, 0.012, 0.055), (x, y - 0.122, z0 + th * 0.6), bevel=0.0)
        # Banderín en lo alto de cada torre.
        zt = z0 + th + 0.24 + 0.04 * level
        m.beam('metal', (x, y, zt - 0.06), (x, y, zt + 0.16), t=0.012)
        m.box('EQUIPO', (0.01, 0.12, 0.07), (x, y + 0.062, zt + 0.12), bevel=0.0)
    # Portón de madera en la entrada.
    (gx1, gy1), (gx2, gy2) = cs[3], cs[4]
    gang = math.atan2(gy2 - gy1, gx2 - gx1)
    m.box('madera', (0.2, 0.03, wall_h * 0.85), ((gx1 + gx2) / 2, (gy1 + gy2) / 2, z0), rot=(0, 0, gang), bevel=0.006)
    m.box('metal', (0.21, 0.035, 0.018), ((gx1 + gx2) / 2, (gy1 + gy2) / 2, z0 + wall_h * 0.6), rot=(0, 0, gang), bevel=0.0)

    # Torre central: más alta en cada nivel, con franjas del color del jugador y ventanas encendidas.
    H = (0.62, 0.88, 1.14)[level - 1]
    r0, r1 = 0.31, 0.22
    m.hexprism('oscuro', 0.45, 0.08, (0, 0, z0))
    m.cyl('piedra_clara', r0, H, (0, 0, z0 + 0.08), seg=6, r2=r1, smooth=False)
    bands = level + 1
    for i in range(bands):
        t = (i + 1) / (bands + 1)
        r = r0 + (r1 - r0) * t
        m.cyl('EQUIPO', r + 0.014, 0.05, (0, 0, z0 + 0.08 + H * t - 0.025), seg=6, smooth=False)
    for k in range(6):
        a = PI / 6 + k * PI / 3
        for j in range(level + 1):
            t = (j + 0.5) / (bands + 1)
            r = (r0 + (r1 - r0) * t) * math.cos(PI / 6) + 0.006
            m.box('luz', (0.05, 0.012, 0.075), (math.cos(a) * r, math.sin(a) * r, z0 + 0.08 + H * t - 0.01),
                  rot=(0, 0, a + PI / 2), bevel=0.0)
    # Balcón con almenas en lo alto.
    zt = z0 + 0.08 + H
    m.cyl('oscuro', 0.31, 0.05, (0, 0, zt), seg=6, smooth=False)
    for k in range(6):
        a = k * PI / 3
        m.box('piedra_clara', (0.08, 0.05, 0.065), (math.cos(a) * 0.27, math.sin(a) * 0.27, zt + 0.05),
              rot=(0, 0, a + PI / 2), bevel=0.006)
    # Soporte del cristal (dorado en nivel 3).
    prong = 'oro' if level == 3 else 'metal'
    for k in range(3):
        a = k * 2 * PI / 3 + PI / 6
        m.beam(prong, (math.cos(a) * 0.17, math.sin(a) * 0.17, zt + 0.05), (math.cos(a) * 0.07, math.sin(a) * 0.07, zt + 0.26), t=0.035)
    m.cyl('EQUIPO_OSC', 0.12, 0.05, (0, 0, zt + 0.05), seg=6, smooth=False)
    # Nivel 2: arbotantes de los muros a la torre. Nivel 3: anillos dorados y 3 agujas.
    if level >= 2:
        for k in range(3):
            a = k * 2 * PI / 3 + PI / 6
            m.beam('piedra_clara', (math.cos(a) * 0.62, math.sin(a) * 0.62, z0 + wall_h), (math.cos(a) * 0.28, math.sin(a) * 0.28, z0 + 0.08 + H * 0.45), t=0.055)
    if level == 3:
        m.cyl('oro', r0 + 0.02, 0.035, (0, 0, z0 + 0.08), seg=6, smooth=False)
        m.cyl('oro', 0.33, 0.03, (0, 0, zt + 0.045), seg=6, smooth=False)
        for k in range(3):
            a = k * 2 * PI / 3 - PI / 6
            x, y = math.cos(a) * 0.27, math.sin(a) * 0.27
            m.cone('oro', 0.04, 0.2, (x, y, zt + 0.1), seg=6)
    size = (0.22, 0.27, 0.32)[level - 1]
    crystal(m, zt + 0.14 + size * 1.35, size)
    return m
