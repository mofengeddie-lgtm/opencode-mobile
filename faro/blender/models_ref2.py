"""Modelos de la v0.6 (diseño propio, estilo de las referencias del 7 de noviembre).

Cuartel, Fábrica, Puerto, Casa, cinco energías, Submarino, Apache Guardián, Camión antiaéreo,
Torreta chica, Puesto avanzado y Enfermería por niveles. Blender: Z arriba, el frente mira a -Y.
"""
import math

from lib import Model
from models_ref import wheels

PI = math.pi
H = PI / 2


def sandbags(m, cx, cy, r, a0, a1, n, z=0.0, part='main'):
    """Fila de sacos de arena en arco (de a0 a a1 radianes)."""
    for i in range(n):
        a = a0 + (a1 - a0) * (i + 0.5) / n
        m.box('arena', (0.12, 0.07, 0.06), (cx + math.cos(a) * r, cy + math.sin(a) * r, z), rot=(0, 0, a + H), bevel=0.02, part=part)


def flag(m, x, y, z, h=0.6):
    m.tube('metal_claro', (x, y, z), (x, y, z + h), r=0.01, seg=6)
    m.box('EQUIPO', (0.18, 0.012, 0.11), (x + 0.09, y, z + h - 0.13), bevel=0.0)


def barracks():
    """Cuartel: nave con techo de lona, puerta grande, sacos de arena y bandera."""
    m = Model('barracks')
    m.box('concreto', (1.2, 0.9, 0.06), (0, 0.04, 0), bevel=0.02)
    m.box('oliva', (0.9, 0.56, 0.24), (0, 0.08, 0.06), bevel=0.02)
    m.cyl('oliva_osc', 0.28, 0.92, (0, 0.08, 0.3), rot=(0, H, 0), seg=16, base=False)
    for x in (-0.3, 0.0, 0.3):
        m.cyl('oscuro', 0.285, 0.025, (x, 0.08, 0.3), rot=(0, H, 0), seg=16, base=False)
    m.box('EQUIPO', (0.94, 0.08, 0.03), (0, 0.08, 0.57), bevel=0.0)
    m.box('oscuro', (0.3, 0.02, 0.2), (0, -0.205, 0.06), bevel=0.0)
    for k in range(4):
        m.box('negro', (0.3, 0.022, 0.008), (0, -0.208, 0.09 + k * 0.045), bevel=0.0)
    m.box('luz', (0.08, 0.02, 0.03), (0, -0.21, 0.29), bevel=0.0)
    for sx in (-1, 1):
        m.box('luz', (0.1, 0.012, 0.06), (sx * 0.3, -0.206, 0.17), bevel=0.0)
    sandbags(m, -0.38, -0.32, 0.16, PI * 0.6, PI * 1.4, 4, 0.06)
    sandbags(m, 0.38, -0.32, 0.16, -PI * 0.4, PI * 0.4, 4, 0.06)
    flag(m, 0.5, 0.42, 0.06, 0.75)
    for (x, y) in [(-0.5, 0.36), (-0.38, 0.4)]:
        m.box('madera', (0.1, 0.1, 0.09), (x, y, 0.06), bevel=0.01)
    return m


