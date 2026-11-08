"""Modelos de la v0.9 de Faro de Ámbar: vehículos y barcos nuevos, aviones, Aeropuerto, defensas y
AIR DEFENSE rehecha. Los vehículos reales solo inspiran la forma general; los modelos son propios.

Convención: -Y es el frente, Z hacia arriba, 1 unidad ≈ una casilla. EQUIPO y EQUIPO_OSC toman el
color del imperio en el juego.
"""
import math

from lib import Model
from models_ref import launcher_face, tracks, wheels

PI = math.pi
H = PI / 2


# ---------------------------------------------------------------------
# Vehículos
# ---------------------------------------------------------------------
def light_tank():
    """Tanque ligero: casco bajo y anguloso, torreta chica y cañón corto."""
    m = Model('lighttank')
    tracks(m, 0.23, 0.82, 5, 0.044)
    m.box('oliva', (0.42, 0.78, 0.13), (0, 0.02, 0.08), bevel=0.035)
    m.box('oliva_osc', (0.4, 0.18, 0.08), (0, -0.36, 0.11), rot=(0.6, 0, 0), bevel=0.025)
    for sx in (-1, 1):
        m.box('EQUIPO_OSC', (0.03, 0.7, 0.07), (sx * 0.29, 0.02, 0.07), bevel=0.01)
        m.box('luz', (0.04, 0.02, 0.02), (sx * 0.15, -0.43, 0.16), bevel=0.004)
    m.box('EQUIPO', (0.44, 0.14, 0.02), (0, 0.26, 0.21), bevel=0.006)
    m.pivot('turret', 0, 0.06, 0.21)
    m.box('EQUIPO', (0.28, 0.32, 0.1), (0, 0.08, 0.21), bevel=0.04, part='turret')
    m.box('EQUIPO_OSC', (0.24, 0.1, 0.08), (0, -0.09, 0.22), rot=(0.3, 0, 0), bevel=0.02, part='turret')
    m.tube('oscuro', (0, -0.12, 0.27), (0, -0.48, 0.27), r=0.024, seg=10, part='turret')
    m.cyl('oscuro', 0.032, 0.05, (0, -0.5, 0.27), rot=(H, 0, 0), seg=10, base=False, part='turret')
    m.cyl('oliva_osc', 0.045, 0.03, (0.07, 0.12, 0.31), seg=12, part='turret')
    m.tube('negro', (-0.1, 0.2, 0.31), (-0.11, 0.24, 0.62), r=0.005, seg=6, part='turret')
    return m


def heavy_tank():
    """Tanque pesado: casco ancho, faldones laterales, torreta grande en cuña y cañón largo."""
    m = Model('heavytank')
    tracks(m, 0.3, 1.0, 7, 0.054)
    for sx in (-1, 1):
        m.box('EQUIPO_OSC', (0.05, 0.92, 0.12), (sx * 0.38, 0.0, 0.07), bevel=0.012)
        for k in range(5):
            m.box('oscuro', (0.052, 0.012, 0.1), (sx * 0.385, -0.36 + k * 0.18, 0.08), bevel=0.0)
        m.box('oliva', (0.18, 0.96, 0.035), (sx * 0.3, 0, 0.19), bevel=0.01)
    m.box('oliva', (0.56, 0.94, 0.17), (0, 0.02, 0.09), bevel=0.045)
    m.box('oliva_osc', (0.54, 0.22, 0.12), (0, -0.44, 0.12), rot=(0.62, 0, 0), bevel=0.035)
    for sx in (-1, 1):
        m.box('luz', (0.05, 0.02, 0.025), (sx * 0.2, -0.53, 0.2), bevel=0.004)
    m.box('oscuro', (0.3, 0.14, 0.07), (0, 0.4, 0.26), bevel=0.015)
    m.box('EQUIPO', (0.56, 0.2, 0.025), (0, 0.32, 0.27), bevel=0.008)
    m.pivot('turret', 0, 0.06, 0.27)
    m.box('EQUIPO', (0.44, 0.48, 0.16), (0, 0.1, 0.27), bevel=0.05, part='turret')
    m.box('EQUIPO_OSC', (0.18, 0.2, 0.13), (0.15, -0.16, 0.29), rot=(0.3, 0, -0.35), bevel=0.03, part='turret')
    m.box('EQUIPO_OSC', (0.18, 0.2, 0.13), (-0.15, -0.16, 0.29), rot=(0.3, 0, 0.35), bevel=0.03, part='turret')
    m.box('oscuro', (0.46, 0.14, 0.1), (0, 0.33, 0.29), bevel=0.02, part='turret')
    m.cyl('oscuro', 0.045, 0.72, (0, -0.56, 0.35), rot=(H, 0, 0), seg=12, base=False, part='turret')
    m.cyl('oscuro', 0.058, 0.12, (0, -0.42, 0.35), rot=(H, 0, 0), seg=12, base=False, part='turret')
    m.cyl('oscuro', 0.054, 0.08, (0, -0.9, 0.35), rot=(H, 0, 0), seg=12, base=False, part='turret')
    m.cyl('oliva_osc', 0.07, 0.05, (0.12, 0.16, 0.43), seg=14, part='turret')
    m.box('oscuro', (0.12, 0.08, 0.07), (-0.12, 0.12, 0.45), bevel=0.015, part='turret')
    m.box('vidrio', (0.08, 0.01, 0.04), (-0.12, 0.078, 0.47), bevel=0.003, part='turret')
    for sx in (-1, 1):
        m.tube('negro', (sx * 0.16, 0.3, 0.43), (sx * 0.18, 0.35, 0.92), r=0.006, seg=6, part='turret')
    return m


