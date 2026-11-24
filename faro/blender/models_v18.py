"""Modelos de la v1.8: todas las tropas y edificios del catálogo del usuario (PRD 1.8, secciones 37-54) y de su
lista de equipamiento que faltaban en el juego.

Estilo de los modelos 0.2 del usuario: bloques, soldados con uniforme verde, vehículos verde militar, flota gris,
el color del jugador (EQUIPO) en franjas y banderas. Son piezas de juego estilizadas, no copias de vehículos reales.
Blender: Z arriba, el frente mira a -Y. Una casilla mide 1 de radio.
"""
import math

from lib import P, Model
from models_ref import soldier, tracks, wheels
from models_v17 import _cab

PI = math.pi
H = PI / 2
P.update({'camo_claro': 0xb3b98f, 'camo_medio': 0x74834d, 'camo_osc': 0x3f4a2a, 'misil': 0xa9b8ad, 'misil_osc': 0x76867c,
          'gris_osc': 0x5d646c, 'casco_naval': 0x7d8790, 'cubierta': 0x6b7178, 'lona': 0x7c7a55, 'hormigon': 0xa7a49b,
          'verde_med': 0x3fae5b, 'cruz': 0xd23b3b, 'cristal_azul': 0x6ec6ff})

HX, HY, HZ = 0.09, -0.13, 0.27   # mano del arma de los soldados (models_ref.soldier)


# =====================================================================================================
# Ayudas
# =====================================================================================================
def helmet(m, color='oliva', brim=False):
    m.sphere(color, 0.074, (0, 0.004, 0.52), scale=(1.06, 1.1, 0.72))
    m.cyl(color, 0.077, 0.024, (0, 0.004, 0.495), seg=18)
    m.box('oscuro', (0.11, 0.012, 0.018), (0, -0.07, 0.535), bevel=0.003)
    if brim:
        m.cyl(color, 0.09, 0.01, (0, -0.005, 0.495), seg=18)


def cap(m, color='oliva'):
    m.cyl(color, 0.068, 0.04, (0, 0, 0.5), seg=16)
    m.box(color, (0.1, 0.07, 0.012), (0, -0.07, 0.49), bevel=0.004)


def rifle(m, length=0.34, color='negro', scope=False, stock='madera', barrel_r=0.012):
    m.box(color, (0.045, length * 0.55, 0.055), (HX, HY - length * 0.1, HZ), bevel=0.008)
    m.box(stock, (0.04, length * 0.25, 0.05), (HX, HY + length * 0.28, HZ - 0.01), bevel=0.008)
    m.cyl('metal', barrel_r, length * 0.45, (HX, HY - length * 0.38, HZ + 0.028), rot=(H, 0, 0), seg=8, base=False)
    m.box('negro', (0.02, 0.04, 0.05), (HX, HY - length * 0.02, HZ - 0.045), rot=(0.3, 0, 0), bevel=0.004)
    if scope:
        m.cyl('oscuro', 0.018, length * 0.22, (HX, HY - length * 0.08, HZ + 0.075), rot=(H, 0, 0), seg=10, base=False)


def chassis(m, length, w=0.36, z=0.11, color='oscuro'):
    m.box(color, (w, length, 0.07), (0, 0, z), bevel=0.015)


def axles(m, ys, x=0.19, r=0.08, w=0.08):
    wheels(m, [(sx * x, y) for y in ys for sx in (-1, 1)], r=r, w=w)


def team_stripes(m, x, y, length, z, t=0.022):
    for sx in (-1, 1):
        m.box('EQUIPO', (t, length, t), (sx * x, y, z), bevel=0.004)


def tracked_hull(m, w=0.46, length=0.86, h=0.15, color='oliva', tx=0.26):
    tracks(m, tx, length + 0.04, 6, 0.048)
    for sx in (-1, 1):
        m.box(color, (0.15, length + 0.04, 0.03), (sx * tx, 0, 0.17), bevel=0.01)
    m.box(color, (w, length, h), (0, 0.02, 0.09 + h / 2 - 0.04), bevel=0.035)
    m.box('oliva_osc', (w - 0.02, 0.18, 0.09), (0, -length / 2 + 0.04, 0.12), rot=(0.55, 0, 0), bevel=0.03)
    for sx in (-1, 1):
        m.box('luz', (0.045, 0.02, 0.025), (sx * 0.15, -length / 2 - 0.02, 0.17), bevel=0.004)


def antenna(m, x, y, z, h=0.3, part='main'):
    m.tube('negro', (x, y, z), (x, y, z + h), r=0.006, seg=6, part=part)
    m.sphere('rojo', 0.012, (x, y, z + h), part=part)


def dish(m, x, y, z, r=0.12, tilt=0.6, part='main', color='blanco'):
    m.cyl(color, r, 0.03, (x, y, z), rot=(tilt, 0, 0), seg=18, r2=r * 0.55, part=part)
    m.tube('oscuro', (x, y, z), (x, y - math.sin(tilt) * r * 0.9, z + math.cos(tilt) * r * 0.9), r=0.008, seg=6, part=part)


def flag(m, x, y, z, h=0.55):
    m.tube('oscuro', (x, y, z), (x, y, z + h), r=0.01, seg=6)
    m.box('EQUIPO', (0.012, 0.18, 0.11), (x, y + 0.09, z + h - 0.07), bevel=0.0)


def ship_hull(m, length, width, color='casco_naval', deck='cubierta', z_top=0.15, stripe=True):
    L, W = length / 2, width / 2
    m.hull(color, [(L, W * 0.86, W * 0.55, -0.06, z_top), (L * 0.45, W, W * 0.66, -0.08, z_top + 0.01),
                   (-L * 0.35, W * 0.96, W * 0.55, -0.08, z_top + 0.02), (-L * 0.78, W * 0.55, W * 0.2, -0.05, z_top + 0.04),
                   (-L, 0.015, 0.01, 0.03, z_top + 0.07)])
    m.box(deck, (width * 0.86, length * 0.86, 0.014), (0, -length * 0.02, z_top + 0.005), bevel=0.0)
    if stripe:
        for sx in (-1, 1):
            m.box('EQUIPO', (0.012, length * 0.8, 0.028), (sx * (W + 0.005), -length * 0.02, z_top - 0.04), rot=(0, 0, sx * 0.05), bevel=0.0)


def gun_turret(m, y, z, r=0.07, barrel=0.22, part='turret', color='metal_claro', twin=False):
    m.pivot(part, 0, y, z)
    m.cyl('gris_osc', r, 0.035, (0, y, z), seg=14, part=part)
    m.box(color, (r * 1.9, r * 2.2, r * 1.1), (0, y, z + r * 0.5), bevel=0.03, part=part)
    for sx in ((-1, 1) if twin else (0,)):
        m.tube('oscuro', (sx * r * 0.4, y - r, z + r * 0.6), (sx * r * 0.4, y - r - barrel, z + r * 0.65), r=0.016, seg=8, part=part)


def bridge_tower(m, y, w=0.24, d=0.22, h=0.16, z=0.16, color='metal_claro'):
    m.box('gris', (w + 0.06, d + 0.06, h), (0, y, z + h / 2), bevel=0.02)
    m.box(color, (w, d, h), (0, y, z + h * 1.5), bevel=0.02)
    m.box('luz', (w + 0.01, 0.012, 0.03), (0, y - d / 2 - 0.004, z + h * 1.7), bevel=0.0)


def heli_body(m, color='EQUIPO', w=0.26, length=0.5, tail=0.8, twin=False):
    m.box(color, (w, length, 0.22), (0, 0.03, 0.12), bevel=0.07)
    m.sphere('vidrio', 0.14, (0, -length / 2 + 0.04, 0.22), scale=(0.9, 1.05, 0.85))
    m.box('EQUIPO_OSC', (w * 0.75, length * 0.45, 0.08), (0, 0.06, 0.32), bevel=0.03)
    if not twin:
        m.tube('EQUIPO_OSC', (0, length / 2, 0.2), (0, length / 2 + tail * 0.7, 0.28), r=0.04, r2=0.022, seg=10)
        m.box('EQUIPO_OSC', (0.02, 0.13, 0.17), (0, length / 2 + tail * 0.68, 0.33), rot=(0.3, 0, 0), bevel=0.01)
        m.cyl('oscuro', 0.065, 0.01, (0.03, length / 2 + tail * 0.7, 0.34), rot=(0, H, 0), seg=14, base=False)
    for sx in (-1, 1):
        m.tube('oscuro', (sx * 0.16, -0.28, 0.0), (sx * 0.16, 0.28, 0.0), r=0.014, seg=8)
        m.tube('oscuro', (sx * 0.16, -0.12, 0.0), (sx * 0.1, -0.11, 0.08), r=0.01, seg=6)
        m.tube('oscuro', (sx * 0.16, 0.14, 0.0), (sx * 0.1, 0.14, 0.08), r=0.01, seg=6)


def rotor(m, y, z, span=1.2, part='rotor', blades=2):
    m.pivot(part, 0, y, z)
    m.cyl('oscuro', 0.04, 0.04, (0, y, z - 0.01), seg=12, part=part)
    m.box('oscuro', (span, 0.065, 0.012), (0, y, z), bevel=0.004, part=part)
    if blades > 2:
        m.box('oscuro', (0.065, span * 0.85, 0.012), (0, y, z + 0.002), bevel=0.004, part=part)


