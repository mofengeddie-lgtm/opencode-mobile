"""Genera los modelos 3D de Faro de Ámbar con Blender y los exporta como GLB.

Uso:  python generate_models.py <carpeta_salida>     (con el módulo bpy de Blender 5)
      blender -b -P generate_models.py -- <carpeta_salida>

Los GLB sirven para el juego web y se pueden importar en Roblox Studio (3D Importer).
"""
import math
import os
import sys

import bpy

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import Model  # noqa: E402
# Modelos rehechos según tus referencias del 7 de noviembre.
from models_ref import (aadef, arty, barge, boat_engineer, core, destroyer, farm, helicopter, helipad,  # noqa: E402
                        jeep, mine, rig, soldier, speedboat, tank, turret, wheels)

PI = math.pi
H = PI / 2


# =====================================================================
# Soldados: cuerpo de bloques; cada uno con casco, equipo y arma propios
# =====================================================================


# =====================================================================
# Vehículos
# =====================================================================


def aa_truck():
    m = Model('aa')
    wheels(m, [(-0.21, -0.28), (0.21, -0.28), (-0.21, 0.12), (0.21, 0.12), (-0.21, 0.3), (0.21, 0.3)], r=0.08)
    m.box('oliva_osc', (0.44, 0.84, 0.08), (0, 0.02, 0.1), bevel=0.02)
    m.box('EQUIPO', (0.42, 0.24, 0.2), (0, -0.28, 0.17), bevel=0.04)
    m.box('vidrio', (0.36, 0.02, 0.09), (0, -0.405, 0.27), rot=(-0.2, 0, 0), bevel=0.005)
    m.box('oliva', (0.44, 0.5, 0.08), (0, 0.15, 0.18), bevel=0.02)
    m.pivot('turret', 0, 0.15, 0.27)
    m.cyl('oliva_osc', 0.14, 0.06, (0, 0.15, 0.26), seg=16, part='turret')
    m.box('EQUIPO', (0.24, 0.2, 0.12), (0, 0.15, 0.31), bevel=0.04, part='turret')
    for sx in (-1, 1):
        m.cyl('oscuro', 0.018, 0.4, (sx * 0.07, -0.02, 0.48), rot=(H - 0.9, 0, 0), seg=8, base=False, part='turret')
        m.box('oscuro', (0.05, 0.12, 0.06), (sx * 0.07, 0.1, 0.39), rot=(-0.9, 0, 0), bevel=0.01, part='turret')
    m.box('metal_claro', (0.12, 0.02, 0.1), (0, 0.27, 0.4), rot=(0.3, 0, 0), bevel=0.01, part='turret')
    return m


# =====================================================================
# Barcos: cascos con forma, cubierta, puente y detalles
# =====================================================================


def submarine():
    m = Model('sub')
    m.cyl('negro', 0.15, 1.0, (0, 0, 0.0), rot=(H, 0, 0), seg=18, base=False)
    m.sphere('negro', 0.15, (0, -0.5, 0.0), scale=(1, 1.2, 1))
    m.cone('negro', 0.15, 0.36, (0, 0.68, 0.0), rot=(-H, 0, 0), seg=18, smooth=True)
    m.box('EQUIPO', (0.11, 0.26, 0.2), (0, -0.08, 0.1), bevel=0.04)
    m.box('negro', (0.32, 0.07, 0.015), (0, -0.08, 0.22), bevel=0.004)
    m.cyl('oscuro', 0.008, 0.16, (0.02, -0.12, 0.3), seg=8)
    m.cyl('oscuro', 0.008, 0.1, (-0.02, -0.04, 0.3), seg=8)
    m.box('oscuro', (0.4, 0.08, 0.015), (0, 0.66, 0.0), bevel=0.004)
    m.box('oscuro', (0.015, 0.08, 0.26), (0, 0.66, -0.13), bevel=0.004)
    m.cyl('metal', 0.04, 0.03, (0, 0.85, 0.0), rot=(H, 0, 0), seg=10, base=False)
    return m


# =====================================================================
# Helicópteros
# =====================================================================