def missile_truck():
    """Camión de misiles: cabina adelante y lanzador inclinado de cuatro tubos atrás."""
    m = Model('missiletruck')
    wheels(m, [(-0.21, -0.3), (0.21, -0.3), (-0.21, 0.1), (0.21, 0.1), (-0.21, 0.3), (0.21, 0.3)], r=0.085, w=0.08)
    m.box('oscuro', (0.36, 0.9, 0.06), (0, 0.0, 0.1), bevel=0.015)
    m.box('EQUIPO', (0.4, 0.26, 0.2), (0, -0.32, 0.16), bevel=0.035)
    m.box('vidrio', (0.34, 0.02, 0.08), (0, -0.452, 0.27), rot=(-0.2, 0, 0), bevel=0.004)
    for sx in (-1, 1):
        m.box('luz', (0.04, 0.02, 0.03), (sx * 0.15, -0.454, 0.2), bevel=0.004)
    m.box('oliva_osc', (0.38, 0.6, 0.06), (0, 0.15, 0.16), bevel=0.015)
    m.pivot('turret', 0, 0.2, 0.22)
    m.box('oscuro', (0.22, 0.14, 0.06), (0, 0.3, 0.22), bevel=0.015, part='turret')
    for ix in range(2):
        for iz in range(2):
            x = -0.07 + ix * 0.14
            m.tube('EQUIPO', (x, 0.36, 0.25 + iz * 0.12), (x, -0.12, 0.47 + iz * 0.12), r=0.055, seg=12, part='turret')
            m.cyl('blanco', 0.045, 0.012, (x, -0.125, 0.472 + iz * 0.12), rot=(H + 0.43, 0, 0), seg=12, base=False, part='turret')
    m.beam('oscuro', (0, 0.3, 0.22), (0, 0.18, 0.4), t=0.04, part='turret')
    return m