def jet(m, length=1.0, span=1.0, color='gris', straight=True, z=0.12, engines=0, high=False):
    L = length / 2
    m.hull(color, [(L, 0.05, 0.05, 0.03, 0.09), (L * 0.6, 0.15, 0.13, 0.0, 0.13), (0, 0.17, 0.15, 0.0, 0.14),
                   (-L * 0.6, 0.12, 0.08, 0.02, 0.13), (-L, 0.03, 0.02, 0.06, 0.1)], loc=(0, 0, z))
    wz = z + (0.11 if high else 0.04)
    if straight:
        m.box(color, (span, 0.17, 0.022), (0, -0.02, wz), bevel=0.006)
    else:
        m.hull(color, [(0.12, 0.18, 0.18, 0.0, 0.02), (-0.18, span, span, 0.0, 0.016), (-0.24, span * 0.9, span * 0.9, 0.0, 0.014),
                       (-0.3, 0.3, 0.3, 0.0, 0.016)], loc=(0, 0, wz))
    m.box(color, (span * 0.36, 0.1, 0.016), (0, L - 0.06, z + 0.1), bevel=0.004)
    m.box('EQUIPO', (0.014, 0.16, 0.15), (0, L - 0.06, z + 0.19), rot=(0.25, 0, 0), bevel=0.0)
    m.sphere('vidrio', 0.05, (0, -L * 0.62, z + 0.12), scale=(0.8, 1.7, 0.7))
    for sx in (-1, 1):
        m.box('EQUIPO', (0.07, 0.06, 0.004), (sx * span * 0.42, -0.01, wz + 0.012), bevel=0.0)
    for k in range(engines):
        x = (k - (engines - 1) / 2) * span * (0.6 / max(1, engines - 1)) if engines > 1 else 0
        m.cyl('gris_osc', 0.045, 0.2, (x if engines > 1 else 0.13, 0.0, wz - 0.05), rot=(H, 0, 0), seg=12)


def quad(m, size=0.3, z=0.12, color='gris_osc', part_rotor=True):
    m.box(color, (size * 0.45, size * 0.45, 0.06), (0, 0, z), bevel=0.02)
    for (sx, sy) in [(-1, -1), (1, -1), (-1, 1), (1, 1)]:
        x, y = sx * size * 0.42, sy * size * 0.42
        m.beam(color, (0, 0, z), (x, y, z + 0.01), t=0.02)
        m.cyl('oscuro', 0.012, 0.03, (x, y, z + 0.02), seg=8)
        m.cyl('metal_claro', size * 0.24, 0.006, (x, y, z + 0.04), seg=14, part='rotor' if part_rotor else 'main')
    if part_rotor:
        m.pivot('rotor', 0, 0, z + 0.04)
    m.box('EQUIPO', (size * 0.3, size * 0.12, 0.012), (0, 0, z + 0.035), bevel=0.0)


def slab(m, w=1.2, d=1.0, h=0.06, color='concreto'):
    m.box(color, (w, d, h), (0, 0, h / 2 - 0.03), bevel=0.02)


def shed(m, w, d, h, x=0, y=0, z=0.03, color='gris', roof='oscuro', curved=False):
    m.box(color, (w, d, h), (x, y, z + h / 2), bevel=0.02)
    if curved:
        m.cyl(roof, w * 0.5, d, (x, y, z + h), rot=(H, 0, 0), seg=16, base=False)
    else:
        m.box(roof, (w + 0.04, d + 0.04, 0.04), (x, y, z + h + 0.02), bevel=0.01)
    m.box('EQUIPO', (w + 0.01, 0.05, 0.03), (x, y - d / 2 - 0.005, z + h - 0.04), bevel=0.0)


# =====================================================================================================
# Infantería y personal
# =====================================================================================================
def inf_scout():
    m = soldier('scout')
    cap(m, 'oliva_osc')
    rifle(m, 0.28)
    m.box('negro', (0.07, 0.03, 0.03), (0, -0.075, 0.45), bevel=0.006)
    for sx in (-1, 1):
        m.cyl('oscuro', 0.012, 0.03, (sx * 0.02, -0.095, 0.45), rot=(H, 0, 0), seg=8, base=False)
    m.box('oliva_osc', (0.11, 0.06, 0.1), (0, 0.095, 0.24), bevel=0.015)
    return m


def inf_soldier():
    m = soldier('soldier')
    helmet(m, 'oliva')
    rifle(m, 0.3)
    return m


def inf_officer():
    m = soldier('officer')
    m.cyl('oliva', 0.07, 0.035, (0, 0, 0.5), seg=16)
    m.cyl('oliva_osc', 0.08, 0.012, (0, -0.012, 0.52), seg=16)
    m.box('EQUIPO', (0.1, 0.012, 0.02), (0, -0.074, 0.52), bevel=0.0)
    m.box('negro', (0.12, 0.016, 0.085), (HX, HY - 0.02, HZ + 0.03), rot=(0.5, 0, 0), bevel=0.006)
    m.box('cristal_azul', (0.1, 0.004, 0.065), (HX, HY - 0.03, HZ + 0.033), rot=(0.5, 0, 0), bevel=0.0)
    m.box('oro', (0.03, 0.012, 0.03), (-0.05, -0.078, 0.33), bevel=0.0)
    return m


def inf_radioman():
    m = soldier('radioman')
    helmet(m, 'oliva')
    rifle(m, 0.26)
    m.box('oliva_osc', (0.15, 0.09, 0.2), (0, 0.12, 0.25), bevel=0.02)
    m.box('negro', (0.1, 0.02, 0.05), (0, 0.17, 0.3), bevel=0.004)
    antenna(m, 0.05, 0.14, 0.35, 0.42)
    m.box('negro', (0.02, 0.04, 0.04), (0.075, -0.01, 0.46), bevel=0.004)
    return m


def inf_sapper():
    m = soldier('sapper')
    helmet(m, 'tierra')
    m.box('vidrio', (0.1, 0.012, 0.03), (0, -0.074, 0.48), bevel=0.003)
    m.box('tierra', (0.15, 0.08, 0.18), (0, 0.11, 0.23), bevel=0.02)
    for k in range(3):
        m.box('rojo', (0.035, 0.035, 0.06), (-0.05 + k * 0.05, 0.16, 0.25), bevel=0.006)
    m.box('metal', (0.03, 0.2, 0.03), (HX, HY - 0.05, HZ), bevel=0.006)
    m.cyl('metal_claro', 0.04, 0.012, (HX, HY - 0.16, HZ - 0.02), rot=(0.3, 0, 0), seg=12)
    return m


def inf_mortar():
    m = soldier('mortar')
    helmet(m, 'oliva')
    m.cyl('concreto', 0.11, 0.025, (0.0, -0.32, 0.012), seg=16)
    m.tube('oscuro', (0.0, -0.3, 0.03), (0.0, -0.42, 0.32), r=0.032, seg=12)
    m.beam('metal', (0.0, -0.36, 0.17), (0.07, -0.42, 0.0), t=0.012)
    m.beam('metal', (0.0, -0.36, 0.17), (-0.07, -0.42, 0.0), t=0.012)
    for k in range(3):
        m.box('oliva_osc', (0.05, 0.05, 0.05), (0.18, -0.12 + k * 0.06, 0.025), bevel=0.006)
    return m


def inf_paratrooper():
    m = soldier('paratrooper')
    helmet(m, 'oliva_osc')
    rifle(m, 0.28)
    m.box('lona', (0.17, 0.1, 0.22), (0, 0.12, 0.27), bevel=0.04)
    m.box('EQUIPO', (0.175, 0.105, 0.03), (0, 0.12, 0.3), bevel=0.006)
    m.box('lona', (0.12, 0.06, 0.08), (0, -0.09, 0.16), bevel=0.02)
    return m


def inf_marine():
    m = soldier('marine')
    helmet(m, 'camo_osc')
    rifle(m, 0.32)
    m.box('camo_medio', (0.23, 0.16, 0.16), (0, 0, 0.24), bevel=0.02)
    m.box('EQUIPO', (0.06, 0.012, 0.04), (-0.06, -0.083, 0.3), bevel=0.0)
    m.box('agua', (0.05, 0.006, 0.02), (0.06, -0.083, 0.3), bevel=0.0)
    return m


def inf_atguided():
    m = soldier('atguided')
    helmet(m, 'oliva')
    m.cyl('oliva', 0.05, 0.56, (0.11, -0.02, 0.41), rot=(H, 0, 0), seg=14, base=False)
    m.box('oscuro', (0.09, 0.1, 0.08), (0.11, -0.12, 0.47), bevel=0.012)
    m.cyl('vidrio', 0.022, 0.012, (0.11, -0.172, 0.47), rot=(H, 0, 0), seg=10)
    m.cyl('oliva_osc', 0.055, 0.04, (0.11, 0.27, 0.41), rot=(H, 0, 0), seg=14, base=False)
    return m


def inf_gunner():
    m = soldier('gunner')
    helmet(m, 'oscuro')
    m.box('oscuro', (0.07, 0.16, 0.08), (HX, HY + 0.02, HZ), bevel=0.012)
    for k in range(6):
        a = k * PI / 3
        m.tube('negro', (HX + math.cos(a) * 0.022, HY - 0.05, HZ + math.sin(a) * 0.022),
               (HX + math.cos(a) * 0.022, HY - 0.3, HZ + math.sin(a) * 0.022), r=0.007, seg=6)
    m.box('oliva_osc', (0.13, 0.08, 0.12), (0, 0.11, 0.24), bevel=0.02)
    m.beam('amarillo', (HX, HY + 0.05, HZ - 0.03), (0.0, 0.08, 0.2), t=0.014)
    return m


def inf_antidrone():
    m = soldier('antidrone')
    helmet(m, 'oliva')
    m.box('arena', (0.06, 0.26, 0.07), (HX, HY - 0.04, HZ), bevel=0.012)
    m.box('oscuro', (0.11, 0.05, 0.11), (HX, HY - 0.2, HZ + 0.02), bevel=0.012)
    for (dx, dz) in [(-0.035, 0.035), (0.035, 0.035), (0.0, -0.035)]:
        m.tube('negro', (HX + dx, HY - 0.22, HZ + 0.02 + dz), (HX + dx * 1.6, HY - 0.36, HZ + 0.02 + dz * 1.6), r=0.008, seg=6)
    m.box('oliva_osc', (0.12, 0.07, 0.12), (0, 0.11, 0.23), bevel=0.02)
    antenna(m, 0.04, 0.13, 0.33, 0.12)
    return m


def robodog():
    m = Model('robodog')
    m.box('gris_osc', (0.16, 0.42, 0.11), (0, 0, 0.27), bevel=0.04)
    m.box('EQUIPO', (0.165, 0.2, 0.02), (0, 0.03, 0.33), bevel=0.006)
    m.box('oscuro', (0.12, 0.12, 0.09), (0, -0.25, 0.3), bevel=0.03)
    m.box('cristal_azul', (0.09, 0.012, 0.035), (0, -0.312, 0.31), bevel=0.0)
    for sx in (-1, 1):
        for sy in (-1, 1):
            x, y = sx * 0.075, sy * 0.15
            m.beam('gris_osc', (x, y, 0.25), (x, y - 0.04 * sy, 0.13), t=0.03)
            m.beam('oscuro', (x, y - 0.04 * sy, 0.13), (x, y, 0.02), t=0.025)
            m.box('negro', (0.04, 0.05, 0.02), (x, y, 0.01), bevel=0.006)
    antenna(m, 0.03, 0.12, 0.33, 0.12)
    return m