def factory():
    """Fábrica: nave con techo en sierra, chimeneas, portón y cinta con un vehículo saliendo."""
    m = Model('factory')
    m.box('concreto', (1.3, 1.0, 0.06), (0, 0.04, 0), bevel=0.02)
    m.box('concreto', (1.0, 0.66, 0.36), (0, 0.12, 0.06), bevel=0.02)
    m.box('EQUIPO', (1.02, 0.68, 0.04), (0, 0.12, 0.3), bevel=0.0)
    for k in range(4):
        x = -0.375 + k * 0.25
        m.wedge('metal', (0.25, 0.66, 0.16), (x, 0.12, 0.42), rot=(0, 0, H))
        m.box('vidrio', (0.012, 0.6, 0.11), (x - 0.06, 0.12, 0.45), rot=(0, -0.55, 0), bevel=0.0)
    for (x, y) in [(0.34, 0.34), (0.18, 0.4)]:
        m.cyl('ladrillo', 0.06, 0.62, (x, y, 0.42), seg=12)
        m.cyl('EQUIPO', 0.065, 0.04, (x, y, 0.88), seg=12)
        m.cyl('negro', 0.05, 0.02, (x, y, 1.04), seg=12)
    m.box('oscuro', (0.42, 0.02, 0.26), (-0.1, -0.215, 0.06), bevel=0.0)
    for k in range(6):
        m.box('amarillo' if k % 2 == 0 else 'negro', (0.07, 0.024, 0.03), (-0.275 + k * 0.07, -0.22, 0.33), bevel=0.0)
    m.box('negro', (0.26, 0.42, 0.04), (-0.1, -0.42, 0.06), bevel=0.01)
    for k in range(5):
        m.cyl('metal', 0.025, 0.27, (-0.1, -0.25 - k * 0.085, 0.08), rot=(0, H, 0), seg=8, base=False)
    m.box('EQUIPO', (0.16, 0.22, 0.08), (-0.1, -0.46, 0.13), bevel=0.02)
    m.box('vidrio', (0.14, 0.02, 0.05), (-0.1, -0.572, 0.17), bevel=0.0)
    for sx in (-1, 1):
        for y in (-0.39, -0.53):
            m.cyl('goma', 0.035, 0.03, (-0.1 + sx * 0.085, y, 0.135), rot=(0, H, 0), seg=10, base=False)
    m.box('luz', (0.3, 0.012, 0.05), (0.3, -0.216, 0.22), bevel=0.0)
    for (x, y, mat) in [(0.48, -0.32, 'madera'), (0.48, -0.2, 'EQUIPO_OSC')]:
        m.box(mat, (0.1, 0.1, 0.09), (x, y, 0.06), bevel=0.01)
    return m


def harbor():
    """Puerto: muelle de madera sobre pilotes, bodega, grúa de pórtico y contenedores."""
    m = Model('harbor')
    for x in (-0.55, -0.18, 0.18, 0.55):
        for y in (-0.45, 0.0, 0.45):
            m.cyl('madera', 0.045, 0.3, (x, y, -0.28), seg=8)
    m.box('madera', (1.3, 1.04, 0.08), (0, 0, 0.0), bevel=0.01)
    for k in range(9):
        m.box('madera_clara', (1.3, 0.012, 0.004), (0, -0.46 + k * 0.115, 0.08), bevel=0.0)
    m.box('EQUIPO_OSC', (0.56, 0.44, 0.32), (-0.3, 0.24, 0.08), bevel=0.02)
    m.wedge('EQUIPO', (0.62, 0.5, 0.14), (-0.3, 0.24, 0.4))
    m.box('oscuro', (0.22, 0.012, 0.2), (-0.3, 0.015, 0.08), bevel=0.0)
    m.box('luz', (0.1, 0.012, 0.05), (-0.48, 0.015, 0.26), bevel=0.0)
    for sx in (-1, 1):
        m.beam('amarillo', (0.4 + sx * 0.2, -0.05, 0.08), (0.4 + sx * 0.2, -0.05, 0.85), t=0.05)
        m.beam('amarillo', (0.4 + sx * 0.2, -0.05, 0.4), (0.4 - sx * 0.2, -0.05, 0.75), t=0.025)
    m.beam('amarillo', (0.16, -0.05, 0.85), (0.64, -0.05, 0.85), t=0.06)
    m.beam('amarillo', (0.4, -0.05, 0.85), (0.4, -0.62, 0.85), t=0.05)
    m.box('oscuro', (0.08, 0.08, 0.06), (0.4, -0.5, 0.82), bevel=0.01)
    m.tube('oscuro', (0.4, -0.5, 0.82), (0.4, -0.5, 0.42), r=0.004, seg=6)
    m.box('EQUIPO', (0.2, 0.12, 0.1), (0.4, -0.5, 0.32), bevel=0.01)
    for (x, y, z, mat) in [(0.36, 0.28, 0.08, 'EQUIPO'), (0.36, 0.28, 0.2, 'rojo'), (0.56, 0.28, 0.08, 'blanco_sucio')]:
        m.box(mat, (0.18, 0.12, 0.12), (x, y, z), bevel=0.01)
    for x in (-0.58, -0.3, 0.0, 0.3, 0.58):
        m.cyl('oscuro', 0.025, 0.05, (x, -0.49, 0.08), seg=10)
    m.tube('oscuro', (-0.6, -0.4, 0.08), (-0.6, -0.4, 0.42), r=0.01, seg=6)
    m.sphere('luz', 0.03, (-0.6, -0.4, 0.44))
    return m


