"""Exporta solo el Núcleo nuevo de la v1.5 (core_1, core_2 y core_3)."""
import os
import sys

import bpy

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from models_v15 import core15  # noqa: E402

out_dir = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else 'models')
os.makedirs(out_dir, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
for lv in (1, 2, 3):
    m = core15(lv)
    path = os.path.join(out_dir, m.name + '.glb')
    m.export(path)
    print(f'[Blender] ✅ {m.name}: {os.path.getsize(path) / 1024:.0f} KB')