# =====================================================================================================
# Tierra: blindados, artillería y apoyo
# =====================================================================================================
def armoredcar():
    m = Model('armoredcar')
    axles(m, [-0.26, 0.0, 0.26], x=0.21, r=0.085, w=0.08)
    m.box('oliva', (0.42, 0.8, 0.16), (0, 0.0, 0.2), bevel=0.04)
    m.box('oliva_osc', (0.4, 0.16, 0.1), (0, -0.4, 0.2), rot=(0.6, 0, 0), bevel=0.03)
    team_stripes(m, 0.212, 0.0, 0.7, 0.26)
    m.box('vidrio', (0.26, 0.012, 0.05), (0, -0.405, 0.27), rot=(0.6, 0, 0), bevel=0.0)
    m.pivot('turret', 0, 0.05, 0.28)
    m.cyl('oliva_osc', 0.12, 0.08, (0, 0.05, 0.28), seg=8, part='turret')
    m.box('EQUIPO', (0.16, 0.16, 0.05), (0, 0.06, 0.34), bevel=0.02, part='turret')
    m.tube('oscuro', (0, -0.05, 0.33), (0, -0.4, 0.33), r=0.018, seg=8, part='turret')
    return m


def ifv():
    m = Model('ifv')
    tracked_hull(m, 0.46, 0.92, 0.2)
    m.box('oliva_osc', (0.44, 0.06, 0.16), (0, 0.48, 0.2), bevel=0.02)
    m.box('oscuro', (0.2, 0.02, 0.12), (0, 0.512, 0.2), bevel=0.0)
    team_stripes(m, 0.232, 0.05, 0.7, 0.24)
    m.pivot('turret', -0.06, -0.05, 0.27)
    m.box('EQUIPO', (0.24, 0.28, 0.1), (-0.06, -0.05, 0.31), bevel=0.04, part='turret')
    m.tube('oscuro', (-0.06, -0.2, 0.33), (-0.06, -0.55, 0.34), r=0.016, seg=8, part='turret')
    m.box('oscuro', (0.07, 0.1, 0.06), (0.08, -0.02, 0.33), bevel=0.01, part='turret')
    return m


def trooptruck():
    m = Model('trooptruck')
    axles(m, [-0.32, 0.12, 0.3])
    chassis(m, 0.98)
    _cab(m, -0.32, w=0.38, h=0.18, d=0.22)
    m.box('oliva_osc', (0.4, 0.62, 0.05), (0, 0.17, 0.18), bevel=0.01)
    m.cyl('lona', 0.2, 0.6, (0, 0.17, 0.24), rot=(H, 0, 0), seg=14, base=True, r2=0.2)
    m.box('lona', (0.4, 0.6, 0.1), (0, 0.17, 0.25), bevel=0.02)
    team_stripes(m, 0.2, 0.17, 0.56, 0.22)
    return m


def ambulance():
    m = Model('ambulance')
    axles(m, [-0.25, 0.25], x=0.2)
    chassis(m, 0.86)
    m.box('blanco', (0.42, 0.24, 0.22), (0, -0.3, 0.27), bevel=0.04)
    m.box('vidrio', (0.36, 0.012, 0.08), (0, -0.425, 0.32), rot=(-0.15, 0, 0), bevel=0.0)
    m.box('blanco', (0.44, 0.56, 0.32), (0, 0.12, 0.31), bevel=0.04)
    for sx in (-1, 1):
        m.box('cruz', (0.006, 0.18, 0.05), (sx * 0.223, 0.12, 0.33), bevel=0.0)
        m.box('cruz', (0.006, 0.05, 0.18), (sx * 0.223, 0.12, 0.33), bevel=0.0)
    m.box('cruz', (0.18, 0.05, 0.006), (0, 0.12, 0.473), bevel=0.0)
    m.box('cruz', (0.05, 0.18, 0.006), (0, 0.12, 0.473), bevel=0.0)
    m.box('EQUIPO', (0.445, 0.04, 0.03), (0, 0.4, 0.2), bevel=0.0)
    m.box('agua', (0.1, 0.05, 0.03), (0, -0.25, 0.4), bevel=0.01)
    return m


def recovery():
    m = Model('recovery')
    tracked_hull(m, 0.46, 0.9, 0.2)
    m.box('oliva_osc', (0.36, 0.3, 0.12), (0, -0.2, 0.3), bevel=0.03)
    team_stripes(m, 0.232, 0.0, 0.7, 0.24)
    m.pivot('turret', 0, 0.2, 0.27)
    m.box('amarillo', (0.12, 0.12, 0.08), (0, 0.2, 0.3), bevel=0.02, part='turret')
    m.beam('amarillo', (0, 0.2, 0.32), (0, 0.55, 0.62), t=0.05, part='turret')
    m.tube('negro', (0, 0.55, 0.62), (0, 0.6, 0.3), r=0.006, seg=6, part='turret')
    m.box('metal', (0.06, 0.04, 0.04), (0, 0.6, 0.29), bevel=0.006, part='turret')
    m.box('oscuro', (0.46, 0.06, 0.1), (0, -0.5, 0.1), bevel=0.02)
    return m


def supplytruck():
    m = Model('supplytruck')
    axles(m, [-0.32, 0.12, 0.3])
    chassis(m, 0.98)
    _cab(m, -0.32, w=0.38, h=0.18, d=0.22)
    m.box('oliva_osc', (0.4, 0.62, 0.05), (0, 0.17, 0.18), bevel=0.01)
    for sx in (-1, 1):
        m.box('oliva', (0.02, 0.62, 0.08), (sx * 0.19, 0.17, 0.23), bevel=0.004)
    for (x, y, c) in [(-0.09, 0.0, 'madera'), (0.09, 0.0, 'oliva'), (-0.09, 0.2, 'oliva'), (0.09, 0.2, 'madera'), (0, 0.38, 'madera'),
                      (0, 0.1, 'EQUIPO')]:
        m.box(c, (0.15, 0.15, 0.12), (x, y, 0.27 if c != 'EQUIPO' else 0.39), bevel=0.012)
    return m


def tanker():
    m = Model('tanker')
    axles(m, [-0.32, 0.12, 0.3])
    chassis(m, 0.98)
    _cab(m, -0.32, w=0.38, h=0.16, d=0.22)
    m.tube('metal_claro', (0, -0.15, 0.3), (0, 0.48, 0.3), r=0.15, seg=16)
    m.sphere('metal_claro', 0.15, (0, 0.48, 0.3), scale=(1, 0.4, 1), seg=14)
    m.sphere('metal_claro', 0.15, (0, -0.15, 0.3), scale=(1, 0.4, 1), seg=14)
    m.tube('EQUIPO', (0, 0.12, 0.3), (0, 0.2, 0.3), r=0.155, seg=16)
    m.box('oscuro', (0.08, 0.08, 0.04), (0, 0.15, 0.46), bevel=0.01)
    m.box('amarillo', (0.006, 0.12, 0.06), (0.152, 0.35, 0.3), bevel=0.0)
    return m


def commandveh():
    m = Model('commandveh')
    axles(m, [-0.28, 0.0, 0.28], x=0.21)
    m.box('oliva', (0.42, 0.82, 0.3), (0, 0.0, 0.27), bevel=0.04)
    m.box('oliva_osc', (0.4, 0.14, 0.12), (0, -0.42, 0.22), rot=(0.6, 0, 0), bevel=0.03)
    m.box('vidrio', (0.28, 0.012, 0.05), (0, -0.43, 0.28), rot=(0.6, 0, 0), bevel=0.0)
    team_stripes(m, 0.212, 0.0, 0.72, 0.35)
    m.box('EQUIPO', (0.3, 0.3, 0.03), (0, 0.1, 0.43), bevel=0.006)
    antenna(m, -0.14, 0.3, 0.42, 0.55)
    antenna(m, 0.14, 0.3, 0.42, 0.42)
    dish(m, 0.0, 0.05, 0.47, 0.07, tilt=0.9)
    m.pivot('turret', 0.1, -0.15, 0.42)
    m.box('oscuro', (0.06, 0.06, 0.05), (0.1, -0.15, 0.45), bevel=0.01, part='turret')
    m.tube('negro', (0.1, -0.18, 0.46), (0.1, -0.32, 0.46), r=0.008, seg=6, part='turret')
    return m


def mobileradar():
    m = Model('mobileradar')
    axles(m, [-0.32, 0.12, 0.3])
    chassis(m, 0.98)
    _cab(m, -0.32, w=0.38, h=0.18, d=0.22)
    m.box('oliva_osc', (0.36, 0.56, 0.12), (0, 0.17, 0.22), bevel=0.02)
    m.pivot('rotor', 0, 0.18, 0.3)
    m.tube('oscuro', (0, 0.18, 0.28), (0, 0.18, 0.42), r=0.025, seg=8, part='rotor')
    m.box('blanco', (0.5, 0.04, 0.24), (0, 0.18, 0.52), rot=(0.25, 0, 0), bevel=0.01, part='rotor')
    m.box('EQUIPO', (0.5, 0.045, 0.03), (0, 0.18, 0.4), rot=(0.25, 0, 0), bevel=0.0, part='rotor')
    for k in range(5):
        m.box('oscuro', (0.006, 0.045, 0.2), (-0.2 + k * 0.1, 0.18, 0.52), rot=(0.25, 0, 0), bevel=0.0, part='rotor')
    return m


def howitzer():
    m = Model('howitzer')
    tracked_hull(m, 0.48, 0.96, 0.16)
    m.pivot('turret', 0, 0.12, 0.25)
    m.box('EQUIPO', (0.44, 0.52, 0.18), (0, 0.15, 0.32), bevel=0.04, part='turret')
    m.box('oliva_osc', (0.4, 0.1, 0.12), (0, -0.14, 0.33), rot=(0.3, 0, 0), bevel=0.02, part='turret')
    m.tube('oscuro', (0, -0.15, 0.36), (0, -0.95, 0.42), r=0.032, seg=12, part='turret')
    m.tube('oscuro', (0, -0.92, 0.42), (0, -1.0, 0.425), r=0.044, seg=12, part='turret')
    m.box('oscuro', (0.2, 0.1, 0.06), (0, 0.38, 0.32), bevel=0.01, part='turret')
    return m