def apc():
    """Transporte blindado: caja con ruedas, rampa trasera y ametralladora en el techo."""
    m = Model('apc')
    wheels(m, [(-0.24, -0.3), (0.24, -0.3), (-0.24, 0.0), (0.24, 0.0), (-0.24, 0.3), (0.24, 0.3)], r=0.09, w=0.08)
    m.box('EQUIPO', (0.44, 0.84, 0.18), (0, 0.02, 0.1), bevel=0.04)
    m.box('EQUIPO_OSC', (0.42, 0.22, 0.12), (0, -0.38, 0.13), rot=(0.7, 0, 0), bevel=0.03)
    m.box('EQUIPO', (0.38, 0.6, 0.08), (0, 0.08, 0.28), bevel=0.03)
    for sx in (-1, 1):
        for k in range(3):
            m.box('vidrio', (0.012, 0.05, 0.03), (sx * 0.225, -0.12 + k * 0.17, 0.22), bevel=0.0)
        m.box('luz', (0.04, 0.02, 0.025), (sx * 0.15, -0.46, 0.19), bevel=0.004)
    m.box('oscuro', (0.3, 0.03, 0.14), (0, 0.44, 0.13), rot=(0.2, 0, 0), bevel=0.01)
    m.pivot('turret', 0, 0.02, 0.36)
    m.cyl('oscuro', 0.07, 0.04, (0, 0.02, 0.36), seg=14, part='turret')
    m.box('EQUIPO_OSC', (0.12, 0.1, 0.06), (0, 0.0, 0.4), bevel=0.015, part='turret')
    m.tube('negro', (0, -0.04, 0.43), (0, -0.26, 0.43), r=0.012, seg=8, part='turret')
    return m


def launcher():
    """Lanzador de misiles de largo alcance: camión de ocho ejes con un contenedor enorme encima."""
    m = Model('launcher')
    xs = [-0.55, -0.4, -0.22, -0.07, 0.1, 0.25, 0.42, 0.57]
    wheels(m, [(sx * 0.22, y) for y in xs for sx in (-1, 1)], r=0.085, w=0.08)
    m.box('oscuro', (0.36, 1.32, 0.07), (0, 0.02, 0.11), bevel=0.015)
    # Cabina dividida adelante.
    for sx in (-1, 1):
        m.box('EQUIPO', (0.16, 0.22, 0.2), (sx * 0.1, -0.62, 0.15), bevel=0.03)
        m.box('vidrio', (0.12, 0.02, 0.07), (sx * 0.1, -0.733, 0.27), rot=(-0.15, 0, 0), bevel=0.004)
        m.box('luz', (0.04, 0.02, 0.025), (sx * 0.12, -0.735, 0.19), bevel=0.004)
    m.box('EQUIPO_OSC', (0.42, 1.02, 0.08), (0, 0.12, 0.17), bevel=0.02)
    # Contenedor del misil (tubo grande con tapa redonda adelante) y sus soportes.
    m.pivot('turret', 0, 0.12, 0.25)
    m.tube('EQUIPO', (0, 0.66, 0.36), (0, -0.48, 0.36), r=0.13, seg=16, part='turret')
    m.sphere('EQUIPO_OSC', 0.13, (0, -0.48, 0.36), scale=(1, 0.55, 1), part='turret')
    for k in range(4):
        m.cyl('oscuro', 0.135, 0.025, (0, -0.3 + k * 0.28, 0.36), rot=(H, 0, 0), seg=16, base=False, part='turret')
    for y in (-0.25, 0.4):
        m.beam('oscuro', (0, y, 0.21), (0, y, 0.25), t=0.08, part='turret')
    return m


