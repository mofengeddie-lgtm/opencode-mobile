"""v1.9: arma la versión para Poki y la deja lista para subir.

Uso: python3 faro/tools/poki/empaquetar.py
  1) node faro/build.mjs --poki  →  faro/poki/index.html (todo adentro + script del SDK de Poki)
  2) faro/poki/faro-poki.zip con index.html en la raíz (es lo que se sube a Poki for Developers).
"""
import os
import subprocess
import sys
import zipfile

FARO = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
subprocess.run(['node', os.path.join(FARO, 'build.mjs'), '--poki'], check=True)
src = os.path.join(FARO, 'poki', 'index.html')
out = os.path.join(FARO, 'poki', 'faro-poki.zip')
with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as z:
    z.write(src, 'index.html')
print(f'[Poki] ✅ {out} ({os.path.getsize(out) / 1048576:.2f} MB; index.html adentro: {os.path.getsize(src) / 1048576:.2f} MB)')
sys.exit(0)