def apache():
    m = Model('apache')
    m.box('EQUIPO', (0.2, 0.62, 0.2), (0, -0.02, 0.12), bevel=0.05)
    m.box('EQUIPO_OSC', (0.16, 0.24, 0.14), (0, -0.36, 0.13), rot=(0.12, 0, 0), bevel=0.04)
    m.box('vidrio', (0.14, 0.14, 0.09), (0, -0.33, 0.26), rot=(0.25, 0, 0), bevel=0.02)
    m.box('vidrio', (0.14, 0.14, 0.1), (0, -0.15, 0.3), rot=(0.2, 0, 0), bevel=0.02)
    m.cyl('EQUIPO_OSC', 0.045, 0.62, (0, 0.55, 0.22), rot=(H, 0, 0), seg=10, r2=0.028, base=False)
    m.box('EQUIPO_OSC', (0.02, 0.16, 0.2), (0, 0.84, 0.3), rot=(0.25, 0, 0), bevel=0.01)
    m.box('EQUIPO_OSC', (0.24, 0.07, 0.015), (0, 0.82, 0.22), bevel=0.005)
    m.cyl('oscuro', 0.06, 0.01, (0.03, 0.86, 0.3), rot=(0, H, 0), seg=12, base=False)
    for sx in (-1, 1):
        m.box('oscuro', (0.3, 0.1, 0.025), (sx * 0.22, 0.0, 0.2), bevel=0.008)
        m.cyl('oliva_osc', 0.04, 0.2, (sx * 0.3, -0.02, 0.15), rot=(H, 0, 0), seg=10, base=False)
        for k in range(2):
            m.cyl('blanco', 0.018, 0.16, (sx * (0.16 + k * 0.05), -0.02, 0.15), rot=(H, 0, 0), seg=8, base=False)
        m.box('oscuro', (0.03, 0.12, 0.08), (sx * 0.12, 0.05, 0.13), bevel=0.01)
        m.box('oscuro', (0.02, 0.02, 0.08), (sx * 0.1, -0.2, 0.0), bevel=0.0)
        m.box('oscuro', (0.02, 0.02, 0.08), (sx * 0.1, 0.25, 0.0), bevel=0.0)
        m.cyl('goma', 0.035, 0.03, (sx * 0.1, -0.2, 0.0), rot=(0, H, 0), seg=10, base=False)
    m.cyl('oscuro', 0.03, 0.06, (0, -0.42, 0.02), seg=10)
    m.cyl('metal', 0.012, 0.18, (0, -0.52, 0.03), rot=(H, 0, 0), seg=8, base=False)
    m.cyl('oscuro', 0.04, 0.1, (0, 0.0, 0.32), seg=10)
    m.pivot('rotor', 0, 0.0, 0.44)
    m.cyl('oscuro', 0.045, 0.04, (0, 0, 0.43), seg=12, part='rotor')
    m.sphere('oscuro', 0.06, (0, 0, 0.5), scale=(1, 1, 0.7), part='rotor')
    m.box('oscuro', (1.36, 0.07, 0.012), (0, 0, 0.44), bevel=0.004, part='rotor')
    m.box('oscuro', (0.07, 1.36, 0.012), (0, 0, 0.44), bevel=0.004, part='rotor')
    return m


# =====================================================================
# Edificios
# =====================================================================


def pump():
    m = Model('pump')
    m.box('concreto', (1.1, 0.8, 0.05), (0, 0.05, 0), bevel=0.02)
    m.cyl('negro', 0.18, 0.012, (0.32, 0.25, 0.05), seg=18)
    m.box('metal', (0.06, 0.06, 0.62), (0, -0.12, 0.05), rot=(0.28, 0, 0), bevel=0.01)
    m.box('metal', (0.06, 0.06, 0.62), (0, 0.06, 0.05), rot=(-0.28, 0, 0), bevel=0.01)
    m.box('EQUIPO', (0.2, 0.22, 0.16), (0, 0.32, 0.05), bevel=0.03)
    m.cyl('blanco', 0.16, 0.4, (-0.38, -0.25, 0.05), seg=16)
    m.cyl('EQUIPO_OSC', 0.17, 0.03, (-0.38, -0.25, 0.45), seg=16)
    m.cyl('oscuro', 0.035, 0.28, (0, -0.42, 0.05), seg=10)
    m.pivot('rocker', 0, -0.03, 0.66)
    m.box('amarillo', (0.07, 0.9, 0.07), (0, 0.02, 0.62), bevel=0.015, part='rocker')
    m.box('amarillo', (0.09, 0.14, 0.24), (0, -0.46, 0.5), rot=(0.35, 0, 0), bevel=0.02, part='rocker')
    m.box('oscuro', (0.14, 0.16, 0.14), (0, 0.4, 0.58), bevel=0.02, part='rocker')
    return m