# ---------------------------------------------------------------------
# Barcos
# ---------------------------------------------------------------------
def frigate():
    """Fragata antiaérea: casco fino, celdas de misiles, mástil con radares planos."""
    m = Model('frigate')
    m.hull('gris', [(0.8, 0.2, 0.13, -0.06, 0.14), (0.35, 0.23, 0.15, -0.08, 0.15), (-0.3, 0.22, 0.12, -0.08, 0.16),
                    (-0.66, 0.12, 0.04, -0.04, 0.18), (-0.92, 0.012, 0.01, 0.04, 0.22)])
    m.box('metal_claro', (0.4, 1.36, 0.014), (0, -0.04, 0.15), bevel=0.0)
    for sx in (-1, 1):
        m.box('EQUIPO', (0.012, 1.24, 0.03), (sx * 0.225, -0.02, 0.11), rot=(0, 0, sx * 0.05), bevel=0.0)
    m.box('gris', (0.3, 0.46, 0.16), (0, 0.1, 0.16), bevel=0.02)
    m.box('metal_claro', (0.24, 0.24, 0.14), (0, 0.02, 0.32), bevel=0.02)
    m.box('luz', (0.22, 0.012, 0.03), (0, -0.102, 0.4), bevel=0.0)
    # Radares planos del mástil (en las cuatro caras).
    m.box('gris', (0.12, 0.12, 0.26), (0, 0.04, 0.46), bevel=0.01)
    for (dx, dy, rz) in [(0, -0.062, 0), (0, 0.142, 0), (0.062, 0.04, H), (-0.062, 0.04, H)]:
        m.box('oscuro', (0.1, 0.01, 0.12), (dx, dy, 0.56), rot=(0, 0, rz), bevel=0.0)
    m.tube('oscuro', (0, 0.04, 0.72), (0, 0.04, 0.9), r=0.008, seg=6)
    # Celdas de misiles adelante.
    for ix in range(4):
        for iy in range(3):
            m.box('oscuro', (0.045, 0.045, 0.012), (-0.08 + ix * 0.054, -0.3 + iy * 0.054, 0.155), bevel=0.0)
    m.box('oscuro', (0.3, 0.24, 0.01), (0, 0.56, 0.155), bevel=0.0)
    m.box('blanco', (0.03, 0.12, 0.004), (0, 0.56, 0.162), bevel=0.0)
    # Lanzador giratorio (dispara los misiles antiaéreos).
    m.pivot('turret', 0, -0.52, 0.16)
    m.cyl('gris', 0.08, 0.04, (0, -0.52, 0.16), seg=14, part='turret')
    m.box('metal_claro', (0.16, 0.16, 0.08), (0, -0.52, 0.2), bevel=0.03, part='turret')
    for sx in (-1, 1):
        m.tube('blanco', (sx * 0.05, -0.44, 0.27), (sx * 0.05, -0.66, 0.33), r=0.025, seg=8, part='turret')
    return m


def lander():
    """Lancha de desembarco sobre colchón de aire: faldón negro, cubierta abierta y dos ventiladores atrás."""
    m = Model('lander')
    m.box('goma', (0.62, 1.1, 0.1), (0, 0.0, -0.02), bevel=0.05)
    m.box('EQUIPO_OSC', (0.56, 1.02, 0.05), (0, 0.0, 0.08), bevel=0.02)
    m.box('metal', (0.36, 0.86, 0.012), (0, -0.04, 0.13), bevel=0.0)
    for sx in (-1, 1):
        m.box('EQUIPO', (0.1, 0.86, 0.12), (sx * 0.23, -0.02, 0.13), bevel=0.02)
        m.box('vidrio', (0.012, 0.12, 0.04), (sx * 0.282, -0.2, 0.21), bevel=0.0)
        # Ventiladores con aro.
        m.cyl('oscuro', 0.15, 0.06, (sx * 0.15, 0.48, 0.32), rot=(H, 0, 0), seg=18, base=False)
        m.cyl('metal', 0.03, 0.08, (sx * 0.15, 0.48, 0.32), rot=(H, 0, 0), seg=10)
        m.beam('oscuro', (sx * 0.15, 0.45, 0.13), (sx * 0.15, 0.45, 0.2), t=0.04)
        m.box('EQUIPO_OSC', (0.012, 0.16, 0.16), (sx * 0.15, 0.6, 0.32), bevel=0.0)
    m.box('amarillo', (0.3, 0.02, 0.004), (0, -0.45, 0.136), bevel=0.0)
    m.box('EQUIPO_OSC', (0.38, 0.04, 0.1), (0, -0.5, 0.12), rot=(-0.4, 0, 0), bevel=0.01)
    return m