def towedgun():
    m = Model('towedgun')
    wheels(m, [(-0.2, 0.08), (0.2, 0.08)], r=0.1, w=0.07)
    m.box('oliva', (0.34, 0.14, 0.1), (0, 0.08, 0.16), bevel=0.02)
    m.box('oliva', (0.3, 0.02, 0.18), (0, -0.04, 0.24), rot=(0.2, 0, 0), bevel=0.006)
    m.box('EQUIPO', (0.3, 0.022, 0.03), (0, -0.045, 0.32), rot=(0.2, 0, 0), bevel=0.0)
    for sx in (-1, 1):
        m.beam('oliva_osc', (sx * 0.08, 0.12, 0.12), (sx * 0.26, 0.6, 0.02), t=0.04)
        m.box('oscuro', (0.08, 0.06, 0.02), (sx * 0.26, 0.6, 0.01), bevel=0.004)
    m.pivot('turret', 0, 0.06, 0.22)
    m.box('oscuro', (0.1, 0.24, 0.1), (0, 0.1, 0.25), bevel=0.02, part='turret')
    m.tube('oscuro', (0, 0.0, 0.27), (0, -0.7, 0.36), r=0.026, seg=10, part='turret')
    m.tube('oscuro', (0, -0.67, 0.355), (0, -0.74, 0.365), r=0.036, seg=10, part='turret')
    return m


def tankdestroyer():
    m = Model('tankdestroyer')
    tracked_hull(m, 0.5, 0.94, 0.14)
    m.box('EQUIPO', (0.44, 0.5, 0.12), (0, 0.15, 0.24), bevel=0.05)
    m.box('oliva_osc', (0.42, 0.2, 0.11), (0, -0.16, 0.22), rot=(0.4, 0, 0), bevel=0.03)
    m.pivot('turret', 0, -0.05, 0.24)
    m.box('oliva_osc', (0.14, 0.14, 0.08), (0, -0.08, 0.26), bevel=0.02, part='turret')
    m.tube('oscuro', (0, -0.14, 0.27), (0, -0.95, 0.27), r=0.03, seg=12, part='turret')
    m.cyl('oscuro', 0.042, 0.08, (0, -0.94, 0.27), rot=(H, 0, 0), seg=12, base=False, part='turret')
    return m


def amphib():
    m = Model('amphib')
    axles(m, [-0.25, 0.0, 0.25], x=0.21, r=0.07)
    m.hull('camo_medio', [(0.48, 0.2, 0.18, 0.05, 0.3), (0.2, 0.25, 0.22, 0.04, 0.32), (-0.25, 0.25, 0.22, 0.04, 0.32),
                          (-0.46, 0.2, 0.12, 0.1, 0.3), (-0.56, 0.12, 0.05, 0.2, 0.28)])
    m.box('camo_osc', (0.4, 0.4, 0.06), (0, 0.15, 0.34), bevel=0.02)
    team_stripes(m, 0.255, 0.0, 0.8, 0.28)
    m.box('vidrio', (0.24, 0.012, 0.04), (0, -0.33, 0.35), rot=(-0.4, 0, 0), bevel=0.0)
    m.pivot('turret', -0.08, -0.12, 0.36)
    m.cyl('oscuro', 0.06, 0.05, (-0.08, -0.12, 0.38), seg=10, part='turret')
    m.tube('negro', (-0.08, -0.16, 0.4), (-0.08, -0.34, 0.4), r=0.009, seg=6, part='turret')
    return m


def bridgelayer():
    m = Model('bridgelayer')
    tracked_hull(m, 0.46, 0.92, 0.16)
    m.box('oliva_osc', (0.36, 0.2, 0.12), (0, -0.32, 0.27), bevel=0.03)
    for z, k in [(0.3, 0), (0.36, 1)]:
        m.box('metal_claro', (0.46, 0.84, 0.05), (0, 0.06, z), bevel=0.01)
        for sx in (-1, 1):
            m.box('EQUIPO' if k else 'oscuro', (0.03, 0.84, 0.06), (sx * 0.22, 0.06, z + 0.01), bevel=0.004)
    m.box('amarillo', (0.06, 0.06, 0.1), (0, 0.46, 0.3), bevel=0.01)
    return m


def clearer():
    m = Model('clearer')
    tracked_hull(m, 0.46, 0.86, 0.2)
    m.box('oliva_osc', (0.3, 0.3, 0.14), (0, 0.1, 0.3), bevel=0.04)
    team_stripes(m, 0.232, 0.05, 0.6, 0.24)
    for sx in (-1, 1):
        m.beam('oscuro', (sx * 0.2, -0.3, 0.14), (sx * 0.2, -0.6, 0.1), t=0.035)
    m.tube('metal', (-0.26, -0.62, 0.08), (0.26, -0.62, 0.08), r=0.07, seg=14)
    for k in range(5):
        x = -0.2 + k * 0.1
        m.tube('oscuro', (x, -0.62, 0.0), (x, -0.62, 0.16), r=0.012, seg=6)
    return m


def dozer():
    m = Model('dozer')
    tracked_hull(m, 0.44, 0.78, 0.16, color='amarillo')
    m.box('oliva', (0.3, 0.26, 0.18), (0, 0.1, 0.32), bevel=0.03)
    m.box('vidrio', (0.26, 0.012, 0.1), (0, -0.035, 0.36), bevel=0.0)
    m.box('EQUIPO', (0.31, 0.27, 0.03), (0, 0.1, 0.42), bevel=0.006)
    m.box('metal', (0.62, 0.06, 0.2), (0, -0.55, 0.1), rot=(-0.25, 0, 0), bevel=0.02)
    m.box('amarillo', (0.64, 0.04, 0.04), (0, -0.54, 0.21), bevel=0.006)
    for sx in (-1, 1):
        m.beam('oscuro', (sx * 0.2, -0.3, 0.17), (sx * 0.2, -0.52, 0.12), t=0.035)
    return m


def thermo():
    m = Model('thermo')
    tracked_hull(m, 0.48, 0.94, 0.16)
    m.box('oliva_osc', (0.4, 0.2, 0.16), (0, -0.36, 0.28), bevel=0.03)
    m.pivot('turret', 0, 0.12, 0.26)
    th = -0.45
    m.box('EQUIPO', (0.42, 0.6, 0.26), (0, 0.12, 0.38), rot=(th, 0, 0), bevel=0.03, part='turret')
    c, s = math.cos(th), math.sin(th)
    for ix in range(6):
        for iz in range(4):
            x = -0.15 + ix * 0.06
            zc = -0.075 + iz * 0.05
            y0, z0 = -0.31, zc
            p = (x, 0.12 + y0 * c - z0 * s, 0.38 + y0 * s + z0 * c)
            m.cyl('negro', 0.02, 0.012, p, rot=(th + H, 0, 0), seg=8, base=False, part='turret')
    return m


# =====================================================================================================
# Drones
# =====================================================================================================
def scoutdrone():
    m = Model('scoutdrone')
    quad(m, 0.32, 0.12, 'gris')
    m.sphere('oscuro', 0.035, (0, -0.04, 0.07), part='main')
    m.cyl('vidrio', 0.02, 0.01, (0, -0.07, 0.07), rot=(H, 0, 0), seg=10)
    return m


def cargodrone():
    m = Model('cargodrone')
    quad(m, 0.42, 0.2, 'gris_osc')
    for (sx, sy) in [(-1, -1), (1, -1), (-1, 1), (1, 1)]:
        m.tube('negro', (sx * 0.05, sy * 0.05, 0.17), (sx * 0.08, sy * 0.08, 0.08), r=0.004, seg=4)
    m.box('madera', (0.18, 0.18, 0.12), (0, 0, 0.03), bevel=0.012)
    m.box('EQUIPO', (0.185, 0.04, 0.125), (0, 0, 0.03), bevel=0.0)
    return m


def interceptor():
    m = Model('interceptor')
    m.hull('gris', [(0.28, 0.03, 0.03, 0.0, 0.05), (0.05, 0.08, 0.07, 0.0, 0.07), (-0.2, 0.05, 0.04, 0.01, 0.06),
                    (-0.32, 0.01, 0.01, 0.03, 0.04)], loc=(0, 0, 0.12))
    m.hull('gris', [(-0.05, 0.12, 0.12, 0.0, 0.012), (0.22, 0.6, 0.6, 0.0, 0.01), (0.26, 0.2, 0.2, 0.0, 0.01)], loc=(0, 0, 0.15))
    for sx in (-1, 1):
        m.box('EQUIPO', (0.06, 0.05, 0.004), (sx * 0.24, 0.2, 0.165), bevel=0.0)
        m.box('EQUIPO', (0.012, 0.06, 0.06), (sx * 0.28, 0.22, 0.19), bevel=0.0)
    m.pivot('rotor', 0, 0.3, 0.17)
    m.box('oscuro', (0.2, 0.025, 0.006), (0, 0.3, 0.17), bevel=0.0, part='rotor')
    return m


def navaldrone():
    m = Model('navaldrone')
    for sx in (-1, 1):
        m.hull('gris', [(0.36, 0.06, 0.05, -0.03, 0.06), (-0.2, 0.07, 0.05, -0.04, 0.07), (-0.38, 0.01, 0.01, 0.0, 0.08)],
               loc=(sx * 0.13, 0, 0))
    m.box('gris_osc', (0.32, 0.4, 0.04), (0, 0.0, 0.08), bevel=0.01)
    m.box('EQUIPO', (0.18, 0.2, 0.06), (0, 0.05, 0.12), bevel=0.02)
    m.tube('oscuro', (0, -0.05, 0.12), (0, -0.05, 0.36), r=0.01, seg=6)
    m.sphere('blanco', 0.035, (0, -0.05, 0.37))
    m.cyl('oscuro', 0.03, 0.06, (0, 0.24, 0.12), rot=(H, 0, 0), seg=10)
    return m