def house():
    m = Model('house')
    m.box('blanco', (0.6, 0.52, 0.36), (0, 0, 0), bevel=0.02)
    m.wedge('EQUIPO', (0.7, 0.64, 0.3), (0, 0, 0.36))
    m.box('madera', (0.13, 0.015, 0.22), (0, -0.265, 0), bevel=0.004)
    for sx in (-1, 1):
        m.box('vidrio', (0.12, 0.015, 0.1), (sx * 0.19, -0.265, 0.14), bevel=0.004)
        m.box('madera', (0.14, 0.02, 0.015), (sx * 0.19, -0.27, 0.13), bevel=0.0)
    m.box('ladrillo', (0.09, 0.09, 0.3), (0.2, 0.12, 0.42), bevel=0.01)
    m.box('blanco', (0.32, 0.3, 0.28), (0.46, 0.18, 0), bevel=0.02)
    m.wedge('EQUIPO_OSC', (0.36, 0.36, 0.16), (0.46, 0.18, 0.28), rot=(0, 0, H))
    for k in range(5):
        m.box('madera_clara', (0.02, 0.02, 0.1), (-0.45 + k * 0.1, -0.42, 0), bevel=0.0)
    m.box('madera_clara', (0.44, 0.015, 0.015), (-0.25, -0.42, 0.07), bevel=0.0)
    return m


def solar():
    m = Model('solar')
    m.box('concreto', (1.0, 0.9, 0.03), (0, 0, 0), bevel=0.01)
    for ix in (-1, 1):
        for iy in (-1, 1):
            x, y = ix * 0.24, iy * 0.22
            m.box('metal', (0.03, 0.03, 0.16), (x, y + 0.06, 0.03), bevel=0.0)
            m.box('metal', (0.03, 0.03, 0.08), (x, y - 0.06, 0.03), bevel=0.0)
            m.box('panel', (0.4, 0.32, 0.025), (x, y, 0.16), rot=(0.45, 0, 0), bevel=0.006)
            for k in range(3):
                m.box('metal_claro', (0.39, 0.006, 0.004), (x, y - 0.1 + k * 0.1, 0.165 + (k - 1) * 0.045),
                      rot=(0.45, 0, 0), bevel=0.0)
    m.box('EQUIPO', (0.14, 0.1, 0.16), (0.42, 0.36, 0.03), bevel=0.02)
    return m


def wind():
    m = Model('wind')
    m.hexprism('concreto', 0.3, 0.08)
    m.cyl('blanco', 0.075, 1.48, (0, 0, 0.08), seg=14, r2=0.045)
    m.box('EQUIPO', (0.11, 0.004, 0.06), (0, -0.07, 0.3), bevel=0.0)
    m.box('blanco', (0.14, 0.3, 0.13), (0, 0.04, 1.5), bevel=0.04)
    m.box('EQUIPO', (0.15, 0.31, 0.03), (0, 0.04, 1.55), bevel=0.01)
    m.pivot('blades', 0, -0.13, 1.565)
    m.sphere('blanco', 0.06, (0, -0.15, 1.565), scale=(1, 1.3, 1), part='blades')
    for k in range(3):
        a = k * 2 * PI / 3
        m.box('blanco', (0.07, 0.015, 0.62), (math.sin(a) * 0.33, -0.15, 1.565 + math.cos(a) * 0.33),
              rot=(0, a, 0), bevel=0.006, part='blades', base=False)
    return m


def hydro():
    m = Model('hydro')
    m.box('concreto', (1.3, 0.3, 0.5), (0, 0.2, 0), bevel=0.03)
    m.box('agua', (0.5, 0.6, 0.02), (0, -0.25, 0.0), bevel=0.0)
    m.box('concreto', (0.5, 0.06, 0.12), (0, -0.04, 0.38), bevel=0.01)
    m.box('agua', (0.46, 0.1, 0.4), (0, 0.02, 0.0), rot=(0.25, 0, 0), bevel=0.0)
    m.box('EQUIPO', (0.34, 0.3, 0.3), (-0.42, -0.25, 0), bevel=0.03)
    m.wedge('EQUIPO_OSC', (0.38, 0.34, 0.12), (-0.42, -0.25, 0.3))
    for sx in (-1, 1):
        m.box('metal', (0.04, 0.08, 0.22), (0.38 + sx * 0.12, -0.25, 0), bevel=0.01)
    m.pivot('blades', 0.38, -0.25, 0.22)
    m.cyl('metal', 0.04, 0.2, (0.38, -0.25, 0.22), rot=(0, H, 0), seg=10, base=False, part='blades')
    for k in range(8):
        a = k * PI / 4
        m.box('madera', (0.16, 0.025, 0.06), (0.38, -0.25 + math.sin(a) * 0.17, 0.22 + math.cos(a) * 0.17),
              rot=(a, 0, 0), bevel=0.004, part='blades', base=False)
    m.cyl('madera', 0.2, 0.02, (0.31, -0.25, 0.22), rot=(0, H, 0), seg=16, base=False, part='blades')
    return m