def carrier():
    """Portaaviones: casco largo, cubierta plana con pista en ángulo, isla con radar y cazas en cubierta."""
    m = Model('carrier')
    m.hull('gris', [(1.0, 0.3, 0.2, -0.08, 0.16), (0.4, 0.34, 0.22, -0.11, 0.17), (-0.5, 0.32, 0.2, -0.11, 0.18),
                    (-0.88, 0.18, 0.06, -0.06, 0.2), (-1.08, 0.02, 0.01, 0.02, 0.22)])
    # Cubierta de vuelo (más ancha que el casco) y pista en ángulo.
    m.box('oscuro', (0.7, 2.0, 0.025), (0.06, -0.02, 0.19), bevel=0.0)
    m.box('oscuro', (0.36, 0.9, 0.025), (-0.17, 0.4, 0.19), rot=(0, 0, 0.16), bevel=0.0)
    for k in range(9):
        m.box('blanco', (0.012, 0.07, 0.004), (0.02, -0.85 + k * 0.17, 0.217), bevel=0.0)
    m.box('blanco', (0.008, 0.8, 0.004), (0.33, -0.02, 0.217), bevel=0.0)
    m.box('blanco', (0.008, 0.8, 0.004), (-0.28, -0.02, 0.217), bevel=0.0)
    m.box('EQUIPO', (0.6, 0.06, 0.006), (0.06, -0.98, 0.217), bevel=0.0)
    for sx in (-1, 1):
        m.box('EQUIPO', (0.012, 1.7, 0.03), (sx * 0.335, 0.0, 0.13), rot=(0, 0, sx * 0.04), bevel=0.0)
    # Isla (puente) a estribor con radar y mástil.
    m.box('gris', (0.12, 0.34, 0.24), (0.28, 0.18, 0.21), bevel=0.015)
    m.box('metal_claro', (0.1, 0.24, 0.1), (0.28, 0.16, 0.45), bevel=0.01)
    m.box('luz', (0.012, 0.22, 0.03), (0.226, 0.16, 0.49), bevel=0.0)
    m.tube('oscuro', (0.28, 0.16, 0.55), (0.28, 0.16, 0.8), r=0.01, seg=6)
    m.pivot('rotor', 0.28, 0.16, 0.66)
    m.box('oscuro', (0.04, 0.16, 0.05), (0.28, 0.16, 0.66), bevel=0.0, part='rotor')
    # Cazas estacionados (siluetas simples).
    for (x, y, a) in [(-0.12, -0.55, 0.0), (0.06, -0.55, 0.0), (-0.2, 0.6, 0.6), (-0.04, 0.75, 0.6)]:
        m.box('metal_claro', (0.04, 0.2, 0.025), (x, y, 0.21), rot=(0, 0, a), bevel=0.006)
        m.box('metal_claro', (0.16, 0.06, 0.008), (x, y + 0.02, 0.215), rot=(0, 0, a), bevel=0.0)
    # Defensa de corto alcance (dispara a lo que se acerca).
    m.pivot('turret', -0.3, -0.68, 0.2)
    m.cyl('blanco', 0.05, 0.08, (-0.3, -0.68, 0.2), seg=12, part='turret')
    m.sphere('blanco', 0.05, (-0.3, -0.68, 0.3), scale=(1, 1, 1.1), part='turret')
    m.tube('negro', (-0.3, -0.72, 0.26), (-0.3, -0.84, 0.26), r=0.01, seg=6, part='turret')
    return m


# ---------------------------------------------------------------------
# Aviones
# ---------------------------------------------------------------------
def fighter():
    """Caza furtivo: fuselaje facetado, alas en flecha, dos derivas inclinadas y toberas planas."""
    m = Model('fighter')
    m.hull('gris', [(0.42, 0.11, 0.07, 0.02, 0.1), (0.15, 0.14, 0.09, 0.0, 0.11), (-0.2, 0.09, 0.05, 0.02, 0.11),
                    (-0.42, 0.03, 0.02, 0.05, 0.08), (-0.52, 0.005, 0.005, 0.06, 0.065)], loc=(0, 0, 0.1))
    m.sphere('oro', 0.06, (0, -0.22, 0.215), scale=(0.7, 1.6, 0.6))
    for sx in (-1, 1):
        # Ala principal en flecha (trapecio aproximado con dos placas).
        m.box('gris', (0.36, 0.22, 0.02), (sx * 0.24, 0.12, 0.15), rot=(0, 0, sx * 0.5), bevel=0.0)
        m.box('gris', (0.18, 0.16, 0.018), (sx * 0.4, 0.24, 0.15), rot=(0, 0, sx * 0.5), bevel=0.0)
        # Estabilizador trasero.
        m.box('gris', (0.16, 0.1, 0.014), (sx * 0.15, 0.42, 0.16), rot=(0, 0, sx * 0.4), bevel=0.0)
        # Derivas inclinadas hacia afuera, con el color del imperio.
        m.box('EQUIPO', (0.012, 0.16, 0.13), (sx * 0.09, 0.32, 0.25), rot=(0, sx * 0.45, 0), bevel=0.0)
        # Toma de aire lateral y tobera.
        m.box('oscuro', (0.05, 0.12, 0.06), (sx * 0.1, -0.02, 0.15), rot=(0, 0, sx * 0.1), bevel=0.01)
        m.box('oscuro', (0.06, 0.05, 0.04), (sx * 0.04, 0.45, 0.17), bevel=0.008)
    m.box('luz', (0.05, 0.02, 0.025), (0, 0.48, 0.17), bevel=0.0)
    return m