def subdrone():
    m = Model('subdrone')
    m.tube('amarillo', (0, -0.3, 0.06), (0, 0.24, 0.06), r=0.06, seg=12)
    m.sphere('amarillo', 0.06, (0, -0.3, 0.06), scale=(1, 1.3, 1))
    m.cyl('vidrio', 0.035, 0.01, (0, -0.37, 0.06), rot=(H, 0, 0), seg=10)
    m.tube('EQUIPO', (0, 0.0, 0.06), (0, 0.06, 0.06), r=0.064, seg=12)
    for (rx, ry) in [(0.0, 0.0), (0.0, H)]:
        m.box('oscuro', (0.2, 0.05, 0.008), (0, 0.24, 0.06), rot=(0, ry, 0), bevel=0.0)
    m.cyl('oscuro', 0.03, 0.04, (0, 0.28, 0.06), rot=(H, 0, 0), seg=8)
    return m


# =====================================================================================================
# Helicópteros
# =====================================================================================================
def transheli():
    m = Model('transheli')
    m.box('EQUIPO', (0.32, 0.96, 0.28), (0, 0.04, 0.16), bevel=0.08)
    m.sphere('vidrio', 0.14, (0, -0.43, 0.25), scale=(1.0, 0.9, 0.8))
    m.box('EQUIPO_OSC', (0.3, 0.9, 0.08), (0, 0.06, 0.33), bevel=0.03)
    m.box('oscuro', (0.012, 0.22, 0.16), (0.162, -0.12, 0.17), bevel=0.0)
    for sx in (-1, 1):
        m.box('oscuro', (0.1, 0.24, 0.12), (sx * 0.2, 0.05, 0.08), bevel=0.04)
        for k in range(4):
            m.box('vidrio', (0.006, 0.05, 0.04), (sx * 0.162, -0.1 + k * 0.12, 0.25), bevel=0.0)
    m.box('EQUIPO_OSC', (0.24, 0.16, 0.2), (0, 0.42, 0.42), bevel=0.04)
    rotor(m, -0.3, 0.42, 1.0, part='rotor')
    m.pivot('blades', 0, 0.42, 0.56)
    m.box('oscuro', (1.0, 0.06, 0.012), (0, 0.42, 0.56), bevel=0.004, part='blades')
    return m


def rescueheli():
    m = Model('rescueheli')
    heli_body(m, 'blanco', 0.26, 0.5, 0.8)
    m.box('cruz', (0.006, 0.12, 0.035), (0.132, 0.04, 0.14), bevel=0.0)
    m.box('cruz', (0.006, 0.035, 0.12), (0.132, 0.04, 0.14), bevel=0.0)
    m.box('EQUIPO', (0.27, 0.06, 0.04), (0, 0.24, 0.12), bevel=0.0)
    m.tube('metal', (0.15, -0.05, 0.3), (0.26, -0.05, 0.3), r=0.01, seg=6)
    m.tube('negro', (0.26, -0.05, 0.3), (0.26, -0.05, 0.12), r=0.004, seg=4)
    m.box('rojo', (0.04, 0.02, 0.02), (0, -0.22, 0.34), bevel=0.004)
    rotor(m, 0.05, 0.42, 1.2, blades=4)
    return m


def navalheli():
    m = Model('navalheli')
    heli_body(m, 'gris', 0.27, 0.56, 0.85)
    m.sphere('blanco', 0.07, (0, -0.1, 0.0), scale=(1, 1.2, 0.6))
    for sx in (-1, 1):
        m.tube('oliva_osc', (sx * 0.2, -0.1, 0.1), (sx * 0.2, 0.18, 0.1), r=0.03, seg=10)
        m.cone('oliva_osc', 0.03, 0.06, (sx * 0.2, -0.13, 0.1), rot=(H, 0, 0), seg=10)
    m.box('EQUIPO', (0.28, 0.06, 0.04), (0, 0.2, 0.18), bevel=0.0)
    rotor(m, 0.05, 0.42, 1.25, blades=4)
    return m


# =====================================================================================================
# Aviación de ala fija
# =====================================================================================================
def attackjet():
    m = Model('attackjet')
    jet(m, 1.0, 1.1, 'gris_osc', straight=True, z=0.12)
    for sx in (-1, 1):
        m.cyl('gris', 0.06, 0.22, (sx * 0.1, 0.24, 0.3), rot=(H, 0, 0), seg=14)
        m.box('EQUIPO', (0.012, 0.12, 0.14), (sx * 0.17, 0.46, 0.3), bevel=0.0)
        for k in range(3):
            m.cyl('misil', 0.016, 0.12, (sx * (0.2 + k * 0.1), -0.02, 0.12), rot=(H, 0, 0), seg=8)
    m.tube('oscuro', (0, -0.5, 0.15), (0, -0.62, 0.14), r=0.015, seg=8)
    return m


def heavybomber():
    m = Model('heavybomber')
    jet(m, 1.5, 1.8, 'gris', straight=False, z=0.14, engines=0)
    for x in (-0.6, -0.32, 0.32, 0.6):
        m.cyl('gris_osc', 0.045, 0.2, (x, 0.08 + abs(x) * 0.18, 0.13), rot=(H, 0, 0), seg=12)
    return m


def transportplane():
    m = Model('transportplane')
    m.hull('gris_osc', [(0.7, 0.08, 0.06, 0.15, 0.24), (0.45, 0.2, 0.2, 0.06, 0.32), (-0.3, 0.22, 0.22, 0.04, 0.34),
                        (-0.62, 0.14, 0.12, 0.1, 0.3), (-0.75, 0.03, 0.03, 0.18, 0.24)], loc=(0, 0, 0.0))
    m.box('gris_osc', (1.7, 0.2, 0.025), (0, -0.05, 0.36), bevel=0.006)
    for x in (-0.6, -0.32, 0.32, 0.6):
        m.cyl('gris', 0.04, 0.16, (x, -0.1, 0.31), rot=(H, 0, 0), seg=12)
    m.box('gris_osc', (0.56, 0.1, 0.02), (0, 0.66, 0.5), bevel=0.004)
    m.box('EQUIPO', (0.016, 0.22, 0.26), (0, 0.64, 0.38), rot=(0.3, 0, 0), bevel=0.0)
    m.box('vidrio', (0.14, 0.012, 0.04), (0, -0.62, 0.26), rot=(-0.4, 0, 0), bevel=0.0)
    m.box('oscuro', (0.2, 0.18, 0.012), (0, 0.6, 0.12), rot=(0.4, 0, 0), bevel=0.0)
    return m


def awacs():
    m = Model('awacs')
    jet(m, 1.2, 1.3, 'gris', straight=False, z=0.12, engines=0)
    for sx in (-1, 1):
        m.cyl('gris_osc', 0.04, 0.16, (sx * 0.3, 0.02, 0.12), rot=(H, 0, 0), seg=12)
    m.beam('oscuro', (0, 0.1, 0.24), (0, 0.1, 0.32), t=0.03)
    m.pivot('rotor', 0, 0.1, 0.36)
    m.cyl('blanco', 0.3, 0.05, (0, 0.1, 0.36), seg=24, part='rotor')
    m.cyl('EQUIPO', 0.302, 0.012, (0, 0.1, 0.36), seg=24, part='rotor')
    return m


def tankerplane():
    m = Model('tankerplane')
    jet(m, 1.3, 1.4, 'blanco_sucio', straight=False, z=0.12)
    for sx in (-1, 1):
        m.cyl('gris_osc', 0.045, 0.18, (sx * 0.34, 0.02, 0.12), rot=(H, 0, 0), seg=12)
    m.tube('oscuro', (0, 0.6, 0.16), (0, 0.9, 0.05), r=0.012, seg=6)
    m.box('oscuro', (0.1, 0.012, 0.03), (0, 0.88, 0.06), bevel=0.0)
    return m


def ewplane():
    m = Model('ewplane')
    jet(m, 1.0, 1.0, 'gris', straight=False, z=0.12)
    for sx in (-1, 1):
        m.cyl('oscuro', 0.025, 0.24, (sx * 0.38, 0.06, 0.1), rot=(H, 0, 0), seg=10)
        m.box('oscuro', (0.012, 0.08, 0.06), (sx * 0.06, 0.1, 0.27), bevel=0.0)
    m.cyl('oscuro', 0.03, 0.1, (0, 0.46, 0.36), seg=10)
    return m


def gunship():
    m = Model('gunship')
    m.hull('gris_osc', [(0.6, 0.08, 0.06, 0.14, 0.22), (0.38, 0.17, 0.17, 0.06, 0.3), (-0.3, 0.18, 0.18, 0.05, 0.3),
                        (-0.62, 0.05, 0.05, 0.12, 0.26)])
    m.box('gris_osc', (1.5, 0.17, 0.022), (0, -0.05, 0.33), bevel=0.006)
    for x in (-0.55, -0.3, 0.3, 0.55):
        m.cyl('gris', 0.035, 0.14, (x, -0.13, 0.29), rot=(H, 0, 0), seg=10)
        m.cyl('oscuro', 0.06, 0.008, (x, -0.2, 0.29), rot=(H, 0, 0), seg=12)
    m.box('gris_osc', (0.5, 0.09, 0.02), (0, 0.55, 0.44), bevel=0.004)
    m.box('EQUIPO', (0.016, 0.18, 0.22), (0, 0.55, 0.34), rot=(0.3, 0, 0), bevel=0.0)
    for y in (-0.15, 0.0, 0.12):
        m.tube('oscuro', (-0.17, y, 0.18), (-0.36, y, 0.14), r=0.02 if y == 0.0 else 0.012, seg=8)
    return m


# =====================================================================================================
# Flota naval
# =====================================================================================================
def gunboat():
    m = Model('gunboat')
    ship_hull(m, 0.9, 0.34, z_top=0.12)
    bridge_tower(m, 0.1, 0.2, 0.18, 0.1, 0.12)
    antenna(m, 0, 0.12, 0.42, 0.2)
    gun_turret(m, -0.24, 0.13, 0.06, 0.22)
    return m