def tidal():
    m = Model('tidal')
    m.cyl('concreto', 0.14, 0.9, (0, 0.1, -0.35), seg=14)
    m.box('metal', (0.6, 0.5, 0.06), (0, 0.15, 0.48), bevel=0.02)
    m.box('EQUIPO', (0.36, 0.3, 0.22), (0.05, 0.22, 0.54), bevel=0.03)
    m.box('vidrio', (0.32, 0.012, 0.05), (0.05, 0.065, 0.65), bevel=0.003)
    m.box('amarillo', (0.62, 0.02, 0.06), (0, -0.1, 0.54), bevel=0.0)
    m.cyl('metal', 0.07, 0.28, (0, -0.1, 0.05), rot=(H, 0, 0), seg=12, base=False)
    m.pivot('blades', 0, -0.26, 0.05)
    m.cone('metal_claro', 0.07, 0.12, (0, -0.3, 0.05), rot=(H, 0, 0), seg=12, part='blades', smooth=True)
    for k in range(3):
        a = k * 2 * PI / 3
        m.box('EQUIPO_OSC', (0.07, 0.015, 0.36), (math.sin(a) * 0.19, -0.26, 0.05 + math.cos(a) * 0.19),
              rot=(0, a, 0), bevel=0.005, part='blades', base=False)
    return m


def wave():
    m = Model('wave')
    m.cyl('oscuro', 0.05, 0.3, (0.5, 0.5, -0.1), seg=10)
    m.cyl('EQUIPO', 0.1, 0.14, (0.5, 0.5, 0.0), seg=14)
    m.cone('amarillo', 0.06, 0.12, (0.5, 0.5, 0.14), seg=10)
    m.pivot('rocker', 0, 0, 0.04)
    for k in range(4):
        y = -0.5 + k * 0.32
        m.cyl('naranja' if k % 2 == 0 else 'EQUIPO', 0.085, 0.27, (0, y, 0.04), rot=(H, 0, 0), seg=14, base=False,
              part='rocker')
        if k < 3:
            m.cyl('oscuro', 0.06, 0.06, (0, y + 0.16, 0.04), rot=(H, 0, 0), seg=10, base=False, part='rocker')
    m.sphere('naranja', 0.085, (0, -0.64, 0.04), part='rocker')
    return m


def barracks():
    m = Model('barracks')
    m.box('concreto', (1.2, 0.86, 0.04), (0, 0.05, 0), bevel=0.01)
    m.cyl('oliva', 0.36, 1.0, (0, 0.05, 0.04), rot=(0, H, 0), seg=20, base=False)
    m.box('oliva', (1.0, 0.72, 0.04), (0, 0.05, 0.02), bevel=0.0)
    m.box('oscuro', (0.04, 0.26, 0.3), (0.5, 0.05, 0.04), bevel=0.01)
    m.box('EQUIPO', (0.03, 0.3, 0.06), (0.51, 0.05, 0.34), bevel=0.005)
    for k in range(3):
        m.box('vidrio', (0.12, 0.012, 0.06), (-0.3 + k * 0.3, -0.31, 0.22), rot=(-0.5, 0, 0), bevel=0.003)
    for k in range(4):
        m.box('trigo', (0.16, 0.09, 0.07), (-0.45 + k * 0.16, -0.48, 0.04), bevel=0.03)
    m.box('trigo', (0.16, 0.09, 0.07), (-0.37, -0.48, 0.11), bevel=0.03)
    m.box('oscuro', (0.025, 0.025, 0.85), (0.5, -0.4, 0.04), bevel=0.0)
    m.box('EQUIPO', (0.012, 0.26, 0.16), (0.5, -0.27, 0.68), bevel=0.003)
    return m


