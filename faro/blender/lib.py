"""Herramientas para modelar Faro de Ámbar con Python dentro de Blender.

Cada modelo se arma con piezas simples (cajas biseladas, cilindros, conos, cascos de barco) que se
agrupan en partes: 'main' y, si el modelo se anima, 'turret', 'rotor', 'blades', 'rocker' o
'crystal'. Cada parte se exporta como un objeto con su origen en el pivote de giro.

Convenciones (Blender, Z arriba): el frente del modelo mira hacia -Y, que en el juego (glTF, Y
arriba) es +Z. Una casilla mide 1 de radio. Los materiales llamados EQUIPO y EQUIPO_OSC se pintan
en el juego con el color de cada jugador.
"""
import math

import bmesh
import bpy
from mathutils import Euler, Matrix, Vector

MATS = {}


def mat(name, rgb, rough=0.75, metal=0.0):
    """Material con color base (valores 0-1 tal cual, como la paleta del juego)."""
    if name in MATS:
        return name
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (rgb[0], rgb[1], rgb[2], 1.0)
    bsdf.inputs['Roughness'].default_value = rough
    bsdf.inputs['Metallic'].default_value = metal
    MATS[name] = m
    return name


def hexrgb(h):
    return ((h >> 16 & 255) / 255, (h >> 8 & 255) / 255, (h & 255) / 255)


# Paleta (misma familia de colores que el juego).
P = {
    'EQUIPO': 0xffffff, 'EQUIPO_OSC': 0x888888,
    'piedra': 0x8f8b82, 'piedra_clara': 0xa9a59b, 'oscuro': 0x3b4048, 'metal': 0x6e7782,
    'metal_claro': 0x9aa3ad, 'madera': 0x8b5d3c, 'madera_clara': 0xb07d52, 'blanco': 0xefece4,
    'oliva': 0x5d6d3b, 'oliva_osc': 0x46532c, 'piel': 0xe0b089, 'amarillo': 0xf1c232, 'trigo': 0xc9a54b,
    'cultivo': 0x8dbf3d, 'ladrillo': 0xb3653b, 'rojo': 0xd94141, 'gris': 0x8b939c, 'negro': 0x24272c,
    'naranja': 0xf08a24, 'concreto': 0xb5b2aa, 'vidrio': 0x9fd6ee, 'oro': 0xffcf3a, 'agua': 0x4aa3c8,
    'panel': 0x1f3a63, 'arena': 0xc9b27a, 'tierra': 0x7a5a3a, 'goma': 0x1b1d20, 'cuerda': 0xc9b47a,
    'luz': 0xffd76a, 'camo': 0x2f3438, 'camo2': 0x4a5056, 'mascara': 0xf2c230, 'blanco_sucio': 0xd8d4c8,
}


def m_(name):
    return mat(name, hexrgb(P[name]), rough=0.45 if name in ('metal', 'metal_claro', 'vidrio') else 0.75,
               metal=0.3 if name in ('metal', 'metal_claro') else 0.0)