def house():
    """Casa: techo a dos aguas, ventanas encendidas, chimenea y cerca."""
    m = Model('house')
    m.box('cultivo', (0.95, 0.9, 0.03), (0, 0.0, 0), bevel=0.01)
    m.box('blanco', (0.56, 0.46, 0.3), (0, 0.06, 0.03), bevel=0.02)
    m.wedge('EQUIPO', (0.66, 0.58, 0.26), (0, 0.06, 0.33))
    m.box('ladrillo', (0.08, 0.08, 0.2), (0.16, 0.16, 0.42), bevel=0.01)
    m.box('madera', (0.12, 0.012, 0.2), (0, -0.175, 0.03), bevel=0.0)
    for sx in (-1, 1):
        m.box('luz', (0.1, 0.012, 0.08), (sx * 0.17, -0.175, 0.15), bevel=0.0)
        m.box('blanco', (0.13, 0.016, 0.012), (sx * 0.17, -0.178, 0.105), bevel=0.0)
        m.box('luz', (0.012, 0.1, 0.08), (sx * 0.282, 0.06, 0.15), bevel=0.0)
    m.box('piedra_clara', (0.14, 0.2, 0.012), (0, -0.28, 0.03), bevel=0.0)
    for k in range(7):
        x = -0.42 + k * 0.14
        if abs(x) < 0.09:
            continue
        m.box('madera', (0.02, 0.02, 0.1), (x, -0.4, 0.03), bevel=0.0)
    m.beam('madera_clara', (-0.42, -0.4, 0.09), (-0.09, -0.4, 0.09), t=0.014)
    m.beam('madera_clara', (0.09, -0.4, 0.09), (0.42, -0.4, 0.09), t=0.014)
    m.sphere('oliva', 0.08, (-0.35, 0.3, 0.08), scale=(1, 1, 0.8))
    m.sphere('cultivo', 0.07, (0.36, 0.32, 0.07), scale=(1, 1, 0.8))
    return m


def solar():
    """Solar: dos filas de paneles inclinados sobre patas y un inversor."""
    m = Model('solar')
    m.box('concreto', (1.1, 0.95, 0.04), (0, 0, 0), bevel=0.01)
    for row in range(2):
        y = -0.22 + row * 0.42
        for col in range(3):
            x = -0.32 + col * 0.32
            m.beam('metal', (x, y + 0.08, 0.04), (x, y + 0.08, 0.26), t=0.025)
            m.beam('metal', (x, y - 0.08, 0.04), (x, y - 0.08, 0.14), t=0.025)
            m.box('metal_claro', (0.3, 0.28, 0.03), (x, y, 0.17), rot=(0.5, 0, 0), bevel=0.005)
            m.box('panel', (0.27, 0.25, 0.012), (x, y - 0.006, 0.19), rot=(0.5, 0, 0), bevel=0.0)
            for k in range(2):
                m.box('metal_claro', (0.27, 0.006, 0.004), (x, y - 0.04 + k * 0.08, 0.2 + k * 0.04), rot=(0.5, 0, 0), bevel=0.0)
    m.box('EQUIPO', (0.14, 0.1, 0.16), (0.46, 0.38, 0.04), bevel=0.01)
    m.box('luz', (0.03, 0.012, 0.03), (0.46, 0.328, 0.15), bevel=0.0)
    return m


def wind():
    """Eólica: torre alta y fina, góndola con franja del equipo y tres aspas que giran."""
    m = Model('wind')
    m.cyl('concreto', 0.2, 0.06, (0, 0, 0), seg=12)
    m.cyl('blanco', 0.065, 1.48, (0, 0, 0.06), seg=12, r2=0.035)
    m.cyl('EQUIPO', 0.06, 0.05, (0, 0, 0.3), seg=12)
    m.box('blanco', (0.11, 0.28, 0.11), (0, 0.02, 1.51), bevel=0.04)
    m.box('EQUIPO', (0.115, 0.1, 0.03), (0, 0.08, 1.58), bevel=0.0)
    m.pivot('blades', 0, -0.13, 1.565)
    m.sphere('blanco', 0.055, (0, -0.15, 1.565), scale=(1, 1.4, 1), part='blades')
    for k in range(3):
        a = k * 2 * PI / 3
        m.box('blanco', (0.06, 0.018, 0.62), (math.sin(a) * 0.33, -0.15, 1.565 + math.cos(a) * 0.33),
              rot=(0, a, 0), bevel=0.006, part='blades', base=False)
        m.box('rojo', (0.062, 0.02, 0.06), (math.sin(a) * 0.6, -0.15, 1.565 + math.cos(a) * 0.6),
              rot=(0, a, 0), bevel=0.0, part='blades', base=False)
    return m