def factory():
    m = Model('factory')
    m.box('ladrillo', (1.16, 0.84, 0.46), (0, 0, 0), bevel=0.02)
    for k in range(3):
        m.wedge('EQUIPO', (0.39, 0.84, 0.18), (-0.39 + k * 0.39, 0, 0.46), rot=(0, 0, H))
        m.box('vidrio', (0.012, 0.8, 0.12), (-0.39 + k * 0.39 - 0.17, 0, 0.5), rot=(0, 0.5, 0), bevel=0.0)
    m.box('oscuro', (0.46, 0.015, 0.34), (0.15, -0.425, 0), bevel=0.005)
    for k in range(5):
        m.box('metal', (0.44, 0.012, 0.01), (0.15, -0.432, 0.05 + k * 0.06), bevel=0.0)
    for k in range(3):
        m.box('amarillo', (0.12, 0.012, 0.08), (-0.38, -0.425, 0.12 + k * 0.0), bevel=0.003)
    m.cyl('gris', 0.08, 0.75, (-0.36, 0.26, 0.46), seg=12)
    m.cyl('gris', 0.08, 0.6, (-0.12, 0.26, 0.46), seg=12)
    m.cyl('rojo', 0.085, 0.05, (-0.36, 0.26, 1.15), seg=12)
    return m


def harbor():
    m = Model('harbor')
    m.box('concreto', (1.36, 1.1, 0.2), (0, 0, -0.1), bevel=0.03)
    for (x, y) in [(-0.62, -0.5), (0.62, -0.5), (-0.62, 0.5), (0.62, 0.5), (0, -0.5)]:
        m.cyl('madera', 0.05, 0.25, (x, y, -0.25), seg=10)
    m.box('oscuro', (0.7, 0.5, 0.4), (-0.22, 0.18, 0.1), bevel=0.02)
    m.box('EQUIPO', (0.74, 0.54, 0.07), (-0.22, 0.18, 0.5), bevel=0.02)
    m.box('amarillo', (0.3, 0.012, 0.3), (-0.22, -0.075, 0.1), bevel=0.004)
    m.box('amarillo', (0.06, 0.06, 0.95), (0.45, 0.3, 0.1), bevel=0.01)
    m.box('amarillo', (0.06, 0.7, 0.06), (0.45, 0.02, 1.02), bevel=0.01)
    m.box('oscuro', (0.006, 0.006, 0.3), (0.45, -0.28, 0.72), bevel=0.0)
    m.box('metal', (0.1, 0.1, 0.06), (0.45, -0.28, 0.68), bevel=0.01)
    for x in (-0.5, -0.2, 0.1, 0.4):
        m.cyl('oscuro', 0.025, 0.05, (x, -0.5, 0.1), seg=10)
    m.box('madera_clara', (0.12, 0.12, 0.1), (0.2, -0.2, 0.1), bevel=0.01)
    m.box('madera_clara', (0.12, 0.12, 0.1), (0.2, -0.2, 0.2), bevel=0.01)
    return m


def miniturret():
    m = Model('miniturret')
    m.cyl('piedra', 0.3, 0.12, seg=8)
    m.box('trigo', (0.5, 0.1, 0.08), (0, 0.18, 0.0), bevel=0.03)
    m.pivot('turret', 0, 0, 0.12)
    m.cyl('EQUIPO', 0.15, 0.1, (0, 0, 0.12), seg=12, part='turret')
    m.box('oscuro', (0.06, 0.24, 0.06), (0, -0.12, 0.2), bevel=0.01, part='turret')
    m.box('metal', (0.18, 0.02, 0.1), (0, -0.04, 0.2), bevel=0.004, part='turret')
    return m


def wall_post():
    m = Model('wall_post')
    m.box('piedra', (0.4, 0.4, 0.62), (0, 0, 0), bevel=0.03)
    m.box('piedra_clara', (0.46, 0.46, 0.06), (0, 0, 0.56), bevel=0.02)
    for (x, y) in [(-0.15, -0.15), (0.15, -0.15), (-0.15, 0.15), (0.15, 0.15)]:
        m.box('piedra_clara', (0.12, 0.12, 0.12), (x, y, 0.62), bevel=0.015)
    m.box('EQUIPO', (0.42, 0.42, 0.04), (0, 0, 0.38), bevel=0.008)
    m.box('oscuro', (0.06, 0.012, 0.12), (0, -0.2, 0.42), bevel=0.0)
    return m


