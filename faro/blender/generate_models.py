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
from models_ref import (arty, barge, boat_engineer, core, destroyer, farm, helicopter, helipad,  # noqa: E402
                        jeep, mine, rig, soldier, speedboat, tank, turret, wheels)
# Modelos de la v0.6.
from models_ref2 import (aa_truck, apache, barracks, factory, harbor, hospital, house, hydro, miniturret,  # noqa: E402
                         outpost, solar, submarine, tidal, wave, wind)
# Modelos nuevos de la v0.9 (vehículos, barcos, aviones, Aeropuerto, Antinuclear y Defensa aérea nivel 4).
from models_ref3 import (aadef, airport, antinuke, apartment, apc, bomber, carrier, fighter, frigate, heavy_tank,  # noqa: E402
                         lander, launcher, light_tank, missile_truck)

PI = math.pi
H = PI / 2


# =====================================================================
# Soldados: cuerpo de bloques; cada uno con casco, equipo y arma propios
# =====================================================================


# =====================================================================
# Vehículos
# =====================================================================


# =====================================================================
# Barcos: cascos con forma, cubierta, puente y detalles
# =====================================================================


# =====================================================================
# Helicópteros
# =====================================================================


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
    infantry = ['builder', 'engineer', 'medic', 'rifle', 'shotgun', 'ranger', 'sniper', 'breaker', 'hunter', 'rocket']
    for k in infantry:
        out.append(soldier(k))
    # Skin Brigada Tóxica: los mismos soldados con capucha y máscara de gas.
    for k in infantry:
        out.append(soldier(k, 'toxico'))
    out += [jeep(), tank(), aa_truck(), arty(), speedboat(), boat_engineer(), barge(), destroyer(), submarine(),
            helicopter(), apache(), light_tank(), heavy_tank(), missile_truck(), apc(), launcher(), frigate(),
            lander(), carrier(), fighter(), bomber()]
    out += [core(1), core(2), core(3), farm(), pump(), mine(), rig(), house(), apartment(), solar(), wind(), hydro(),
            tidal(), wave(),
            barracks(), factory(), harbor(), helipad(), turret(1), turret(2), turret(3), turret(4), miniturret(), aadef(1),
            aadef(4), airport(), antinuke(),
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