def hydro():
    """Hidráulica: casa de piedra con canal de agua y una rueda de madera que gira."""
    m = Model('hydro')
    m.box('piedra', (0.9, 0.8, 0.12), (-0.05, 0.05, 0), bevel=0.02)
    m.box('agua', (0.16, 0.8, 0.02), (0.38, 0.05, 0.1), bevel=0.0)
    for sx in (-1, 1):
        m.box('piedra_clara', (0.04, 0.8, 0.1), (0.38 + sx * 0.1, 0.05, 0.1), bevel=0.01)
    m.box('blanco', (0.46, 0.4, 0.3), (-0.12, 0.12, 0.12), bevel=0.02)
    m.wedge('EQUIPO', (0.54, 0.48, 0.18), (-0.12, 0.12, 0.42))
    m.box('madera', (0.12, 0.012, 0.18), (-0.12, -0.085, 0.12), bevel=0.0)
    m.box('luz', (0.08, 0.012, 0.06), (-0.27, -0.085, 0.26), bevel=0.0)
    m.cyl('metal', 0.03, 0.26, (0.15, -0.25, 0.22), rot=(0, H, 0), seg=10, base=False)
    m.pivot('blades', 0.38, -0.25, 0.22)
    m.cyl('metal', 0.04, 0.16, (0.38, -0.25, 0.22), rot=(0, H, 0), seg=10, base=False, part='blades')
    for sx in (-1, 1):
        m.cyl('madera', 0.2, 0.02, (0.38 + sx * 0.06, -0.25, 0.22), rot=(0, H, 0), seg=18, base=False, part='blades')
        m.cyl('madera_clara', 0.17, 0.024, (0.38 + sx * 0.06, -0.25, 0.22), rot=(0, H, 0), seg=18, base=False, part='blades')
    for k in range(8):
        a = k * PI / 4
        m.box('madera', (0.14, 0.012, 0.07), (0.38, -0.25 + math.cos(a) * 0.19, 0.22 + math.sin(a) * 0.19),
              rot=(a, 0, 0), bevel=0.0, part='blades', base=False)
    return m


def tidal():
    """Mareomotriz: plataforma sobre pilotes con caseta y turbina bajo el agua."""
    m = Model('tidal')
    for (x, y) in [(-0.3, -0.25), (0.3, -0.25), (-0.3, 0.3), (0.3, 0.3)]:
        m.cyl('amarillo', 0.045, 0.5, (x, y, -0.3), seg=10)
    m.box('metal', (0.8, 0.7, 0.06), (0, 0.03, 0.18), bevel=0.01)
    for k in range(4):
        m.beam('metal_claro', (-0.4 + k * 0.266, -0.32, 0.24), (-0.4 + k * 0.266, -0.32, 0.36), t=0.012)
    m.beam('metal_claro', (-0.4, -0.32, 0.36), (0.4, -0.32, 0.36), t=0.012)
    m.box('EQUIPO', (0.3, 0.26, 0.22), (0.15, 0.15, 0.24), bevel=0.02)
    m.box('luz', (0.24, 0.012, 0.05), (0.15, 0.018, 0.36), bevel=0.0)
    m.box('blanco_sucio', (0.32, 0.28, 0.03), (0.15, 0.15, 0.46), bevel=0.005)
    m.beam('metal', (0, -0.26, 0.18), (0, -0.26, 0.0), t=0.05)
    m.cyl('metal_claro', 0.07, 0.24, (0, -0.14, 0.05), rot=(H, 0, 0), seg=12, base=False)
    m.pivot('blades', 0, -0.26, 0.05)
    m.cone('metal_claro', 0.07, 0.12, (0, -0.31, 0.05), rot=(H, 0, 0), seg=12, part='blades', smooth=True)
    for k in range(3):
        a = k * 2 * PI / 3
        m.box('blanco', (0.05, 0.016, 0.28), (math.sin(a) * 0.15, -0.27, 0.05 + math.cos(a) * 0.15),
              rot=(0, a, 0), bevel=0.005, part='blades', base=False)
    return m