def wall_segment():
    """Tramo de muralla que va del centro de la casilla hacia -Y (el frente): mide medio paso de casilla."""
    m = Model('wall_seg')
    L = 0.9
    m.box('piedra', (0.26, L, 0.46), (0, -L / 2 - 0.05, 0), bevel=0.02)
    m.box('piedra_clara', (0.3, L, 0.04), (0, -L / 2 - 0.05, 0.46), bevel=0.01)
    for k in range(3):
        m.box('piedra_clara', (0.1, 0.12, 0.1), (-0.08, -0.22 - k * 0.28, 0.5), bevel=0.012)
        m.box('piedra_clara', (0.1, 0.12, 0.1), (0.08, -0.22 - k * 0.28, 0.5), bevel=0.012)
    m.box('EQUIPO', (0.27, L, 0.03), (0, -L / 2 - 0.05, 0.3), bevel=0.004)
    return m


def hospital(level):
    m = Model(f'hospital_{level}')
    if level == 1:
        m.box('blanco', (0.6, 0.46, 0.34), (0.1, 0.05, 0), bevel=0.02)
        m.box('rojo', (0.22, 0.06, 0.012), (0.1, 0.05, 0.34), bevel=0.0)
        m.box('rojo', (0.06, 0.22, 0.012), (0.1, 0.05, 0.34), bevel=0.0)
        m.box('oscuro', (0.14, 0.012, 0.2), (0.1, -0.185, 0), bevel=0.004)
        m.cone('blanco', 0.32, 0.36, (-0.4, -0.25, 0), seg=4)
        m.box('rojo', (0.08, 0.012, 0.02), (-0.4, -0.48, 0.18), bevel=0.0)
        m.box('EQUIPO', (0.6, 0.47, 0.03), (0.1, 0.05, 0.22), bevel=0.006)
    elif level == 2:
        m.box('blanco', (0.78, 0.56, 0.56), (0, 0.04, 0), bevel=0.02)
        m.box('EQUIPO', (0.8, 0.58, 0.04), (0, 0.04, 0.27), bevel=0.006)
        for k in range(4):
            m.box('vidrio', (0.12, 0.012, 0.09), (-0.27 + k * 0.18, -0.245, 0.4), bevel=0.003)
        m.box('vidrio', (0.2, 0.012, 0.2), (0, -0.245, 0), bevel=0.003)
        m.box('blanco', (0.36, 0.18, 0.03), (0, -0.33, 0.22), bevel=0.01)
        m.box('rojo', (0.26, 0.02, 0.08), (0, -0.245, 0.62), bevel=0.0)
        m.box('rojo', (0.08, 0.02, 0.26), (0, -0.245, 0.53), bevel=0.0)
        m.box('blanco', (0.03, 0.03, 0.22), (-0.16, -0.4, 0), bevel=0.0)
        m.box('blanco', (0.03, 0.03, 0.22), (0.16, -0.4, 0), bevel=0.0)
    else:
        m.box('blanco', (1.0, 0.5, 0.78), (0, 0.18, 0), bevel=0.02)
        m.box('blanco', (0.42, 0.5, 0.5), (0.32, -0.3, 0), bevel=0.02)
        for z in (0.27, 0.53):
            m.box('EQUIPO', (1.02, 0.52, 0.03), (0, 0.18, z), bevel=0.006)
        for row in range(3):
            for k in range(5):
                m.box('vidrio', (0.1, 0.012, 0.08), (-0.4 + k * 0.2, -0.075, 0.1 + row * 0.24), bevel=0.003)
        m.cyl('oscuro', 0.2, 0.02, (-0.2, 0.18, 0.78), seg=18)
        m.box('blanco', (0.03, 0.14, 0.005), (-0.25, 0.18, 0.8), bevel=0.0)
        m.box('blanco', (0.03, 0.14, 0.005), (-0.15, 0.18, 0.8), bevel=0.0)
        m.box('blanco', (0.1, 0.03, 0.005), (-0.2, 0.18, 0.8), bevel=0.0)
        m.box('rojo', (0.24, 0.02, 0.07), (0.32, -0.555, 0.38), bevel=0.0)
        m.box('rojo', (0.07, 0.02, 0.24), (0.32, -0.555, 0.3), bevel=0.0)
        m.box('blanco', (0.2, 0.34, 0.16), (-0.3, -0.38, 0.04), bevel=0.03)
        m.box('rojo', (0.21, 0.35, 0.03), (-0.3, -0.38, 0.12), bevel=0.0)
        wheels(m, [(-0.4, -0.48), (-0.2, -0.48), (-0.4, -0.28), (-0.2, -0.28)], r=0.04, w=0.03)
    return m