def bomber():
    """Bombardero furtivo de ala volante: ala ancha en flecha, borde trasero en dientes y joroba central."""
    m = Model('bomber')
    for sx in (-1, 1):
        # Borde de ataque en flecha.
        m.box('oscuro', (0.78, 0.3, 0.03), (sx * 0.34, 0.08, 0.16), rot=(0, 0, sx * 0.56), bevel=0.0)
        m.box('oscuro', (0.4, 0.26, 0.028), (sx * 0.62, 0.3, 0.16), rot=(0, 0, sx * 0.56), bevel=0.0)
        # Dientes del borde trasero.
        m.box('oscuro', (0.22, 0.12, 0.025), (sx * 0.22, 0.36, 0.158), rot=(0, 0, -sx * 0.56), bevel=0.0)
        m.box('oscuro', (0.2, 0.12, 0.025), (sx * 0.5, 0.48, 0.158), rot=(0, 0, -sx * 0.56), bevel=0.0)
        # Tomas de aire arriba.
        m.box('negro', (0.08, 0.1, 0.03), (sx * 0.14, 0.06, 0.2), bevel=0.01)
        m.box('EQUIPO', (0.2, 0.05, 0.008), (sx * 0.48, 0.2, 0.182), rot=(0, 0, sx * 0.56), bevel=0.0)
    m.hull('oscuro', [(0.3, 0.1, 0.12, 0.0, 0.07), (0.0, 0.16, 0.18, 0.0, 0.1), (-0.25, 0.1, 0.12, 0.0, 0.08),
                      (-0.4, 0.02, 0.03, 0.01, 0.04)], loc=(0, 0, 0.14))
    m.box('vidrio', (0.1, 0.06, 0.03), (0, -0.18, 0.24), rot=(0.3, 0, 0), bevel=0.01)
    m.box('EQUIPO', (0.04, 0.3, 0.01), (0, 0.06, 0.245), bevel=0.0)
    return m


# ---------------------------------------------------------------------
# Edificios
# ---------------------------------------------------------------------
def apartment():
    """Apartamento (Casa nivel 2): edificio de tres pisos con balcones, ventanas encendidas y azotea."""
    m = Model('house_2')
    m.box('cultivo', (0.95, 0.9, 0.03), (0, 0.0, 0), bevel=0.01)
    m.box('blanco', (0.62, 0.5, 0.66), (0, 0.04, 0.03), bevel=0.02)
    for z in (0.25, 0.47):
        m.box('piedra_clara', (0.635, 0.515, 0.02), (0, 0.04, z), bevel=0.0)
    for f in range(3):
        z = 0.1 + f * 0.22
        for sx in (-1, 0, 1):
            m.box('luz', (0.1, 0.012, 0.09), (sx * 0.19, -0.212, z), bevel=0.0)
        for sy in (-1, 1):
            m.box('luz', (0.012, 0.09, 0.09), (0.312, 0.04 + sy * 0.12, z), bevel=0.0)
            m.box('luz', (0.012, 0.09, 0.09), (-0.312, 0.04 + sy * 0.12, z), bevel=0.0)
        if f > 0:
            for sx in (-1, 1):
                m.box('EQUIPO', (0.18, 0.08, 0.015), (sx * 0.19, -0.25, z - 0.04), bevel=0.0)
                m.box('metal_claro', (0.18, 0.008, 0.05), (sx * 0.19, -0.29, z - 0.012), bevel=0.0)
    m.box('madera', (0.11, 0.012, 0.13), (0, -0.212, 0.03), bevel=0.0)
    m.box('EQUIPO', (0.2, 0.1, 0.015), (0, -0.25, 0.17), bevel=0.0)
    m.box('oscuro', (0.64, 0.52, 0.03), (0, 0.04, 0.69), bevel=0.006)
    m.box('EQUIPO', (0.66, 0.54, 0.03), (0, 0.04, 0.66), bevel=0.004)
    m.cyl('metal_claro', 0.06, 0.1, (0.18, 0.15, 0.72), seg=12)
    m.box('metal', (0.1, 0.08, 0.06), (-0.16, 0.12, 0.72), bevel=0.01)
    m.box('piedra_clara', (0.14, 0.2, 0.012), (0, -0.33, 0.03), bevel=0.0)
    m.sphere('oliva', 0.08, (-0.36, 0.32, 0.08), scale=(1, 1, 0.8))
    m.sphere('cultivo', 0.07, (0.37, 0.33, 0.07), scale=(1, 1, 0.8))
    return m