def wave():
    """Undimotriz: base flotante con boyas amarillas en brazos que suben y bajan con las olas."""
    m = Model('wave')
    m.cyl('gris', 0.24, 0.16, (0, 0, -0.08), seg=16)
    m.cyl('EQUIPO', 0.25, 0.04, (0, 0, 0.06), seg=16)
    m.box('blanco_sucio', (0.2, 0.2, 0.16), (0, 0.0, 0.08), bevel=0.02)
    m.box('luz', (0.16, 0.012, 0.04), (0, -0.102, 0.18), bevel=0.0)
    m.tube('oscuro', (0, 0, 0.24), (0, 0, 0.5), r=0.008, seg=6)
    m.sphere('luz', 0.025, (0, 0, 0.51))
    m.pivot('rocker', 0, 0, 0.04)
    for (dx, dy) in [(0, -1), (0.87, 0.5), (-0.87, 0.5)]:
        x, y = dx * 0.55, dy * 0.55
        m.beam('metal', (dx * 0.2, dy * 0.2, 0.06), (x, y, 0.04), t=0.035, part='rocker')
        m.cyl('amarillo', 0.12, 0.12, (x, y, -0.04), seg=14, part='rocker')
        m.cyl('naranja', 0.122, 0.025, (x, y, 0.06), seg=14, part='rocker')
    return m


def submarine():
    """Submarino: casco largo con torre, timones y hélice."""
    m = Model('sub')
    m.cyl('oscuro', 0.15, 0.9, (0, 0.02, 0.0), rot=(H, 0, 0), seg=18, base=False)
    m.sphere('oscuro', 0.15, (0, -0.43, 0.0), scale=(1, 1.4, 1))
    m.cone('oscuro', 0.15, 0.4, (0, 0.67, 0.0), rot=(-H, 0, 0), seg=18, smooth=True)
    m.box('EQUIPO', (0.012, 0.6, 0.03), (0.15, 0.0, 0.03), bevel=0.0)
    m.box('EQUIPO', (0.012, 0.6, 0.03), (-0.15, 0.0, 0.03), bevel=0.0)
    m.box('oscuro', (0.1, 0.28, 0.2), (0, -0.1, 0.1), bevel=0.04)
    m.box('EQUIPO', (0.104, 0.1, 0.04), (0, -0.1, 0.24), bevel=0.0)
    m.box('oscuro', (0.34, 0.07, 0.014), (0, -0.12, 0.2), bevel=0.0)
    m.tube('metal', (0.02, -0.15, 0.3), (0.02, -0.15, 0.46), r=0.008, seg=6)
    m.tube('metal', (-0.02, -0.07, 0.3), (-0.02, -0.07, 0.4), r=0.008, seg=6)
    m.box('luz', (0.06, 0.012, 0.02), (0, -0.242, 0.24), bevel=0.0)
    m.box('oscuro', (0.42, 0.07, 0.014), (0, 0.64, 0.0), bevel=0.0)
    m.box('oscuro', (0.014, 0.07, 0.3), (0, 0.64, -0.15), bevel=0.0)
    m.cyl('metal', 0.035, 0.03, (0, 0.88, 0.0), rot=(H, 0, 0), seg=10, base=False)
    for k in range(4):
        a = k * H + PI / 4
        m.box('metal', (0.12, 0.012, 0.03), (math.cos(a) * 0.05, 0.9, math.sin(a) * 0.05), rot=(0, -a, 0), bevel=0.0, base=False)
    return m