def battleship():
    m = Model('battleship')
    ship_hull(m, 1.8, 0.48, z_top=0.16)
    bridge_tower(m, -0.02, 0.3, 0.3, 0.14, 0.17)
    m.box('gris', (0.18, 0.18, 0.18), (0, -0.02, 0.6), bevel=0.02)
    m.cyl('gris_osc', 0.06, 0.2, (0, 0.24, 0.3), seg=12)
    antenna(m, 0, -0.02, 0.68, 0.25)
    gun_turret(m, -0.42, 0.17, 0.1, 0.32, twin=True)
    for y in (-0.68, 0.48):
        m.box('metal_claro', (0.18, 0.2, 0.09), (0, y, 0.21), bevel=0.04)
        for sx in (-1, 1):
            m.tube('oscuro', (sx * 0.04, y - 0.1, 0.23), (sx * 0.04, y - 0.38 if y < 0 else y + 0.38, 0.24), r=0.016, seg=8)
    return m


def patrolboat():
    m = Model('patrolboat')
    ship_hull(m, 0.8, 0.26, z_top=0.11, color='gris')
    m.box('blanco', (0.18, 0.24, 0.14), (0, 0.06, 0.18), bevel=0.03)
    m.box('vidrio', (0.16, 0.012, 0.05), (0, -0.065, 0.22), bevel=0.0)
    m.box('EQUIPO', (0.185, 0.245, 0.03), (0, 0.06, 0.26), bevel=0.0)
    antenna(m, 0, 0.1, 0.27, 0.25)
    dish(m, 0, 0.0, 0.3, 0.05, tilt=0.4)
    m.pivot('turret', 0, -0.22, 0.12)
    m.cyl('oscuro', 0.03, 0.04, (0, -0.22, 0.14), seg=8, part='turret')
    m.tube('negro', (0, -0.24, 0.17), (0, -0.36, 0.17), r=0.008, seg=6, part='turret')
    return m


def corvette():
    m = Model('corvette')
    ship_hull(m, 1.1, 0.36, z_top=0.14)
    bridge_tower(m, 0.05, 0.24, 0.24, 0.12, 0.15)
    m.box('gris', (0.08, 0.08, 0.2), (0, 0.06, 0.5), bevel=0.01)
    dish(m, 0, 0.06, 0.64, 0.05, tilt=0.3)
    m.cyl('blanco', 0.04, 0.06, (0, 0.38, 0.17), seg=12)
    m.sphere('blanco', 0.04, (0, 0.38, 0.24))
    gun_turret(m, -0.33, 0.15, 0.065, 0.22)
    return m


def cruiser():
    m = Model('cruiser')
    ship_hull(m, 1.6, 0.46, z_top=0.16)
    bridge_tower(m, -0.05, 0.3, 0.34, 0.14, 0.17)
    m.box('gris', (0.14, 0.14, 0.3), (0, -0.05, 0.6), bevel=0.01)
    for (dx, dy, rz) in [(0, -0.122, 0), (0, 0.022, 0)]:
        m.box('oscuro', (0.12, 0.01, 0.14), (dx, dy, 0.62), rot=(0, 0, rz), bevel=0.0)
    antenna(m, 0, -0.05, 0.75, 0.28)
    m.box('EQUIPO', (0.31, 0.35, 0.02), (0, -0.05, 0.47), bevel=0.0)
    for ix in range(5):
        for iy in range(3):
            m.box('oscuro', (0.05, 0.05, 0.012), (-0.12 + ix * 0.06, -0.42 + iy * 0.06, 0.17), bevel=0.0)
    for ix in range(4):
        m.box('oscuro', (0.05, 0.05, 0.012), (-0.09 + ix * 0.06, 0.42, 0.17), bevel=0.0)
    gun_turret(m, -0.62, 0.17, 0.07, 0.24)
    return m


def landingship():
    m = Model('landingship')
    ship_hull(m, 1.5, 0.52, z_top=0.16)
    m.box('cubierta', (0.44, 0.9, 0.012), (0, -0.2, 0.17), bevel=0.0)
    for k in range(4):
        m.box('blanco', (0.3, 0.012, 0.004), (0, -0.55 + k * 0.22, 0.18), bevel=0.0)
    bridge_tower(m, 0.42, 0.34, 0.26, 0.16, 0.17)
    antenna(m, 0, 0.42, 0.66, 0.24)
    m.box('casco_naval', (0.4, 0.04, 0.18), (0, -0.74, 0.12), rot=(-0.4, 0, 0), bevel=0.01)
    return m


