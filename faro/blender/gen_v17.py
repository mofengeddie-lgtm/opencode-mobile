"""Exporta los modelos de la v1.7: Lanzador DF-17 (launcher), Lanzador nuclear móvil (nukelauncher) y el primer
lote de equipo nuevo: Dron de ataque (drone), Dron kamikaze (fpv), Lanzacohetes múltiple (mlrs) y Lancha misilera."""
import os
import sys

import bpy

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from models_v17 import attack_drone, df17, fpv_drone, missile_boat, mlrs, nuke_launcher  # noqa: E402

out_dir = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else 'models')
os.makedirs(out_dir, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
for m in (df17(), nuke_launcher(), attack_drone(), fpv_drone(), mlrs(), missile_boat()):
    path = os.path.join(out_dir, m.name + '.glb')
    m.export(path)
    print(f'[Blender] ✅ {m.name}: {os.path.getsize(path) / 1024:.0f} KB')