def apache():
    """Apache Guardián: cabina en tándem, alas con cohetes y misiles, cañón bajo la nariz."""
    m = Model('apache')
    m.box('EQUIPO', (0.2, 0.62, 0.2), (0, -0.02, 0.12), bevel=0.05)
    m.box('EQUIPO_OSC', (0.16, 0.26, 0.14), (0, -0.37, 0.13), rot=(0.12, 0, 0), bevel=0.04)
    m.box('vidrio', (0.14, 0.15, 0.09), (0, -0.34, 0.26), rot=(0.25, 0, 0), bevel=0.02)
    m.box('vidrio', (0.14, 0.15, 0.11), (0, -0.15, 0.3), rot=(0.2, 0, 0), bevel=0.02)
    m.box('oscuro', (0.06, 0.08, 0.06), (0, -0.5, 0.12), bevel=0.01)
    m.tube('EQUIPO_OSC', (0, 0.28, 0.22), (0, 0.86, 0.26), r=0.045, r2=0.028, seg=10)
    m.box('EQUIPO_OSC', (0.02, 0.16, 0.22), (0, 0.85, 0.32), rot=(0.25, 0, 0), bevel=0.01)
    m.box('EQUIPO_OSC', (0.26, 0.07, 0.015), (0, 0.8, 0.24), bevel=0.0)
    m.cyl('oscuro', 0.07, 0.01, (0.03, 0.88, 0.32), rot=(0, H, 0), seg=14, base=False)
    for sx in (-1, 1):
        m.box('oscuro', (0.32, 0.1, 0.025), (sx * 0.22, 0.0, 0.2), bevel=0.008)
        m.box('oscuro', (0.06, 0.14, 0.1), (sx * 0.13, 0.08, 0.16), bevel=0.02)
        m.cyl('oliva_osc', 0.045, 0.22, (sx * 0.3, -0.02, 0.15), rot=(H, 0, 0), seg=10, base=False)
        for k in range(4):
            a = k * H + PI / 4
            m.cyl('blanco', 0.012, 0.012, (sx * 0.3 + math.cos(a) * 0.022, -0.135, 0.15 + math.sin(a) * 0.022), rot=(H, 0, 0), seg=6, base=False)
        for k in range(2):
            m.tube('blanco', (sx * (0.17 + k * 0.05), 0.06, 0.15), (sx * (0.17 + k * 0.05), -0.12, 0.15), r=0.018, seg=8)
            m.cone('rojo', 0.018, 0.04, (sx * (0.17 + k * 0.05), -0.14, 0.15), rot=(H, 0, 0), seg=8)
        m.beam('oscuro', (sx * 0.1, -0.2, 0.05), (sx * 0.1, -0.2, -0.04), t=0.02)
        m.beam('oscuro', (sx * 0.1, 0.25, 0.05), (sx * 0.1, 0.25, -0.04), t=0.02)
        m.cyl('goma', 0.035, 0.03, (sx * 0.1, -0.2, -0.03), rot=(0, H, 0), seg=10, base=False)
    m.cyl('oscuro', 0.03, 0.06, (0, -0.42, 0.02), seg=10)
    m.tube('metal', (0, -0.44, 0.03), (0, -0.62, 0.03), r=0.012, seg=8)
    m.box('luz', (0.03, 0.02, 0.02), (0, -0.505, 0.15), bevel=0.0)
    m.cyl('oscuro', 0.04, 0.1, (0, 0.0, 0.32), seg=10)
    m.pivot('rotor', 0, 0.0, 0.44)
    m.cyl('oscuro', 0.045, 0.04, (0, 0, 0.43), seg=12, part='rotor')
    m.sphere('oscuro', 0.06, (0, 0, 0.5), scale=(1, 1, 0.7), part='rotor')
    m.box('oscuro', (1.36, 0.07, 0.012), (0, 0, 0.44), bevel=0.004, part='rotor')
    m.box('oscuro', (0.07, 1.36, 0.012), (0, 0, 0.44), bevel=0.004, part='rotor')
    return m


def aa_truck():
    """Camión antiaéreo: seis ruedas, cabina, cañones dobles y radar en la torreta."""
    m = Model('aa')
    wheels(m, [(-0.22, -0.3), (0.22, -0.3), (-0.22, 0.1), (0.22, 0.1), (-0.22, 0.3), (0.22, 0.3)], r=0.08)
    m.box('oliva_osc', (0.44, 0.86, 0.08), (0, 0.02, 0.1), bevel=0.02)
    m.box('EQUIPO', (0.42, 0.24, 0.2), (0, -0.3, 0.17), bevel=0.04)
    m.box('vidrio', (0.36, 0.02, 0.09), (0, -0.425, 0.27), rot=(-0.2, 0, 0), bevel=0.005)
    m.box('oscuro', (0.32, 0.02, 0.06), (0, -0.425, 0.19), bevel=0.0)
    for sx in (-1, 1):
        m.box('luz', (0.04, 0.02, 0.03), (sx * 0.16, -0.425, 0.24), bevel=0.0)
    m.box('oliva', (0.44, 0.5, 0.08), (0, 0.15, 0.18), bevel=0.02)
    m.pivot('turret', 0, 0.15, 0.26)
    m.cyl('oscuro', 0.15, 0.05, (0, 0.15, 0.26), seg=16, part='turret')
    m.box('EQUIPO', (0.26, 0.24, 0.12), (0, 0.16, 0.31), bevel=0.04, part='turret')
    for sx in (-1, 1):
        m.box('oscuro', (0.05, 0.14, 0.07), (sx * 0.08, 0.06, 0.38), rot=(-0.5, 0, 0), bevel=0.01, part='turret')
        m.tube('negro', (sx * 0.08, 0.02, 0.41), (sx * 0.08, -0.32, 0.6), r=0.014, seg=8, part='turret')
        m.cyl('metal', 0.02, 0.03, (sx * 0.08, -0.3, 0.59), rot=(H - 0.5, 0, 0), seg=8, base=False, part='turret')
    m.tube('oscuro', (0, 0.26, 0.43), (0, 0.26, 0.52), r=0.012, seg=6, part='turret')
    m.box('metal_claro', (0.18, 0.025, 0.11), (0, 0.27, 0.56), rot=(0.25, 0, 0), bevel=0.0, part='turret')
    return m