def logship():
    m = Model('logship')
    ship_hull(m, 1.3, 0.42, z_top=0.15)
    bridge_tower(m, 0.42, 0.3, 0.2, 0.12, 0.16)
    cols = ['EQUIPO', 'rojo', 'amarillo', 'agua', 'naranja', 'EQUIPO']
    for i in range(6):
        x = -0.09 if i % 2 else 0.09
        y = -0.42 + (i // 2) * 0.2
        m.box(cols[i], (0.16, 0.18, 0.1), (x, y, 0.21), bevel=0.01)
    m.tube('amarillo', (0.0, 0.12, 0.16), (0.0, 0.12, 0.5), r=0.02, seg=8)
    m.beam('amarillo', (0.0, 0.12, 0.5), (0.0, -0.3, 0.42), t=0.025)
    return m


def hospitalship():
    m = Model('hospitalship')
    ship_hull(m, 1.4, 0.44, color='blanco', deck='blanco_sucio', z_top=0.15)
    m.box('blanco', (0.34, 0.6, 0.16), (0, 0.1, 0.24), bevel=0.02)
    m.box('blanco', (0.26, 0.3, 0.12), (0, 0.15, 0.38), bevel=0.02)
    for sx in (-1, 1):
        m.box('cruz', (0.006, 0.2, 0.06), (sx * 0.172, 0.1, 0.26), bevel=0.0)
        m.box('cruz', (0.006, 0.06, 0.16), (sx * 0.172, 0.1, 0.26), bevel=0.0)
    m.box('cruz', (0.2, 0.06, 0.006), (0, -0.4, 0.165), bevel=0.0)
    m.box('cruz', (0.06, 0.2, 0.006), (0, -0.4, 0.165), bevel=0.0)
    m.box('EQUIPO', (0.27, 0.31, 0.02), (0, 0.15, 0.45), bevel=0.0)
    return m


def hovercraft():
    m = Model('hovercraft')
    m.box('negro', (0.56, 0.9, 0.1), (0, 0, 0.05), bevel=0.05)
    m.box('gris', (0.5, 0.86, 0.06), (0, 0, 0.12), bevel=0.02)
    for sx in (-1, 1):
        m.box('gris', (0.1, 0.6, 0.14), (sx * 0.2, 0.0, 0.22), bevel=0.02)
        m.box('EQUIPO', (0.102, 0.5, 0.03), (sx * 0.2, 0.0, 0.28), bevel=0.0)
    m.box('blanco', (0.1, 0.1, 0.1), (0.2, -0.32, 0.27), bevel=0.02)
    m.box('vidrio', (0.08, 0.012, 0.04), (0.2, -0.372, 0.29), bevel=0.0)
    for sx in (-1, 1):
        m.cyl('gris_osc', 0.11, 0.08, (sx * 0.14, 0.4, 0.3), rot=(H, 0, 0), seg=18, base=False)
        m.box('oscuro', (0.012, 0.06, 0.18), (sx * 0.14, 0.46, 0.3), bevel=0.0)
    return m


def minesweeper():
    m = Model('minesweeper')
    ship_hull(m, 0.95, 0.32, z_top=0.13)
    bridge_tower(m, -0.12, 0.2, 0.2, 0.11, 0.14)
    antenna(m, 0, -0.12, 0.47, 0.2)
    m.beam('amarillo', (0.0, 0.25, 0.15), (0.0, 0.5, 0.4), t=0.025)
    m.tube('negro', (0.0, 0.5, 0.4), (0.0, 0.55, 0.05), r=0.004, seg=4)
    m.cyl('naranja', 0.04, 0.05, (0.0, 0.55, 0.04), seg=10)
    m.box('oscuro', (0.2, 0.2, 0.05), (0, 0.24, 0.16), bevel=0.01)
    return m


def minelayer():
    m = Model('minelayer')
    ship_hull(m, 1.05, 0.36, z_top=0.14)
    bridge_tower(m, -0.25, 0.22, 0.2, 0.12, 0.15)
    for sx in (-1, 1):
        m.tube('oscuro', (sx * 0.08, -0.05, 0.16), (sx * 0.08, 0.5, 0.16), r=0.008, seg=6)
        for k in range(4):
            m.sphere('gris_osc', 0.035, (sx * 0.08, 0.02 + k * 0.12, 0.19), seg=10)
    m.box('EQUIPO', (0.25, 0.04, 0.03), (0, 0.48, 0.16), bevel=0.0)
    return m


def reconsub():
    m = Model('reconsub')
    m.tube('gris_osc', (0, -0.42, 0.04), (0, 0.38, 0.04), r=0.08, seg=14)
    m.sphere('gris_osc', 0.08, (0, -0.42, 0.04), scale=(1, 1.6, 1))
    m.box('gris_osc', (0.07, 0.16, 0.14), (0, -0.12, 0.15), bevel=0.03)
    m.box('EQUIPO', (0.075, 0.08, 0.03), (0, -0.12, 0.2), bevel=0.0)
    m.tube('metal', (0.0, -0.15, 0.22), (0.0, -0.15, 0.32), r=0.008, seg=6)
    m.box('oscuro', (0.22, 0.04, 0.012), (0, 0.38, 0.04), bevel=0.0)
    m.box('oscuro', (0.012, 0.04, 0.16), (0, 0.38, 0.04), bevel=0.0)
    return m


def stratsub():
    m = Model('stratsub')
    m.tube('negro', (0, -0.7, 0.05), (0, 0.66, 0.05), r=0.12, seg=16)
    m.sphere('negro', 0.12, (0, -0.7, 0.05), scale=(1, 1.5, 1))
    m.box('negro', (0.1, 0.24, 0.18), (0, -0.4, 0.2), bevel=0.04)
    m.box('EQUIPO', (0.105, 0.1, 0.03), (0, -0.4, 0.26), bevel=0.0)
    m.box('gris_osc', (0.16, 0.6, 0.04), (0, 0.05, 0.16), bevel=0.02)
    for k in range(6):
        for sx in (-1, 1):
            m.cyl('gris', 0.025, 0.012, (sx * 0.04, -0.18 + k * 0.08, 0.185), seg=10)
    m.box('oscuro', (0.32, 0.05, 0.012), (0, 0.66, 0.05), bevel=0.0)
    m.box('oscuro', (0.012, 0.05, 0.24), (0, 0.66, 0.05), bevel=0.0)
    return m


# =====================================================================================================
# Edificios
# =====================================================================================================
def corral():
    m = Model('corral')
    slab(m, 1.2, 1.0, 0.04, 'tierra')
    for (a, b) in [((-0.55, -0.45), (0.55, -0.45)), ((-0.55, 0.45), (0.55, 0.45)), ((-0.55, -0.45), (-0.55, 0.45)), ((0.55, -0.45), (0.55, 0.45))]:
        m.beam('madera', (a[0], a[1], 0.12), (b[0], b[1], 0.12), t=0.025)
        m.beam('madera', (a[0], a[1], 0.2), (b[0], b[1], 0.2), t=0.025)
    for (x, y) in [(-0.55, -0.45), (0.55, -0.45), (-0.55, 0.45), (0.55, 0.45), (0, -0.45), (0, 0.45)]:
        m.box('madera', (0.04, 0.04, 0.24), (x, y, 0.12), bevel=0.006)
    shed(m, 0.4, 0.3, 0.22, x=0.28, y=0.22, color='ladrillo', roof='EQUIPO')
    for (x, y, c) in [(-0.25, -0.1, 'blanco'), (-0.05, 0.12, 'tierra'), (-0.3, 0.2, 'blanco')]:
        m.box(c, (0.1, 0.18, 0.09), (x, y, 0.1), bevel=0.02)
        m.box(c, (0.07, 0.06, 0.07), (x, y - 0.12, 0.14), bevel=0.015)
        m.box('negro', (0.035, 0.04, 0.03), (x - 0.02, y - 0.03, 0.14), bevel=0.0)
    return m


def powerplant():
    m = Model('powerplant')
    slab(m, 1.24, 1.0)
    shed(m, 0.7, 0.5, 0.3, x=-0.12, y=0.12, color='hormigon', roof='oscuro')
    for (x, h) in [(0.32, 0.8), (0.46, 0.6)]:
        m.cyl('hormigon', 0.09, h, (x, 0.18, 0.03), seg=14, r2=0.07)
        m.cyl('rojo', 0.072, 0.04, (x, 0.18, 0.03 + h - 0.06), seg=14)
    m.box('amarillo', (0.4, 0.2, 0.12), (-0.18, -0.32, 0.09), bevel=0.02)
    for k in range(3):
        m.box('oscuro', (0.006, 0.18, 0.1), (-0.32 + k * 0.1, -0.32, 0.1), bevel=0.0)
    m.pivot('blades', 0.3, -0.3, 0.12)
    m.box('luz', (0.12, 0.12, 0.12), (0.3, -0.3, 0.12), bevel=0.03, part='blades')
    return m


def workshop():
    m = Model('workshop')
    slab(m)
    shed(m, 0.8, 0.56, 0.32, y=0.12, color='gris', roof='oscuro', curved=True)
    m.box('oscuro', (0.4, 0.02, 0.26), (0, -0.165, 0.16), bevel=0.0)
    for k in range(5):
        m.box('negro', (0.4, 0.022, 0.008), (0, -0.168, 0.06 + k * 0.05), bevel=0.0)
    m.tube('amarillo', (0.45, -0.3, 0.03), (0.45, -0.3, 0.55), r=0.025, seg=8)
    m.beam('amarillo', (0.45, -0.3, 0.55), (0.1, -0.3, 0.55), t=0.03)
    m.tube('negro', (0.12, -0.3, 0.55), (0.12, -0.3, 0.3), r=0.005, seg=4)
    m.box('metal', (0.12, 0.08, 0.06), (-0.35, -0.35, 0.06), bevel=0.01)
    return m


def research():
    m = Model('research')
    slab(m)
    shed(m, 0.5, 0.4, 0.26, x=-0.22, y=0.1, color='blanco', roof='gris')
    shed(m, 0.36, 0.3, 0.2, x=0.3, y=0.15, color='blanco', roof='gris')
    m.cyl('blanco', 0.14, 0.42, (0.2, -0.25, 0.03), seg=16)
    m.sphere('cristal_azul', 0.14, (0.2, -0.25, 0.45), scale=(1, 1, 0.7))
    m.pivot('crystal', -0.22, 0.1, 0.42)
    m.ico('cristal_azul', 0.06, (-0.22, 0.1, 0.42), part='crystal')
    for k in range(3):
        m.box('vidrio', (0.08, 0.006, 0.08), (-0.35 + k * 0.13, -0.105, 0.17), bevel=0.0)
    return m


def radarstation():
    m = Model('radarstation')
    slab(m)
    shed(m, 0.5, 0.36, 0.2, x=-0.2, y=0.22, color='hormigon')
    m.cyl('gris', 0.08, 0.36, (0.1, -0.1, 0.03), seg=12)
    m.pivot('rotor', 0.1, -0.1, 0.42)
    m.cyl('blanco', 0.3, 0.06, (0.1, -0.1, 0.48), rot=(0.7, 0, 0), seg=20, r2=0.16, part='rotor')
    m.tube('oscuro', (0.1, -0.1, 0.42), (0.1, -0.3, 0.62), r=0.012, seg=6, part='rotor')
    m.box('EQUIPO', (0.1, 0.1, 0.04), (0.1, -0.1, 0.41), bevel=0.01, part='rotor')
    antenna(m, -0.4, 0.3, 0.25, 0.4)
    return m


def dronecenter():
    m = Model('dronecenter')
    slab(m)
    shed(m, 0.5, 0.5, 0.24, x=-0.28, y=0.18, color='gris', roof='oscuro')
    for (x, y) in [(0.25, -0.25), (0.25, 0.22), (-0.25, -0.3)]:
        m.cyl('oscuro', 0.15, 0.02, (x, y, 0.03), seg=6)
        m.cyl('amarillo', 0.13, 0.006, (x, y, 0.05), seg=6)
        m.box('blanco', (0.1, 0.02, 0.004), (x, y, 0.056), bevel=0.0)
    antenna(m, -0.45, 0.4, 0.27, 0.35)
    dish(m, -0.15, 0.25, 0.32, 0.07, tilt=0.6)
    m.pivot('rotor', 0.25, -0.25, 0.16)
    m.box('gris_osc', (0.08, 0.08, 0.03), (0.25, -0.25, 0.14), bevel=0.01, part='rotor')
    m.box('metal_claro', (0.24, 0.02, 0.004), (0.25, -0.25, 0.16), bevel=0.0, part='rotor')
    return m


def shipyard():
    m = Model('shipyard')
    m.box('hormigon', (1.3, 1.1, 0.12), (0, 0, 0.0), bevel=0.02)
    m.box('agua', (0.6, 0.9, 0.02), (0, -0.05, 0.065), bevel=0.0)
    for sx in (-1, 1):
        m.box('hormigon', (0.3, 1.0, 0.1), (sx * 0.48, 0, 0.08), bevel=0.02)
        m.tube('amarillo', (sx * 0.45, 0.25, 0.1), (sx * 0.45, 0.25, 0.75), r=0.025, seg=8)
        m.beam('amarillo', (sx * 0.45, 0.25, 0.75), (sx * 0.05, 0.25, 0.75), t=0.03)
    m.beam('amarillo', (-0.45, -0.3, 0.6), (0.45, -0.3, 0.6), t=0.04)
    for sx in (-1, 1):
        m.tube('amarillo', (sx * 0.45, -0.3, 0.1), (sx * 0.45, -0.3, 0.6), r=0.025, seg=8)
    m.hull('casco_naval', [(0.3, 0.12, 0.08, 0.05, 0.2), (-0.1, 0.13, 0.08, 0.05, 0.21), (-0.38, 0.01, 0.01, 0.1, 0.22)])
    m.box('EQUIPO', (1.31, 0.05, 0.05), (0, 0.55, 0.08), bevel=0.0)
    return m


def depot():
    m = Model('depot')
    slab(m)
    shed(m, 0.5, 0.36, 0.26, x=-0.25, y=0.2, color='oliva', roof='oliva_osc', curved=True)
    cols = ['EQUIPO', 'oliva', 'rojo', 'oliva_osc', 'amarillo', 'EQUIPO']
    for i in range(6):
        x = 0.15 + (i % 2) * 0.24
        y = -0.3 + (i // 2) * 0.22
        m.box(cols[i], (0.22, 0.18, 0.14), (x, y, 0.1), bevel=0.01)
    m.box('madera', (0.3, 0.2, 0.05), (-0.25, -0.28, 0.05), bevel=0.01)
    return m


def hq():
    m = Model('hq')
    slab(m, 1.25, 1.05)
    m.box('hormigon', (0.84, 0.64, 0.22), (0, 0.05, 0.14), bevel=0.04)
    m.box('oliva_osc', (0.64, 0.44, 0.12), (0, 0.05, 0.31), bevel=0.03)
    m.box('vidrio', (0.6, 0.012, 0.05), (0, -0.172, 0.32), bevel=0.0)
    m.box('EQUIPO', (0.86, 0.66, 0.03), (0, 0.05, 0.25), bevel=0.0)
    m.tube('oscuro', (0.25, 0.15, 0.37), (0.25, 0.15, 0.95), r=0.012, seg=6)
    m.box('EQUIPO', (0.012, 0.22, 0.13), (0.25, 0.26, 0.88), bevel=0.0)
    dish(m, -0.2, 0.15, 0.42, 0.09, tilt=0.6)
    antenna(m, -0.3, 0.25, 0.37, 0.4)
    return m


def bunker():
    m = Model('bunker')
    slab(m, 1.1, 0.95, 0.04, 'tierra')
    m.hexprism('hormigon', 0.42, 0.2, (0, 0, 0.02))
    m.hexprism('concreto', 0.36, 0.08, (0, 0, 0.22))
    for k in range(6):
        a = k * PI / 3 + PI / 6
        m.box('negro', (0.12, 0.02, 0.04), (math.cos(a) * 0.37, math.sin(a) * 0.37, 0.15), rot=(0, 0, a + H), bevel=0.0)
    m.box('EQUIPO', (0.2, 0.2, 0.02), (0, 0, 0.31), bevel=0.0)
    m.pivot('turret', 0, 0, 0.32)
    m.box('oscuro', (0.08, 0.1, 0.06), (0, 0, 0.35), bevel=0.01, part='turret')
    m.tube('negro', (0, -0.05, 0.36), (0, -0.25, 0.36), r=0.01, seg=6, part='turret')
    return m


def gate():
    m = Model('gate')
    for sx in (-1, 1):
        m.box('hormigon', (0.2, 0.3, 0.55), (sx * 0.42, 0, 0.27), bevel=0.02)
        m.box('EQUIPO', (0.21, 0.31, 0.05), (sx * 0.42, 0, 0.5), bevel=0.0)
        m.box('luz', (0.05, 0.04, 0.04), (sx * 0.42, -0.16, 0.57), bevel=0.006)
    m.box('metal', (0.64, 0.06, 0.4), (0, 0, 0.22), bevel=0.01)
    for k in range(4):
        m.box('amarillo' if k % 2 else 'negro', (0.16, 0.065, 0.06), (-0.24 + k * 0.16, 0, 0.36), bevel=0.0)
    for k in range(5):
        m.box('metal_claro', (0.02, 0.07, 0.36), (-0.24 + k * 0.12, 0, 0.2), bevel=0.0)
    return m


def bridge():
    m = Model('bridge')
    m.box('madera', (0.9, 1.6, 0.06), (0, 0, 0.26), bevel=0.01)
    for k in range(7):
        m.box('madera_clara', (0.9, 0.02, 0.064), (0, -0.7 + k * 0.233, 0.262), bevel=0.0)
    for sx in (-1, 1):
        m.box('metal', (0.04, 1.6, 0.05), (sx * 0.44, 0, 0.38), bevel=0.006)
        m.box('EQUIPO', (0.045, 1.6, 0.02), (sx * 0.44, 0, 0.41), bevel=0.0)
        for y in (-0.6, -0.2, 0.2, 0.6):
            m.box('metal', (0.03, 0.03, 0.13), (sx * 0.44, y, 0.33), bevel=0.0)
        for y in (-0.45, 0.45):
            m.cyl('oscuro', 0.05, 0.36, (sx * 0.35, y, -0.12), seg=10)
    return m


def dock():
    m = Model('dock')
    m.box('madera', (1.0, 1.2, 0.06), (0, 0, 0.14), bevel=0.01)
    for (x, y) in [(-0.45, -0.55), (0.45, -0.55), (-0.45, 0.55), (0.45, 0.55), (-0.45, 0), (0.45, 0)]:
        m.cyl('oscuro', 0.05, 0.34, (x, y, -0.18), seg=10)
    m.box('hormigon', (0.4, 0.3, 0.06), (0, 0.45, 0.2), rot=(-0.25, 0, 0), bevel=0.01)
    for (x, y, c) in [(-0.25, -0.2, 'EQUIPO'), (-0.25, 0.05, 'madera'), (0.25, -0.3, 'oliva')]:
        m.box(c, (0.18, 0.18, 0.14), (x, y, 0.24), bevel=0.012)
    m.tube('amarillo', (0.35, 0.1, 0.17), (0.35, 0.1, 0.55), r=0.02, seg=8)
    m.beam('amarillo', (0.35, 0.1, 0.55), (0.35, -0.25, 0.5), t=0.025)
    for (x, y) in [(-0.48, -0.3), (0.48, 0.3)]:
        m.cyl('negro', 0.05, 0.05, (x, y, 0.13), rot=(0, H, 0), seg=10)
    return m


def watchtower():
    m = Model('watchtower')
    slab(m, 0.6, 0.6, 0.04, 'tierra')
    for (sx, sy) in [(-1, -1), (1, -1), (-1, 1), (1, 1)]:
        m.beam('madera', (sx * 0.2, sy * 0.2, 0.02), (sx * 0.13, sy * 0.13, 0.9), t=0.04)
    for z in (0.3, 0.6):
        k = 0.2 - (z / 0.9) * 0.07
        for (a, b) in [((-k, -k), (k, k)), ((k, -k), (-k, k))]:
            m.beam('madera', (a[0], a[1], z), (b[0], b[1], z + 0.2), t=0.02)
    m.box('madera_clara', (0.38, 0.38, 0.04), (0, 0, 0.92), bevel=0.01)
    for sx in (-1, 1):
        m.box('madera', (0.38, 0.02, 0.1), (0, sx * 0.18, 1.0), bevel=0.0)
        m.box('madera', (0.02, 0.38, 0.1), (sx * 0.18, 0, 1.0), bevel=0.0)
    m.box('EQUIPO', (0.44, 0.44, 0.04), (0, 0, 1.18), bevel=0.01)
    for (sx, sy) in [(-1, -1), (1, -1), (-1, 1), (1, 1)]:
        m.tube('madera', (sx * 0.18, sy * 0.18, 0.94), (sx * 0.18, sy * 0.18, 1.17), r=0.012, seg=6)
    m.box('luz', (0.06, 0.06, 0.04), (0, -0.19, 1.08), bevel=0.01)
    return m


def coastal():
    m = Model('coastal')
    slab(m, 1.1, 1.0)
    m.box('hormigon', (0.7, 0.6, 0.16), (0, 0.05, 0.1), bevel=0.04)
    m.box('EQUIPO', (0.72, 0.62, 0.03), (0, 0.05, 0.17), bevel=0.0)
    gun_turret(m, 0.0, 0.18, 0.13, 0.5, twin=True)
    return m


def silo():
    m = Model('silo')
    slab(m, 1.25, 1.05, 0.06, 'hormigon')
    m.hexprism('concreto', 0.46, 0.08, (0, 0, 0.03))
    m.cyl('gris_osc', 0.3, 0.06, (0, 0, 0.1), seg=24)
    m.cyl('oscuro', 0.24, 0.02, (0, 0, 0.16), seg=24)
    for k in range(8):
        a = k * PI / 4
        m.box('amarillo' if k % 2 else 'negro', (0.08, 0.03, 0.012), (math.cos(a) * 0.32, math.sin(a) * 0.32, 0.15), rot=(0, 0, a), bevel=0.0)
    m.box('EQUIPO', (0.06, 0.5, 0.012), (0, 0, 0.175), bevel=0.0)
    shed(m, 0.3, 0.2, 0.18, x=-0.4, y=0.35, color='hormigon')
    antenna(m, 0.45, 0.4, 0.03, 0.5)
    m.pivot('crystal', 0, 0, 0.22)
    m.cyl('luz', 0.035, 0.03, (0, 0, 0.2), seg=10, part='crystal')
    return m


def ciws():
    m = Model('ciws')
    slab(m, 0.9, 0.8)
    m.cyl('gris', 0.18, 0.18, (0, 0, 0.03), seg=14)
    m.pivot('turret', 0, 0, 0.22)
    m.box('gris_osc', (0.2, 0.22, 0.16), (0, 0.02, 0.28), bevel=0.04, part='turret')
    m.cyl('blanco', 0.1, 0.2, (0, 0.04, 0.36), seg=14, part='turret')
    m.sphere('blanco', 0.1, (0, 0.04, 0.56), scale=(1, 1, 0.8), part='turret')
    m.box('EQUIPO', (0.205, 0.225, 0.03), (0, 0.02, 0.24), bevel=0.0, part='turret')
    for k in range(6):
        a = k * PI / 3
        m.tube('negro', (math.cos(a) * 0.022, -0.1, 0.27 + math.sin(a) * 0.022), (math.cos(a) * 0.022, -0.36, 0.27 + math.sin(a) * 0.022),
               r=0.007, seg=6, part='turret')
    return m


def laser():
    m = Model('laser')
    slab(m, 0.9, 0.8)
    m.box('gris', (0.3, 0.3, 0.3), (0, 0.05, 0.18), bevel=0.04)
    for sx in (-1, 1):
        m.box('panel', (0.3, 0.02, 0.2), (sx * 0.32, 0.1, 0.2), rot=(0.4, 0, sx * 0.3), bevel=0.0)
    m.pivot('turret', 0, 0.05, 0.34)
    m.box('blanco', (0.16, 0.2, 0.14), (0, 0.05, 0.42), bevel=0.03, part='turret')
    m.cyl('oscuro', 0.07, 0.12, (0, -0.1, 0.43), rot=(H, 0, 0), seg=14, part='turret')
    m.cyl('cristal_azul', 0.05, 0.01, (0, -0.16, 0.43), rot=(H, 0, 0), seg=14, part='turret')
    m.box('EQUIPO', (0.165, 0.205, 0.025), (0, 0.05, 0.5), bevel=0.0, part='turret')
    return m


def seamine():
    m = Model('seamine')
    m.sphere('gris_osc', 0.11, (0, 0, 0.0), seg=12)
    for (dx, dy, dz) in [(1, 0, 0), (-1, 0, 0), (0, 1, 0), (0, -1, 0), (0, 0, 1)]:
        m.tube('oscuro', (dx * 0.1, dy * 0.1, dz * 0.1), (dx * 0.15, dy * 0.15, dz * 0.15), r=0.014, seg=6)
    m.box('EQUIPO', (0.08, 0.08, 0.02), (0, 0, 0.11), bevel=0.0)
    return m


ALL = [
    inf_scout, inf_soldier, inf_officer, inf_radioman, inf_sapper, inf_mortar, inf_paratrooper, inf_marine, inf_atguided,
    inf_gunner, inf_antidrone, robodog,
    armoredcar, ifv, trooptruck, ambulance, recovery, supplytruck, tanker, commandveh, mobileradar, howitzer, towedgun,
    tankdestroyer, amphib, bridgelayer, clearer, dozer, thermo,
    scoutdrone, cargodrone, interceptor, navaldrone, subdrone,
    transheli, rescueheli, navalheli,
    attackjet, heavybomber, transportplane, awacs, tankerplane, ewplane, gunship,
    gunboat, battleship, patrolboat, corvette, cruiser, landingship, logship, hospitalship, hovercraft, minesweeper, minelayer,
    reconsub, stratsub,
    corral, powerplant, workshop, research, radarstation, dronecenter, shipyard, depot, hq, bunker, gate, bridge, dock,
    watchtower, coastal, silo, ciws, laser, seamine,
]
