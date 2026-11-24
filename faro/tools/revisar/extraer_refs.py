"""Saca las imágenes de los modelos del usuario del PDF «Faro_de_Ambar_Juego_y_PRD_v1_8.pdf» (páginas 3-14).

Uso:  python3 extraer_refs.py <ruta del PDF> [carpeta de salida]
Guarda una imagen JPG por modelo con la clave del juego (builder.jpg, tank.jpg…) y las dos escenas.
Necesita pdfplumber, Pillow y pdftoppm (poppler).
"""
import os
import subprocess
import sys
import tempfile

import pdfplumber
from PIL import Image

# Página del PDF → claves de los modelos en el orden de la página (izquierda a derecha, arriba a abajo).
PAGES = {
    3: ['builder', 'engineer', 'rifle'],
    4: ['shotgun', 'ranger', 'sniper'],
    5: ['breaker', 'hunter', 'rocket'],
    6: ['tank', 'aa'],
    7: ['speedboat', 'boatEng', 'barge'],
    8: ['destroyer', 'sub'],
    9: ['heli', 'apache'],
    10: ['core', 'farm', 'wind', 'house', 'pump', 'rig'],
    11: ['barracks', 'factory', 'harbor', 'helipad'],
    12: ['wall', 'turret', 'aadef'],
    13: ['escena-base'],
    14: ['escena-costa'],
}
RES = 110  # puntos por pulgada al recortar


def main() -> None:
    pdf_path = sys.argv[1]
    out = sys.argv[2] if len(sys.argv) > 2 else os.path.join(os.path.dirname(__file__), '..', '..', 'docs', 'roblox', 'modelos-0.2')
    os.makedirs(out, exist_ok=True)
    tmp = tempfile.mkdtemp()
    with pdfplumber.open(pdf_path) as pdf:
        for pn, keys in PAGES.items():
            pg = pdf.pages[pn - 1]
            imgs = sorted(pg.images, key=lambda i: (round(i['top'] / 40), i['x0']))
            if len(imgs) < len(keys):
                print(f'[Refs] ❌ página {pn}: {len(imgs)} imágenes, se esperaban {len(keys)}')
                continue
            base = os.path.join(tmp, f'p{pn}')
            subprocess.run(['pdftoppm', '-f', str(pn), '-l', str(pn), '-r', str(RES), '-singlefile', '-png', pdf_path, base], check=True)
            page = Image.open(base + '.png').convert('RGB')
            k = RES / 72.0
            for key, im in zip(keys, imgs):
                box = (int(im['x0'] * k), int(im['top'] * k), int(im['x1'] * k), int(im['bottom'] * k))
                crop = page.crop(box)
                if crop.width > 900:
                    crop = crop.resize((900, int(crop.height * 900 / crop.width)), Image.LANCZOS)
                crop.save(os.path.join(out, key + '.jpg'), quality=82)
            print(f'[Refs] ✅ página {pn}: {", ".join(keys)}')


if __name__ == '__main__':
    main()