def airport():
    """Aeropuerto militar: pista con marcas, hangar en arco, torre de control con radar y un caza."""
    m = Model('airport')
    m.hexprism('concreto', 0.95, 0.05)
    # Pista en diagonal con línea central y bordes.
    m.box('oscuro', (0.34, 1.6, 0.012), (-0.18, 0.0, 0.05), rot=(0, 0, 0.35), bevel=0.0)
    for k in range(6):
        y = -0.6 + k * 0.24
        m.box('blanco', (0.02, 0.1, 0.004), (-0.18 - math.tan(0.35) * y, y, 0.063), rot=(0, 0, 0.35), bevel=0.0)
    m.box('amarillo', (0.012, 1.5, 0.004), (-0.03, 0.0, 0.063), rot=(0, 0, 0.35), bevel=0.0)
    m.box('amarillo', (0.012, 1.5, 0.004), (-0.33, 0.0, 0.063), rot=(0, 0, 0.35), bevel=0.0)
    # Hangar en arco con portón.
    m.cyl('EQUIPO_OSC', 0.2, 0.46, (0.36, 0.1, 0.05), rot=(H, 0, 0), seg=14, smooth=False)
    m.box('concreto', (0.42, 0.46, 0.02), (0.36, 0.1, 0.04), bevel=0.0)
    m.box('oscuro', (0.28, 0.012, 0.16), (0.36, -0.13, 0.05), bevel=0.0)
    m.box('EQUIPO', (0.4, 0.04, 0.03), (0.36, -0.13, 0.24), bevel=0.0)
    # Torre de control.
    m.box('blanco', (0.12, 0.12, 0.4), (0.4, -0.42, 0.05), bevel=0.01)
    m.box('vidrio', (0.2, 0.2, 0.08), (0.4, -0.42, 0.45), bevel=0.02)
    m.box('oscuro', (0.22, 0.22, 0.02), (0.4, -0.42, 0.53), bevel=0.0)
    m.pivot('rotor', 0.4, -0.42, 0.6)
    m.box('oscuro', (0.2, 0.03, 0.06), (0.4, -0.42, 0.6), bevel=0.0, part='rotor')
    # Caza estacionado.
    m.box('metal_claro', (0.05, 0.26, 0.03), (-0.45, 0.42, 0.07), rot=(0, 0, 0.35), bevel=0.006)
    m.box('metal_claro', (0.22, 0.08, 0.01), (-0.45, 0.45, 0.075), rot=(0, 0, 0.35), bevel=0.0)
    return m


def antinuke():
    """Escudo antimisiles: radar en cúpula que gira y celdas verticales de interceptores."""
    m = Model('antinuke')
    m.hexprism('concreto', 0.6, 0.08)
    m.box('oliva_osc', (0.5, 0.36, 0.2), (-0.1, 0.12, 0.08), bevel=0.03)
    for ix in range(3):
        for iy in range(2):
            m.cyl('blanco', 0.05, 0.04, (-0.24 + ix * 0.14, 0.06 + iy * 0.13, 0.28), seg=10)
            m.cyl('oscuro', 0.038, 0.004, (-0.24 + ix * 0.14, 0.06 + iy * 0.13, 0.32), seg=10, base=False)
    m.box('EQUIPO', (0.5, 0.04, 0.03), (-0.1, -0.06, 0.26), bevel=0.0)
    m.cyl('metal_claro', 0.1, 0.16, (0.28, -0.24, 0.08), seg=12)
    m.pivot('rotor', 0.28, -0.24, 0.34)
    m.sphere('blanco', 0.16, (0.28, -0.24, 0.34), scale=(1, 1, 0.9), part='rotor')
    m.box('EQUIPO_OSC', (0.18, 0.012, 0.06), (0.28, -0.4, 0.36), bevel=0.0, part='rotor')
    return m


