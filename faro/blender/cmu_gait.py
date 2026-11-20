"""Saca un ciclo de paso (caminar y correr) de la base de datos de captura de movimiento de CMU.

Uso: python faro/blender/cmu_gait.py <carpeta_con_bvh> faro/assets/anim/cmu_gait.json

Datos: CMU Graphics Lab Motion Capture Database (mocap.cs.cmu.edu), conversión BVH de B. Hahne
(cgspeed). Uso libre según su READMEFIRST. Archivos: 02_01 (caminar) y 35_17 (correr).

Para cada cuadro se miden, en el plano de la marcha, los ángulos de cadera y rodilla de cada pierna,
la inclinación del torso y la altura de la cadera. Se toma un ciclo completo (de un paso adelante de
la pierna izquierda al siguiente) y se reparte en 24 muestras. Los ángulos van en radianes; el rebote
y la zancada van en largos de pierna, para escalarlos a cualquier soldado.
"""
import json
import math
import os
import sys

import bpy  # primero bpy: agrega la carpeta de módulos de Blender (addon_utils)
import addon_utils  # noqa: E402
from mathutils import Vector  # noqa: E402

CLIPS = {'walk': '02_01.bvh', 'run': '35_17.bvh'}
SAMPLES = 24


def load(path):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    addon_utils.enable('io_anim_bvh', default_set=True)
    bpy.ops.import_anim.bvh(filepath=path, global_scale=1.0, rotate_mode='NATIVE', axis_forward='-Z', axis_up='Y',
                            update_scene_fps=True, update_scene_duration=True)
    arm = [o for o in bpy.data.objects if o.type == 'ARMATURE'][0]
    return arm


def joints(arm, frame):
    bpy.context.scene.frame_set(frame)
    mw = arm.matrix_world
    pb = arm.pose.bones
    head = lambda n: mw @ pb[n].head
    return {
        'hips': head('Hips'), 'chest': head('Spine1'),
        'hipL': head('LeftUpLeg'), 'kneeL': head('LeftLeg'), 'ankleL': head('LeftFoot'),
        'hipR': head('RightUpLeg'), 'kneeR': head('RightLeg'), 'ankleR': head('RightFoot'),
    }


def angle_from_down(d, fwd, up):
    """Ángulo de un segmento respecto de la vertical, en el plano de la marcha (+ = hacia adelante)."""
    return math.atan2(d.dot(fwd), -d.dot(up))


def extract(path):
    arm = load(path)
    scene = bpy.context.scene
    f0, f1 = int(scene.frame_start), int(scene.frame_end)
    frames = [joints(arm, f) for f in range(f0, f1 + 1)]
    up = Vector((0, 0, 1))
    move = frames[-1]['hips'] - frames[0]['hips']
    move.z = 0
    fwd = move.normalized()
    leg = sum(((j['hipL'] - j['kneeL']).length + (j['kneeL'] - j['ankleL']).length) for j in frames) / len(frames)
    rows = []
    for j in frames:
        r = {}
        for s in ('L', 'R'):
            th = angle_from_down(j['knee' + s] - j['hip' + s], fwd, up)
            sh = angle_from_down(j['ankle' + s] - j['knee' + s], fwd, up)
            r['hip' + s] = th
            r['knee' + s] = th - sh  # flexión de rodilla (+ = el pie va hacia atrás)
        # Inclinación del torso (+ = hacia adelante).
        r['pitch'] = math.atan2((j['chest'] - j['hips']).dot(fwd), (j['chest'] - j['hips']).dot(up))
        r['y'] = j['hips'].z
        r['h'] = j['hips'].dot(fwd)
        rows.append(r)
    # Ciclo: entre dos máximos seguidos del ángulo de la cadera izquierda (pierna más adelante).
    hl = [r['hipL'] for r in rows]
    # Máximo dentro de ±20 cuadros (1/6 s): así no se cuentan los temblores dentro de un mismo paso.
    W = 20
    peaks = [i for i in range(W, len(hl) - W) if hl[i] >= max(hl[i - W:i + W + 1])]
    clean = []
    for p in peaks:
        if not clean or p - clean[-1] > 30:
            clean.append(p)
    if len(clean) < 2:
        raise RuntimeError(f'No hay un ciclo completo en {path}: picos {clean}')
    a, b = clean[0], clean[1]
    fps = 1.0 / bpy.context.scene.render.fps_base * bpy.context.scene.render.fps
    frame_time = 1.0 / fps
    # El importador ajusta los fps de la escena al archivo; si no, se usa 120 (CMU).
    if abs(fps - 24) < 0.01:
        frame_time = 1.0 / 120
    out = {k: [] for k in ('hipL', 'kneeL', 'hipR', 'kneeR', 'pitch', 'bob')}
    ys = [rows[i]['y'] for i in range(a, b + 1)]
    ymean = sum(ys) / len(ys)
    pmean = sum(rows[i]['pitch'] for i in range(a, b + 1)) / (b - a + 1)
    for k in range(SAMPLES):
        t = a + (b - a) * k / SAMPLES
        i = int(t)
        f = t - i
        lerp = lambda key: rows[i][key] * (1 - f) + rows[min(i + 1, len(rows) - 1)][key] * f
        for key in ('hipL', 'kneeL', 'hipR', 'kneeR'):
            out[key].append(round(lerp(key), 4))
        out['pitch'].append(round(lerp('pitch') - pmean * 0.5, 4))
        out['bob'].append(round((lerp('y') - ymean) / leg, 4))
    stride = (rows[b]['h'] - rows[a]['h']) / leg
    return {'dur': round((b - a) * frame_time, 4), 'stride': round(stride, 4), 'frames': [a, b], **out}


def main():
    src, dst = sys.argv[-2], sys.argv[-1]
    data = {'source': 'CMU Graphics Lab Motion Capture Database (mocap.cs.cmu.edu), conversión BVH de B. Hahne',
            'files': CLIPS, 'samples': SAMPLES}
    for name, f in CLIPS.items():
        data[name] = extract(os.path.join(src, f))
        d = data[name]
        print(name, 'ciclo', d['frames'], 'dur', d['dur'], 's · zancada', d['stride'], 'piernas · cadera',
              round(min(d['hipL']), 2), round(max(d['hipL']), 2), '· rodilla max', round(max(d['kneeL']), 2),
              '· rebote', round(min(d['bob']), 3), round(max(d['bob']), 3))
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    with open(dst, 'w') as fh:
        json.dump(data, fh, separators=(',', ':'))
    print('guardado', dst, os.path.getsize(dst), 'bytes')


main()