def outpost():
    m = Model('outpost')
    m.cone('EQUIPO', 0.5, 0.6, (-0.15, 0, 0), seg=4)
    m.box('oscuro', (0.16, 0.012, 0.22), (-0.15, -0.36, 0), rot=(0, 0, PI / 4), bevel=0.0)
    m.box('oscuro', (0.025, 0.025, 1.0), (0.45, -0.2, 0), bevel=0.0)
    m.box('EQUIPO', (0.012, 0.3, 0.18), (0.45, -0.06, 0.78), bevel=0.003)
    m.box('madera', (0.2, 0.2, 0.18), (0.4, 0.35, 0), bevel=0.02)
    m.box('madera', (0.15, 0.15, 0.13), (0.2, 0.5, 0), bevel=0.02)
    return m


def scaffold():
    """Andamio que rodea las obras en construcción."""
    m = Model('scaffold')
    R = 0.62
    corners = [(-R, -R), (R, -R), (R, R), (-R, R)]
    for (x, y) in corners:
        m.box('madera_clara', (0.04, 0.04, 0.95), (x, y, 0), bevel=0.0)
    for z in (0.32, 0.64, 0.92):
        for i in range(4):
            (x1, y1), (x2, y2) = corners[i], corners[(i + 1) % 4]
            mx, my = (x1 + x2) / 2, (y1 + y2) / 2
            rotz = 0 if y1 == y2 else H
            m.box('madera', (2 * R, 0.03, 0.03), (mx, my, z), rot=(0, 0, rotz), bevel=0.0)
    for i in range(4):
        (x1, y1), (x2, y2) = corners[i], corners[(i + 1) % 4]
        mx, my = (x1 + x2) / 2, (y1 + y2) / 2
        rotz = 0 if y1 == y2 else H
        m.box('madera', (2 * R * 1.1, 0.025, 0.025), (mx, my, 0.02), rot=(0.6, 0, rotz), bevel=0.0)
        m.box('amarillo', (2 * R, 0.12, 0.02), (mx * 1.04, my * 1.04, 0.33), rot=(0, 0, rotz), bevel=0.0)
    m.box('amarillo', (0.36, 0.012, 0.12), (0, -R - 0.02, 0.5), bevel=0.0)
    m.box('negro', (0.06, 0.014, 0.12), (-0.1, -R - 0.03, 0.5), rot=(0, 0.6, 0), bevel=0.0)
    m.box('negro', (0.06, 0.014, 0.12), (0.1, -R - 0.03, 0.5), rot=(0, 0.6, 0), bevel=0.0)
    return m


def all_models():
    out = []
    infantry = ['builder', 'engineer', 'rifle', 'shotgun', 'ranger', 'sniper', 'breaker', 'hunter', 'rocket']
    for k in infantry:
        out.append(soldier(k))
    # Skin Brigada Tóxica: los mismos soldados con capucha y máscara de gas.
    for k in infantry:
        out.append(soldier(k, 'toxico'))
    out += [jeep(), tank(), aa_truck(), arty(), speedboat(), boat_engineer(), barge(), destroyer(), submarine(),
            helicopter(), apache()]
    out += [core(1), core(2), core(3), farm(), pump(), mine(), rig(), house(), solar(), wind(), hydro(), tidal(), wave(),
            barracks(), factory(), harbor(), helipad(), turret(1), turret(2), turret(3), miniturret(), aadef(),
            wall_post(), wall_segment(), hospital(1), hospital(2), hospital(3), outpost(), scaffold()]
    return out


def main():
    args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
    out_dir = os.path.abspath(args[0] if args else 'models')
    os.makedirs(out_dir, exist_ok=True)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    total = 0
    models = all_models()
    for m in models:
        path = os.path.join(out_dir, m.name + '.glb')
        m.export(path)
        total += os.path.getsize(path)
    print(f'[Blender] ✅ {len(models)} modelos · {total / 1024:.0f} KB en {out_dir}')


if __name__ == '__main__':
    main()