class Model:
    def __init__(self, name):
        self.name = name
        self.parts = {}
        self.pivots = {}
        self.mats = {}

    def _bm(self, part):
        if part not in self.parts:
            self.parts[part] = bmesh.new()
            self.mats[part] = []
            self.pivots.setdefault(part, Vector((0, 0, 0)))
        return self.parts[part]

    def pivot(self, part, x, y, z):
        self.pivots[part] = Vector((x, y, z))
        self._bm(part)

    def _mi(self, part, matname):
        m_(matname) if matname in P else None
        lst = self.mats[part]
        if matname not in lst:
            lst.append(matname)
        return lst.index(matname)

    def _merge(self, part, src, matname, matrix, smooth):
        dst = self._bm(part)
        mi = self._mi(part, matname)
        piv = self.pivots[part]
        full = Matrix.Translation(-piv) @ matrix
        vmap = {}
        for v in src.verts:
            vmap[v] = dst.verts.new(full @ v.co)
        for f in src.faces:
            nf = dst.faces.new([vmap[v] for v in f.verts])
            nf.material_index = mi
            nf.smooth = smooth
        src.free()

    @staticmethod
    def _xf(loc, rot, scale=(1, 1, 1)):
        return Matrix.LocRotScale(Vector(loc), Euler(rot).to_quaternion(), Vector(scale))

    def box(self, matname, size, loc=(0, 0, 0), rot=(0, 0, 0), bevel=0.02, part='main', base=True):
        """Caja biselada. Con base=True, loc[2] es la cara de abajo."""
        sx, sy, sz = size
        t = bmesh.new()
        bmesh.ops.create_cube(t, size=1.0)
        bmesh.ops.scale(t, vec=Vector((sx, sy, sz)), verts=t.verts)
        b = min(bevel, sx * 0.45, sy * 0.45, sz * 0.45)
        # Las piezas chicas van sin bisel: casi no se nota y el archivo pesa mucho menos.
        if b > 0.001 and min(sx, sy, sz) >= 0.05:
            bmesh.ops.bevel(t, geom=list(t.edges) + list(t.verts), offset=b, segments=1, affect='EDGES', profile=0.5)
        x, y, z = loc
        self._merge(part, t, matname, self._xf((x, y, z + (sz / 2 if base else 0)), rot), False)

    def cyl(self, matname, r, h, loc=(0, 0, 0), rot=(0, 0, 0), seg=16, r2=None, part='main', base=True, smooth=True):
        """Cilindro (o tronco de cono con r2). Con base=True, loc[2] es la base."""
        t = bmesh.new()
        bmesh.ops.create_cone(t, cap_ends=True, cap_tris=False, segments=seg, radius1=r,
                              radius2=r if r2 is None else r2, depth=h)
        x, y, z = loc
        off = Matrix.Translation((0, 0, h / 2 if base else 0))
        self._merge(part, t, matname, self._xf((x, y, z), rot) @ off, smooth)

    def cone(self, matname, r, h, loc=(0, 0, 0), rot=(0, 0, 0), seg=16, part='main', smooth=False):
        self.cyl(matname, r, h, loc, rot, seg, r2=0.0001, part=part, smooth=smooth)

    def sphere(self, matname, r, loc=(0, 0, 0), scale=(1, 1, 1), part='main', seg=14):
        t = bmesh.new()
        bmesh.ops.create_uvsphere(t, u_segments=seg, v_segments=max(6, seg // 2), radius=r)
        self._merge(part, t, matname, self._xf(loc, (0, 0, 0), scale), True)

    def ico(self, matname, r, loc=(0, 0, 0), scale=(1, 1, 1), part='main', sub=1):
        t = bmesh.new()
        bmesh.ops.create_icosphere(t, subdivisions=sub, radius=r)
        self._merge(part, t, matname, self._xf(loc, (0, 0, 0), scale), False)

    def hexprism(self, matname, r, h, loc=(0, 0, 0), part='main', bevel=0.02):
        """Prisma hexagonal alineado con las casillas del juego."""
        t = bmesh.new()
        bmesh.ops.create_cone(t, cap_ends=True, cap_tris=False, segments=6, radius1=r, radius2=r, depth=h)
        if bevel > 0:
            bmesh.ops.bevel(t, geom=list(t.edges) + list(t.verts), offset=bevel, segments=1, affect='EDGES', profile=0.5)
        x, y, z = loc
        self._merge(part, t, matname, self._xf((x, y, z + h / 2), (0, 0, math.pi / 6)), False)

    def wedge(self, matname, size, loc=(0, 0, 0), rot=(0, 0, 0), part='main'):
        """Tejado a dos aguas: largo en X, ancho en Y, alto en Z, base en loc[2]."""
        lx, ly, lz = size
        t = bmesh.new()
        hx, hy = lx / 2, ly / 2
        vs = [t.verts.new(c) for c in [(-hx, -hy, 0), (hx, -hy, 0), (hx, hy, 0), (-hx, hy, 0), (-hx, 0, lz), (hx, 0, lz)]]
        for f in [(0, 1, 2, 3), (0, 4, 5, 1), (3, 2, 5, 4), (0, 3, 4), (1, 5, 2)]:
            t.faces.new([vs[i] for i in f])
        bmesh.ops.recalc_face_normals(t, faces=t.faces)
        self._merge(part, t, matname, self._xf(loc, rot), False)

    @staticmethod
    def _between(p1, p2):
        a, b = Vector(p1), Vector(p2)
        d = b - a
        q = Vector((0, 0, 1)).rotation_difference(d.normalized())
        return (a + b) / 2, q, d.length

    def beam(self, matname, p1, p2, t=0.02, part='main'):
        """Barra de sección cuadrada entre dos puntos (barandas, grúas, celosías, patines)."""
        c, q, length = self._between(p1, p2)
        tm = bmesh.new()
        bmesh.ops.create_cube(tm, size=1.0)
        bmesh.ops.scale(tm, vec=Vector((t, t, length)), verts=tm.verts)
        self._merge(part, tm, matname, Matrix.LocRotScale(c, q, Vector((1, 1, 1))), False)

    def tube(self, matname, p1, p2, r=0.02, seg=10, part='main', r2=None):
        """Cilindro entre dos puntos (tubos de lancha, antenas, cañones)."""
        c, q, length = self._between(p1, p2)
        tm = bmesh.new()
        bmesh.ops.create_cone(tm, cap_ends=True, cap_tris=False, segments=seg, radius1=r,
                              radius2=r if r2 is None else r2, depth=length)
        self._merge(part, tm, matname, Matrix.LocRotScale(c, q, Vector((1, 1, 1))), True)

    def hull(self, matname, sections, loc=(0, 0, 0), part='main', smooth=False):
        """Casco de barco a partir de secciones (y, medio_ancho_cubierta, medio_ancho_fondo, z_fondo, z_cubierta).

        Las secciones van de popa (y mayor) a proa (y menor, el frente)."""
        t = bmesh.new()
        rings = []
        for (y, wt, wb, zb, zt) in sections:
            rings.append([t.verts.new(c) for c in [(-wb, y, zb), (wb, y, zb), (wt, y, zt), (-wt, y, zt)]])
        for a, b in zip(rings, rings[1:]):
            for i in range(4):
                j = (i + 1) % 4
                try:
                    t.faces.new([a[i], a[j], b[j], b[i]])
                except ValueError:
                    pass
        t.faces.new(list(reversed(rings[0])))
        t.faces.new(rings[-1])
        bmesh.ops.recalc_face_normals(t, faces=t.faces)
        self._merge(part, t, matname, self._xf(loc, (0, 0, 0)), smooth)

    # ---------- exportación ----------
    def export(self, path):
        for o in list(bpy.data.objects):
            bpy.data.objects.remove(o, do_unlink=True)
        for me in list(bpy.data.meshes):
            bpy.data.meshes.remove(me)
        scene = bpy.context.scene
        for part, bm in self.parts.items():
            me = bpy.data.meshes.new(f'{self.name}_{part}')
            bm.to_mesh(me)
            bm.free()
            for mname in self.mats[part]:
                me.materials.append(MATS[mname])
            ob = bpy.data.objects.new(part, me)
            ob.location = self.pivots[part]
            scene.collection.objects.link(ob)
        bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', export_apply=True, export_yup=True,
                                  use_selection=False, export_materials='EXPORT', export_texcoords=False,
                                  export_normals=False, export_cameras=False, export_lights=False)