def aadef(level=1):
    """AIR DEFENSE rehecha: remolque con cuatro contenedores de misiles que apuntan al cielo y radar
    plano aparte. Nivel 4: además, un misil nuclear blanco sobre su erector."""
    m = Model('aadef' if level < 4 else 'aadef_4')
    m.hexprism('concreto', 0.55, 0.08)
    for (x, y) in [(-0.42, 0.28), (0.42, 0.28), (-0.42, -0.28), (0.42, -0.28)]:
        m.box('amarillo', (0.06, 0.06, 0.012), (x, y, 0.08), bevel=0.0)
    # Generador y cables.
    m.box('oliva_osc', (0.2, 0.26, 0.14), (0.3, 0.32, 0.08), bevel=0.02)
    m.box('oscuro', (0.16, 0.012, 0.08), (0.3, 0.188, 0.12), bevel=0.0)
    # Radar plano (gira).
    m.cyl('oscuro', 0.035, 0.16, (-0.32, 0.3, 0.08), seg=8)
    m.pivot('rotor', -0.32, 0.3, 0.28)
    m.box('EQUIPO_OSC', (0.3, 0.04, 0.22), (-0.32, 0.3, 0.28), rot=(-0.3, 0, 0), bevel=0.01, part='rotor')
    m.box('oscuro', (0.26, 0.012, 0.18), (-0.32, 0.276, 0.29), rot=(-0.3, 0, 0), bevel=0.0, part='rotor')
    # Lanzador giratorio: cuatro contenedores cuadrados inclinados.
    m.cyl('oscuro', 0.16, 0.08, (0.0, -0.12, 0.08), seg=14)
    m.pivot('turret', 0.0, -0.12, 0.16)
    m.box('oliva_osc', (0.34, 0.3, 0.06), (0.0, -0.12, 0.16), bevel=0.02, part='turret')
    th = -0.7
    for ix in range(2):
        for iz in range(2):
            x = -0.07 + ix * 0.14
            m.box('EQUIPO', (0.13, 0.5, 0.12), (x, -0.08, 0.26 + iz * 0.13), rot=(th, 0, 0), bevel=0.012, part='turret')
            m.cyl('blanco', 0.04, 0.006, (x, -0.29, 0.43 + iz * 0.13), rot=(H + th, 0, 0), seg=10, base=False, part='turret')
    for sx in (-1, 1):
        m.beam('oscuro', (sx * 0.15, 0.0, 0.18), (sx * 0.15, -0.02, 0.36), t=0.03, part='turret')
    if level >= 4:
        # Misil nuclear sobre su erector, con franja de aviso.
        m.beam('oscuro', (0.36, -0.3, 0.08), (0.36, -0.3, 0.2), t=0.06)
        m.tube('blanco', (0.36, -0.12, 0.22), (0.36, -0.12, 0.86), r=0.06, seg=14)
        m.cone('rojo', 0.06, 0.14, (0.36, -0.12, 0.86), seg=14)
        m.cyl('amarillo', 0.062, 0.05, (0.36, -0.12, 0.6), seg=14, base=False)
        m.cyl('negro', 0.062, 0.02, (0.36, -0.12, 0.66), seg=14, base=False)
        for k in range(4):
            a = k * H
            m.box('oscuro', (0.012, 0.08, 0.1), (0.36 + math.cos(a) * 0.07, -0.12 + math.sin(a) * 0.07, 0.24), rot=(0, 0, a), bevel=0.0)
        m.beam('oscuro', (0.45, -0.12, 0.08), (0.45, -0.12, 0.7), t=0.03)
    return m
