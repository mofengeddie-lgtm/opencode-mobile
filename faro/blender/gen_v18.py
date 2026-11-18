"""Exporta los modelos de la v1.8 (todas las tropas y edificios del catálogo del usuario que faltaban).

Uso: python3 gen_v18.py <carpeta de salida> [nombre ...]   (bpy de Blender como módulo de Python)
Con nombres, exporta solo esos modelos.
"""
import os
import sys

import bpy

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from models_v18 import ALL  # noqa: E402

out_dir = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else 'models')
only = set(sys.argv[2:])
os.makedirs(out_dir, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
ok = 0
for fn in ALL:
    try:
        m = fn()
    except Exception as err:  # un modelo con error no frena a los demás
        print(f'[Blender] ❌ {fn.__name__}: {err}')
        continue
    if only and m.name not in only:
        continue
    path = os.path.join(out_dir, m.name + '.glb')
    m.export(path)
    ok += 1
    print(f'[Blender] ✅ {m.name}: {os.path.getsize(path) / 1024:.0f} KB')
print(f'[Blender] {ok} modelos')