def miniturret():
    """Torreta chica: nido de ametralladora con sacos de arena."""
    m = Model('miniturret')
    m.cyl('tierra', 0.32, 0.04, (0, 0, 0), seg=16)
    sandbags(m, 0, 0, 0.27, -PI * 0.15, PI * 1.15, 9, 0.04)
    sandbags(m, 0, 0, 0.27, -PI * 0.05, PI * 1.05, 8, 0.1)
    m.pivot('turret', 0, 0, 0.12)
    m.cyl('oscuro', 0.07, 0.06, (0, 0, 0.1), seg=10, part='turret')
    for k in range(3):
        a = k * 2 * PI / 3
        m.beam('oscuro', (0, 0, 0.16), (math.cos(a) * 0.08, math.sin(a) * 0.08, 0.04), t=0.012, part='turret')
    m.box('negro', (0.05, 0.2, 0.06), (0, -0.06, 0.18), bevel=0.01, part='turret')
    m.tube('metal', (0, -0.16, 0.21), (0, -0.34, 0.21), r=0.01, seg=6, part='turret')
    m.box('EQUIPO', (0.18, 0.015, 0.1), (0, -0.12, 0.17), bevel=0.0, part='turret')
    m.box('oliva_osc', (0.05, 0.06, 0.05), (0.05, 0.0, 0.16), bevel=0.01, part='turret')
    return m


def outpost():
    """Puesto avanzado: torre de vigía de madera con techo del equipo, bandera y tienda."""
    m = Model('outpost')
    m.cyl('tierra', 0.7, 0.03, (0, 0, 0), seg=18)
    c = [(-0.12, -0.12), (0.12, -0.12), (0.12, 0.12), (-0.12, 0.12)]
    for (x, y) in c:
        m.beam('madera', (x * 1.5, y * 1.5, 0.03), (x, y, 0.62), t=0.035)
    for i in range(4):
        (xa, ya), (xb, yb) = c[i], c[(i + 1) % 4]
        m.beam('madera_clara', (xa * 1.32, ya * 1.32, 0.3), (xb * 1.32, yb * 1.32, 0.3), t=0.02)
    m.box('madera', (0.34, 0.34, 0.04), (0, 0, 0.62), bevel=0.01)
    for i in range(4):
        (xa, ya), (xb, yb) = c[i], c[(i + 1) % 4]
        m.beam('madera_clara', (xa * 1.35, ya * 1.35, 0.78), (xb * 1.35, yb * 1.35, 0.78), t=0.018)
    for (x, y) in c:
        m.beam('madera', (x * 1.35, y * 1.35, 0.66), (x * 1.35, y * 1.35, 0.92), t=0.02)
    m.cone('EQUIPO', 0.3, 0.2, (0, 0, 0.92), seg=4, rot=(0, 0, PI / 4))
    m.sphere('luz', 0.025, (0.0, -0.16, 0.85))
    for k in range(6):
        m.beam('madera_clara', (-0.05, -0.2 - k * 0.0, 0.1 + k * 0.1), (0.05, -0.2, 0.1 + k * 0.1), t=0.012)
    flag(m, 0.18, 0.18, 0.92, 0.35)
    m.wedge('oliva', (0.36, 0.3, 0.2), (0.38, 0.3, 0.03), rot=(0, 0, H))
    m.box('oscuro', (0.1, 0.012, 0.14), (0.38, 0.148, 0.03), bevel=0.0)
    for (x, y) in [(-0.36, 0.2), (-0.42, 0.06)]:
        m.box('madera', (0.1, 0.1, 0.09), (x, y, 0.03), bevel=0.01)
    return m


def hospital(level):
    """Enfermería: tienda (1), clínica (2) y hospital grande con helipuerto (3)."""
    m = Model(f'hospital_{level}')
    m.box('concreto', (1.0, 0.86, 0.04), (0, 0.02, 0), bevel=0.01)

    def cross(x, y, z, s, rot=0.0):
        if rot:
            m.box('rojo', (0.016, s, s * 0.34), (x, y, z), bevel=0.0)
            m.box('rojo', (0.016, s * 0.34, s), (x, y, z - s * 0.33), bevel=0.0)
        else:
            m.box('rojo', (s, 0.016, s * 0.34), (x, y, z), bevel=0.0)
            m.box('rojo', (s * 0.34, 0.016, s), (x, y, z - s * 0.33), bevel=0.0)
    if level == 1:
        m.wedge('blanco', (0.7, 0.5, 0.36), (0, 0.06, 0.04), rot=(0, 0, 0))
        m.box('oscuro', (0.14, 0.012, 0.18), (-0.36, 0.06, 0.04), rot=(0, 0, H), bevel=0.0)
        # Cruz roja apoyada en la lona inclinada (la cara delantera sube de y=-0,25 a la cumbrera).
        t = math.atan2(0.25, 0.36)
        cy, cz = -0.25 * (1 - 0.2 / 0.36) - 0.012 * math.cos(t), 0.04 + 0.2 + 0.012 * math.sin(t)
        m.box('rojo', (0.22, 0.012, 0.07), (0, cy, cz), rot=(-t, 0, 0), bevel=0.0, base=False)
        m.box('rojo', (0.07, 0.012, 0.22), (0, cy, cz), rot=(-t, 0, 0), bevel=0.0, base=False)
        for (x, y) in [(0.3, -0.32), (0.18, -0.32)]:
            m.box('blanco_sucio', (0.1, 0.18, 0.05), (x, y, 0.04), bevel=0.01)
        flag(m, -0.4, -0.3, 0.04, 0.5)
        return m
    if level == 2:
        m.box('blanco', (0.7, 0.5, 0.32), (0, 0.08, 0.04), bevel=0.02)
        m.box('EQUIPO', (0.72, 0.52, 0.04), (0, 0.08, 0.36), bevel=0.0)
        m.box('blanco_sucio', (0.3, 0.16, 0.04), (0, -0.24, 0.24), bevel=0.0)
        m.beam('metal_claro', (-0.13, -0.3, 0.04), (-0.13, -0.3, 0.24), t=0.02)
        m.beam('metal_claro', (0.13, -0.3, 0.04), (0.13, -0.3, 0.24), t=0.02)
        m.box('vidrio', (0.16, 0.012, 0.18), (0, -0.172, 0.04), bevel=0.0)
        for sx in (-1, 1):
            m.box('luz', (0.12, 0.012, 0.1), (sx * 0.24, -0.172, 0.18), bevel=0.0)
        m.box('blanco', (0.2, 0.02, 0.2), (0, -0.16, 0.38), bevel=0.0)
        cross(0, -0.172, 0.53, 0.14)
        return m
    m.box('blanco', (0.86, 0.6, 0.5), (0, 0.08, 0.04), bevel=0.02)
    m.box('EQUIPO', (0.88, 0.62, 0.035), (0, 0.08, 0.3), bevel=0.0)
    m.box('EQUIPO', (0.88, 0.62, 0.04), (0, 0.08, 0.54), bevel=0.0)
    for row in range(2):
        for col in range(4):
            if row == 0 and col in (1, 2):
                continue
            m.box('luz', (0.12, 0.012, 0.1), (-0.3 + col * 0.2, -0.222, 0.12 + row * 0.24), bevel=0.0)
    m.box('vidrio', (0.26, 0.012, 0.2), (0, -0.222, 0.04), bevel=0.0)
    m.box('blanco_sucio', (0.4, 0.2, 0.03), (0, -0.32, 0.25), bevel=0.0)
    for sx in (-1, 1):
        m.beam('metal_claro', (sx * 0.18, -0.4, 0.04), (sx * 0.18, -0.4, 0.25), t=0.02)
    m.box('blanco', (0.24, 0.02, 0.24), (-0.3, -0.21, 0.6), bevel=0.0)
    cross(-0.3, -0.222, 0.76, 0.18)
    m.cyl('oscuro', 0.22, 0.02, (0.12, 0.12, 0.58), seg=20)
    m.cyl('amarillo', 0.2, 0.006, (0.12, 0.12, 0.6), seg=20)
    m.cyl('oscuro', 0.17, 0.008, (0.12, 0.12, 0.6), seg=20)
    m.box('blanco', (0.022, 0.12, 0.005), (0.08, 0.12, 0.605), bevel=0.0)
    m.box('blanco', (0.022, 0.12, 0.005), (0.16, 0.12, 0.605), bevel=0.0)
    m.box('blanco', (0.08, 0.022, 0.005), (0.12, 0.12, 0.605), bevel=0.0)
    m.box('blanco', (0.2, 0.3, 0.12), (0.5, 0.22, 0.04), bevel=0.01)
    m.box('rojo', (0.21, 0.04, 0.03), (0.5, 0.22, 0.12), bevel=0.0)
    return m
